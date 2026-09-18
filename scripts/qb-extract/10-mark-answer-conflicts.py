#!/usr/bin/env python3
"""10-mark-answer-conflicts.py —— 规范 §68: 答案冲突必须标成 CONFLICT, 不许静默保留其一。

背景 (实测)
-----------
按来源做正确性审计 (只比对**可独立重建**的那部分) 发现真实冲突:

    answer_section      2429 条中 46 条与源的显式答案串不一致  ('源=C 库=B')
    compact_global      1459 条中  4 条不一致
    from_analysis / from_analysis_fill / answer_line_global   0 条

规范 §64/§68 的要求是「宁可 REVIEW_REQUIRED 不造假」: 拿到两个互相矛盾的答案时,
正确做法是**标出来让人裁决**, 而不是挑一个留下、另一个丢掉 —— 后者就是「静默覆盖」。

独立证据只用**无歧义**的两类形态 (不复用被验函数, 避免自证):
  A. 显式区间串      `1-10 CBABDACCBA`            (自带题号范围)
  B. 独占一行的      `21. 答案：A`                 (整行只有它, 不会被选项行干扰)
**不用** `_expand_compact_runs` 对任意行扫描 —— 实测它会把选项行
`21. A. xxx  B. yyy` 读成「21 题答案是 A」。

用法:
  python3 10-mark-answer-conflicts.py --dry-run
  python3 10-mark-answer-conflicts.py
"""
import argparse
import asyncio
import collections
import glob
import json
import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PAPERS = REPO / 'database' / 'preflight' / 'qb-extract' / 'out' / 'papers'
DOCX = REPO / 'database' / 'preflight' / 'qb-extract' / 'docx-cache'

RANGE = re.compile(r'(\d{1,3})\s*[-~`]\s*(\d{1,3})\s*[.．:：]?\s*([A-D][A-D\s]{2,})')
ONLY = re.compile(r'^\s*(\d{1,3})\s*[.．、]\s*(?:参考答案|答案)\s*[】\]]?\s*[:：]?\s*([A-D])\s*$')


def log(*a):
    print(*a, flush=True)


def recon_pool(paras):
    """独立重建的「无歧义答案池」。"""
    pool = {}
    for it in paras:
        t = (it[0] if isinstance(it, (tuple, list)) else it) or ''
        for m in RANGE.finditer(t):
            a, b, ls = int(m.group(1)), int(m.group(2)), re.sub(r'\s', '', m.group(3))
            for i, ch in enumerate(ls):
                if a + i <= b:
                    pool[a + i] = ch
        m2 = ONLY.match(t)
        if m2:
            pool[int(m2.group(1))] = m2.group(2)
    return pool


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    args = ap.parse_args()
    if not args.dsn:
        log('!! 需要 DATABASE_URL'); sys.exit(2)

    import asyncpg
    sys.path.insert(0, str(REPO / 'scripts' / 'qb-extract'))
    import qbx

    by = {c.stem: c for c in DOCX.rglob('*.docx')}
    conflicts = []            # (paper_stem, number, stored, recon, source)
    for f in PAPERS.rglob('*.json'):
        try:
            d = json.loads(f.read_text(encoding='utf-8'))
        except Exception:
            continue
        qs = [q for q in (d.get('questions') or [])
              if q.get('answer') and q.get('answer_source')]
        if not qs:
            continue
        p = by.get(Path(d.get('source_path') or '').stem)
        if not p:
            continue
        try:
            paras, z = qbx.read_paras(p); z.close()
        except Exception:
            continue
        pool = recon_pool(paras)
        for q in qs:
            n = q['number']
            if n in pool and str(pool[n]) != str(q['answer']).strip():
                conflicts.append((Path(d.get('source_path') or '').stem, n,
                                  str(q['answer'])[:24], pool[n], q.get('answer_source')))

    log(f'检出答案冲突 {len(conflicts)} 条 (库=answer 与源的显式答案串不一致)')
    for c in conflicts[:10]:
        log(f'   {c[0][:34]:<36} Q{c[1]:<4} 库={c[2]!r} 源={c[3]} 来源={c[4]}')
    if not conflicts:
        log('无冲突'); return

    if args.dry_run:
        log('\nDRY-RUN: 未写库'); return

    conn = await asyncpg.connect(args.dsn)
    try:
        # 用 (paper 的 source_name, 题号) 定位; 只标记, 不动 answer 内容 ——
        # 「标出来」正是 §68 要的; 删掉或改写都属于造假。
        n = 0
        for stem, num, _stored, _recon, _src in conflicts:
            st = await conn.execute("""
                UPDATE exam_questions q SET answer_status='CONFLICT', updated_at=now()
                 FROM exam_papers p
                WHERE q.paper_id = p.id AND q.question_number = $1
                  AND p.created_at::date = '2026-09-17' AND q.archive_state='active'
                  AND q.answer IS NOT NULL AND q.answer <> ''
                  AND p.paper_file_path LIKE '%' || $2 || '%'
            """, num, stem)
            try:
                n += int(st.split()[-1])
            except (ValueError, IndexError):
                pass
        log(f'\n已标记 answer_status=CONFLICT 的题: {n}')
        left = await conn.fetchval("SELECT count(*) FROM exam_questions WHERE answer_status='CONFLICT'")
        log(f'库内 CONFLICT 总数: {left}')
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
