#!/usr/bin/env python3
"""
从提取结果中随机抽 N 道题, 导出成 markdown。

展示「题库原子化」的实际产出: 每道题都带齐
  维度地址(年份/省份/学科/卷型/题号) + 题干 + 选项 + 答案 + 解析
  + 公式 LaTeX + 插图语义描述 + 媒体文件绝对路径

用法: python3 sample-questions.py [题数, 默认10] [--seed N] [--usable-only]
"""
from __future__ import annotations

import argparse
import json
import random
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BASE = REPO / 'database' / 'preflight' / 'qb-extract'
PAPERS = BASE / 'out' / 'papers'
MEDIA = BASE / 'out' / 'media'
VLM = BASE / 'out' / 'vlm'
OUTDIR = BASE / 'out' / 'samples'

SUBJECT_CN = {}


def load_all_questions():
    """返回 [(paper_dict, question_dict), ...]"""
    rows = []
    for jf in sorted(PAPERS.rglob('*.json')):
        try:
            d = json.loads(jf.read_text(encoding='utf-8'))
        except Exception:
            continue
        for q in d.get('questions') or []:
            rows.append((d, q))
    return rows


def vlm_for(sha):
    f = VLM / f'{sha}.json'
    if not f.exists():
        return None
    try:
        return json.loads(f.read_text(encoding='utf-8'))
    except Exception:
        return None


def usable(q):
    """严格可用: 有题干 + 有答案 + 有解析"""
    return bool((q.get('stem') or '').strip()) and bool(q.get('answer')) and bool(q.get('analysis'))


