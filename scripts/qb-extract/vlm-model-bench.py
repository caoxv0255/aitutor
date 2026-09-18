#!/usr/bin/env python3
"""
VLM 公式识别候选模型对比 — 用「LaTeX 回渲相似度」做可量化评估

方法:
  1. 从 docx→HTML 渲染产物里取真实公式图 (尺寸正确、非空白)
  2. 让候选 VLM 输出该公式的 LaTeX
  3. 用 matplotlib mathtext 把 LaTeX 回渲成图, 与原始公式图做墨迹 IoU 比对
     (两者都二值化 → 等高缩放 → 逐像素比对)
  4. IoU 高 ⇒ LaTeX 忠实还原了公式。这是可自动化、可复核的代理指标。

用法: python3 vlm-model-bench.py <公式图目录或HTML目录> [每模型样本数]
"""
from __future__ import annotations

import base64
import io
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

KEY = Path.home() / '.secrets' / 'aliyun_maas_key'
BASE = Path.home() / '.secrets' / 'aliyun_maas_base'

PROMPT = (
    '这是一道中国高考/中考题里的数学或理科公式图片（来自 Word 的 MathType 公式对象）。\n'
    '请把它转写成 LaTeX。要求:\n'
    '1) 只输出 LaTeX 代码本身, 不要 markdown 代码块, 不要解释\n'
    '2) 行内公式不要加 $ 或 \\\\( \\\\)\n'
    '3) 保持符号完整: 上下标、分式、根号、希腊字母、向量箭头、绝对值、不等号、矩阵等\n'
    '4) 若含中文, 用 \\\\text{中文} 包裹\n'
    '5) 若图片确实不含任何公式内容, 只输出: NONE'
)


def b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


def call(model: str, img: Path, base: str, key: str, timeout=90):
    body = {
        'model': model,
        'messages': [{'role': 'user', 'content': [
            {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{b64(img)}'}},
            {'type': 'text', 'text': PROMPT},
        ]}],
        'max_tokens': 600,
        'temperature': 0.0,
    }
    req = urllib.request.Request(
        f'{base}/chat/completions', data=json.dumps(body).encode(),
        headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=timeout) as r:
        d = json.loads(r.read().decode())
    txt = d['choices'][0]['message']['content'].strip()
    txt = re.sub(r'^```(?:latex)?\s*|\s*```$', '', txt).strip()
    usage = d.get('usage', {})
    return txt, time.time() - t0, usage


# ─── 回渲与相似度 ───

def render_latex(tex: str, out_h: int = 64):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig = plt.figure(figsize=(0.01, 0.01))
    try:
        fig.text(0, 0, f'${tex}$', fontsize=20)
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=140, bbox_inches='tight', pad_inches=0.02,
                    transparent=False, facecolor='white')
        plt.close(fig)
        buf.seek(0)
        im = Image.open(buf).convert('L')
        return im
    except Exception:
        plt.close(fig)
        return None


def ink_mask(im: Image.Image, out_h=64):
    """二值墨迹图, 等高缩放, 返回 (mask, aspect)"""
    a = np.array(im.convert('L'))
    m = a < 200
    if m.sum() == 0:
        return None, 0
    ys, xs = np.where(m)
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = m.shape
    scale = out_h / h
    new_w = max(1, int(round(w * scale)))
    return m, new_w


def iou(a: np.ndarray, b: np.ndarray) -> float:
    h = max(a.shape[0], b.shape[0])
    w = max(a.shape[1], b.shape[1])
    pa = np.zeros((h, w), bool); pa[:a.shape[0], :a.shape[1]] = a
    pb = np.zeros((h, w), bool); pb[:b.shape[0], :b.shape[1]] = b
    inter = (pa & pb).sum(); union = (pa | pb).sum()
    return inter / union if union else 0.0


def strip_math_delims(tex: str) -> str:
    """去掉模型可能加的 $...$ / \\[ \\] / \\( \\) / ``` 包裹"""
    t = tex.strip()
    t = re.sub(r'^```(?:latex|tex)?\s*', '', t)
    t = re.sub(r'\s*```$', '', t).strip()
    t = re.sub(r'^\$\$?(.*?)\$\$?$', r'\1', t, flags=re.S)
    t = re.sub(r'^\\\[(.*?)\\\]$', r'\1', t, flags=re.S)
    t = re.sub(r'^\\\((.*?)\\\)$', r'\1', t, flags=re.S)
    return t.strip()


def norm_mask(im: Image.Image, out_h=48, canvas_w=160):
    """裁到墨迹框 → 等比缩放到高=48 → 左对齐放入固定画布(白底黑字) → 高斯模糊。
    模糊是为了容忍「原图是 MathType 位图 / 回渲是 matplotlib 字体」之间的字形与线宽差异;
    逐像素硬比会把语义完全正确的公式判成低分。"""
    from PIL import ImageFilter
    a = np.array(im.convert('L'))
    m = a < 200
    if m.sum() == 0:
        return None, 0.0
    ys, xs = np.where(m)
    crop = Image.fromarray((255 - (m[ys.min():ys.max() + 1, xs.min():xs.max() + 1] * 255)).astype(np.uint8))
    w, h = crop.size
    nw = max(1, int(round(w * out_h / h)))
    crop = crop.resize((nw, out_h), Image.Resampling.LANCZOS)
    canvas = Image.new('L', (max(canvas_w, nw), out_h), 255)
    canvas.paste(crop, (0, 0))
    canvas = canvas.filter(ImageFilter.GaussianBlur(1.6))
    arr = np.array(canvas).astype(np.float32)
    return arr, nw / h


