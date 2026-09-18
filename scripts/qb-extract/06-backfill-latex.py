#!/usr/bin/env python3
"""06-backfill-latex.py —— 把 VLM 识别出的 LaTeX 回填进 exam_questions。

为什么需要单独回填 (根因)
------------------------
05-ingest 用 `media_stored[*].sha256` 去 out/vlm/ 里查结果, 结果是
**image_descriptions 有值而 latex_formulas 全空**。实测定位:

  media_stored 侧唯一 sha256 : 80571
  out/vlm 侧                : 57434
  交集                      : 22298  —— 且**全部是 kind='figure'、latex 为空的条目**

原因是两条管线对「同一张公式」哈希的**不是同一份字节**:
  · 02-extract 的 media_stored 走 docx/OLE 路径 (out/media/)
  · 04-vlm-formulas 走 LibreOffice 渲染的 HTML 图片 (out/media-html/)
MathType/Equation3.0 是 OLE 对象, 只有 LibreOffice 能在文档上下文里把它渲染出来,
两条路的渲染字节不同 → sha256 天然不通。图 (`<a:blip>`) 两边字节一致, 所以图能对上。

正确关联方式
------------
04 在 out/html/<level>/<subject>/<year>/<name>.json 的 items[] 里记录了
`question_number` (归属题号, 用上下文题号锚点推得)。于是:

    html items (kind='formula', 有 question_number)
      → vlm[sha256].latex
      → exam_papers.paper_file_path 反查 paper_id
      → exam_questions (paper_id, question_number) 定位
      → 追加写入 latex_formulas

已知上限 (实测): 77830 个 formula item 里只有 9785 个拿到了归属题号,
其中 7058 个有 latex —— 锚点法偏弱, 这是当前能回填的天花板。

用法:
  python3 06-backfill-latex.py --dry-run     # 只报数
  python3 06-backfill-latex.py               # 真写
"""
import argparse
import asyncio
import collections
import glob
import json
import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BASE = REPO / 'database' / 'preflight' / 'qb-extract' / 'out'
HTML = BASE / 'html'
VLM = BASE / 'vlm'

VALID_Q_TYPES = {'choice', 'solve', 'fill', 'unknown'}


def log(*a):
    print(*a, flush=True)


def stem(p):
    """去掉扩展名的文件主干。

    必须用 stem 而不是 basename: exam_papers.paper_file_path 存的是**转换后的
    docx 缓存路径** (…/docx-cache/gaokao/math/2019/xxx.docx), 而 04 的 html 里
    source_path 记的是**原始路径** (…/incoming/gaokao/math/2019/xxx.doc)。
    两者主干相同、扩展名不同, 直接比 basename 会让全部 .doc 卷 (公式最多的那批) 落空。
    """
    return os.path.splitext(os.path.basename(p or ''))[0]


def load_vlm():
    """sha256(64位) -> {latex, semantic, kind}"""
    idx = {}
    for f in glob.glob(str(VLM / '*.json')):
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception:
            continue
        s = d.get('sha256')
        if s:
            idx[s] = d
    return idx


def collect(level='all'):
    """返回 [(basename, paper_no, [(qno, latex, semantic), ...]), ...]

    level: 'all' 或 'gaokao' / 'zhongkao' —— 只处理已入库的那一批。
    """
    vlm = load_vlm()
    log(f'VLM 缓存 {len(vlm)} 条')
    out = []
    stats = collections.Counter()
    for f in glob.glob(str(HTML / '**' / '*.json'), recursive=True):
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception:
            stats['html 解析失败'] += 1
            continue
        items = d.get('items') or []
        for it in items:
            if it.get('kind') != 'formula':
                continue
            stats['formula item'] += 1
            qn = it.get('question_number')
            if qn is None:
                stats['无归属题号(跳过)'] += 1
                continue
            v = vlm.get(it.get('sha256')) or {}
            if not v.get('latex'):
                stats['无 latex(跳过)'] += 1
                continue
            stats['可回填'] += 1
            out.append((stem(d.get('source_path') or f), qn,
                        v.get('latex'), v.get('semantic')))
    return out, stats


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    args = ap.parse_args()
    if not args.dsn:
        log('!! 需要 DATABASE_URL'); sys.exit(2)

    rows, stats = collect()
    log(f'\n采集: {dict(stats)}')
    if not rows:
        log('没有可回填的公式'); return

    import asyncpg
    conn = await asyncpg.connect(args.dsn)
    try:
        # 卷定位: 用 paper_file_path 的 basename 反查 (与 html 的 source_path 同源)
        pre = await conn.fetch(
            "SELECT id, paper_file_path FROM exam_papers WHERE paper_uid IS NOT NULL")
        by_name = {}
        for r in pre:
            by_name[stem(r['paper_file_path'])] = r['id']
        log(f'库内新卷 {len(pre)} 份')

        grouped = collections.OrderedDict()
        miss_paper = collections.Counter()
        for name, qn, latex, sem in rows:
            pid = by_name.get(name)
            if not pid:
                miss_paper[name] += 1
                continue
            grouped.setdefault(pid, []).append((qn, latex, sem))
        log(f'卷命中 {len(grouped)} 份, 未命中 {len(miss_paper)} 个文件名')

        upd, ambiguous, miss_q = 0, 0, 0
        for pid, items in grouped.items():
            per_q = collections.defaultdict(list)
            for qn, latex, sem in items:
                per_q[qn].append((latex, sem))
            for qn, vals in per_q.items():
                # 一卷可能多节共用同一题号 (migration 022): 优先 main, 否则最小节;
                # 命中的多行都算「同一题号」, 只写优先那一行, 其余计入 ambiguous。
                cand = await conn.fetch(
                    "SELECT id, question_section FROM exam_questions "
                    "WHERE paper_id=$1 AND question_number=$2 AND archive_state='active' "
                    "ORDER BY CASE WHEN question_section='main' THEN 0 ELSE 1 END, question_section",
                    pid, qn)
                if not cand:
                    miss_q += 1
                    continue
                if len(cand) > 1:
                    ambiguous += 1
                row = cand[0]
                lats = [v[0] for v in vals]
                sems = [v[1] for v in vals if v[1]]
                try:
                    if args.dry_run:
                        upd += 1
                    else:
                        await conn.execute(
                            "UPDATE exam_questions SET "
                            "latex_formulas = $2, formula_semantics = COALESCE($3, formula_semantics), "
                            "has_formula = true, updated_at = now() WHERE id = $1",
                            row['id'],
                            json.dumps(lats, ensure_ascii=False),
                            '\n'.join(sems) if sems else None)
                        upd += 1
                except Exception as e:
                    log(f'   写失败 qid={row["id"]} q{qn}: {type(e).__name__}: {e}')
        log(f'\n=== {"DRY-RUN (未写)" if args.dry_run else "已写入"} ===')
        log(f'更新题目 {upd} 道 | 题号在库中找不到 {miss_q} 个 | 题号多节歧义(取 main) {ambiguous} 个')
        if miss_paper:
            log('未命中卷的文件名 (前 8):')
            for n, c in miss_paper.most_common(8):
                log(f'   {c:>5} 次  {n[:70]}')
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
