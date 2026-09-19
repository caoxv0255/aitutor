#!/usr/bin/env python3
"""29-table-contamination-fields.py —— 表格污染**按字段**细分诊断 (路线图 P3 第 1 步)。

为什么需要
----------
`21-table-diagnosis.py` 把题面当一个整体算 CONTAMINATED (strong 2710),
但**不同字段的处置方式完全不同**:
  · stem    —— 路线 A 已能把 data_table 换成 ⟦TABLE:n⟧ (读端 P2 可渲染);
  · options —— **完全没处理**, 且 option_layout (表格即选项) 不能换占位符;
  · analysis—— 已定「只渲染、不动库」;
  · answer  —— **绝不换占位符** (错答案比缺答案更糟)。
不知道「strong 2710 里各字段各占多少」就无法分批治理。本脚本只量化, 不改数据。

判据 (与 21/22 同口径, 机械可复现)
----------------------------------
  单元格命中 = 单元格文本 (去空白, 长度≥4) 出现在某字段文本里 (子串)。
  字段 strong = 该题在该字段命中 ≥2 个单元格, 或存在命中单元格长度 ≥8
                (短串有误命中风险, 「生态系统」「2007年」一律不算 strong)。
  同时区分表型 (option_layout / data_table) 与「该 stem 是否已带 ⟦TABLE:n⟧」。

输出
----
  database/preflight/qb-extract/logs/table-contamination-fields-<ts>.json
  屏幕人读版 (strong 为主), 含各字段样例。

用法
----
  python3 29-table-contamination-fields.py
  python3 29-table-contamination-fields.py --limit 50
"""
import argparse
import asyncio
import json
import os
import re
import sys
import zipfile
from collections import Counter, defaultdict
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
TABLE_TOKEN = re.compile(r'⟦TABLE:\d+⟧')
FIELDS = ('stem', 'options', 'analysis', 'answer')


def log(*a):
    print(*a, flush=True)


def parse_tables(docx_path: Path) -> list:
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
                cells.append(''.join(n.text or '' for n in tc.iter(W + 't')).strip())
            if any(cells):
                rows.append(cells)
        if not rows:
            continue
        first_col = [r[0] for r in rows if r and r[0].strip()]
        opt_hits = sum(1 for c in first_col if OPT_LEAD.match(c))
        kind = 'option_layout' if first_col and opt_hits / len(first_col) >= 0.5 else 'data_table'
        out.append({'kind': kind, 'cells': rows})
    return out


def resolve_docx(paper_file_path, cache_index):
    if not paper_file_path:
        return None
    p = Path(paper_file_path)
    if p.suffix.lower() == '.docx' and p.exists():
        return p
    return cache_index.get(p.name) or cache_index.get(Path(p.name).with_suffix('.docx').name)


