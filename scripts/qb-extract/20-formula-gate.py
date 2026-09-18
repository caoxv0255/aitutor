#!/usr/bin/env python3
"""20-formula-gate.py —— G11 公式资产闸门 (独立脚本 + 退出码)。

判据 (方案 A, 见 docs/database/g11-threshold-proposal.md)
--------------------------------------------------------
  **F0 = 0** —— `question_formulas` 中不可渲染 (KaTeX throwOnError) 或空的行必须为 0。

为什么用「可渲染」而不是「strict 模式通过」
------------------------------------------
KaTeX 的 `strict:'error'` 是 **lint 级**严格度, 会把 `\\text{∪}`、中文标点之类
**实际能渲染**的公式判成失败。实测同批数据: strict 口径 38 条"失败", 可渲染口径 21 条
—— 差出来的 17 条是误判。所以闸门用可渲染口径, strict 只作参考。
(与 `11-answer-gate.py` 同款设计: 独立脚本 + 明确退出码, 不做"永远返回 0 的假闸门"。)

退出码
------
  0 = 通过 (F0 = 0)
  1 = 不通过 (存在不可渲染行)  ← CI 据此拦截
  2 = 环境/用法错误 (无 DSN / node 缺失)

用法
----
  python3 scripts/qb-extract/20-formula-gate.py [--json out.json]
"""
import argparse
import asyncio
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CHECK = REPO / 'scripts/qb-extract/katex-check.cjs'


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    ap.add_argument('--json', dest='json_out', default=None)
    ap.add_argument('--table', default='question_formulas',
                    help='被检表 (默认 question_formulas; 供自测/预发表使用)')
    a = ap.parse_args()
    if not a.dsn:
        print('!! 需要 DATABASE_URL')
        return 2
    if not CHECK.exists():
        print(f'!! 缺少检查器 {CHECK}')
        return 2

    import asyncpg
    conn = await asyncpg.connect(a.dsn)
    T = a.table
    try:
        # 1) 库内标记的 F0 (持久化口径, 与 19-formula-repair.py 一致)
        n_f0_db = await conn.fetchval(f"""
            SELECT count(*) FROM {T}
             WHERE formula_quality = 'F0' OR latex IS NULL OR btrim(latex) = ''""")
        total = await conn.fetchval(f"SELECT count(*) FROM {T}")
        dist = {r['formula_quality']: r['n'] for r in await conn.fetch(
            f"SELECT formula_quality, count(*) n FROM {T} GROUP BY 1")}

        # 2) **独立复验**: 不信库内标记, 自己把全量再跑一遍 KaTeX
        rows = await conn.fetch(f"SELECT id, latex FROM {T} ORDER BY id")
        with tempfile.NamedTemporaryFile('w', suffix='.jsonl', delete=False) as f:
            for r in rows:
                f.write(json.dumps({'id': r['id'], 'latex': r['latex'] or ''},
                                   ensure_ascii=False) + '\n')
            inf = f.name
        outf = inf + '.out'
        subprocess.run(['node', str(CHECK), inf, outf], check=True, capture_output=True, cwd=str(REPO))
        bad = []
        with open(outf) as fh:
            for line in fh:
                if line.strip():
                    d = json.loads(line)
                    if not d['ok']:
                        bad.append({'id': d['id'], 'err': d.get('err', '')})
        os.unlink(inf)
        os.unlink(outf)

        print(f'公式总数 {total}   库内标记: ' +
              ', '.join(f'{k}={v}' for k, v in sorted(dist.items())))
        print(f'库内 F0 计数 = {n_f0_db}')
        print(f'**独立复验不可渲染 = {len(bad)}**')
        for b in bad[:10]:
            print(f"   #{b['id']}: {b['err'][:110]}")

        ok = (n_f0_db == 0 and len(bad) == 0)
        print(('PASS' if ok else 'FAIL') + ' — G11 闸门 (F0=0)' +
              ('' if ok else f'  剩余 {len(bad)} 条不可渲染, 见上方清单'))
        if a.json_out:
            Path(a.json_out).write_text(json.dumps(
                {'total': total, 'quality_dist': dist, 'f0_db': n_f0_db,
                 'unrenderable': bad, 'pass': ok}, ensure_ascii=False, indent=2))
        return 0 if ok else 1
    finally:
        await conn.close()

sys.exit(asyncio.run(main()))
