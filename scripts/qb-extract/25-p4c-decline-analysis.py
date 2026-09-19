#!/usr/bin/env python3
"""25-p4c-decline-analysis.py —— P4-c 为什么下降（**只读**，不写库、不改 qbx）。

背景
----
表感知重抽取（w:tbl 整块 → ⟦TABLE:n⟧）实测卷级下降：
  题数 1132→1111 / 有答案 863→831 / 可用题 718→703
本脚本回答「下降的那些题，信息是不是本来就住在表格里」。

假设（互斥，可机械判定）
------------------------
  H1 答案住在表里     —— baseline 抽到的答案文本，在原文里位于 w:tbl 单元格内
  H2 题号锚点在表里   —— 切分用的题号行（QNUM）位于 w:tbl 内，表格不透明后切分点消失
  H3 答案区锚点在表里 —— 卷末「参考答案」等强锚点位于 w:tbl 内，答案区定位失败
  H4 选项住在表里     —— 选项文本位于 w:tbl 内（已知：option_layout）

做法
----
对每份卷：
  1. 用 qbx（未改动的原版）跑 baseline，取每题的 answer / options 文本
  2. 单独解析 docx，把**所有 w:tbl 单元格文本**收集起来
  3. 量化「暴露面」—— 管线依赖表格段落的证据有多少：
       E1 答案来自表格通道 (answer_source='answer_table'，见 qbx:522)
       E2 **表内题号行** —— 切分用的 QNUM 锚点有多少落在表格里（表格不透明就消失）
       E3 答案区强锚点（参考答案/答案解析…）落在表格里的卷数
       E4 表内段落占全卷段落的比例（表格不透明会动多少输入）

初版假设「答案文本本身在表里」实测只有 0.3%，**不是主因**；
真正的暴露面是切分与答案回填**依赖表格段落当输入**。

输出：各假设的命中率 + 可人工复核的样例。

用法
----
  python3 25-p4c-decline-analysis.py --n 60
"""
import argparse
import asyncio
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
sys.path.insert(0, str(Path(__file__).resolve().parent))
import qbx  # noqa: E402

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
QNUM = re.compile(r'^\s*(\d{1,2})\s*[.．、]\s*(?=\S|$)')
# 与 qbx.candidate_layouts 同一族的答案区强锚点
ANSWER_SECTION_STRONG = re.compile(r'参考答案|答案与解析|答案解析|参考答案及|【答案】|答案部分|答案与评分')


def log(*a):
    print(*a, flush=True)


