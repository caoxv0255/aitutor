#!/usr/bin/env python3
"""23-reextract-risk-probe.py —— P4-c 重抽风险探针（**只读，不改任何数据**）。

要回答的问题
------------
P4-c 打算把扁平化进题面的表格文本抽出来、换成占位符。风险是**把题抽坏**:
  - 语文选择题的「选项」本身就是表格排版的 (option_layout) —— 抽掉 = 删掉选项
  - 有些题的 stem 几乎**只有**表格内容 —— 抽掉 = 题干变空
  - 表格文本可能与正文**交错**出现, 不是一个连续块 —— 抽掉 = 句子被拦腰截断

本脚本在库内 1694 组「表↔题」归属上**模拟抽取**, 按机械判据分级, 不改一个字。

判据
----
  span        表格每个单元格在题面里的出现位置 (取全部出现)
  coverage    这些 span 的并集长度 / 题面长度
  gaps        相邻 span 之间的间隙之和; 间隙占比 > 30% → **交错** (interleaved)
  after_len   抽掉并集后的剩余长度; < 12 字 → **抽坏** (destructive)

分级 (人工复核后修正 —— 第一版把「碰巧命中」误判成 SAFE)
----------------------------------------------------------
  DESTRUCTIVE      option_layout 且单元格命中在 options 里 (抽掉 = 删选项);
                   或抽取后 stem 剩余 < 12 字。**一律不动**
  FLATTENED_BLOCK  覆盖率 ≥15% 且间隙比 ≤50% —— 表格确实是整块扁平化进 stem 的,
                   抽出并换占位符在**结构上是安全的** (语义完整性仍需人判)
  INCIDENTAL       覆盖率 <5% —— 单元格文本只是碰巧出现在正文里 (如「颜色深浅程度」),
                   抽掉 = 把句子挖个洞。**一律不动**
  UNCERTAIN        5% ≤ 覆盖率 <15%, 或间隙比 >50% (与正文交错) —— 需人判
  NO_HIT_IN_STEM   表格文本不在 stem 里, 细分在 options / analysis / nowhere

判据阈值: GAP_RATIO=0.50, BLOCK_MIN=0.15, INCIDENTAL_MAX=0.05, MIN_STEM_LEFT=12

**注意**: SAFE 只代表「抽掉不会把题抽空」, 不代表「抽出后题面语义完整」——
语义完整性需要人判, 这正是本探针要产出人工复核样例的原因。

用法
----
  python3 23-reextract-risk-probe.py            # 全量 1694 组
  python3 23-reextract-risk-probe.py --limit 50 # 只跑前 N 组 (快速试)
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
MIN_CELL = 4
GAP_RATIO = 0.50      # 间隙并集 / 覆盖并集 超过此值 → 与正文交错
BLOCK_MIN = 0.15      # 覆盖率 ≥ 此值才算「整块扁平化」
INCIDENTAL_MAX = 0.05 # 覆盖率 < 此值 = 只是碰巧命中
MIN_STEM_LEFT = 12    # 抽取后 stem 剩余字数下限


def log(*a):
    print(*a, flush=True)


def spans_of(text: str, needle: str):
    out = []
    i = text.find(needle)
    while i >= 0:
        out.append((i, i + len(needle)))
        i = text.find(needle, i + 1)
    return out


def merge(spans):
    if not spans:
        return []
    spans = sorted(spans)
    merged = [list(spans[0])]
    for s, e in spans[1:]:
        if s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    return merged


def probe(stem: str, opt_text: str, cells: list, kind: str, analysis: str = '') -> dict:
    """在 stem 上模拟抽取, 返回分级与证据"""
    all_spans = []
    for c in cells:
        all_spans.extend(spans_of(stem, c))
    merged = merge(all_spans)
    if not merged:
        # 单元格不在 stem 里 (可能只落在 options/analysis) —— 对 stem 无影响
        hit_opt = [c for c in cells if c in opt_text]
        if kind == 'option_layout' and hit_opt:
            return {'cls': 'DESTRUCTIVE', 'why': '选项即表格: 抽掉=删选项',
                    'coverage': 0.0, 'gap_ratio': 0.0, 'stem_left': len(stem),
                    'hit_cells': hit_opt[:3]}
        # 表格文本不在 stem —— 定位它到底在哪, 决定 P4-c 该不该碰、碰哪里
        if hit_opt:
            where = 'options'
        elif analysis and any(c in analysis for c in cells):
            where = 'analysis'
        else:
            where = 'nowhere'
        return {'cls': 'NO_HIT_IN_STEM', 'why': f'表格文本不在 stem 里 (在 {where})',
                'coverage': 0.0, 'gap_ratio': 0.0, 'stem_left': len(stem),
                'hit_cells': hit_opt[:3], 'where': where}

    cover = sum(e - s for s, e in merged)
    gaps = sum(merged[i + 1][0] - merged[i][1] for i in range(len(merged) - 1))
    coverage = cover / max(len(stem), 1)
    gap_ratio = gaps / max(cover, 1)
    removed = ''.join(stem[s:e] for s, e in merged)
    left = stem
    for s, e in reversed(merged):          # 从后往前删, 避免位移
        left = left[:s] + left[e:]
    stem_left = len(left)

    if kind == 'option_layout':
        return {'cls': 'DESTRUCTIVE', 'why': '选项即表格: 抽掉=删选项',
                'coverage': round(coverage, 3), 'gap_ratio': round(gap_ratio, 3),
                'stem_left': stem_left, 'hit_cells': removed[:40],
                'after_preview': left[:100]}
    if stem_left < MIN_STEM_LEFT:
        return {'cls': 'DESTRUCTIVE', 'why': f'抽取后 stem 仅剩 {stem_left} 字',
                'coverage': round(coverage, 3), 'gap_ratio': round(gap_ratio, 3),
                'stem_left': stem_left, 'hit_cells': removed[:40],
                'after_preview': left[:100]}
    if coverage < INCIDENTAL_MAX:
        return {'cls': 'INCIDENTAL', 'why': '只是碰巧命中正文短语, 抽掉=挖洞',
                'coverage': round(coverage, 3), 'gap_ratio': round(gap_ratio, 3),
                'stem_left': stem_left, 'hit_cells': removed[:40],
                'after_preview': left[:100]}
    if coverage >= BLOCK_MIN and gap_ratio <= GAP_RATIO:
        return {'cls': 'FLATTENED_BLOCK', 'why': '整块扁平化, 结构上可安全抽出',
                'coverage': round(coverage, 3), 'gap_ratio': round(gap_ratio, 3),
                'stem_left': stem_left, 'hit_cells': removed[:40],
                'after_preview': left[:100]}
    return {'cls': 'UNCERTAIN', 'why': '覆盖率居中或与正文交错, 需人判',
            'coverage': round(coverage, 3), 'gap_ratio': round(gap_ratio, 3),
            'stem_left': stem_left, 'hit_cells': removed[:40],
            'after_preview': left[:100]}


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--kind', default=None, help='只跑指定表型 (data_table/option_layout)')
    a = ap.parse_args()
    if not a.dsn:
        log('!! 需要 DATABASE_URL')
        return 2

    import asyncpg
    conn = await asyncpg.connect(a.dsn)
    try:
        rows = await conn.fetch(f"""
            SELECT t.id AS tid, t.question_id, t.table_kind, t.rows AS trows,
                   q.stem, q.options, p.subject,
                   coalesce(q.analysis, '') AS analysis
              FROM public.question_tables t
              JOIN public.exam_questions q ON q.id = t.question_id
              JOIN public.exam_papers   p ON p.id = t.paper_id
             WHERE t.question_id IS NOT NULL
               {'AND t.table_kind = $1' if a.kind else ''}
             ORDER BY t.id""" + (' LIMIT $2' if a.limit and a.kind else
                                 (' LIMIT $1' if a.limit else '')),
            *([a.kind] + ([a.limit] if a.limit else []) if a.kind else
              ([a.limit] if a.limit else [])))
    finally:
        await conn.close()

    log(f'待评估归属组: {len(rows)}')

    st = Counter()
    st.where_stat = Counter()
    by_kind = Counter()
    by_subject = {}
    samples = {'FLATTENED_BLOCK': [], 'UNCERTAIN': [], 'INCIDENTAL': [], 'DESTRUCTIVE': [], 'NO_HIT_IN_STEM': []}

    for r in rows:
        opts = r['options']
        if isinstance(opts, str):
            try:
                opts = json.loads(opts)
            except Exception:
                opts = {}
        opt_text = ' '.join((opts or {}).values())
        trows = r['trows']
        if isinstance(trows, str):
            trows = json.loads(trows)
        cells = [c for row in trows for c in row
                 if isinstance(c, str) and len(c.strip()) >= MIN_CELL]
        if not cells:
            st['no_usable_cell'] += 1
            continue
        res = probe(r['stem'] or '', opt_text, cells, r['table_kind'], r['analysis'] or '')
        st[res['cls']] += 1
        if res.get('where'):
            st.where_stat[res['where']] += 1
        by_kind[(r['table_kind'], res['cls'])] += 1
        d = by_subject.setdefault(r['subject'], Counter())
        d[res['cls']] += 1
        if len(samples.get(res['cls'], [])) < 12:
            samples.setdefault(res['cls'], []).append({
                'question_id': r['question_id'], 'table_id': r['tid'],
                'subject': r['subject'], 'table_kind': r['table_kind'],
                'why': res['why'], 'coverage': res['coverage'],
                'gap_ratio': res['gap_ratio'], 'stem_left': res['stem_left'],
                'stem_before': (r['stem'] or '')[:140],
                'removed_head': res['hit_cells'][:60],
                'stem_after': res.get('after_preview', '')[:100],
            })

    total = sum(v for k, v in st.items() if k != 'no_usable_cell')
    log('')
    log('════ P4-c 重抽风险探针 ════')
    log(f"评估归属组 {total}  (无可用单元格 {st['no_usable_cell']})")
    for cls in ('FLATTENED_BLOCK', 'UNCERTAIN', 'INCIDENTAL', 'DESTRUCTIVE', 'NO_HIT_IN_STEM'):
        if st[cls]:
            log(f"  {cls:<15} {st[cls]:<5} ({st[cls]/max(total,1):.1%})")
    if st['NO_HIT_IN_STEM']:
        log(f"  NO_HIT 细分: {dict(st.where_stat)}")
    log('')
    log('按表型:')
    for (k, c), v in sorted(by_kind.items()):
        log(f"  {k:<15} {c:<15} {v}")
    log('')
    log('按学科 (D=DESTRUCTIVE / U=UNCERTAIN / B=FLATTENED_BLOCK / I=INCIDENTAL):')
    for s, c in sorted(by_subject.items(), key=lambda kv: -kv[1].get('DESTRUCTIVE', 0)):
        log(f"  {s:<10} D={c.get('DESTRUCTIVE', 0):<4} U={c.get('UNCERTAIN', 0):<4} "
            f"B={c.get('FLATTENED_BLOCK', 0):<4} I={c.get('INCIDENTAL', 0):<4} "
            f"none={c.get('NO_HIT_IN_STEM', 0)}")

    ts = datetime.now().strftime('%Y%m%d-%H%M%S')
    LOGS.mkdir(parents=True, exist_ok=True)
    out = LOGS / f'reextract-risk-{ts}.json'
    out.write_text(json.dumps({
        'generated_at': ts, 'groups_total': total, 'no_usable_cell': st['no_usable_cell'],
        'classes': {k: v for k, v in st.items()},
        'by_kind': {f'{k[0]}|{k[1]}': v for k, v in by_kind.items()},
        'by_subject': {k: dict(v) for k, v in by_subject.items()},
        'samples': samples,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    log('')
    log(f'已写入 {out}  (含各类人工复核样例)')
    return 0


sys.exit(asyncio.run(main()))
