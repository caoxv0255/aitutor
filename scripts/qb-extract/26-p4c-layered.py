#!/usr/bin/env python3
"""26-p4c-layered.py —— P4-c 路线 A「分层处理」：只换 stem，切分与答案照旧。

为什么换做法
------------
上一版「表感知整卷重抽取」实测下降（有答案 −3.7% / 可用题 −2.1%），归因是
**表格段落同时是管线的输入**：卷末答案表的证据（2.5% 的答案）和题号计数
（影响 tail 候选与布局择优）都靠表内段落。见
`docs/database/p4c-decline-analysis-2026-09-19.md`。

分层处理 = 两个通道各司其职：
  base 通道（原样）  → 切分、答案回填、统计。**表内文本可见**，答案表证据与题号计数不丢
  table-aware 通道   → 只用来生成 stem（data_table 让位成 ⟦TABLE:n⟧，option_layout 保留原文）

护栏（机械判定，不猜）
----------------------
两遍必须**逐题对齐**才采纳 table-aware 的 stem：
  1. 题号集合完全相同（不多不少）
  2. 每题的 options 键集合相同
  3. 两遍题数相同
任一不满足 → **整卷回退 base**（宁可不改，也不静默改坏）。

这样答案、题数、切分**按构造不可能退步**（它们全部来自 base 通道），
唯一的变量是 stem 文本。

用法
----
  python3 26-p4c-layered.py --n 100            # 抽样评估（默认 dry-run，不写库）
  python3 26-p4c-layered.py --n 1634 --apply   # 全量应用（先备份旧 stem 到 logs）
"""
import argparse
import asyncio
import json
import os
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


def log(*a):
    print(*a, flush=True)


