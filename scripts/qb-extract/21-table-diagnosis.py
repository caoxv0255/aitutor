#!/usr/bin/env python3
"""21-table-diagnosis.py —— 表格污染诊断 (P4 表格结构化 Phase 0)。

为什么要先诊断
--------------
`qbx.py` 完全不处理 OOXML `w:tbl` (grep 零命中) —— 表内段落被当成正文段落、
按文档顺序塞进文本流。后果不是「表格没结构化」这么简单, 而是**结构丢失 + 内容串味**:

    2018 天津语文 docx 表1/表2 是 A-D 选项排版, 库里那题的 options 实测:
      A = "悄无声息盘垣澄澈深邃"                 ← 表1第1行 + 表2第1格, 跨表拼接
      D = "偃卧兀立睥睨（2）依次填入…B．幽邃…"   ← 吞掉了第(2)题的表格

在不知道「多少题被污染、污染成什么样」之前建资产表, 等于把污染数据当作已验收的一部分。
本脚本只做量化, **不改任何数据**。

判据 (全部机械可复现, 不做语义筛选)
----------------------------------
  CONTAMINATED  题的 stem/options/解析 里出现了**同卷某张表的单元格文本** (长度≥4)
                → 表格内容已混进题面。分两档可信度:
                  strong = 命中单元格 ≥2 个, 或命中单元格长度 ≥8 (短串有误命中风险)
                  weak   = 只命中 1 个且长度 4–7 (如「2007年」这种泛用词)
  SPLIT        一张表的单元格文本落在 **≥2 个 question_id** 的题面里
                → 表被拆散分给多题 (数据表被拆=信息碎裂; 选项排版表被拆=选项串题)
  DROPPED      整张表的单元格在本卷**任何题面/解析/答案里都找不到** → 内容被丢弃

**被废弃的判据**: 曾用「options 含 `（N）` 且 N≠题号」当串味信号, 实测**不成立** ——
那绝大多数是合法子问编号 (G4: 7990 题含子问 / 34816 子问实体化)。
串味必须**锚定在表格上**才能判断, 否则就是把正常结构误报成缺陷。

表型分类 (机械): 首列单元格 ≥50% 匹配 ^[A-D][．.、)] → option_layout (选项排版),
                否则 data_table (数据表)。两类处置方式不同, 必须先分开统计。

输出
----
  database/preflight/qb-extract/logs/table-diagnosis-<ts>.json
  屏幕打印人读版 (含可人工复核的样例)

用法
----
  python3 21-table-diagnosis.py            # 本批 (exam_papers.created_at = 2026-09-17)
  python3 21-table-diagnosis.py --limit 50 # 只跑前 N 卷 (试跑)
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
HTML_RAW = REPO / 'database' / 'preflight' / 'qb-extract' / 'html-raw'

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
BATCH_DATE = '2026-09-17'
OPT_LEAD = re.compile(r'^\s*[A-D][．.、)）]')
PAREN_NUM = re.compile(r'（([0-9]{1,2})）')
MIN_CELL = 4  # 短于 4 字的单元格不做匹配 (避免空串/单字误命中)


def log(*a):
    print(*a, flush=True)


# ───────────────────────── docx 表格解析 ─────────────────────────

def parse_tables(docx_path: Path) -> list:
    """返回 [{'n_rows','n_cols','kind','cells':[[text,...]]}]"""
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
        n_cols = max(len(r) for r in rows)
        first_col = [r[0] for r in rows if r and r[0].strip()]
        opt_hits = sum(1 for c in first_col if OPT_LEAD.match(c))
        kind = 'option_layout' if first_col and opt_hits / len(first_col) >= 0.5 else 'data_table'
        out.append({'n_rows': len(rows), 'n_cols': n_cols, 'kind': kind, 'cells': rows})
    return out


def resolve_docx(paper_file_path: str, subject: str, year: int, cache_index: dict) -> Path | None:
    """卷 → docx。DB 里的 paper_file_path 有时直接指 docx-cache, 有时指 incoming 原始路径。"""
    if not paper_file_path:
        return None
    p = Path(paper_file_path)
    if p.suffix.lower() == '.docx' and p.exists():
        return p
    base = p.name
    if base in cache_index:
        return cache_index[base]
    # 原始名可能是 .doc, 转换后是 .docx
    alt = Path(base).with_suffix('.docx').name
    return cache_index.get(alt)


def build_cache_index() -> dict:
    idx = {}
    for f in DOCX_CACHE.rglob('*.docx'):
        idx.setdefault(f.name, f)
    return idx


# ───────────────────────── 主流程 ─────────────────────────

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    ap.add_argument('--limit', type=int, default=0, help='只跑前 N 卷 (试跑)')
    ap.add_argument('--json', dest='json_out', default=None)
    a = ap.parse_args()
    if not a.dsn:
        log('!! 需要 DATABASE_URL')
        return 2

    import asyncpg
    log('建立 docx 索引 …')
    cache_index = build_cache_index()
    log(f'  docx-cache 文件 {len(cache_index)}')

    conn = await asyncpg.connect(a.dsn)
    try:
        papers = await conn.fetch(f"""
            SELECT id, subject, year, province_code, paper_file_path
              FROM public.exam_papers
             WHERE created_at::date = '{BATCH_DATE}'
             ORDER BY id""" + (' LIMIT $1' if a.limit else ''), *([a.limit] if a.limit else []))
        qs = await conn.fetch(f"""
            SELECT q.id, q.paper_id, q.question_number, q.stem, q.options,
                   q.analysis, q.analysis_original, q.reference_answer
              FROM public.exam_questions q
              JOIN public.exam_papers p ON p.id = q.paper_id
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
        # 题面 + 解析 + 答案 全算「库里有没有这段内容」—— 只看 stem/options 会把
        # 「表格内容被塞进解析里」误判成 DROPPED。
        by_paper[r['paper_id']].append({
            'id': r['id'], 'qn': r['question_number'],
            'stem': r['stem'] or '', 'opt_text': ' '.join((opts or {}).values()),
            'other': ' '.join(x for x in (r['analysis'], r['analysis_original'],
                                          r['reference_answer']) if x),
        })

    log(f'本批 {len(papers)} 卷 / {len(qs)} 题, 开始逐卷比对 …')

    in_scope = 0
    rep = {
        'papers_total': len(papers),
        'papers_with_docx': 0, 'papers_no_docx': 0, 'papers_with_tables': 0,
        'tables_total': 0, 'tables_by_kind': Counter(), 'tables_by_subject': Counter(),
        'questions_total': len(qs), 'questions_in_scope': in_scope,
        'contaminated': 0, 'contaminated_strong': 0, 'contaminated_weak': 0,
        'dropped_tables': 0, 'dropped_cells': 0,
        'split_tables': 0, 'split_tables_strong': 0,
        'hit_dist': Counter(), 'hit_dist_strong': Counter(), 'split_by_kind': Counter(),
        'by_subject': defaultdict(lambda: Counter()),
        'samples_contaminated': [], 'samples_split': [], 'samples_dropped': [],
        'dropped_list': [],
    }

    in_scope = 0
    for i, p in enumerate(papers, 1):
        if i % 200 == 0:
            log(f'  … {i}/{len(papers)}')
        dx = resolve_docx(p['paper_file_path'], p['subject'], p['year'], cache_index)
        if not dx:
            rep['papers_no_docx'] += 1
            rep['by_subject'][p['subject']]['no_docx'] += 1
            continue
        rep['papers_with_docx'] += 1
        tables = parse_tables(dx)
        if not tables:
            continue
        rep['papers_with_tables'] += 1
        rep['tables_total'] += len(tables)
        qs_here = by_paper.get(p['id'], [])
        in_scope += len(qs_here)
        # 该卷所有题面/解析/答案的拼接文本 (用于判断表格内容是否被丢弃)
        all_text = '\n'.join(q['stem'] + ' ' + q['opt_text'] + ' ' + q['other'] for q in qs_here)

        for t in tables:
            rep['tables_by_kind'][t['kind']] += 1
            rep['tables_by_subject'][p['subject']] += 1
            cells = [c for row in t['cells'] for c in row if len(c) >= MIN_CELL]
            if not cells:
                continue
            # 该表的单元格分别落在哪些题里 —— 逐表判定, 而不是凭题面形态猜
            hits = {}   # qid -> hit cells
            for q in qs_here:
                hay = q['stem'] + ' ' + q['opt_text'] + ' ' + q['other']
                hit = [c for c in cells if c in hay]
                if hit:
                    hits[q['id']] = hit
            n_hit = len(hits)

            if n_hit == 0:
                rep['dropped_tables'] += 1
                rep['dropped_cells'] += len(cells)
                rep['dropped_list'].append({
                    'paper_id': p['id'], 'subject': p['subject'], 'year': p['year'],
                    'province': p['province_code'], 'kind': t['kind'],
                    'rows': t['n_rows'], 'cols': t['n_cols'], 'n_cells': len(cells),
                    'cells': cells[:8], 'docx': str(dx.relative_to(REPO)),
                })
                if len(rep['samples_dropped']) < 10:
                    rep['samples_dropped'].append({
                        'paper_id': p['id'], 'subject': p['subject'], 'year': p['year'],
                        'kind': t['kind'], 'rows': t['n_rows'], 'cols': t['n_cols'],
                        'cells': cells[:6], 'docx': str(dx.relative_to(REPO)),
                    })
                continue

            # 强命中: 短而泛的单元格 (如「生态系统」「2007年」) 会跨题误命中,
            # 所以另算一版只认强证据的口径 —— 报表时以 strong 为准, weak 只作参考。
            strong_qs = [qid for qid, hit in hits.items()
                         if len(hit) >= 2 or max(len(c) for c in hit) >= 8]
            rep['hit_dist_strong'][min(len(strong_qs), 5)] += 1
            if len(strong_qs) >= 2:
                rep['split_tables_strong'] += 1

            rep['hit_dist'][min(n_hit, 5)] += 1
            if n_hit >= 2:
                rep['split_tables'] += 1
                rep['split_by_kind'][t['kind']] += 1
                if len(rep['samples_split']) < 12:
                    rep['samples_split'].append({
                        'paper_id': p['id'], 'subject': p['subject'], 'year': p['year'],
                        'kind': t['kind'], 'n_questions_hit': n_hit,
                        'question_ids': sorted(hits)[:6],
                        'cells': [hits[q][0] for q in list(hits)[:4]],
                        'docx': str(dx.relative_to(REPO)),
                    })

            # 题级 CONTAMINATED: 一题只记一次, 按可信度分档
            for qid, hit in hits.items():
                strong = len(hit) >= 2 or max(len(c) for c in hit) >= 8
                rep['contaminated'] += 1
                rep['contaminated_strong' if strong else 'contaminated_weak'] += 1
                rep['by_subject'][p['subject']]['contaminated'] += 1
                if strong:
                    rep['by_subject'][p['subject']]['contaminated_strong'] += 1
                if strong and len(rep['samples_contaminated']) < 15:
                    rep['samples_contaminated'].append({
                        'question_id': qid, 'paper_id': p['id'],
                        'subject': p['subject'], 'qn': next(
                            (q['qn'] for q in qs_here if q['id'] == qid), None),
                        'table_kind': t['kind'], 'hit_cells': hit[:3],
                        'stem_head': next((q['stem'][:80] for q in qs_here if q['id'] == qid), ''),
                        'opt_head': next((q['opt_text'][:120] for q in qs_here if q['id'] == qid), ''),
                    })

    # ───────── 输出 ─────────
    ts = datetime.now().strftime('%Y%m%d-%H%M%S')
    LOGS.mkdir(parents=True, exist_ok=True)
    out = Path(a.json_out) if a.json_out else LOGS / f'table-diagnosis-{ts}.json'
    payload = {
        'generated_at': ts, 'scope': f"exam_papers.created_at::date = {BATCH_DATE}",
        'papers_total': rep['papers_total'], 'papers_with_docx': rep['papers_with_docx'],
        'papers_no_docx': rep['papers_no_docx'], 'papers_with_tables': rep['papers_with_tables'],
        'tables_total': rep['tables_total'],
        'tables_by_kind': dict(rep['tables_by_kind']),
        'tables_by_subject': dict(rep['tables_by_subject']),
        'questions_total': rep['questions_total'], 'questions_in_scope': in_scope,
        'contaminated': rep['contaminated'],
        'contaminated_strong': rep['contaminated_strong'],
        'contaminated_weak': rep['contaminated_weak'],
        'dropped_tables': rep['dropped_tables'], 'dropped_cells': rep['dropped_cells'],
        'split_tables': rep['split_tables'], 'split_tables_strong': rep['split_tables_strong'],
        'split_by_kind': dict(rep['split_by_kind']),
        'tables_hit_dist': {str(k): v for k, v in sorted(rep['hit_dist'].items())},
        'tables_hit_dist_strong': {str(k): v for k, v in sorted(rep['hit_dist_strong'].items())},
        'by_subject': {k: dict(v) for k, v in rep['by_subject'].items()},
        'samples_contaminated': rep['samples_contaminated'],
        'samples_split': rep['samples_split'],
        'samples_dropped': rep['samples_dropped'],
        'dropped_list': rep['dropped_list'],
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')

    log('')
    log('════ 表格污染诊断 ════')
    log(f"卷: 总 {rep['papers_total']} / 有 docx {rep['papers_with_docx']} / "
        f"无 docx {rep['papers_no_docx']} / 含表 {rep['papers_with_tables']}")
    log(f"表: 总 {rep['tables_total']}  "
        f"({', '.join(f'{k}={v}' for k, v in rep['tables_by_kind'].items())})")
    log(f"题: 本批 {rep['questions_total']} / 本次范围 {in_scope}")
    log(f"  CONTAMINATED 题面含表单元格  = {rep['contaminated']} "
        f"(strong {rep['contaminated_strong']} / weak {rep['contaminated_weak']})")
    log(f"  DROPPED   整表在库里查无此物 = {rep['dropped_tables']} 张表 "
        f"/ {rep['dropped_cells']} 个单元格")
    log(f"  SPLIT     表被拆给多题       = {rep['split_tables']} 张表 "
        f"(仅强证据 {rep['split_tables_strong']} 张) "
        f"({', '.join(f'{k}={v}' for k, v in rep['split_by_kind'].items())})")
    log(f"  每张表命中的题数分布 (5=≥5): {dict(sorted(rep['hit_dist'].items()))}")
    log(f"  同上, 仅强证据             : {dict(sorted(rep['hit_dist_strong'].items()))}")
    log('')
    log('按学科:')
    for s, c in sorted(rep['by_subject'].items(), key=lambda kv: -kv[1].get('contaminated', 0)):
        log(f"  {s:<10} contaminated={c.get('contaminated', 0):<5} "
            f"strong={c.get('contaminated_strong', 0):<5} no_docx={c.get('no_docx', 0)}")
    log('')
    log(f'已写入 {out}')
    return 0


sys.exit(asyncio.run(main()))
