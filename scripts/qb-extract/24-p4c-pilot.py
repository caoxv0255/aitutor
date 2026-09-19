#!/usr/bin/env python3
"""24-p4c-pilot.py —— P4-c 表感知重抽取 pilot（**只读，不写库**）。

做什么
------
同一份 docx 跑两遍 `qbx.extract_paper`:
    baseline     table_aware=False（现行口径, 表内段落当正文）
    table_aware  True（w:tbl 整块 → ⟦TABLE:n⟧ 占位符）
逐题对比 stem / options / answer / analysis, 产出**人工复核用的对照表**。

为什么必须 pilot 而不是直接全量
-------------------------------
表感知抽取有个明确风险: **卷末答案区可能本身就是表格** —— 一旦整块变占位符,
答案就抽不到了 (qbx 的 backfill_answer_tables / backfill_table_positional
正是靠摊平后的段落找答案的)。pilot 就是把这件事**量化**出来再决定要不要继续。

复核三条（人判，机器给不出）
---------------------------
  1. 题干可读 —— 占位符位置对不对, 有没有把正文挖掉
  2. 答案/解析未丢 —— new.answer 与 baseline.answer 是否一致
  3. 选项完整 —— new.options 的键与值是否还在（option_layout 尤其危险: 表格即选项）

用法
----
  python3 24-p4c-pilot.py                # 默认 25 题
  python3 24-p4c-pilot.py --n 40         # 指定题数
  python3 24-p4c-pilot.py --kind option_layout   # 只跑某一表型
"""
import argparse
import asyncio
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

PH = re.compile(r'⟦TABLE:(\d+)⟧')


def log(*a):
    print(*a, flush=True)


