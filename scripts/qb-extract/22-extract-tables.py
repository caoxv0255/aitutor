#!/usr/bin/env python3
"""22-extract-tables.py —— 表格资产回填 (P4-a, 规范 §25)。

做什么
------
把 docx 里的 OOXML `w:tbl` 抽成结构化 rows/headers, 写入 `public.question_tables`
(migration 031), 并按「单元格文本命中」机械地归属到题。

**不动题面** —— stem/options 一个字不改。题面里那些扁平化的表格文本是否要抽出来,
属于 P4-c, 风险高, 单独立项。

归属规则 (机械, 不猜)
----------------------
  strong hit = 某题的 stem/options/解析/答案 里出现 ≥2 个该表单元格, 或出现 ≥8 字的单元格
    强命中恰好 1 题   → question_id = 该题, attributed_by='cell_match'
    强命中 0 题       → question_id = NULL (整表内容未在库里, 见诊断的 223 张 DROPPED)
    强命中 ≥2 题      → question_id = NULL + candidate_question_ids 记录候选
                        (表被拆给多题, 机械无法确定归属, **不猜一个挂上去**)

幂等
----
UNIQUE(paper_id, source_hash, sort_order) + ON CONFLICT DO NOTHING —— 重跑 0 行。

用法
----
  python3 22-extract-tables.py              # 本批 (exam_papers.created_at = 2026-09-17)
  python3 22-extract-tables.py --limit 40   # 试跑
  python3 22-extract-tables.py --dry-run    # 只报数, 不写库
"""
import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
import zipfile
from collections import Counter
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET

REPO = Path(__file__).resolve().parents[2]
LOGS = REPO / 'database' / 'preflight' / 'qb-extract' / 'logs'
DOCX_CACHE = REPO / 'database' / 'preflight' / 'qb-extract' / 'docx-cache'

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
BATCH_DATE = '2026-09-17'
OPT_LEAD = re.compile(r'^\s*[A-D][．.、)）]')
MIN_CELL = 4


def log(*a):
    print(*a, flush=True)


def parse_tables(docx_path: Path) -> list:
    """与 21-table-diagnosis.py 同一口径: 返回 [{n_rows,n_cols,kind,cells}]"""
    try:
        z = zipfile.ZipFile(docx_path)
        root = ET.fromstring(z.read('word/document.xml'))
    except Exception:
        return []
    out = []
    for t in root.iter(W + 'tbl'):
        rows = []
        for tr in t.findall(W + 'tr'):
            cells = []
            for tc in tr.findall(W + 'tc'):
                txt = ''.join(n.text or '' for n in tc.iter(W + 't')).strip()
                cells.append(txt)
            if any(cells):
                rows.append(cells)
        if not rows:
            continue
        first_col = [r[0] for r in rows if r and r[0].strip()]
        opt_hits = sum(1 for c in first_col if OPT_LEAD.match(c))
        kind = 'option_layout' if first_col and opt_hits / len(first_col) >= 0.5 else 'data_table'
        out.append({'n_rows': len(rows), 'n_cols': max(len(r) for r in rows),
                    'kind': kind, 'cells': rows})
    return out


def resolve_docx(paper_file_path: str, cache_index: dict) -> Path | None:
    if not paper_file_path:
        return None
    p = Path(paper_file_path)
    if p.suffix.lower() == '.docx' and p.exists():
        return p
    base = p.name
    if base in cache_index:
        return cache_index[base]
    return cache_index.get(Path(base).with_suffix('.docx').name)