def is_strong(cells) -> bool:
    return len(cells) >= 2 or (cells and max(len(c) for c in cells) >= 8)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    ap.add_argument('--limit', type=int, default=0)
    a = ap.parse_args()
    if not a.dsn:
        log('!! 需要 DATABASE_URL')
        return 2

    import asyncpg
    cache_index = {}
    for f in DOCX_CACHE.rglob('*.docx'):
        cache_index.setdefault(f.name, f)

    conn = await asyncpg.connect(a.dsn)
    try:
        papers = await conn.fetch(f"""
            SELECT id, subject, year, paper_file_path FROM public.exam_papers
             WHERE created_at::date = '{BATCH_DATE}' ORDER BY id""" +
            (' LIMIT $1' if a.limit else ''), *([a.limit] if a.limit else []))
        qs = await conn.fetch(f"""
            SELECT q.id, q.paper_id, q.question_number, q.stem, q.options, q.analysis, q.reference_answer
              FROM public.exam_questions q JOIN public.exam_papers p ON p.id = q.paper_id
             WHERE p.created_at::date = '{BATCH_DATE}' AND q.archive_state = 'active'""")
    finally:
        await conn.close()

    by_paper = defaultdict(list)
    for r in qs:
        opts = r['options']
        if isinstance(opts, str):
            try:
                opts = json.loads(opts)
            except Exception:
                opts = {}
        by_paper[r['paper_id']].append({
            'id': r['id'], 'qn': r['question_number'],
            'stem': r['stem'] or '',
            'options': ' '.join(str(v) for v in (opts or {}).values()) if isinstance(opts, dict) else '',
            'analysis': r['analysis'] or '',
            'answer': r['reference_answer'] or '',
            'has_token': bool(TABLE_TOKEN.search(r['stem'] or '')),
        })

    q_field_strong = Counter()      # field -> 有 strong 污染的题数
    q_field_any = Counter()         # field -> 有任何命中的题数
    q_field_kind_strong = Counter()  # (field, kind) -> 题数
    cell_field_kind = Counter()     # (field, kind) -> 命中单元格次数
    stem_strong_token = Counter()   # stem strong 污染中: 已带 token / 未带
    both_stem_opt = 0               # 同题 stem 与 options 都 strong
    samples = defaultdict(list)
    q_strong_field = defaultdict(set)

    log(f'本批 {len(papers)} 卷 / {len(qs)} 题, 逐卷按字段比对 …')
    for i, p in enumerate(papers, 1):
        if i % 200 == 0:
            log(f'  … {i}/{len(papers)}')
        dx = resolve_docx(p['paper_file_path'], cache_index)
        if not dx:
            continue
        tables = parse_tables(dx)
        if not tables:
            continue
        qs_here = by_paper.get(p['id'], [])
        # qid -> field -> [(cell, kind)]
        hits = defaultdict(lambda: defaultdict(list))
        for t in tables:
            cells = [c for row in t['cells'] for c in row if len(c) >= MIN_CELL]
            if not cells:
                continue
            for q in qs_here:
                for field in FIELDS:
                    text = q[field]
                    if not text:
                        continue
                    h = [c for c in cells if c in text]
                    if not h:
                        continue
                    cell_field_kind[(field, t['kind'])] += len(h)
                    hits[q['id']][field].extend((c, t['kind']) for c in h)
        for q in qs_here:
            fh = hits.get(q['id'])
            if not fh:
                continue
            strong_fields = set()
            for field, pairs in fh.items():
                cells = [c for c, _ in pairs]
                kinds = {k for _, k in pairs}
                q_field_any[field] += 1
                if not is_strong(cells):
                    continue
                q_field_strong[field] += 1
                strong_fields.add(field)
                for k in kinds:
                    q_field_kind_strong[(field, k)] += 1
                if field == 'stem':
                    stem_strong_token['has_token' if q['has_token'] else 'no_token'] += 1
                if len(samples[field]) < 8:
                    samples[field].append({
                        'question_id': q['id'], 'paper_id': p['id'], 'subject': p['subject'],
                        'qn': q['qn'], 'kind': ','.join(sorted(kinds)), 'hit_cells': cells[:3],
                        'field_text': q[field][:160],
                    })
            q_strong_field[q['id']] = strong_fields
            if 'stem' in strong_fields and 'options' in strong_fields:
                both_stem_opt += 1

    payload = {
        'generated_at': datetime.now().strftime('%Y%m%d-%H%M%S'),
        'scope': f"exam_papers.created_at::date = {BATCH_DATE}",
        'questions_total': len(qs),
        'q_field_strong': dict(q_field_strong),
        'q_field_any': dict(q_field_any),
        'q_field_kind_strong': {f'{f}|{k}': v for (f, k), v in sorted(q_field_kind_strong.items())},
        'cell_field_kind': {f'{f}|{k}': v for (f, k), v in sorted(cell_field_kind.items())},
        'stem_strong_token': dict(stem_strong_token),
        'both_stem_opt_strong': both_stem_opt,
        'samples': {k: v for k, v in samples.items()},
    }
    LOGS.mkdir(parents=True, exist_ok=True)
    out = LOGS / f"table-contamination-fields-{payload['generated_at']}.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')

    log('')
    log('════ 表格污染 按字段细分 (strong) ════')
    log(f"题总数 {len(qs)}")
    for f in FIELDS:
        log(f"  {f:<9} any={q_field_any[f]:<6} strong={q_field_strong[f]}")
    log('  字段 × 表型 (strong 题数):')
    for (f, k), v in sorted(q_field_kind_strong.items()):
        log(f"    {f:<9} × {k:<13} = {v}")
    log(f"  stem strong 中: 已带⟦TABLE:⟧ {stem_strong_token['has_token']} / "
        f"未带 {stem_strong_token['no_token']}")
    log(f"  stem 与 options 同时 strong 的题: {both_stem_opt}")
    log('')
    for f in FIELDS:
        if samples[f]:
            s = samples[f][0]
            log(f"  样例[{f}] q={s['question_id']} {s['kind']} 命中={s['hit_cells'][:2]}")
    log(f'已写入 {out}')
    return 0


sys.exit(asyncio.run(main()))
