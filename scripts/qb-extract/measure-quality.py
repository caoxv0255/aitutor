#!/usr/bin/env python3
"""
提取质量量化 (用于改动前后的公平对比)

指标:
  总题数 / 有选项题数 / **选项粘连率** / 选项齐全率 / 答案率 / 解析率 / 严格可用率
用法:
  python3 measure-quality.py --save before.json
  python3 measure-quality.py --compare before.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PAPERS = REPO / 'database' / 'preflight' / 'qb-extract' / 'out' / 'papers'


def glued(opts):
    """B/C/D 全被塞进 A 的粘连形态"""
    if not opts or set(opts.keys()) != {'A'}:
        return False
    a = opts.get('A') or ''
    return all(f'{x}.' in a for x in 'BCD')


def measure():
    tot = with_opt = gl = full = ans = ana = usable = usable_canon = 0
    per_subject = {}
    for f in PAPERS.rglob('*.json'):
        try:
            d = json.loads(f.read_text(encoding='utf-8'))
        except Exception:
            continue
        subj = (d.get('identity') or {}).get('subject') or '?'
        for q in d.get('questions') or []:
            tot += 1
            s = per_subject.setdefault(subj, {'n': 0, 'glued': 0, 'opt': 0})
            s['n'] += 1
            o = q.get('options') or {}
            if o:
                with_opt += 1
                s['opt'] += 1
                if glued(o):
                    gl += 1
                    s['glued'] += 1
                if set(o.keys()) >= {'A', 'B', 'C', 'D'}:
                    full += 1
            if q.get('answer'):
                ans += 1
            if q.get('analysis'):
                ana += 1
            if (q.get('stem') or '').strip() and q.get('answer') and q.get('analysis'):
                usable += 1
            # 权威口径 (与 qbx.usable / report.json 一致):
            #   题干 >= 20 字 且 有答案 且 题型已知
            if len((q.get('stem') or '').strip()) >= 20 and q.get('answer') \
                    and q.get('question_type') != 'unknown':
                usable_canon += 1
    pct = lambda a, b: f'{100*a/max(b,1):.2f}%'
    return {
        'total': tot, 'with_options': with_opt, 'glued': gl, 'options_full': full,
        'answer': ans, 'analysis': ana, 'usable': usable, 'usable_canon': usable_canon,
        'usable_canon_rate': round(100 * usable_canon / max(tot, 1), 2),
        'glued_rate': round(100 * gl / max(with_opt, 1), 2),
        'full_rate': round(100 * full / max(with_opt, 1), 2),
        'answer_rate': round(100 * ans / max(tot, 1), 2),
        'analysis_rate': round(100 * ana / max(tot, 1), 2),
        'usable_rate': round(100 * usable / max(tot, 1), 2),
        'per_subject': {k: {'n': v['n'], 'glued_rate': round(100*v['glued']/max(v['opt'],1), 2)}
                        for k, v in sorted(per_subject.items())},
        'pretty': {
            '总题数': f'{tot}',
            '有选项题数': f'{with_opt}',
            '选项粘连 (B/C/D 挤进 A)': f'{gl} ({pct(gl, with_opt)})',
            '选项齐全 (ABCD 俱全)': f'{full} ({pct(full, with_opt)})',
            '有答案': f'{ans} ({pct(ans, tot)})',
            '有解析': f'{ana} ({pct(ana, tot)})',
            '严格可用 (题干+答案+解析)': f'{usable} ({pct(usable, tot)})',
            '严格可用[权威口径] (题干≥20字+有答案+题型已知)': f'{usable_canon} ({pct(usable_canon, tot)})',
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--save')
    ap.add_argument('--compare')
    a = ap.parse_args()
    m = measure()
    for k, v in m['pretty'].items():
        print(f'  {k}: {v}')
    if a.save:
        Path(a.save).write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding='utf-8')
        print(f'\n已保存 → {a.save}')
    if a.compare:
        b = json.loads(Path(a.compare).read_text(encoding='utf-8'))
        print(f"\n=== 对比 (基准 {a.compare}) ===")
        for k in ('total', 'glued', 'options_full', 'answer', 'analysis', 'usable'):
            d = m[k] - b[k]
            print(f'  {k:<14} {b[k]:>7} → {m[k]:>7}  ({d:+d})')
        print(f"  glued_rate     {b['glued_rate']:>6.2f}% → {m['glued_rate']:>6.2f}%")
        print(f"  full_rate      {b['full_rate']:>6.2f}% → {m['full_rate']:>6.2f}%")
        print(f"  usable_rate    {b['usable_rate']:>6.2f}% → {m['usable_rate']:>6.2f}%")
        print('\n  按学科粘连率变化:')
        for k in sorted(set(b['per_subject']) | set(m['per_subject'])):
            o = b['per_subject'].get(k, {}).get('glued_rate', 0)
            n = m['per_subject'].get(k, {}).get('glued_rate', 0)
            flag = ' ← 变差' if n > o + 0.5 else ''
            print(f'    {k:<12} {o:>6.2f}% → {n:>6.2f}%{flag}')


if __name__ == '__main__':
    main()
