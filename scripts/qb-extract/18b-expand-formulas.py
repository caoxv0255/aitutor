#!/usr/bin/env python3
"""18b-expand-formulas.py —— 把 latex_formulas 的 **JSON 数组串**展开成逐条公式, 供保真度检查。

背景 (实测污染教训)
------------------
`exam_questions.latex_formulas` 存的不是裸 LaTeX, 而是 **JSON 数组串**:
  `["y = \\\\tan x + \\\\sin x", "\\\\left( \\\\frac{\\\\pi}{2} ..."]`
直接把它喂给 KaTeX 检查是**错的** —— KaTeX 把 `[` `"` 当普通字符渲染, 会"编译通过",
测到的是 JSON 外壳而不是公式 (实测第一版 94.28% 通过率就是这么来的假数字)。

本脚本解析 JSON 后逐条落盘, 再交给 18-formula-fidelity.cjs 检查。
"""
import asyncio
import json
import os
import sys

OUT = '/tmp/eq_expanded.txt'


async def main():
    import asyncpg
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        print('!! 需要 DATABASE_URL')
        return 2
    conn = await asyncpg.connect(dsn)
    try:
        rows = await conn.fetch("""
            SELECT q.latex_formulas, p.subject
              FROM exam_questions q JOIN exam_papers p ON p.id = q.paper_id
             WHERE p.created_at::date='2026-09-17'
               AND q.latex_formulas IS NOT NULL AND btrim(q.latex_formulas) <> ''
        """)
        out, bad, forms = [], 0, {'single': 0, 'multi': 0, 'unparsed': 0}
        per_subj = {}
        for r in rows:
            raw = r['latex_formulas']
            try:
                arr = json.loads(raw)
                if isinstance(arr, str):
                    arr = [arr]
                if not isinstance(arr, list):
                    raise ValueError('not list')
            except Exception:
                bad += 1
                forms['unparsed'] += 1
                out.append(raw)
                continue
            forms['single' if len(arr) == 1 else 'multi'] += 1
            per_subj[r['subject']] = per_subj.get(r['subject'], 0) + len(arr)
            for f in arr:
                if isinstance(f, str) and f.strip():
                    out.append(f)
        with open(OUT, 'w') as fh:
            fh.write('\n'.join(out))
        print(f'题行 {len(rows)}  →  展开公式 {len(out)} 条')
        print(f'形态: {forms}  (unparsed={bad})')
        print('按学科公式数: ' + ', '.join(f'{k}={v}' for k, v in sorted(per_subj.items(), key=lambda x: -x[1])))
        print(f'已写 {OUT}')
        return 0
    finally:
        await conn.close()

sys.exit(asyncio.run(main()))