def norm(s):
    return re.sub(r'\s+', '', s or '')


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    ap.add_argument('--n', type=int, default=25, help='抽样题数')
    ap.add_argument('--kind', default='data_table', choices=['data_table', 'option_layout', 'any'])
    a = ap.parse_args()
    if not a.dsn:
        log('!! 需要 DATABASE_URL')
        return 2

    import asyncpg
    conn = await asyncpg.connect(a.dsn)
    try:
        kind_sql = '' if a.kind == 'any' else "AND t.table_kind = $1"
        rows = await conn.fetch(f"""
            SELECT q.id AS question_id, q.paper_id, q.question_number, q.stem, q.options, q.answer,
                   q.analysis, p.subject, p.year, p.paper_file_path, t.id AS table_id
              FROM public.question_tables t
              JOIN public.exam_questions q ON q.id = t.question_id
              JOIN public.exam_papers   p ON p.id = q.paper_id
             WHERE t.question_id IS NOT NULL
               AND p.created_at::date = '2026-09-17'
               {kind_sql}
             ORDER BY t.id
             LIMIT {a.n}""", *([a.kind] if kind_sql else []))
    finally:
        await conn.close()

    cache_index = {}
    for f in DOCX_CACHE.rglob('*.docx'):
        cache_index.setdefault(f.name, f)

    log(f'抽样归属组 {len(rows)}（table_kind={a.kind}）')

    out_rows = []
    st = Counter()
    for r in rows:
        p = Path(r['paper_file_path'])
        dx = p if (p.suffix.lower() == '.docx' and p.exists()) else cache_index.get(p.name)
        if not dx:
            st['no_docx'] += 1
            continue
        tbl_id = r['table_id']
        try:
            base = qbx.extract_paper(dx, table_aware=False)
        except Exception as e:
            st['baseline_failed'] += 1
            log(f'  !! baseline 失败 {dx.name}: {str(e)[:60]}')
            continue
        try:
            new = qbx.extract_paper(dx, table_aware=True)
        except Exception as e:
            st['tableaware_failed'] += 1
            log(f'  !! table-aware 失败 {dx.name}: {str(e)[:60]}')
            continue

        # 按题号对齐两遍结果的题目
        def by_number(res):
            return {int(q.get('number') or 0): q for q in res['questions']}
        bq = by_number(base)
        nq = by_number(new)
        qn = r['question_number']
        b, n = bq.get(qn), nq.get(qn)
        if b is None or n is None:
            st['number_unmatched'] += 1
            continue

        def opts_of(q):
            o = q.get('options') or {}
            return {k: v for k, v in o.items()} if isinstance(o, dict) else {}

        bo, no = opts_of(b), opts_of(n)
        bs, ns = b.get('stem') or '', n.get('stem') or ''
        ba, na = b.get('answer') or '', n.get('answer') or ''
        bana, nana = b.get('analysis') or '', n.get('analysis') or ''

        flags = []
        if norm(ba) != norm(na):
            flags.append('ANSWER_CHANGED')
        if set(bo) != set(no):
            flags.append('OPTIONS_KEYS_CHANGED')
        elif any(norm(bo.get(k)) != norm(no.get(k)) for k in bo):
            flags.append('OPTIONS_TEXT_CHANGED')
        if len(norm(ns)) < len(norm(bs)) * 0.5:
            flags.append('STEM_SHRUNK_HALF')
        if '⟦TABLE:' not in ns and '⟦TABLE:' in bs:
            flags.append('PLACEHOLDER_LOST')
        if not flags:
            flags.append('IDENTICAL')

        st['compared'] += 1
        for f in flags:
            st[f'flag_{f}'] += 1
        st[f"n_tbl_{min(len(new.get('tables') or []), 5)}"] += 1

        out_rows.append({
            'question_id': r['question_id'], 'table_id': tbl_id,
            'subject': r['subject'], 'year': r['year'], 'question_number': qn,
            'docx': str(dx.relative_to(REPO)),
            'flags': flags,
            'n_tables_in_doc': len(new.get('tables') or []),
            'stem_before': bs[:260], 'stem_after': ns[:260],
            'options_before': bo, 'options_after': no,
            'answer_before': ba, 'answer_after': na,
            'analysis_before': bana[:120], 'analysis_after': nana[:120],
        })

    log('')
    log('════ P4-c pilot ════')
    log(f"对比题数 {st['compared']}  (无 docx {st['no_docx']}, 题号对不上 {st['number_unmatched']}, "
        f"baseline 失败 {st['baseline_failed']}, table-aware 失败 {st['tableaware_failed']})")
    log('标记分布:')
    for k, v in sorted(st.items()):
        if k.startswith('flag_'):
            log(f"  {k[5:]:<24} {v}")

    ts = datetime.now().strftime('%Y%m%d-%H%M%S')
    LOGS.mkdir(parents=True, exist_ok=True)
    out = LOGS / f'p4c-pilot-{ts}.json'
    out.write_text(json.dumps({
        'generated_at': ts, 'sample_kind': a.kind, 'sample_size': len(rows),
        'stats': dict(st), 'rows': out_rows,
    }, ensure_ascii=False, indent=2), encoding='utf-8')

    md = LOGS / f'p4c-pilot-{ts}.md'
    with md.open('w', encoding='utf-8') as fh:
        fh.write(f'# P4-c pilot 人工复核表（{ts}, table_kind={a.kind}）\n\n')
        fh.write('复核三条: ① 题干可读（占位符位置对不对）② 答案/解析未丢 ③ 选项完整\n\n')
        for i, r in enumerate(out_rows, 1):
            fh.write(f"## {i}. q{r['question_id']} / {r['subject']}{r['year']} 第{r['question_number']}题 "
                     f"— {' '.join(r['flags'])}\n\n")
            fh.write(f"- docx: `{r['docx']}`（全卷表 {r['n_tables_in_doc']} 张）\n")
            fh.write(f"- 答案: `{r['answer_before']}` → `{r['answer_after']}`\n")
            fh.write('**stem 前**\n```\n' + r['stem_before'] + '\n```\n')
            fh.write('**stem 后**\n```\n' + r['stem_after'] + '\n```\n')
            if r['options_before'] or r['options_after']:
                fh.write('**选项 前/后**\n```\n' +
                         json.dumps(r['options_before'], ensure_ascii=False) + '\n→\n' +
                         json.dumps(r['options_after'], ensure_ascii=False) + '\n```\n')
            fh.write('\n')
    log('')
    log(f'对照表(人工复核用): {md}')
    log(f'结构化数据: {out}')
    return 0


sys.exit(asyncio.run(main()))
