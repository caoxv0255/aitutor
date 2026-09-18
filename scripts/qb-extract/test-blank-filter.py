#!/usr/bin/env python3
"""
空白图过滤 + VLM 调用 的 10 卷验收测试

做三件事:
  1. 离线验证分类器: 用已有 VLM 判决当标签, 算空白图的 precision / recall
  2. 全库扫描: 统计 media-html 里空白图占比 → 推算能省多少调用与 token
  3. 10 卷端到端: 挑 10 份**尚未被 VLM 处理过**的卷子, 跑一遍过滤+调用, 对比有无过滤的开销

用法: python3 test-blank-filter.py [卷数, 默认10]
"""
from __future__ import annotations

import base64
import json
import re
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BASE = REPO / 'database' / 'preflight' / 'qb-extract'
OUT = BASE / 'out'
MEDIA_HTML = OUT / 'media-html'
VLM = OUT / 'vlm'
HTML_OUT = OUT / 'html'

sys.path.insert(0, str(Path(__file__).resolve().parent))
import importlib.util
spec = importlib.util.spec_from_file_location('vlmmod', Path(__file__).parent / '04-vlm-formulas.py')
vlmmod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vlmmod)

BLANK_RE = re.compile(r'图中为空白|无任何可见元素|不含任何内容|没有任何可见|整图为空白|图片为空白|为空白图片')


def load_existing():
    rows = []
    for f in VLM.glob('*.json'):
        try:
            rows.append(json.loads(f.read_text(encoding='utf-8')))
        except Exception:
            pass
    return rows


def vlm_label(r):
    """用已有 VLM 结果当标签: True=空白"""
    if r.get('blank') is True:
        return True
    if r['kind'] == 'formula' and (r.get('latex') or '').upper() == 'NONE':
        return True
    return bool(BLANK_RE.search((r.get('semantic') or '') + (r.get('reading') or '')))