def metric(orig: Path, tex: str):
    """返回 (分数, 说明)。分数 = 模糊后二值 IoU × 宽高比一致度, 越高越像。"""
    tex = strip_math_delims(tex or '')
    if not tex or tex.upper() == 'NONE':
        return None, 'empty/NONE'
    r = render_latex(tex)
    if r is None:
        return None, 'LaTeX 回渲失败'
    A, ar_a = norm_mask(Image.open(orig))
    B, ar_b = norm_mask(r)
    if A is None:
        return None, '原图无墨迹'
    if B is None:
        return None, '回渲无墨迹'
    h = min(A.shape[0], B.shape[0]); w = min(A.shape[1], B.shape[1])
    A = A[:h, :w]; B = B[:h, :w]
    # 模糊后取「墨迹较重」的像素做 IoU
    ta = A < 200; tb = B < 200
    if ta.sum() == 0 or tb.sum() == 0:
        return 0.0, 'ok'
    i = (ta & tb).sum(); u = (ta | tb).sum()
    ar = min(ar_a, ar_b) / max(ar_a, ar_b) if max(ar_a, ar_b) else 0
    return round((i / u) * (0.5 + 0.5 * ar), 4), 'ok'


def score(orig: Path, tex: str):
    """兼容旧调用名"""
    return metric(orig, tex)


def collect_images(src_dir: Path, n: int):
    """从 HTML 目录取公式图 (按 name=ObjectN 判定公式)"""
    htmls = list(src_dir.glob('*.html'))
    if htmls:
        h = htmls[0]
        txt = h.read_text(encoding='utf-8', errors='ignore')
        pairs = re.findall(r'<img src="([^"]+)" name="(Object\d+|Image\d+)"', txt)
        forms, figs = [], []
        for src, name in pairs:
            p = (h.parent / src)
            if not p.exists():
                continue
            (forms if name.startswith('Object') else figs).append(p)
        # 去空图 + 去重
        out, seen = [], set()
        for p in forms:
            try:
                a = np.array(Image.open(p).convert('L'))
                if (a < 240).sum() < 20:
                    continue
                if a.shape[0] < 10 or a.shape[1] < 10:
                    continue
                key = (p.stat().st_size, a.shape)
                if (p.name) in seen:
                    continue
                seen.add(p.name)
                out.append(p)
            except Exception:
                continue
        return out[:n], figs[:4]
    return [], []


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/htm2')
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    key = KEY.read_text().strip()
    base = BASE.read_text().strip()
    models = sys.argv[3].split(',') if len(sys.argv) > 3 else [
        'qwen3-vl-plus', 'qwen3-vl-flash', 'qwen-vl-ocr-latest']

    forms, figs = collect_images(src, n)
    print(f'公式图样本 {len(forms)} 张 (来自 {src})')
    if not forms:
        print('无样本'); return

    allres = {}
    for m in models:
        print(f'\n===== {m} =====')
        rows = []
        for i, p in enumerate(forms, 1):
            try:
                tex, el, usage = call(m, p, base, key)
            except Exception as e:
                print(f'  [{i}] 调用失败: {str(e)[:90]}')
                rows.append({'img': p.name, 'iou': None, 'tex': None, 'err': str(e)[:80]})
                continue
            s, note = score(p, tex)
            rows.append({'img': p.name, 'iou': s, 'tex': tex, 'note': note,
                         'sec': round(el, 2), 'tokens': usage.get('total_tokens')})
            print(f'  [{i}] IoU={s} {note} {el:.1f}s tok={usage.get("total_tokens")}')
            print(f'      latex: {tex[:150]}')
        ok = [r['iou'] for r in rows if r['iou'] is not None]
        allres[m] = {
            'n': len(rows), 'scored': len(ok),
            'mean_iou': round(sum(ok) / len(ok), 4) if ok else 0,
            'median_iou': round(sorted(ok)[len(ok) // 2], 4) if ok else 0,
            'good_ge_050': sum(1 for v in ok if v >= 0.50),
            'good_ge_070': sum(1 for v in ok if v >= 0.70),
            'avg_sec': round(sum(r.get('sec', 0) for r in rows) / len(rows), 2),
            'avg_tokens': round(sum(r.get('tokens') or 0 for r in rows) / len(rows)),
            'rows': rows,
        }

    print('\n' + '=' * 72)
    print(f"{'模型':<24}{'均IoU':>8}{'中位':>8}{'≥0.5':>7}{'≥0.7':>7}{'秒/张':>8}{'tok/张':>8}")
    for m, r in allres.items():
        print(f"{m:<24}{r['mean_iou']:>8}{r['median_iou']:>8}"
              f"{r['good_ge_050']:>7}{r['good_ge_070']:>7}{r['avg_sec']:>8}{r['avg_tokens']:>8}")
    out = Path('/tmp/vlm-bench.json')
    out.write_text(json.dumps(allres, ensure_ascii=False, indent=1))
    print(f'\n明细: {out}')


if __name__ == '__main__':
    main()