def parse_docx(path: Path):
    """返回 (表内单元格文本集合, 表内段落文本列表, 全文段落文本列表)"""
    z = zipfile.ZipFile(path)
    root = ET.fromstring(z.read('word/document.xml'))
    body = root.find(W + 'body')

    def ptext(p):
        return ''.join(t.text or '' for t in p.iter(W + 't')).strip()

    all_paras = [ptext(p) for p in body.iter(W + 'p')]
    in_tbl_paras, cells = [], []
    for tbl in body.iter(W + 'tbl'):
        for tr in tbl.findall(W + 'tr'):
            for tc in tr.findall(W + 'tc'):
                parts = [ptext(p) for p in tc.iter(W + 'p')]
                parts = [x for x in parts if x]
                if parts:
                    cells.append('　'.join(parts))
                    in_tbl_paras.extend(parts)
    return cells, in_tbl_paras, all_paras


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    ap.add_argument('--n', type=int, default=60, help='抽样卷数')
    a = ap.parse_args()
    if not a.dsn:
        log('!! 需要 DATABASE_URL')
        return 2

    import asyncpg
    conn = await asyncpg.connect(a.dsn)
    try:
        papers = await conn.fetch(f"""
            SELECT DISTINCT p.id, p.subject, p.year, p.paper_file_path
              FROM public.question_tables t
              JOIN public.exam_papers p ON p.id = t.paper_id
             WHERE t.question_id IS NOT NULL AND p.created_at::date = '2026-09-17'
             ORDER BY p.id LIMIT {a.n}""")
    finally:
        await conn.close()

    cache_index = {}
    for f in DOCX_CACHE.rglob('*.docx'):
        cache_index.setdefault(f.name, f)

    log(f'抽样卷数 {len(papers)}')
    st = Counter()
    samples = {'answer_in_table': [], 'qnum_in_table': [], 'anchor_in_table': []}

    for p in papers:
        fp = Path(p['paper_file_path'])
        dx = fp if (fp.suffix.lower() == '.docx' and fp.exists()) else cache_index.get(fp.name)
        if not dx:
            st['no_docx'] += 1
            continue
        try:
            cells, in_tbl, all_paras = parse_docx(dx)
            res = qbx.extract_paper(dx)
        except Exception as e:
            st['failed'] += 1
            log(f"  !! {dx.name}: {str(e)[:60]}")
            continue

        st['papers'] += 1
        in_tbl_set = set(in_tbl)

        # E4: 表内段落占比
        st['e4_paras_total'] += len(all_paras)
        st['e4_paras_in_table'] += len(in_tbl)

        # E1: 答案来自表格通道 (qbx:522 backfill_answer_tables)
        for q in res['questions']:
            st['questions'] += 1
            if (q.get('answer') or '').strip():
                st['with_answer'] += 1
                if q.get('answer_source') == 'answer_table':
                    st['e1_answer_table'] += 1
                    if len(samples['answer_in_table']) < 10:
                        samples['answer_in_table'].append({
                            'paper_id': p['id'], 'subject': p['subject'], 'year': p['year'],
                            'number': q.get('number'),
                            'answer': (q.get('answer') or '')[:60],
                            'docx': str(dx.relative_to(REPO))})
                elif q.get('answer_source') == 'table_positional':
                    st['e1_table_positional'] += 1

        # E3: 答案区强锚点是否在表内
        anchors_in_tbl = [t for t in in_tbl if ANSWER_SECTION_STRONG.search(t)]
        anchors_total = [t for t in all_paras if ANSWER_SECTION_STRONG.search(t)]
        if anchors_total:
            st['h3_papers_with_anchor'] += 1
            if anchors_in_tbl:
                st['h3_anchor_in_table'] += 1
                if len(samples['anchor_in_table']) < 8:
                    samples['anchor_in_table'].append({
                        'paper_id': p['id'], 'subject': p['subject'], 'year': p['year'],
                        'docx': str(dx.relative_to(REPO)),
                        'anchors_in_table': anchors_in_tbl[:3],
                        'total_anchors': len(anchors_total)})

        # E2: 题号行 (切分锚点) 有多少在表内。
        # 人工复核: 表内命中的绝大多数是**小数** (0.01 / 88.0), 被 QNUM 正则误当题号行。
        # 它们虽不是真题号, 但**确实参与** qbx 的 qnum 计数 (candidate_layouts 用
        # sum(qnum[c:])<3 筛 tail 候选) → 表格不透明后计数变化, 策略选择随之改变。
        DECIMAL = re.compile(r'^\s*\d{1,2}[.．]\d')
        qnum_all = [t for t in all_paras if QNUM.match(t)]
        qnum_in_tbl = [t for t in in_tbl if QNUM.match(t)]
        qnum_dec = [t for t in qnum_in_tbl if DECIMAL.match(t)]
        st['e2_qnum_all'] += len(qnum_all)
        st['e2_qnum_in_table'] += len(qnum_in_tbl)
        st['e2_qnum_decimal'] += len(qnum_dec)
        st['e2_qnum_realish'] += len(qnum_in_tbl) - len(qnum_dec)
        if qnum_in_tbl:
            st['e2_papers_with_qnum_in_table'] += 1
            if len(samples['qnum_in_table']) < 8:
                samples['qnum_in_table'].append({
                    'paper_id': p['id'], 'subject': p['subject'], 'year': p['year'],
                    'docx': str(dx.relative_to(REPO)),
                    'qnum_all': len(qnum_all), 'qnum_in_table': len(qnum_in_tbl),
                    'decimal_like': len(qnum_dec),
                    'realish': len(qnum_in_tbl) - len(qnum_dec),
                    'examples': qnum_in_tbl[:4]})

        # H1: 每题的答案文本是否来自表内
        for q in res['questions']:
            st['questions'] += 1
            ans = (q.get('answer') or '').strip()
            if not ans:
                continue
            st['with_answer'] += 1
            hit = [c for c in cells if len(c) >= 4 and c in ans] or \
                  [t for t in in_tbl if len(t) >= 4 and t in ans]
            if hit:
                st['h1_answer_in_table'] += 1
                if len(samples['answer_in_table']) < 10:
                    samples['answer_in_table'].append({
                        'paper_id': p['id'], 'subject': p['subject'], 'year': p['year'],
                        'number': q.get('number'), 'answer': ans[:60],
                        'hit_cell': hit[0][:60], 'docx': str(dx.relative_to(REPO))})

    log('')
    log('════ P4-c 下降归因（暴露面）════')
    log(f"卷 {st['papers']} / 题 {st['questions']} / 有答案 {st['with_answer']}")
    log(f"E1 答案来自表格通道   answer_table={st['e1_answer_table']} "
        f"table_positional={st['e1_table_positional']} "
        f"({st['e1_answer_table']/max(st['with_answer'],1):.1%} of 有答案题)")
    log(f"E2 题号行(切分锚点)在表内 = {st['e2_qnum_in_table']}/{st['e2_qnum_all']} "
        f"({st['e2_qnum_in_table']/max(st['e2_qnum_all'],1):.1%})"
        f"  涉及 {st['e2_papers_with_qnum_in_table']}/{st['papers']} 卷")
    log(f"   其中小数型(0.01/88.0, 被 QNUM 误当题号) {st['e2_qnum_decimal']} / "
        f"疑似真题号 {st['e2_qnum_realish']}")
    log(f"E3 答案区强锚点落在表内的卷 = {st['h3_anchor_in_table']}/{st['h3_papers_with_anchor']}")
    log(f"E4 表内段落占比 = {st['e4_paras_in_table']}/{st['e4_paras_total']} "
        f"({st['e4_paras_in_table']/max(st['e4_paras_total'],1):.1%})")
    log(f"无 docx {st['no_docx']} / 失败 {st['failed']}")

    ts = datetime.now().strftime('%Y%m%d-%H%M%S')
    LOGS.mkdir(parents=True, exist_ok=True)
    out = LOGS / f'p4c-decline-{ts}.json'
    out.write_text(json.dumps({
        'generated_at': ts, 'papers': st['papers'], 'questions': st['questions'],
        'with_answer': st['with_answer'], 'stats': dict(st), 'samples': samples,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    log('')
    log(f'已写入 {out}')
    return 0


sys.exit(asyncio.run(main()))