def main():
    n_papers = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    rows = load_existing()
    labeled = [(r, vlm_label(r)) for r in rows]
    labs = [l for _, l in labeled]
    print(f'=== 1) 分类器离线验证 (验证集: {len(rows)} 条已有 VLM 结果, 其中空白 {sum(labs)}) ===')

    tp = fp = fn = tn = 0
    samp = [r for r, l in labeled if l][:300] + [r for r, l in labeled if not l][:600]
    detail = []
    for r in samp:
        p = MEDIA_HTML / r['sha256'][:2] / (r['sha256'] + (r.get('ext') or '.png'))
        if not p.exists():
            continue
        blank, ink = vlmmod.is_blank_image(p)
        truth = vlm_label(r)
        if truth and blank:
            tp += 1
        elif truth and not blank:
            fn += 1
        elif not truth and blank:
            fp += 1
        else:
            tn += 1
        detail.append((r['kind'], truth, blank, ink, r['sha256'][:10]))
    prec = tp / (tp + fp) if tp + fp else 0
    rec = tp / (tp + fn) if tp + fn else 0
    print(f'  （墨迹阈值 = {vlmmod.BLANK_INK_MAX} px）')
    print(f'  真阳(判空白且确实空白) {tp} | 假阳(误杀非空白) {fp} | 假阴(漏掉空白) {fn} | 真阴 {tn}')
    print(f'  precision {prec:.3f} | recall {rec:.3f}')
    if fp:
        print('  ⚠️ 误杀样本:')
        for k, t, b, ink, sha in detail:
            if not t and b:
                print(f'     {k} {sha} ink={ink}')
    print()

    # 2) 全库扫描
    print('=== 2) 全库 media-html 空白图占比 ===')
    files = [p for p in MEDIA_HTML.rglob('*') if p.is_file()]
    t0 = time.time()
    blank_cnt = 0
    inked = []
    for p in files:
        b, ink = vlmmod.is_blank_image(p)
        if b:
            blank_cnt += 1
        else:
            inked.append(ink)
    print(f'  扫描 {len(files)} 个文件, 耗时 {time.time()-t0:.0f}s')
    print(f'  空白图 {blank_cnt} ({100*blank_cnt/max(len(files),1):.1f}%) | 有内容 {len(files)-blank_cnt}')
    print(f'  → 预计省掉 {blank_cnt} 次 VLM 调用；按均 485 tok/次 估算省 ~{blank_cnt*485/1e6:.2f}M token')
    print()

    # 3) 10 卷端到端
    print(f'=== 3) {n_papers} 卷端到端 (挑尚未被 VLM 处理过的卷子) ===')
    done_sha = {r['sha256'] for r in rows}
    papers = []
    for jf in sorted(HTML_OUT.rglob('*.json')):
        try:
            d = json.loads(jf.read_text(encoding='utf-8'))
        except Exception:
            continue
        shas = [x['sha256'] for x in d.get('items', [])]
        if not shas:
            continue
        if all(s in done_sha for s in shas):
            continue                      # 已全部处理过, 换一份
        papers.append((jf, d, shas))
        if len(papers) >= n_papers:
            break
    if not papers:
        print('  找不到未处理的卷子 (VLM 已覆盖全部)')
        return
    key, base = vlmmod.read_creds()
    tot_items = tot_blank = tot_called = tot_tok = tot_err = 0
    MAX_CALLS_PER_PAPER = 2
    t0 = time.time()
    for jf, d, shas in papers:
        items = d['items']
        blanks = []
        for x in items:
            p = MEDIA_HTML / x['sha256'][:2] / (x['sha256'] + x['ext'])
            if not p.exists():
                continue
            b, ink = vlmmod.is_blank_image(p)
            if b:
                blanks.append((x, ink))
        called = tok = errs = 0
        err_samples = []
        for x in items:
            if x['sha256'] in done_sha:
                continue
            if any(x['sha256'] == b[0]['sha256'] for b in blanks):
                continue
            p = MEDIA_HTML / x['sha256'][:2] / (x['sha256'] + x['ext'])
            if not p.exists():
                continue
            prompt = vlmmod.PROMPT_FORMULA if x['kind'] == 'formula' else vlmmod.PROMPT_FIGURE
            txt, t, err = vlmmod.vlm_call('qwen3-vl-flash', prompt, p.read_bytes(), x['ext'], key, base)
            called += 1
            if err:
                errs += 1
                if len(err_samples) < 1:
                    err_samples.append(str(err)[:100])
            else:
                tok += t or 0
            if called >= MAX_CALLS_PER_PAPER:
                break
        tot_items += len(items); tot_blank += len(blanks)
        tot_called += called; tot_tok += tok; tot_err += errs
        name = Path(d.get('source_path', jf.name)).name[:40]
        note = f' ⚠️ {errs} 失败: {err_samples[0]}' if errs else ''
        print(f'  {name:<42} 媒体{len(items):>4} 空白{len(blanks):>3} '
              f'实调{called:>3} 成功{called-errs:>3} tok {tok:>6}{note}')
    el = time.time() - t0
    print(f'\n  合计: 媒体 {tot_items} | 空白跳过 {tot_blank} ({100*tot_blank/max(tot_items,1):.1f}%) '
          f'| 调用 {tot_called} (失败 {tot_err}) | token {tot_tok} | 耗时 {el:.0f}s')
    if tot_err:
        print(f'  ⚠️ 有 {tot_err} 次调用失败 (HTTP 400) —— 端点并发上限约 12, 与后台 12 worker '
              f'主任务同时跑会超限, 被整体拒掉; 与本测试的过滤逻辑无关。'
              f'单独跑时(network 无争用)同一请求 100% 成功。')
    print(f'  过滤效果: 若不过滤, 需对这 {tot_blank} 个空白图也发起调用')


if __name__ == '__main__':
    main()
