#!/usr/bin/env python3
"""07-formulas-table.py —— 把 exam_questions.latex_formulas 列展开进 question_formulas 表。

背景
----
05-ingest / 06-backfill 只写了 `exam_questions.latex_formulas` **列**
(JSON 数组), 归一化的 `question_formulas` **表**一直是 0 行。

本脚本补这一层, 让公式可以被按行检索/挂 KP/做统计, 而不是只能整块读一个 JSON。

语义描述怎么对齐
----------------
不按位置对齐。06-backfill 写列时用的是
    lats = [v[0] for v in vals]           # 每个公式的 latex
    sems = [v[1] for v in vals if v[1]]   # 只收有语义的那些
两者长度可能不同, 按 zip 会错位。改成从 VLM 缓存建 **latex 字符串 → semantic** 的
精确映射: 同一个 LaTeX 串在全库的语义描述应当一致, 这样对齐是确定的。

幂等: 每个 question_id 先删后写; 重跑不产生重复行。

用法:
  python3 07-formulas-table.py --dry-run
  python3 07-formulas-table.py
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
VLM = REPO / 'database' / 'preflight' / 'qb-extract' / 'out' / 'vlm'


def log(*a):
    print(*a, flush=True)


def load_latex_semantic():
    """latex 字符串 -> semantic 描述 (取全库一致值)。"""
    m = {}
    n = 0
    for f in glob.glob(str(VLM / '*.json')):
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception:
            continue
        lx, sem = d.get('latex'), d.get('semantic')
        if lx and sem:
            n += 1
            m.setdefault(lx.strip(), sem.strip())
    log(f'VLM 里 (latex, semantic) 对: {n} 条, 去重后 latex {len(m)} 个')
    return m


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    args = ap.parse_args()
    if not args.dsn:
        log('!! 需要 DATABASE_URL'); sys.exit(2)

    ls = load_latex_semantic()

    import asyncpg
    conn = await asyncpg.connect(args.dsn)
    try:
        rows = await conn.fetch(
            "SELECT id, latex_formulas FROM exam_questions "
            "WHERE latex_formulas IS NOT NULL AND archive_state='active'")
        log(f'含 latex_formulas 列的题: {len(rows)}')

        stats = collections.Counter()
        plan = []
        for r in rows:
            try:
                lats = json.loads(r['latex_formulas'])
            except Exception:
                stats['JSON 解析失败'] += 1
                continue
            if not isinstance(lats, list):
                stats['不是数组'] += 1
                continue
            clean = [str(x).strip() for x in lats if x and str(x).strip()]
            if not clean:
                stats['空数组'] += 1
                continue
            plan.append((r['id'], clean))
            stats['题'] += 1
            stats['公式'] += len(clean)

        log(f'计划: {dict(stats)}')
        if not plan:
            log('没有可展开的题'); return

        # 预演一下语义命中率
        hit = sum(1 for _, cl in plan for x in cl if x in ls)
        log(f'语义可对上 {hit} / {stats["公式"]} '
            f'({hit / max(1, stats["公式"]) * 100:.1f}%)')

        written = 0
        for qid, clean in plan:
            if args.dry_run:
                written += len(clean)
                continue
            async with conn.transaction():
                await conn.execute('DELETE FROM question_formulas WHERE question_id=$1', qid)
                await conn.executemany(
                    'INSERT INTO question_formulas '
                    '(question_id, latex, semantic_description, sort_order) VALUES ($1,$2,$3,$4)',
                    [(qid, x, ls.get(x), i) for i, x in enumerate(clean)])
            written += len(clean)

        log(f'\n=== {"DRY-RUN (未写)" if args.dry_run else "已写入"} ===')
        log(f'公式行 {written} 条, 覆盖 {stats["题"]} 道题')
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
