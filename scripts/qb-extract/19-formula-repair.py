#!/usr/bin/env python3
"""19-formula-repair.py —— 修 G11 的不可编译公式 + 建 formula_quality 列并回填。

背景
----
实测 (docs/database/g11-threshold-proposal.md): 11039 条公式资产中 38 条 (0.34%) 在
KaTeX 严格模式下**不可编译** —— 这是**客观真缺陷**, 与「F2 阈值如何定义」的争议无关,
所以可以无条件先修。

修复原则
-------
1. **只做可证明的变换**, 不做"猜原意"的重写。
2. **原文不丢**: `latex_original` 存修复前串; `latex` 存修复后串 (归档而非删除)。
3. **改完必须复验**: 修复后重新过 KaTeX, 复验失败的一律**保持原样**并标 F0,
   不允许"改了但没验"入库。
4. 修不了的不硬修, 由闸门 `20-formula-gate.py` 拦住。

实测到的五类坏资产 (a–e) 与对应规则:
  a. **JSON 对象塞进 latex 列** (16 行): `{"latex":"m : m^{\\prime}","reading":"m 比 m 双撇"}`
     → 解析 JSON 取 `.latex`
  b. **双反斜杠** (134 行): `N^{\\\\mathrm{...}}` / `\\\\left(` —— JSON 转义残留
     → 折叠 `\\\\` → `\\` (单反斜杠)
  c. **双下标**: `CS_{2}_{(l)} = ...` / `C_{F}^{L}_{AB}` —— 数学上非法
     → 把前面的组包起来: `{CS_{2}}_{(l)}`
  d. **括号不配对**: `N^{\\mathrm{N}^{\\mathrm{N}})` / `\\frac{1}{2+\\frac{1}{2+\\frac{1}{2}})`
     → 花括号不平衡时把尾部多余的 `)` 换成 `}`
  e. **`\\.` 在数学模式非法** (KaTeX 严格模式): `y\\.0` → `y.0`
  f. **中文标点混入**(顿号进下标): `O_{、}O^{'}` / `Mn、Zn_{1-y}Fe_2O_3` → 剥掉(\\text{} 内保留)

F 级口径 (方案 A, 与提案文档一致)
  F0 = 不可编译 (KaTeX 严格模式失败 / 空)
  F1 = 可编译但含中文/全角字符
  F2 = 可编译且干净  ← 默认达标档
"""
import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CHECK = REPO / 'scripts/qb-extract/katex-check.cjs'

CJK_PUNCT = '、，。；：！？（）【】《》“”‘’'


# ---------- 规则 (顺序敏感) ----------
# JSON 包装行的**真判据**: 以 `{"` 开头且带 latex/reading 字段。
# ⚠️ 不能只用 `LIKE '{%'` —— 实测 16 条里大多数是**真公式**(`{}^{14}_{6}C + Y \rightarrow ...`
#    碳14记法 / `{}^{2}_{1}\text{H}` 氘), 用 `{%` 判会误把好公式当 JSON。
JSONISH = re.compile(r'^\{\s*"[a-zA-Z_]+"\s*:')


def r_json(s: str) -> str:
    """a. JSON 包装行 → 抽 .latex / .reading 字段。

    ⚠️ **不许用 json.loads**: 这些是 VLM 产出的 "JSON-ish" 文本, 转义不规范, 而且
       `"\\text{ }"` 里的 `\\t` 在 JSON 里是**合法转义(制表符)** → json.loads 会"成功"但
       把 `\\text` 静默变成 `TAB+ext` (实测 #160817 就这么被损坏)。
    改用**正则抽字段 + 折叠转义**: 不经过 JSON 解析器, 不碰字段内容语义。
    """
    t = s.strip()
    if not JSONISH.match(t):
        return s
    m = re.search(r'"latex"\s*:\s*"(.*?)"\s*(?:,\s*"|\}\s*$)', t, re.S)
    if not m:
        m = re.search(r'"(?:reading|text)"\s*:\s*"(.*?)"\s*(?:,\s*"|\}\s*$)', t, re.S)
    if not m:
        return s
    v = m.group(1)
    v = v.replace('\\\\', '\\')     # 折叠转义残留:  `\\\\frac` → `\\frac`
    v = v.replace('\\"', '"').replace('\\/', '/')
    return v.strip() if v.strip() else s


