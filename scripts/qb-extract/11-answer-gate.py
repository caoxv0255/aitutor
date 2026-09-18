#!/usr/bin/env python3
"""答案正确性准入门闸 —— **退出码即判定**, 供 shell 用 `if ... then 入库` 串联。

为什么要单独成文件 (教训): 上一轮把闸门写成「打印一行 PASS/FAIL」的脚本,
         结果 FAIL 之后**入库照跑** —— 打印不是门。
         门必须能用退出码拦住下一步, 否则等于没有门。

判定口径 (只统计**真字母冲突**):
  分母 = 单字母答案 ([A-D]) 的题; 分子 = 与独立重建的答案池不一致的题。
  非字母码答案 (整段正文被当成答案) 属**另一类缺陷**(答案污染), 由 purge_prose_answers
  在管线内处理, 不计入本闸门 —— 否则两类问题会互相淹没。

阈值: 0.5%。超过则非零退出, 调用方必须放弃入库。
"""
import glob
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, 'scripts/qb-extract')
import qbx  # noqa: E402

THRESHOLD = 0.005
LET = re.compile(r'^[A-D]$')


def main() -> int:
    by = {c.stem: c for c in Path('database/preflight/qb-extract/docx-cache').rglob('*.docx')}
    tot = bad = 0
    examples = []
    for f in glob.glob('database/preflight/qb-extract/out/papers/**/*.json', recursive=True):
        d = json.load(open(f, encoding='utf-8'))
        qs = [q for q in (d.get('questions') or []) if q.get('answer') and q.get('answer_source')]
        if not qs:
            continue
        p = by.get(Path(d.get('source_path') or '').stem)
        if not p:
            continue
        try:
            paras, z = qbx.read_paras(p)
            z.close()
        except Exception:
            continue
        pool = {}
        for it in paras:
            t = (it[0] if isinstance(it, (tuple, list)) else it) or ''
            for n, a in qbx._expand_compact_runs(t).items():
                pool.setdefault(n, a)
            m = qbx.ANS_STANDALONE.match(t.strip())
            if m:
                pool.setdefault(int(m.group(1)), m.group(2))
        for n, a in qbx.expand_answer_tables(paras).items():
            pool.setdefault(n, a)
        for q in qs:
            a = str(q['answer']).strip()
            if not LET.match(a):
                continue
            tot += 1
            if q['number'] in pool and pool[q['number']] != a:
                bad += 1
                if len(examples) < 4:
                    examples.append((q['answer_source'], q['number'], pool[q['number']], a))
    rate = bad / max(tot, 1)
    print(f'字母码答案 {tot}, 与源冲突 {bad} = {rate * 100:.3f}%   {examples}')
    if rate > THRESHOLD:
        print(f'准入: FAIL (>{THRESHOLD * 100:.1f}%) —— 不得入库')
        return 1
    print(f'准入: PASS (≤{THRESHOLD * 100:.1f}%) —— 放行')
    return 0


if __name__ == '__main__':
    sys.exit(main())
