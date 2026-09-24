#!/usr/bin/env python3
"""32-text-integrity-scan.py —— 可复用的 DB 文本完整性检测 (机械判据)。

实现与 text_gate.py 同一套判据, 但作用于**已入库**的数据, 用来回答
「库里现在还有没有坏文本」—— 无需重跑提取。

判据 (与任务给定一致):
  ERROR  stem/options/analysis 命中
           · PUA 私用区  U+E000–U+F8FF
           · OLE 误解码族 [æ ä ã ï å]
           · U+FFFD 替换符
  WARN   `（ ）`  (选择题作答空是合法的, 故只告警)
         + options 非合法 JSON (形态问题, 供参考)

默认射程 = **可检索池** (与相似题检索同口径):
  question_vectors JOIN exam_questions, q_embedding 非空 且 answer 非空。
用 --all 可扩到全表 exam_questions。

退出码: 有 ERROR 命中 → 1; 否则 0 (WARN 不影响退出码)。

用法:
  export DATABASE_URL=postgresql://aitutor:...@localhost:55432/aitutor_db
  python3 scripts/qb-extract/32-text-integrity-scan.py            # 可检索池
  python3 scripts/qb-extract/32-text-integrity-scan.py --all      # 全表
  python3 scripts/qb-extract/32-text-integrity-scan.py --json out.json
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import text_gate  # noqa: E402

POOL_SQL = """
SELECT q.id, q.province_code, q.subject_code, q.year, q.question_number,
       q.stem, q.options, q.analysis
  FROM question_vectors qv JOIN exam_questions q ON q.id = qv.question_id
 WHERE qv.q_embedding IS NOT NULL AND q.answer IS NOT NULL AND TRIM(q.answer) <> ''
"""

ALL_SQL = """
SELECT id, province_code, subject_code, year, question_number, stem, options, analysis
  FROM exam_questions
"""


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--all', action='store_true', help='扫全表 (默认只扫可检索池)')
    ap.add_argument('--json', help='把命中清单写到该文件')
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    a = ap.parse_args()
    if not a.dsn:
        print('缺少 DATABASE_URL'); return 2
    import asyncpg
    conn = await asyncpg.connect(a.dsn.split('?')[0])
    try:
        rows = await conn.fetch(ALL_SQL if a.all else POOL_SQL)
    finally:
        await conn.close()

    scope = 'exam_questions(全表)' if a.all else '可检索池 (question_vectors JOIN, answer 非空)'
    err, warn = [], []
    totals = {'pua': 0, 'ole_family': 0, 'replacement': 0, 'blank_paren': 0}
    for r in rows:
        cleaned, rep = text_gate.evaluate_question(
            {'stem': r['stem'], 'options': r['options'], 'analysis': r['analysis']})
        for k in totals:
            totals[k] += rep['counts'][k]
        if rep['has_error']:
            err.append({'id': r['id'], 'province': r['province_code'], 'subject': r['subject_code'],
                        'year': r['year'], 'qn': r['question_number'],
                        'counts': rep['counts'], 'fields': list(rep['hits'])})
        if rep['has_warn']:
            warn.append({'id': r['id'], 'blank_paren': rep['counts']['blank_paren']})

    print(f'射程: {scope} | 扫 {len(rows)} 行')
    print(f'计数: PUA={totals["pua"]} OLE族={totals["ole_family"]} '
          f'U+FFFD={totals["replacement"]} （）={totals["blank_paren"]}')
    print(f'ERROR 行 (PUA/OLE/FFFD): {len(err)} | WARN 行 (（ ）): {len(warn)}')
    if err:
        print('\nERROR 命中:')
        for e in err[:60]:
            print(f"  id{e['id']} {e['province']}/{e['subject']}/{e['year']} Q{e['qn']} "
                  f"{e['counts']} {e['fields']}")
    if a.json:
        json.dump({'scope': scope, 'scanned': len(rows), 'totals': totals,
                   'errors': err, 'warnings': warn}, open(a.json, 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=1)
        print(f'\n已写 {a.json}')
    return 1 if err else 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
