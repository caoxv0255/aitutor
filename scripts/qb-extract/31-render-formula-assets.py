#!/usr/bin/env python3
"""31-render-formula-assets.py —— 公式可见性**根治**: 在带 rId 的通道内产出可渲染资产。

为什么这是根治 (而不是桥接)
--------------------------
公式 token 是 ⟦F:rId⟧, 资产是 wmf (浏览器不可渲染)。试过的"桥接"路线 (用 04 的 HTML/VLM
产物对齐到 token) 实测**不可靠**: HTML item→题目 96.3%, 但 token→具体公式图 仅 19.5%
(ExcelObject 无 rId, 且抽取会丢题/重复引用, 数量对不上)。在两条通道间猜绑定 = 会错公式。

根治 = **不做任何对齐**: 直接在该 token 自己的资产 (wmf sha) 上渲染出 PNG,
token→wmf sha→PNG 天然 1:1。wmf sha 已存在 media_refs 里 (30-backfill 产物)。

做法
----
  1. 从 media_refs 收集全部 distinct (sha, rel_path) 其中 ext ∈ {.wmf,.emf};
  2. `convert` 渲染为 out/media-png/<sha[:2]>/<sha>.png (内容寻址, 幂等);
  3. 空白/失败**显式记录** (不静默): nonwhite 占比 < 阈值 → 判失败, 删产物;
  4. `--apply` 时回填 media_refs 的 `png_rel` (只加字段, 不改其他; 写前备份, 值未变不更新)。

读端: media_refs 有 png_rel → 用 PNG 渲染; 否则回退 latex / 标记。

用法
----
  python3 31-render-formula-assets.py --workers 8            # 渲染 (不改库)
  python3 31-render-formula-assets.py --workers 8 --apply    # 渲染 + 回填 png_rel
  python3 31-render-formula-assets.py --limit 200            # 小样
"""
import argparse
import asyncio
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PREFLIGHT = REPO / 'database' / 'preflight' / 'qb-extract'
LOGS = PREFLIGHT / 'logs'
MEDIA = PREFLIGHT / 'out' / 'media'
PNG_OUT = PREFLIGHT / 'out' / 'media-png'
BATCH_DATE = '2026-09-17'
VECTOR_EXT = {'.wmf', '.emf'}
BLANK_RATIO = 0.0005      # nonwhite 占比低于此 → 视为空白
DENSITY = '200'


def log(*a):
    print(*a, flush=True)


def nonwhite_ratio(png_path: Path) -> float | None:
    try:
        from PIL import Image
        im = Image.open(png_path).convert('L')
        px = list(im.getdata())
        if not px:
            return 0.0
        return sum(1 for v in px if v < 250) / len(px)
    except Exception:
        return None