def r_collapse_bs(s: str) -> str:
    """b. 折叠双反斜杠 → 单反斜杠。

    只折叠**命令/符号**前的 `\\\\`; 不碰真正的 LaTeX 换行 `\\\\` (公式都是单行, 无换行语义)。

    ⚠️ 替换必须用 lambda: `re.sub(pat, '\\', s)` 里的 `'\\'` 会被当**模板**解析 →
       抛 `re.error: bad escape (end of pattern)`, 而调用方的 `except: continue` 会把它
       静默吞掉, 表现为"规则未产生变化" (实测就是这么骗了我一轮)。
    """
    return re.sub(r'\\\\(?=[a-zA-Z{}()\[\]|.,;:!])', lambda m: '\\', s)


def r_dot(s: str) -> str:
    """e. `\\.` (数学模式的 accent, KaTeX 严格模式拒绝) → `.`"""
    return re.sub(r'\\\.', '.', s)


def r_slash(s: str) -> str:
    """e2. `\\/` (非法命令) → `/`"""
    return s.replace(r'\/', '/')


def r_left_right(s: str) -> str:
    """d1. 补 \\left 缺 \\right 的配对。

    ⚠️ 字典键必须是**裸字符**: 捕获组 `(\\?[{}()\\[\\]|.])` 里反斜杠是可选的,
       对 `\\left(` 捕获到的是 `(` 而不是 `\\(` —— 键写成 `r'\\('` 会 KeyError (实测踩过)。
    """
    out = s
    guard = 0
    while out.count(r'\left') > out.count(r'\right') and guard < 8:
        guard += 1
        m = list(re.finditer(r'\\left\s*(\\?[{}()\[\]|.])', out))
        if not m:
            break
        last = m[-1]
        d = last.group(1).lstrip('\\')          # 裸字符, 与 close 表对齐
        close = {'(': ')', ')': '(', '{': '}', '}': '{', '[': ']', ']': '[', '|': '|', '.': '.'}
        out = out[:last.end()] + ' \\right' + close.get(d, ')') + out[last.end():]
    return out


def r_double_sub(s: str) -> str:
    """c. 双下标 → 把前面的组包起来。

    `CS_{2}_{(l)}`  → `{CS_{2}}_{(l)}`
    `C_{F}^{L}_{AB}` → `{C_{F}^{L}}_{AB}`
    """
    out = s
    # 形态 1: X_{A}_{B}   (X 为字母数字串)
    # ⚠️ `(?<!\{)` 必须有: 否则已正确包裹的 `{CS_{2}}_{(l)}` 会被再包一层变成 `{{CS_{2}}_...`
    out = re.sub(r'(?<!\{)([A-Za-z0-9]+)_\{([^{}]*)\}_\{',
                 lambda m: '{' + m.group(1) + '_{' + m.group(2) + '}}_{',
                 out)
    # 形态 2: X_{A}^{B}_{C}
    out = re.sub(r'(?<!\{)([A-Za-z0-9]+)_\{([^{}]*)\}\^\{([^{}]*)\}_\{',
                 lambda m: '{' + m.group(1) + '_{' + m.group(2) + '}^{' + m.group(3) + '}}_{',
                 out)
    return out


def r_braces(s: str) -> str:
    """d2. 花括号配对修复。

    三种形态 (实测):
      · `{` 多于 `}` 且尾部有多余 `)` → 把 `)` 换成 `}`   (`N^{\\mathrm{...}})` 形态)
      · `{` 多于 `}` 且无 `)` 可换   → 末尾补足缺失的 `}`  (截断形态)
      · `}` 多于 `{`                 → 删掉多余的尾部 `}`  (不硬补 `{`, 语义不明)
    """
    out = s
    for _ in range(8):
        o, c = out.count('{'), out.count('}')
        if o == c:
            break
        if o > c:
            idx = out.rfind(')')
            # ⚠️ 判 `)` 是否**多余**必须把 idx 自己算进去: 用 out[:idx] 的话它本身不在切片里,
            #    条件恒为 False → 退化成"末尾追加 }", 结果把 `)` 留在公式里 (会渲染出一个多余右括号)。
            #    实测踩过: `N^{\mathrm{N}^{\mathrm{N}})` → `N^{\mathrm{N}^{\mathrm{N}})}` ✗
            if idx > 0 and out[:idx + 1].count(')') > out[:idx + 1].count('('):
                out = out[:idx] + '}' + out[idx + 1:]
                continue
            out += '}' * (o - c)
            break
        # } 多于 { : 从右往左删掉多余的 } (兜底变换, 复验不过会回滚原文)
        for _ in range(c - o):
            i = out.rfind('}')
            if i < 0:
                break
            out = out[:i] + out[i + 1:]
        break
    return out


