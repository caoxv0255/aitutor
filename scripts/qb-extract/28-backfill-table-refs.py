#!/usr/bin/env python3
"""28-backfill-table-refs.py —— 把 ⟦TABLE:n⟧ 占位符确定性映射到 question_tables (路线图 P1)。

为什么需要
----------
`⟦TABLE:n⟧` 的 n 是 qbx 对 `body.iter(w:tbl)` **含空表**的顺序编号; 而
`question_tables.sort_order` 是 `22-extract-tables.py` 对**非空表**重新枚举。
两者对空表处理不同 → 实测 386 卷里 4 卷计数不一致 (如 paper 3832 qbx=2/qt=1),
所以 `(paper_id, sort_order=n)` **会错位**, 不能拿来当映射。

做法: **内容签名**, 与 sort_order 无关
---------------------------------------
  1. 对每卷重跑 `extract_paper(table_aware=True)` 取 `tables` (下标即 token n);
  2. 对 `question_tables` 每行**重组成全行** (data_table 且 headers 非空 → `[headers]+rows`);
  3. 两边都做归一化签名: 逐格去 `⟦…⟧` 占位符 + 去所有空白; **整行归一后为空则丢弃**
     (qbx 会保留只含图片/公式的行, 22 不存这类行 —— 不丢则签名必不匹配);
  4. 同签名的多张表按**文档序**对齐 (第 j 个 qbx 出现 ↔ 第 j 个 sort_order)。

缺失不静默: 解析不到时写 `{"table_id": null, "missing": <reason>}`:
  - `image_only_table` —— 该"表"其实只含图片/公式 (route A 把图片当表的已知缺陷, 见报告)
  - `empty_table`      —— 整表无任何单元格文本
  - `ambiguous`        —— 同签名多解且文档序也放不下
  - `no_asset`         —— 表在 qbx 里存在但 question_tables 无对应行

幂等 & 安全
-----------
  · 默认 dry-run; `--apply` 才写库。
  · 写前把旧 `table_refs` 备份到 `logs/table-refs-backup-<ts>.json`。
  · 值未变的行不 UPDATE (重跑 0 行)。
  · 只写 `exam_questions.table_refs`, 不动任何其他字段。

用法
----
  python3 28-backfill-table-refs.py                 # dry-run, 只报数
  python3 28-backfill-table-refs.py --apply         # 写库 (先备份)
  python3 28-backfill-table-refs.py --limit 50      # 只跑前 N 卷
"""
import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LOGS = REPO / 'database' / 'preflight' / 'qb-extract' / 'logs'
DOCX_CACHE = REPO / 'database' / 'preflight' / 'qb-extract' / 'docx-cache'
sys.path.insert(0, str(Path(__file__).resolve().parent))
import qbx  # noqa: E402

BATCH_DATE = '2026-09-17'
TOKEN_RE = re.compile(r'⟦TABLE:(\d+)⟧')
PLACEHOLDER_RE = re.compile(r'⟦[^⟧]*⟧')
WS_RE = re.compile(r'\s+')


def log(*a):
    print(*a, flush=True)


def _cell_norm(c: str) -> str:
    return WS_RE.sub('', PLACEHOLDER_RE.sub('', c or ''))


def norm_table(rows) -> str:
    """归一化签名: 逐格去占位符+空白; 整行归一后为空则丢弃 (22 不存这类行)。"""
    cells = []
    for row in rows or []:
        vals = [_cell_norm(c) for c in row]
        if not any(vals):
            continue
        cells.extend(vals)
    return hashlib.sha256('|'.join(cells).encode()).hexdigest()


def has_text(rows) -> bool:
    """归一后是否还有任何非空单元格 (用于区分 image_only / empty)。"""
    return any(_cell_norm(c) for row in (rows or []) for c in row)


def full_rows(headers, rows):
    """question_tables 的 headers+rows 重组成全行 (data_table 首行被拆进 headers)。"""
    h = headers
    if isinstance(h, str):
        h = json.loads(h)
    b = rows
    if isinstance(b, str):
        b = json.loads(b)
    return ([h] if h else []) + (b or [])


