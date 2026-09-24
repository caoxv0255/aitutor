#!/usr/bin/env python3
"""text_gate.py —— 题干/选项/解析「文本完整性」闸门 (纯函数, 无 DB 依赖)。

为什么需要 (2026-09-24 实测根因)
--------------------------------
北京数学 2022–2024 有 30 行进了可检索池 (question_vectors) 却是坏文本:
  - 24 行是**跨省错配 + PDF 文本层解码**产物: 题干里混着 PUA 私用区字符
    (U+E000–F8FF, 来自 MathType/WMF 字形映射) 与 `æ ä ã ï å` 一族的
    Latin-1↔UTF-8 单字节误解码; OLE 公式在纯文本层被压成 `f x` / `2 x =`。
  - 11 行丢公式: 公式位置成了 `（ ）`。
这些行在库里"看起来有值", 检索/展示才发现是垃圾 —— 与「静默跳过」同类, 必须在
**入库处**拦下, 而不是等上线后靠肉眼。

策略 (不粗暴清洗到丢信息)
------------------------
- **strip**: 只删 PUA 私用区 (U+E000–F8FF) —— 那是字形映射噪声, 不含可恢复信息,
  删掉是净收益。
- **标记 (flag) 不删**: `æ ä ã ï å` 一族与 U+FFFD 是**不可恢复**的误解码信号。
  删掉只会把损坏藏起来, 所以只标记 + 计数 (warn), 交给评审/回抽。
- **`（ ）` 只告警**: 选择题作答空是合法的 (广西生物/贵州政治/海南政治…) ——
  绝不能当错误拦下。仅计数用于人工抽查。

用法
----
  python3 text_gate.py --selftest     # 离线自检 (无副作用, 可挂 CI)
"""
from __future__ import annotations

import argparse
import re
import sys

PUA_RE = re.compile(r'[\ue000-\uf8ff]')
# `æ ä ã ï å` 一族 = UTF-8 字节被按 Latin-1 单字节解码后的典型残迹。
OLE_FAMILY_RE = re.compile(r'[æäãïå]')
U_FFFD = '\ufffd'
# 选择题作答空 / 公式丢失都长这样; 单独作**告警**, 不作错误。
BLANK_RE = re.compile(r'（\s*）')

LIMIT = 4000   # 单字段扫描上限, 防止超大文本拖垮闸门


def scan(text: str) -> dict:
    """返回一个字段的完整性信号 (纯函数, 不改文本)。"""
    s = (text or '')[:LIMIT]
    return {
        'pua': len(PUA_RE.findall(s)),
        'ole_family': len(OLE_FAMILY_RE.findall(s)),
        'replacement': s.count(U_FFFD),
        'blank_paren': len(BLANK_RE.findall(s)),
    }


def strip_pua(text: str) -> str:
    """仅删 PUA 私用区 (U+E000–F8FF)。其余一律不动。"""
    return PUA_RE.sub('', text or '')


def evaluate_question(q: dict, fields=('stem', 'options', 'analysis')):
    """对一道题的若干文本字段做闸门。

    返回 (cleaned_fields, report):
      cleaned_fields: {field: 已 strip PUA 的值}   —— 只动了 PUA。
      report: {has_error, has_warn, counts, hits}
        has_error = 命中 OLE 误码族 / U+FFFD (不可恢复, 须评审)
        has_warn  = 命中 `（ ）` (合法也可能, 仅告警)
    """
    cleaned, counts = {}, {'pua': 0, 'ole_family': 0, 'replacement': 0, 'blank_paren': 0}
    hits = {}
    for f in fields:
        raw = q.get(f)
        if raw is None:
            cleaned[f] = raw
            continue
        if not isinstance(raw, str):
            raw = str(raw)
        st = scan(raw)
        for k in counts:
            counts[k] += st[k]
        if st['pua'] or st['ole_family'] or st['replacement'] or st['blank_paren']:
            hits[f] = st
        cleaned[f] = strip_pua(raw)
    report = {
        'counts': counts,
        'hits': hits,
        'has_error': counts['ole_family'] > 0 or counts['replacement'] > 0,
        'has_warn': counts['blank_paren'] > 0,
    }
    return cleaned, report


def _selftest() -> int:
    """自检: PUA 必删; OLE 族/FFFD 必标; `（ ）` 只告警且合法行不报错。"""
    bad = 0

    def check(name, cond):
        nonlocal bad
        if cond:
            print(f'  ok  {name}')
        else:
            print(f'  FAIL {name}'); bad += 1

    # PUA 被识别并剥离
    t = '集合\ue0f7M\ue0f8等于'
    check('PUA 识别', scan(t)['pua'] == 2)
    check('PUA 剥离', strip_pua(t) == '集合M等于')
    # OLE 误码族
    check('æ 族识别', scan('已知函数æ ä ã ï å')['ole_family'] == 5)
    # U+FFFD
    check('U+FFFD 识别', scan('a\ufffdb')['replacement'] == 1)
    # （ ）告警但不报错
    _, r = evaluate_question({'stem': '下列正确的是（ ）'})
    check('（ ）告警', r['has_warn'] and not r['has_error'])
    # OLE 族行报错
    _, r2 = evaluate_question({'stem': '函数 f x æ ö'})
    check('OLE 行报错', r2['has_error'])
    # 干净行不报错不告警
    _, r3 = evaluate_question({'stem': '已知集合 A={1,2}，求 A∩B', 'options': None})
    check('干净行无告警', not r3['has_error'] and not r3['has_warn'])
    print('SELFTEST ' + ('FAILED' if bad else 'PASSED'))
    return 1 if bad else 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        sys.exit(_selftest())
    print('用 --selftest 跑自检; 作为库被 05-ingest.py import 使用。')