def opts_of(q):
    o = q.get('options') or {}
    return o if isinstance(o, dict) else {}


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    ap.add_argument('--n', type=int, default=100, help='抽样卷数')
    ap.add_argument('--apply', action='store_true', help='写库 (默认只评估)')
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
             WHERE t.question_id IS NOT NULL AND p.created_at::date = '{BATCH_DATE}'
             ORDER BY p.id LIMIT {a.n}""")
        dbq = await conn.fetch(f"""
            SELECT q.id, q.paper_id, q.question_number, q.stem
              FROM public.exam_questions q
              JOIN public.exam_papers p ON p.id = q.paper_id
             WHERE p.created_at::date = '{BATCH_DATE}' AND q.archive_state='active'""")
    finally:
        if not a.apply:
            await conn.close()

    by_paper = {}
    for r in dbq:
        by_paper.setdefault(r['paper_id'], {})[r['question_number']] = r

    cache_index = {}
    for f in DOCX_CACHE.rglob('*.docx'):
        cache_index.setdefault(f.name, f)

    log(f'卷 {len(papers)}（{"应用模式" if a.apply else "评估模式, 不写库"}）')

    st = Counter()
    updates = []          # (question_id, new_stem, old_stem)
    backup = []
    samples = {'adopted': [], 'reverted': []}

    for i, p in enumerate(papers, 1):
        if i % 100 == 0:
            log(f'  … {i}/{len(papers)}')
        fp = Path(p['paper_file_path'])
        dx = fp if (fp.suffix.lower() == '.docx' and fp.exists()) else cache_index.get(fp.name)
        if not dx:
            st['no_docx'] += 1
            continue
        try:
            base = qbx.extract_paper(dx)
        except Exception as e:
            st['base_failed'] += 1
            log(f'  !! base 失败 {dx.name}: {str(e)[:60]}')
            continue
        # 护栏 0: **索引守恒** —— 段落数不一致说明有没兜住的嵌套结构
        # (文本框里的表格曾让 ta 少 16 段 → mask_regions IndexError)。
        # 这种卷直接跳过, 不猜、不硬跑。
        try:
            n_base = len(qbx.read_paras(dx, table_aware=False)[0])
            n_ta = len(qbx.read_paras(dx, table_aware=True)[0])
        except Exception as e:
            st['read_failed'] += 1
            continue
        if n_base != n_ta:
            st['revert_index_mismatch'] += 1
            if len(samples['reverted']) < 8:
                samples['reverted'].append({
                    'paper_id': p['id'], 'subject': p['subject'], 'year': p['year'],
                    'docx': str(dx.relative_to(REPO)),
                    'reason': f'段落数不守恒 base={n_base} ta={n_ta}'})
            continue
        try:
            ta = qbx.extract_paper(dx, table_aware=True,
                                   force_strategy=(base['doc_kind'], base['answer_regions']))
        except Exception as e:
            st['ta_failed'] += 1
            log(f'  !! ta 失败 {dx.name}: {str(e)[:60]}')
            continue

        st['papers'] += 1
        b = {q.get('number'): q for q in base['questions']}
        t = {q.get('number'): q for q in ta['questions']}
        if set(b) != set(t) or len(b) != len(t):
            st['revert_number_mismatch'] += 1
            if len(samples['reverted']) < 8:
                samples['reverted'].append({
                    'paper_id': p['id'], 'subject': p['subject'], 'year': p['year'],
                    'docx': str(dx.relative_to(REPO)), 'reason': '题号集合不一致',
                    'base_only': sorted(set(b) - set(t))[:8],
                    'ta_only': sorted(set(t) - set(b))[:8]})
            continue

        adopted = 0
        for num, qb_ in b.items():
            qt = t[num]
            if set(opts_of(qb_)) != set(opts_of(qt)):
                st['revert_options_mismatch'] += 1
                adopted = 0
                if len(samples['reverted']) < 8:
                    samples['reverted'].append({
                        'paper_id': p['id'], 'subject': p['subject'], 'year': p['year'],
                        'docx': str(dx.relative_to(REPO)),
                        'reason': f'第{num}题 options 键不一致',
                        'base_keys': sorted(opts_of(qb_)), 'ta_keys': sorted(opts_of(qt))})
                break
            old_stem = qb_.get('stem') or ''
            new_stem = qt.get('stem') or ''
            if old_stem == new_stem:
                continue
            # 护栏 4: 填空标记守恒 —— 表格让位成 ⟦TABLE:n⟧ 时, 若 base stem 里的
            #   填空标记（______ / （  ） / ___）被一并吃掉, 题就不可答.
            #   base 有而 ta 没有 → 回退该题 (保持原 stem)。
            if qbx.FILL_BLANK.search(old_stem) and not qbx.FILL_BLANK.search(new_stem):
                st['revert_fill_blank_lost'] += 1
                if len(samples['reverted']) < 8:
                    samples['reverted'].append({
                        'paper_id': p['id'], 'subject': p['subject'], 'year': p['year'],
                        'docx': str(dx.relative_to(REPO)),
                        'reason': f'第{num}题 填空标记被表格让位吃掉'})
                continue
            if '⟦TABLE:' not in new_stem:
                continue          # 没占位符 = 这题没受表格影响, 不动
            db_row = by_paper.get(p['id'], {}).get(num)
            if not db_row:
                st['db_row_missing'] += 1
                continue
            updates.append((db_row['id'], new_stem, old_stem))
            backup.append({'question_id': db_row['id'], 'paper_id': p['id'],
                           'question_number': num, 'stem_before': old_stem,
                           'stem_after': new_stem})
            adopted += 1
            st['stem_changed'] += 1
            st['stem_len_before'] += len(old_stem)
            st['stem_len_after'] += len(new_stem)
        if adopted:
            st['papers_adopted'] += 1
            st['papers_adopted_q'] += adopted
            if len(samples['adopted']) < 8:
                u = updates[-1]
                samples['adopted'].append({
                    'paper_id': p['id'], 'subject': p['subject'], 'year': p['year'],
                    'docx': str(dx.relative_to(REPO)), 'question_id': u[0],
                    'stem_before': u[2][:160], 'stem_after': u[1][:160]})
        else:
            st['papers_no_change'] += 1

    log('')
    log('════ P4-c 路线 A 分层处理 ════')
    log(f"卷 {st['papers']} / 采纳 {st['papers_adopted']} / 无变化 {st['papers_no_change']} / "
        f"回退(题号不齐) {st['revert_number_mismatch']} / 回退(选项不齐) {st['revert_options_mismatch']} / "
        f"回退(索引不守恒) {st['revert_index_mismatch']} / 回退(填空标记丢) {st['revert_fill_blank_lost']}")
    log(f"换 stem 的题 {st['stem_changed']}  "
        f"(平均字数 {st['stem_len_before']//max(st['stem_changed'],1)} → "
        f"{st['stem_len_after']//max(st['stem_changed'],1)})")
    log(f"无 docx {st['no_docx']} / base 失败 {st['base_failed']} / ta 失败 {st['ta_failed']} / "
        f"读取失败 {st['read_failed']} / 库内对不上 {st['db_row_missing']}")

    if not a.apply:
        log('\n评估模式: 未写库。确认后加 --apply。')
    else:
        ts = datetime.now().strftime('%Y%m%d-%H%M%S')
        LOGS.mkdir(parents=True, exist_ok=True)
        bk = LOGS / f'p4c-stem-backup-{ts}.json'
        bk.write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding='utf-8')
        log(f'\n旧 stem 已备份: {bk}')
        try:
            await conn.executemany(
                "UPDATE public.exam_questions SET stem=$2, updated_at=now() WHERE id=$1",
                [(qid, ns) for qid, ns, _ in updates])
            log(f'已更新 {len(updates)} 题 stem')
        finally:
            await conn.close()

    ts = datetime.now().strftime('%Y%m%d-%H%M%S')
    LOGS.mkdir(parents=True, exist_ok=True)
    out = LOGS / f'p4c-layered-{ts}.json'
    out.write_text(json.dumps({
        'generated_at': ts, 'mode': 'apply' if a.apply else 'dry-run',
        'papers': st['papers'], 'stats': dict(st), 'samples': samples,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    log(f'已写入 {out}')
    return 0


sys.exit(asyncio.run(main()))