def r_punct(s: str) -> str:
    """f. 剥掉混进公式的中文标点 (\\text{...} 内的原样保留)。"""
    parts = re.split(r'(\\text\{[^}]*\})', s)
    return ''.join(p if i % 2 else p.translate(str.maketrans('', '', CJK_PUNCT))
                   for i, p in enumerate(parts))


RULES = [('json', r_json), ('collapse_bs', r_collapse_bs), ('dot', r_dot), ('slash', r_slash),
         ('left_right', r_left_right), ('double_sub', r_double_sub),
         ('braces', r_braces), ('punct', r_punct)]


def katex_batch(items):
    """items: [(id, latex)] → {id: (ok_render, err, ok_strict)}

    判据用 **ok_render** (能真渲染), 不是 strict —— strict:'error' 是 lint 级严格度,
    会把 `\\text{∪}` 之类**渲染没问题**的公式判成坏, 实测把 38 条里的一批误判成缺陷。
    """
    with tempfile.NamedTemporaryFile('w', suffix='.jsonl', delete=False) as f:
        for qid, s in items:
            f.write(json.dumps({'id': qid, 'latex': s}, ensure_ascii=False) + '\n')
        inf = f.name
    outf = inf + '.out'
    subprocess.run(['node', str(CHECK), inf, outf], check=True, capture_output=True, cwd=str(REPO))
    res = {}
    with open(outf) as fh:
        for line in fh:
            if line.strip():
                d = json.loads(line)
                res[d['id']] = (d['ok'], d.get('err', ''), d.get('ok_strict', False))
    os.unlink(inf)
    os.unlink(outf)
    return res


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--redo', action='store_true',
                    help='把已修行回退到 latex_original 后重跑 (修好规则后需要重验旧结果时用)')
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    a = ap.parse_args()
    if not a.dsn:
        print('!! 需要 DATABASE_URL')
        return 2
    import asyncpg
    conn = await asyncpg.connect(a.dsn)
    try:
        if not a.dry_run:
            await conn.execute("""
                ALTER TABLE question_formulas
                  ADD COLUMN IF NOT EXISTS latex_original  TEXT,
                  ADD COLUMN IF NOT EXISTS formula_quality VARCHAR(2) NOT NULL DEFAULT 'F0',
                  ADD COLUMN IF NOT EXISTS repair_note     TEXT
            """)
            print('列已确保存在: latex_original / formula_quality / repair_note')
        if a.redo and not a.dry_run:
            n = await conn.fetchval("""
                WITH u AS (UPDATE question_formulas
                              SET latex = latex_original,
                                  repair_note = COALESCE(repair_note, '') || ' [redo回退]'
                            WHERE latex_original IS NOT NULL RETURNING 1)
                SELECT count(*) FROM u""")
            print(f'--redo: 已回退 {n} 行为原文, 重新应用规则')

        rows = await conn.fetch("SELECT id, latex FROM question_formulas ORDER BY id")
        print(f'公式总数: {len(rows)}')

        first = katex_batch([(r['id'], r['latex']) for r in rows])
        bad = [(r['id'], r['latex']) for r in rows if not first[r['id']][0]]
        print(f'初检不可编译: {len(bad)}')

        fixed, unfixable = [], []          # (qid, orig, new|err, note)
        for qid, orig in bad:
            # ⚠️ 护栏: JSON 包装行若抽不出字段 → **不许**再套其它规则。
            #    实测教训: 对 `{"latex":"...` 跑 collapse_bs 会把它变成**能渲染的垃圾**
            #    (字符串本身可渲, 内容却是 JSON 外壳), 还会被判成 F2 —— 错资产比缺资产更糟。
            if JSONISH.match(orig.strip()):
                ex = r_json(orig)
                if ex == orig:
                    unfixable.append((qid, orig, 'JSON包装未解析', '不硬修(防止产生能渲染的垃圾)'))
                    continue
            cur, notes = orig, []
            for name, fn in RULES:
                try:
                    nxt = fn(cur)
                except Exception as e:
                    # ⚠️ 不许静默吞异常: 曾经因为 `except: continue` 把 "re.sub 替换模板坏转义"
                    #    吞掉, 表现为"规则未产生变化", 白查一轮。异常必须进 notes 暴露出来。
                    notes.append(f'{name}:异常{type(e).__name__}')
                    continue
                if nxt != cur:
                    cur = nxt
                    notes.append(name)
            if cur == orig:
                unfixable.append((qid, orig, first[qid][1], '规则未产生变化'))
                continue
            chk = katex_batch([(qid, cur)])
            if chk[qid][0] and JSONISH.match(cur.strip()):
                # 能渲染但内容还是 JSON 外壳 → 是"能渲染的垃圾", 不算修好
                unfixable.append((qid, orig, '能渲染但仍是JSON外壳', '+'.join(notes) + '(判为垃圾)'))
            elif chk[qid][0]:
                fixed.append((qid, orig, cur, '+'.join(notes)))
            else:
                unfixable.append((qid, orig, chk[qid][1], '+'.join(notes) + '(复验失败)'))

        print(f'修复成功: {len(fixed)}   仍不可编译: {len(unfixable)}')
        for qid, o, new, note in fixed[:14]:
            print(f'   #{qid} [{note}]')
            print(f'      原: {o[:100]}')
            print(f'      新: {new[:100]}')
        if unfixable:
            print('仍不可编译(保持 F0, 不硬修):')
            for qid, o, err, note in unfixable[:14]:
                print(f'   #{qid} [{note}] {o[:80]!r}')
                print(f'      KaTeX: {err[:100]}')

        if a.dry_run:
            print('DRY-RUN: 未写库')
            return 0

        for qid, orig, new, note in fixed:
            await conn.execute("""
                UPDATE question_formulas
                   SET latex_original = COALESCE(latex_original, $2),
                       latex = $3, repair_note = $4, formula_quality = 'F2'
                 WHERE id = $1""", qid, orig, new, f'自动修复: {note}')

        # 质量列**全量赋值**:
        #   F0 = 复验后仍不可渲染的显式清单 / 空串
        #   F1 = 可渲染但**\\text{} 之外**含中文/全角字符 (\\text{定义} 里的中文是合法的, 先剔掉再判)
        #   F2 = 可渲染且干净
        # ⚠️ 字符类用**真实字符** —— Postgres 正则不认 `\\uXXXX` 转义(会静默不匹配)
        bad_ids = [q for q, _ in bad if not any(f[0] == q for f in fixed)]
        SUSPECT_CLS = '[' + '\u3000-\u303f' + '\uff00-\uffef' + '\u4e00-\u9fff' + ']'
        await conn.execute("""
            UPDATE question_formulas SET formula_quality = 'F0'
             WHERE id = ANY($1::int[]) OR latex IS NULL OR btrim(latex) = ''""", bad_ids)
        await conn.execute(r"""
            UPDATE question_formulas
               SET formula_quality = CASE
                     WHEN regexp_replace(latex, '\\text\{[^}]*\}', '', 'g') ~ $1 THEN 'F1'
                     ELSE 'F2' END
             WHERE NOT (id = ANY($2::int[])) AND latex IS NOT NULL AND btrim(latex) <> ''""",
                           SUSPECT_CLS, bad_ids)

        dist = await conn.fetch("SELECT formula_quality, count(*) n FROM question_formulas GROUP BY 1 ORDER BY 1")
        print('\nformula_quality 分布: ' + ', '.join(f"{r['formula_quality']}={r['n']}" for r in dist))
        n0 = await conn.fetchval("SELECT count(*) FROM question_formulas WHERE formula_quality='F0'")
        print(f'剩余 F0 = {n0} (由闸门 20-formula-gate.py 拦截)')
        return 0
    finally:
        await conn.close()

sys.exit(asyncio.run(main()))