def sha_rows(rows) -> str:
    return hashlib.sha256(json.dumps(rows, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--dry-run', action='store_true', help='只报数, 不写库')
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
            SELECT id, subject, year, paper_file_path
              FROM public.exam_papers
             WHERE created_at::date = '{BATCH_DATE}'
             ORDER BY id""" + (' LIMIT $1' if a.limit else ''),
            *([a.limit] if a.limit else []))
        qs = await conn.fetch(f"""
            SELECT q.id, q.paper_id, q.stem, q.options, q.analysis,
                   q.analysis_original, q.reference_answer
              FROM public.exam_questions q
              JOIN public.exam_papers p ON p.id = q.paper_id
             WHERE p.created_at::date = '{BATCH_DATE}' AND q.archive_state = 'active'""")
    finally:
        if a.dry_run:
            pass
        await conn.close()

    by_paper = {}
    for r in qs:
        opts = r['options']
        if isinstance(opts, str):
            try:
                opts = json.loads(opts)
            except Exception:
                opts = {}
        by_paper.setdefault(r['paper_id'], []).append({
            'id': r['id'],
            'hay': ' '.join([r['stem'] or '', ' '.join((opts or {}).values()),
                             r['analysis'] or '', r['analysis_original'] or '',
                             r['reference_answer'] or '']),
        })

    log(f'本批 {len(papers)} 卷 / {len(qs)} 题')

    st = Counter()
    rows_out = []
    for i, p in enumerate(papers, 1):
        if i % 300 == 0:
            log(f'  … {i}/{len(papers)}')
        dx = resolve_docx(p['paper_file_path'], cache_index)
        if not dx:
            st['papers_no_docx'] += 1
            continue
        tables = parse_tables(dx)
        if not tables:
            continue
        st['papers_with_tables'] += 1
        qs_here = by_paper.get(p['id'], [])

        for order, t in enumerate(tables, 1):
            st['tables_total'] += 1
            st[f"kind_{t['kind']}"] += 1
            cells = [c for row in t['cells'] for c in row if len(c) >= MIN_CELL]
            hashes_ok = bool(cells)
            # 归属: 强命中
            strong = {}
            for q in qs_here:
                hit = [c for c in cells if c in q['hay']]
                if len(hit) >= 2 or (hit and max(len(c) for c in hit) >= 8):
                    strong[q['id']] = len(hit)
            if len(strong) == 1:
                qid = next(iter(strong))
                st['attributed'] += 1
                attributed_by = 'cell_match'
                candidates = None
            else:
                qid = None
                attributed_by = None
                candidates = sorted(strong) if strong else None
                st['unattributed_no_strong_hit' if not strong else 'unattributed_ambiguous'] += 1

            # headers: 数据表且 ≥2 行 → 首行作表头; 选项排版表没有表头
            if t['kind'] == 'data_table' and t['n_rows'] >= 2:
                headers, body = t['cells'][0], t['cells'][1:]
            else:
                headers, body = None, t['cells']

            rows_out.append((
                qid, p['id'], order,
                json.dumps(headers, ensure_ascii=False) if headers else None,
                json.dumps(body, ensure_ascii=False),
                t['n_rows'], t['n_cols'], t['kind'],
                str(dx.relative_to(REPO)), sha_rows(body),
                json.dumps(candidates) if candidates else None,
                attributed_by,
            ))
            if not hashes_ok:
                st['tables_no_usable_cell'] += 1

    log('')
    log('════ 表格资产回填 (P4-a) ════')
    log(f"卷含表 {st['papers_with_tables']} / 无 docx {st['papers_no_docx']}")
    log(f"表总计 {st['tables_total']}  "
        f"(data_table={st['kind_data_table']}, option_layout={st['kind_option_layout']})")
    log(f"  归属到题        = {st['attributed']}")
    log(f"  无强命中           = {st['unattributed_no_strong_hit']}  "
        f"(含诊断口径的 DROPPED 与「只有弱命中」两种)")
    log(f"  多题命中(归属歧义) = {st['unattributed_ambiguous']}")
    if st['tables_no_usable_cell']:
        log(f"  无可用单元格(≥4字) = {st['tables_no_usable_cell']}")

    if a.dry_run:
        log('\n--dry-run: 未写库')
        return 0

    conn = await asyncpg.connect(a.dsn)
    try:
        res = await conn.executemany("""
            INSERT INTO public.question_tables
              (question_id, paper_id, sort_order, headers, rows, n_rows, n_cols,
               table_kind, source_docx, source_hash, candidate_question_ids, attributed_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (paper_id, source_hash, sort_order) DO UPDATE
               SET candidate_question_ids = (
                     SELECT jsonb_agg(DISTINCT v ORDER BY v)
                       FROM jsonb_array_elements(
                              coalesce(question_tables.candidate_question_ids, '[]'::jsonb)
                              || coalesce(EXCLUDED.candidate_question_ids, '[]'::jsonb)) AS v)
             WHERE question_tables.question_id IS NULL""", rows_out)
        n_before = await conn.fetchval("SELECT count(*) FROM public.question_tables")
    finally:
        await conn.close()

    log(f'\n写入: {res}')
    log(f'question_tables 现有 {n_before} 行')

    ts = datetime.now().strftime('%Y%m%d-%H%M%S')
    LOGS.mkdir(parents=True, exist_ok=True)
    out = LOGS / f'table-assets-{ts}.json'
    out.write_text(json.dumps({
        'generated_at': ts, 'scope': f"exam_papers.created_at::date = {BATCH_DATE}",
        'tables_total': st['tables_total'], 'attributed': st['attributed'],
        'unattributed_no_strong_hit': st['unattributed_no_strong_hit'],
        'unattributed_ambiguous': st['unattributed_ambiguous'],
        'kind_data_table': st['kind_data_table'],
        'kind_option_layout': st['kind_option_layout'],
        'rows_in_db': int(n_before),
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    log(f'已写入 {out}')
    return 0


sys.exit(asyncio.run(main()))