def resolve_docx(paper_file_path: str, cache_index: dict):
    if not paper_file_path:
        return None
    p = Path(paper_file_path)
    if p.suffix.lower() == '.docx' and p.exists():
        return p
    return cache_index.get(p.name) or cache_index.get(Path(p.name).with_suffix('.docx').name)


def questions_token_nums(row) -> set:
    """一道题在 stem/options/analysis/answer 里出现的所有 token 编号。"""
    txts = [row['stem'] or '', row['analysis'] or '', row['reference_answer'] or '']
    opts = row['options']
    if isinstance(opts, str):
        try:
            opts = json.loads(opts)
        except Exception:
            opts = {}
    if isinstance(opts, dict):
        txts.extend(str(v) for v in opts.values())
    elif isinstance(opts, list):
        txts.extend(str(v) for v in opts)
    nums = set()
    for t in txts:
        nums.update(int(x) for x in TOKEN_RE.findall(t))
    return nums


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--apply', action='store_true', help='写库 (默认只报数)')
    a = ap.parse_args()
    if not a.dsn:
        log('!! 需要 DATABASE_URL')
        return 2

    import asyncpg
    log('建立 docx 索引 …')
    cache_index = {}
    for f in DOCX_CACHE.rglob('*.docx'):
        cache_index.setdefault(f.name, f)
    log(f'  {len(cache_index)} 份 docx')

    conn = await asyncpg.connect(a.dsn)
    try:
        papers = await conn.fetch(f"""
            SELECT DISTINCT p.id, p.paper_file_path
              FROM public.exam_questions q
              JOIN public.exam_papers p ON p.id = q.paper_id
             WHERE q.archive_state = 'active'
               AND (q.stem LIKE '%⟦TABLE:%' OR q.analysis LIKE '%⟦TABLE:%'
                    OR q.options::text LIKE '%⟦TABLE:%' OR q.reference_answer LIKE '%⟦TABLE:%')
             ORDER BY p.id""" + (' LIMIT $1' if a.limit else ''),
            *([a.limit] if a.limit else []))
        log(f'含 ⟦TABLE:⟧ 的卷: {len(papers)}')

        st = Counter()
        updates = []            # (question_id, refs_json, changed)
        backup = []
        mismatch_papers = []

        for i, p in enumerate(papers, 1):
            if i % 100 == 0:
                log(f'  … {i}/{len(papers)}')
            dx = resolve_docx(p['paper_file_path'], cache_index)
            if not dx:
                st['paper_no_docx'] += 1
                continue
            try:
                ta = qbx.extract_paper(dx, table_aware=True)
            except Exception as e:
                st['extract_failed'] += 1
                log(f'  !! extract 失败 {dx.name}: {str(e)[:60]}')
                continue
            tables = ta.get('tables') or []

            qt_rows = await conn.fetch(
                "SELECT id, sort_order, table_kind, headers, rows "
                "FROM public.question_tables WHERE paper_id=$1 ORDER BY sort_order", p['id'])
            # 同签名 → [(sort_order, id, kind)] (已按 sort_order 升序)
            qt_by_sig = {}
            for r in qt_rows:
                qt_by_sig.setdefault(norm_table(full_rows(r['headers'], r['rows'])),
                                     []).append((r['sort_order'], r['id'], r['table_kind']))
            # 同签名 → [n] (qbx 出现序)
            qbx_by_sig = {}
            for n in range(1, len(tables) + 1):
                qbx_by_sig.setdefault(norm_table(tables[n - 1]), []).append(n)

            if len(tables) != len(qt_rows):
                mismatch_papers.append({'paper_id': p['id'], 'qbx': len(tables), 'qt': len(qt_rows)})
                st['paper_count_mismatch'] += 1

            qs = await conn.fetch(
                "SELECT id, stem, options, analysis, reference_answer, table_refs "
                "FROM public.exam_questions WHERE paper_id=$1 AND archive_state='active'", p['id'])
            for q in qs:
                nums = questions_token_nums(q)
                if not nums:
                    continue
                refs = {}
                for n in sorted(nums):
                    if n < 1 or n > len(tables):
                        refs[str(n)] = {'table_id': None, 'missing': 'no_asset'}
                        st['missing_no_asset'] += 1
                        continue
                    tq = tables[n - 1]
                    if not has_text(tq):
                        # 无文本: 空表 or 只含图片/公式
                        reason = 'empty_table' if not tq else 'image_only_table'
                        refs[str(n)] = {'table_id': None, 'missing': reason}
                        st[f'missing_{reason}'] += 1
                        continue
                    sig = norm_table(tq)
                    cand = qt_by_sig.get(sig)
                    if not cand:
                        refs[str(n)] = {'table_id': None, 'missing': 'no_asset'}
                        st['missing_no_asset'] += 1
                        continue
                    # 同签名多解 → 文档序对齐: 第 j 个 qbx 出现 ↔ 第 j 个 sort_order
                    j = qbx_by_sig[sig].index(n)
                    if j < len(cand):
                        _so, tid, kind = cand[j]
                        refs[str(n)] = {'table_id': tid, 'kind': kind}
                        st['resolved'] += 1
                        if len(cand) > 1:
                            st['resolved_docorder'] += 1
                    else:
                        refs[str(n)] = {'table_id': None, 'missing': 'ambiguous'}
                        st['missing_ambiguous'] += 1

                new_json = json.dumps(refs, ensure_ascii=False, sort_keys=True)
                old_json = None
                if q['table_refs'] is not None:
                    old_json = json.dumps(
                        q['table_refs'] if isinstance(q['table_refs'], dict)
                        else json.loads(q['table_refs']),
                        ensure_ascii=False, sort_keys=True)
                if old_json != new_json:
                    updates.append((q['id'], new_json))
                    backup.append({'question_id': q['id'], 'paper_id': p['id'],
                                   'table_refs_before': json.loads(old_json) if old_json else None,
                                   'table_refs_after': refs})

        log('')
        log('════ ⟦TABLE:n⟧ → question_tables 映射回填 (P1) ════')
        log(f"卷 {len(papers)} / token 解析 {st['resolved']} "
            f"(其中文档序多解 {st['resolved_docorder']})")
        log(f"缺失: image_only_table {st['missing_image_only_table']} / "
            f"empty_table {st['missing_empty_table']} / "
            f"ambiguous {st['missing_ambiguous']} / no_asset {st['missing_no_asset']}")
        log(f"计数不一致卷 (qbx≠qt, 签名兜底已处理) {st['paper_count_mismatch']}")
        for m in mismatch_papers[:10]:
            log(f"    paper {m['paper_id']}: qbx={m['qbx']} qt={m['qt']}")
        log(f"无 docx {st['paper_no_docx']} / extract 失败 {st['extract_failed']}")
        log(f"待更新行 {len(updates)}")

        out = {
            'generated_at': datetime.now().strftime('%Y%m%d-%H%M%S'),
            'mode': 'apply' if a.apply else 'dry-run',
            'papers': len(papers), 'stats': dict(st),
            'count_mismatch_papers': mismatch_papers,
            'updates': len(updates),
        }
        LOGS.mkdir(parents=True, exist_ok=True)
        ts = out['generated_at']
        if a.apply and updates:
            bk = LOGS / f'table-refs-backup-{ts}.json'
            bk.write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding='utf-8')
            log(f'旧值已备份: {bk}')
            await conn.executemany(
                "UPDATE public.exam_questions SET table_refs=$2::jsonb WHERE id=$1",
                [(qid, nj) for qid, nj in updates])
            log(f'已更新 {len(updates)} 题 table_refs')
        else:
            log('dry-run: 未写库 (确认后加 --apply)')

        rep = LOGS / f'table-refs-{ts}.json'
        rep.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
        log(f'已写入 {rep}')
    finally:
        await conn.close()
    return 0


sys.exit(asyncio.run(main()))