def render_one(src: Path, dst: Path) -> tuple[str, str]:
    """返回 (status, detail): ok / blank / no_src / err"""
    if dst.exists():
        r = nonwhite_ratio(dst)
        if r is not None and r >= BLANK_RATIO:
            return 'skip_existing', f'{r:.4f}'
        dst.unlink(missing_ok=True)      # 旧产物空白 → 重渲
    if not src.exists():
        return 'no_src', ''
    dst.parent.mkdir(parents=True, exist_ok=True)
    # ⚠️ 临时文件必须保留 .png 扩展名 —— ImageMagick 按扩展名推断输出格式,
    #    用 '.part' 会写出非法 PNG (实测 200/200 被误判空白)。
    tmp = dst.with_name(dst.stem + '.part.png')
    try:
        subprocess.run(
            ['convert', '-density', DENSITY, str(src),
             '-background', 'white', '-alpha', 'remove', '-flatten', str(tmp)],
            capture_output=True, timeout=120, check=False)
    except Exception as e:
        tmp.unlink(missing_ok=True)
        return 'err', str(e)[:60]
    if not tmp.exists():
        return 'blank', 'no_output'
    r = nonwhite_ratio(tmp)
    if r is None or r < BLANK_RATIO:
        tmp.unlink(missing_ok=True)
        return 'blank', f'{r if r is None else round(r, 5)}'
    tmp.rename(dst)
    return 'ok', f'{r:.4f}'


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    ap.add_argument('--workers', type=int, default=8)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--apply', action='store_true', help='回填 media_refs.png_rel (默认只渲染)')
    a = ap.parse_args()
    if not a.dsn:
        log('!! 需要 DATABASE_URL')
        return 2

    import asyncpg
    conn = await asyncpg.connect(a.dsn)
    try:
        rows = await conn.fetch(
            "SELECT id, media_refs FROM public.exam_questions WHERE media_refs IS NOT NULL")
    finally:
        pass

    # 收集 distinct (sha, rel_path)
    targets = {}
    for r in rows:
        d = r['media_refs']
        d = json.loads(d) if isinstance(d, str) else d
        for v in d.values():
            if v.get('missing') or not v.get('sha256') or not v.get('rel_path'):
                continue
            if (v.get('ext') or '') in VECTOR_EXT:
                targets.setdefault(v['sha256'], v['rel_path'])
    items = list(targets.items())
    if a.limit:
        items = items[:a.limit]
    log(f'待渲染 distinct wmf/emf: {len(items)}')

    st = Counter()
    done = {}          # sha -> png_rel (成功)
    t0 = datetime.now()
    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {}
        for sha, rel in items:
            src = MEDIA / rel
            dst = PNG_OUT / sha[:2] / f'{sha}.png'
            futs[ex.submit(render_one, src, dst)] = sha
        for i, fu in enumerate(as_completed(futs), 1):
            sha = futs[fu]
            status, detail = fu.result()
            st[status] += 1
            if status in ('ok', 'skip_existing'):
                done[sha] = f'{sha[:2]}/{sha}.png'
            if i % 2000 == 0:
                el = (datetime.now() - t0).total_seconds()
                log(f'  … {i}/{len(items)}  已用 {el:.0f}s  成功 {len(done)}')
    log(f'渲染完成: {dict(st)}')
    log(f'可渲染 PNG: {len(done)}/{len(items)} = {len(done)/max(1,len(items)):.1%}')

    # ── 回填 media_refs.png_rel ──
    updates = []
    backup = []
    if done:
        for r in rows:
            d = r['media_refs']
            d = json.loads(d) if isinstance(d, str) else d
            changed = False
            for v in d.values():
                sha = v.get('sha256')
                if not sha or (v.get('ext') or '') not in VECTOR_EXT:
                    continue
                pr = done.get(sha)
                if pr and v.get('png_rel') != pr:
                    v['png_rel'] = pr
                    changed = True
            if changed:
                new_json = json.dumps(d, ensure_ascii=False, sort_keys=True)
                old_json = json.dumps(
                    r['media_refs'] if isinstance(r['media_refs'], dict) else json.loads(r['media_refs']),
                    ensure_ascii=False, sort_keys=True)
                if old_json != new_json:
                    updates.append((r['id'], new_json))
                    backup.append({'question_id': r['id'], 'media_refs_before': json.loads(old_json)})
    log(f'待回填 png_rel 的题: {len(updates)}')
    ts = datetime.now().strftime('%Y%m%d-%H%M%S')
    LOGS.mkdir(parents=True, exist_ok=True)
    if a.apply and updates:
        bk = LOGS / f'media-png-refs-backup-{ts}.json'
        bk.write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding='utf-8')
        log(f'旧值已备份: {bk}')
        await conn.executemany(
            "UPDATE public.exam_questions SET media_refs=$2::jsonb WHERE id=$1", updates)
        log(f'已更新 {len(updates)} 题 media_refs.png_rel')
    else:
        log('未写库 (确认后加 --apply)')
    rep = LOGS / f'media-png-{ts}.json'
    rep.write_text(json.dumps({
        'generated_at': ts, 'distinct_vector': len(items), 'renderable': len(done),
        'stats': dict(st), 'updates': len(updates), 'applied': bool(a.apply and updates),
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    log(f'已写入 {rep}')
    await conn.close()
    return 0


sys.exit(asyncio.run(main()))
