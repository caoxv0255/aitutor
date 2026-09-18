#!/usr/bin/env python3
"""
媒体预处理: WMF/EMF (MathType 公式) → 裁剪后的 PNG, 供 VLM 识别

为什么需要:
  * VLM 不能直接读 WMF
  * libreoffice --convert-to png 会把 WMF 渲染到 A4 画布 (794x1123) 且白底铺满,
    所以 Pillow 的 getbbox() (基于 alpha) 拿不到内容框 —— 必须按「非白像素」阈值裁剪

产物按 sha256 缓存, 同一公式在全库只处理一次。
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
MEDIA = REPO / 'database' / 'preflight' / 'qb-extract' / 'out' / 'media'
RENDER = REPO / 'database' / 'preflight' / 'qb-extract' / 'out' / 'render'
CACHE_IDX = RENDER / 'render-index.json'

VECTOR_EXT = {'.wmf', '.emf'}
PAD = 4
WHITE_THRESH = 245


def crop_white(im: Image.Image, thresh: int = WHITE_THRESH, pad: int = PAD) -> Image.Image:
    """按非白像素裁剪 (处理白底铺满的 A4 画布)"""
    if im.mode != 'RGB':
        bg = Image.new('RGB', im.size, (255, 255, 255))
        if im.mode in ('RGBA', 'LA', 'P'):
            im = im.convert('RGBA')
            bg.paste(im, mask=im.split()[-1])
        else:
            bg.paste(im.convert('RGB'))
        im = bg
    g = im.convert('L')
    # 反相阈值 → 内容为白
    mask = g.point(lambda p: 255 if p < thresh else 0)
    bbox = mask.getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(im.width, x1 + pad), min(im.height, y1 + pad)
    return im.crop((x0, y0, x1, y1))


def convert_batch(vectors, outdir: Path, worker_id: int, timeout=600):
    """一次 libreoffice 调用处理一批矢量图, 返回 {src: png_path}"""
    outdir.mkdir(parents=True, exist_ok=True)
    tmp = outdir / f'_tmp_w{worker_id}'
    tmp.mkdir(parents=True, exist_ok=True)
    profile = REPO / 'database' / 'preflight' / 'qb-extract' / 'lo-profile' / f'render{worker_id}'
    cmd = ['libreoffice', '--headless', '--norestore',
           f'-env:UserInstallation=file://{profile}',
           '--convert-to', 'png', '--outdir', str(tmp)] + [str(v) for v in vectors]
    try:
        subprocess.run(cmd, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        pass
    produced = {}
    for v in vectors:
        cand = tmp / (v.stem + '.png')
        if cand.exists():
            produced[v] = cand
    return produced, tmp


def main():
    ap_limit = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    workers = int(sys.argv[2]) if len(sys.argv) > 2 else 4

    vectors = [p for p in MEDIA.rglob('*') if p.suffix.lower() in VECTOR_EXT]
    print(f'矢量公式媒体 (内容已去重): {len(vectors)}')
    idx = json.loads(CACHE_IDX.read_text()) if CACHE_IDX.exists() else {}
    todo = [v for v in vectors if str(v) not in idx]
    print(f'已渲染 {len(idx)} | 待渲染 {len(todo)}')
    todo = todo[:ap_limit]
    if not todo:
        print('无待处理项')
        return

    RENDER.mkdir(parents=True, exist_ok=True)
    B = 20
    batches = [todo[i:i + B] for i in range(0, len(todo), B)]
    shards = [batches[i::workers] for i in range(workers)]
    shards = [s for s in shards if s]
    print(f'开始: {len(batches)} 批 × {B}, {len(shards)} worker')
    t0 = time.time()
    results = {}

    def run_shard(wid, shard):
        out = {}
        for b in shard:
            produced, tmp = convert_batch(b, RENDER, wid)
            for v, png in produced.items():
                try:
                    im = Image.open(png)
                    im.load()
                    c = crop_white(im)
                    key = hashlib.sha256(v.read_bytes()).hexdigest()
                    dst = RENDER / f'{key[:2]}' / f'{key}.png'
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    c.save(dst)
                    out[str(v)] = {'png': str(dst), 'w': c.width, 'h': c.height,
                                   'sha256': key, 'src_bytes': v.stat().st_size}
                except Exception as e:
                    out[str(v)] = {'error': str(e)[:120]}
            for f in tmp.glob('*'):
                try:
                    f.unlink()
                except Exception:
                    pass
        return out

    with ThreadPoolExecutor(max_workers=len(shards)) as ex:
        futs = [ex.submit(run_shard, i, s) for i, s in enumerate(shards)]
        done = 0
        for fut in as_completed(futs):
            r = fut.result()
            results.update(r)
            done += len(r)
            el = time.time() - t0
            print(f'  {done}/{len(todo)} | {done/el:.1f} 个/秒 | '
                  f'ETA {(len(todo)-done)/(done/el)/60:.1f} 分钟', flush=True)

    idx.update(results)
    CACHE_IDX.write_text(json.dumps(idx, ensure_ascii=False))
    ok = [v for v in results.values() if 'png' in v]
    err = [v for v in results.values() if 'error' in v]
    print(f'\n完成: 成功 {len(ok)}, 失败 {len(err)}, 耗时 {(time.time()-t0)/60:.1f} 分钟')
    if ok:
        import statistics
        ws = [v['w'] for v in ok]
        hs = [v['h'] for v in ok]
        print(f'裁剪后尺寸: 宽 {min(ws)}~{max(ws)} (中位 {int(statistics.median(ws))}), '
              f'高 {min(hs)}~{max(hs)} (中位 {int(statistics.median(hs))})')
        tiny = sum(1 for v in ok if v['w'] < 8 or v['h'] < 8)
        print(f'过小(<8px, 疑似空公式/裁剪失败): {tiny}')
    if err:
        print('失败样例:', err[:3])


if __name__ == '__main__':
    main()