def render(sel, seed):
    L = []
    L.append('# 题库随机抽样验证\n')
    L.append(f'- 抽样时间: {time.strftime("%Y-%m-%d %H:%M:%S%z")}')
    L.append(f'- 随机种子: `{seed}`（同种子可复现同一批题）')
    L.append(f'- 抽样数量: {len(sel)} 道')
    L.append(f'- 来源: `database/preflight/qb-extract/out/papers/`（1634 卷 / 36894 题）')
    L.append('')
    L.append('## 抽样概览\n')
    L.append('| # | 年份 | 省份 | 学科 | 卷型 | 题号 | 题型 | 公式 | 插图 | 答案 | 解析 |')
    L.append('|---|---|---|---|---|---|---|---|---|---|---|')
    for i, (d, q) in enumerate(sel, 1):
        idn = d.get('identity') or {}
        L.append('| {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} |'.format(
            i, idn.get('year') or '—', idn.get('province_code') or '—', idn.get('subject') or '—',
            idn.get('paper_type') or '—', q.get('number') or '—',
            q.get('question_type') or '—',
            '✓' if q.get('has_formula') else '—',
            '✓' if q.get('has_image') else '—',
            '✓' if q.get('answer') else '—',
            '✓' if q.get('analysis') else '—'))
    L.append('')
    L.append('---')
    L.append('')

    for i, (d, q) in enumerate(sel, 1):
        idn = d.get('identity') or {}
        subj = idn.get('subject') or '?'
        L.append(f'## 题 {i}')
        L.append('')
        L.append('**维度地址**（五维定位: 年份 / 省份 / 学科 / 卷型 / 题号）')
        L.append('')
        L.append('```')
        L.append(f"year          = {idn.get('year')}")
        L.append(f"province_code = {idn.get('province_code')}")
        L.append(f"subject       = {subj}")
        L.append(f"paper_type    = {idn.get('paper_type')}")
        L.append(f"question_number = {q.get('number')}")
        L.append('```')
        L.append('')
        L.append(f"**原卷**: `{d.get('source_name') or d.get('source_file')}`  ")
        L.append(f"**题目 uid 依据**: `(paper_id, question_number) = ({idn.get('year')}/"
                 f"{idn.get('province_code')}/{subj}/{idn.get('paper_type')}, {q.get('number')})`")
        L.append('')

        L.append('### 题干')
        L.append('')
        stem = (q.get('stem') or '').strip() or '*（空）*'
        L.append(stem)
        L.append('')

        opts = q.get('options') or {}
        if opts:
            L.append('### 选项')
            L.append('')
            for k in sorted(opts.keys()):
                L.append(f'- **{k}.** {opts[k]}')
            L.append('')
        elif q.get('options_text'):
            L.append('### 选项原文')
            L.append('')
            L.append(q['options_text'])
            L.append('')

        subs = q.get('sub_questions') or []
        if subs:
            L.append(f'### 子问（{len(subs)} 个）')
            L.append('')
            for s in subs:
                txt = s.get('stem') if isinstance(s, dict) else str(s)
                L.append(f'- {txt}')
            L.append('')

        L.append('### 答案')
        L.append('')
        L.append(f"**{q.get('answer') or '（缺）'}**")
        L.append('')
        L.append(f"> 来源: `{q.get('answer_source') or '—'}`")
        L.append('')

        L.append('### 解析')
        L.append('')
        L.append((q.get('analysis') or '*（缺）*').strip())
        L.append('')
        L.append(f"> 来源: `{q.get('analysis_source') or '—'}`")
        L.append('')

        # 公式 / 插图: 结合 VLM 理解结果
        stored = q.get('media_stored') or []
        if stored:
            L.append('### 媒体载体（公式 / 插图）')
            L.append('')
            for j, m in enumerate(stored, 1):
                rel = m.get('rel_path')
                p = (MEDIA / rel) if rel else None
                r = vlm_for(m.get('sha256')) or {}
                L.append(f"**{j}. {m.get('kind')}** — `{(m.get('sha256') or '')[:16]}…` "
                         f"({m.get('bytes', 0)} B)")
                L.append('')
                if p is None:
                    L.append('- 文件: ⚠️ 未落盘（media_stored 无 rel_path）')
                elif p.exists():
                    L.append(f'- 文件: `{p}`')
                else:
                    L.append(f'- 文件: ⚠️ 缺失 `{p}`')
                if r.get('blank'):
                    L.append('- VLM: 判定为空白图（已跳过识别）')
                if r.get('latex'):
                    L.append(f"- **公式 LaTeX**: `{r['latex']}`")
                if r.get('semantic'):
                    L.append(f"- **插图语义**: {r['semantic']}")
                if r.get('model'):
                    L.append(f"- 识别模型: `{r['model']}` / {r.get('tokens')} tok")
                L.append('')

        L.append('### 元信息')
        L.append('')
        L.append('| 字段 | 值 |')
        L.append(f"|---|---|")
        for k in ('question_type', 'has_formula', 'has_image', 'stem_len',
                  'seg', 'backfilled'):
            v = q.get(k, d.get(k))
            L.append(f"| `{k}` | `{v}` |")
        L.append('')
        L.append('---')
        L.append('')
    return '\n'.join(L)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('n', nargs='?', type=int, default=10)
    ap.add_argument('--seed', type=int, default=None)
    ap.add_argument('--usable-only', action='store_true',
                    help='只在严格可用(题干+答案+解析俱全)的题里抽')
    a = ap.parse_args()

    rows = load_all_questions()
    pool = [r for r in rows if usable(r[1])] if a.usable_only else \
           [r for r in rows if (r[1].get('stem') or '').strip()]
    seed = a.seed if a.seed is not None else random.randrange(10 ** 9)
    random.seed(seed)
    sel = random.sample(pool, min(a.n, len(pool)))

    # 避免同一卷里抽中过多 (题目层面仍随机, 只是打散展示顺序)
    sel.sort(key=lambda r: (r[0].get('identity', {}).get('subject') or '',
                            r[0].get('identity', {}).get('year') or 0))

    OUTDIR.mkdir(parents=True, exist_ok=True)
    tag = 'usable' if a.usable_only else 'all'
    out = OUTDIR / f'sample-{len(sel)}-{tag}-{time.strftime("%Y%m%d-%H%M%S")}.md'
    out.write_text(render(sel, seed), encoding='utf-8')

    print(f'题库总量: {len(rows)} 题 (可抽池: {len(pool)})')
    print(f'抽样: {len(sel)} 题, seed={seed}')
    print(f'输出: {out}')
    print(f'大小: {out.stat().st_size/1024:.1f} KB')
    print()
    print('抽样清单:')
    for i, (d, q) in enumerate(sel, 1):
        idn = d.get('identity') or {}
        print(f"  {i:>2}. {idn.get('year')}/{idn.get('province_code')}/{idn.get('subject')}"
              f"/{idn.get('paper_type')} 第{q.get('number')}题  "
              f"题长{len(q.get('stem') or '')}  答案{q.get('answer') or '缺'}  "
              f"公式{'Y' if q.get('has_formula') else 'N'} 图{'Y' if q.get('has_image') else 'N'}")


if __name__ == '__main__':
    main()
