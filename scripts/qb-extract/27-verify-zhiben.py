#!/usr/bin/env python3
"""27-verify-zhiben.py —— 验证 P4-c 治本: extract_paper(table_aware=True) 单通道
复现 base 通道的切分与答案回填 (内容等价), 且 stem 干净 (含 ⟦TABLE:n⟧).

不写库, 只读。对 N 卷双跑 base / ta, 逐卷对齐:
  - 题号集合一致 (切分等价, 因为 paras_seg == base)
  - 有答案题数一致 (答案回填等价)
  - 每题 options 键集合与文本一致 (选项未被表干扰)
  - ta stem 含 ⟦TABLE:n⟧ 且非空; expand_tables 展开非退化
"""
import asyncio
import os
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DOCX_CACHE = REPO / 'database' / 'preflight' / 'qb-extract' / 'docx-cache'
sys.path.insert(0, str(Path(__file__).resolve().parent))
import qbx  # noqa: E402

BATCH_DATE = '2026-09-17'


def opts_of(q):
    o = q.get('options') or {}
    return o if isinstance(o, dict) else {}


async def main():
    import asyncpg
    # 卷数可配: python 27-verify-zhiben.py [N]  (N<=0 或省略 = 全量)
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    lim_sql = f'LIMIT {limit}' if limit > 0 else ''
    dsn = os.environ.get('DATABASE_URL')
    conn = await asyncpg.connect(dsn)
    try:
        papers = await conn.fetch(f"""
            SELECT DISTINCT p.id, p.subject, p.year, p.paper_file_path
              FROM public.question_tables t
              JOIN public.exam_papers p ON p.id = t.paper_id
             WHERE t.question_id IS NOT NULL AND p.created_at::date = '{BATCH_DATE}'
             ORDER BY p.id {lim_sql}""")
    finally:
        await conn.close()

    cache = {}
    for f in DOCX_CACHE.rglob('*.docx'):
        cache.setdefault(f.name, f)

    st = Counter()
    mism = []
    for i, p in enumerate(papers, 1):
        fp = Path(p['paper_file_path'])
        dx = fp if (fp.suffix.lower() == '.docx' and fp.exists()) else cache.get(fp.name)
        if not dx:
            st['no_docx'] += 1
            continue
        try:
            base = qbx.extract_paper(dx)
            ta = qbx.extract_paper(dx, table_aware=True)
        except Exception as e:
            st['err'] += 1
            mism.append({'paper': p['id'], 'reason': f'异常 {str(e)[:80]}'})
            continue
        bn = {q.get('number'): q for q in base['questions']}
        tn = {q.get('number'): q for q in ta['questions']}
        if set(bn) != set(tn) or len(bn) != len(tn):
            st['num_mismatch'] += 1
            mism.append({'paper': p['id'], 'reason': '题号集合不一致',
                         'base': len(bn), 'ta': len(tn)})
            continue
        ba = sum(1 for q in bn.values() if (q.get('answer') or '').strip())
        ta_a = sum(1 for q in tn.values() if (q.get('answer') or '').strip())
        if ba != ta_a:
            st['answer_mismatch'] += 1
            mism.append({'paper': p['id'], 'reason': '有答案题数不一致',
                         'base': ba, 'ta': ta_a})
            continue
        opt_bad = 0
        stem_bad = 0
        for num in bn:
            if set(opts_of(bn[num])) != set(opts_of(tn[num])):
                opt_bad += 1
                continue
            # 选项文本逐一比对 (非表选项应完全一致)
            for k in opts_of(bn[num]):
                if (opts_of(bn[num]).get(k) or '') != (opts_of(tn[num]).get(k) or ''):
                    opt_bad += 1
                    break
            tstem = (tn[num].get('stem') or '').strip()
            if '⟦TABLE:' not in tstem:
                continue
            # stem 干净 + 展开非退化
            exp = qbx.expand_tables(tstem, ta['tables']).strip()
            if not exp or '⟦TABLE:' in exp:
                stem_bad += 1
        if opt_bad:
            st['opt_mismatch'] += 1
            mism.append({'paper': p['id'], 'reason': f'{opt_bad} 题 options 不一致'})
            continue
        if stem_bad:
            st['stem_bad'] += 1
            mism.append({'paper': p['id'], 'reason': f'{stem_bad} 题 stem 展开退化'})
            continue
        st['ok'] += 1

    print('════ 治本验证 ════')
    print(f"卷 {len(papers)} / 通过 {st['ok']} / "
          f"题号不一致 {st['num_mismatch']} / 答案不一致 {st['answer_mismatch']} / "
          f"options不一致 {st['opt_mismatch']} / stem退化 {st['stem_bad']} / "
          f"异常 {st['err']} / 无docx {st['no_docx']}")
    for m in mism[:20]:
        print('  ', m)


if __name__ == '__main__':
    asyncio.run(main())
