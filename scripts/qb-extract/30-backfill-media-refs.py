#!/usr/bin/env python3
"""30-backfill-media-refs.py —— ⟦IMG:rId⟧ / ⟦F:rId⟧ → out/media 资产映射 (路线图 P2b)。

为什么需要
----------
qbx 把图片/公式替换成 ⟦IMG:rIdN⟧ / ⟦F:rIdN⟧ (rId = docx 关系 id), 但**从未持久化
rId → 资产** 的映射。05-ingest 写的 question_images / raw_image_path 是「按题目顺序的
列表」, 没有 rId, 无法对齐到 token。实测 11021 题的 stem 里带裸 token 直接进读端。

做法 (不依赖任何顺序假设)
------------------------
  1. 对每卷重跑 `extract_paper`, 取每题 `q['media']` (含 kind/rid/target);
  2. 打开 docx, 对 target 为 `media/*` 的项算 sha256 + 扩展名 (与 qbx.store_media 同口径);
     rel_path = `<subject>/<year>/<sha[:2]>/<sha><ext>` —— 资产实际在
     `database/preflight/qb-extract/out/media/<rel_path>`;
  3. 公式 (kind=formula) 再从 `out/vlm/<sha>.json` 取 latex (VLM 产物);
  4. 只保留**该题字段里真正出现的 token**; 写入 `exam_questions.media_refs`。
     ⟦OMML:txt⟧ 不需要资产 (text 就在 token 里), 不入表。

缺失不静默: 资产文件不存在时写 `{"kind":…, "missing":"asset_absent"}`, 由读端降级为标记。

幂等 & 安全
-----------
  · 默认 dry-run; `--apply` 才写库; 写前备份旧值到 logs/。
  · 值未变的行不 UPDATE (重跑 0 行)。
  · 只写 `exam_questions.media_refs`, 不动其他字段。

用法
----
  python3 30-backfill-media-refs.py                 # dry-run
  python3 30-backfill-media-refs.py --apply
  python3 30-backfill-media-refs.py --limit 100
"""
import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
import zipfile
from collections import Counter
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PREFLIGHT = REPO / 'database' / 'preflight' / 'qb-extract'
LOGS = PREFLIGHT / 'logs'
OUT_MEDIA = PREFLIGHT / 'out' / 'media'
OUT_VLM = PREFLIGHT / 'out' / 'vlm'
DOCX_CACHE = PREFLIGHT / 'docx-cache'
sys.path.insert(0, str(Path(__file__).resolve().parent))
import qbx  # noqa: E402

BATCH_DATE = '2026-09-17'
# ⟦IMG:rId4⟧ / ⟦F:rId4⟧ (OMML 不在本脚本处理)
TOKEN_RE = re.compile(r'⟦(IMG|F):([^⟧]+)⟧')
TOKEN_RE_ALL = re.compile(r'⟦(IMG|F|OMML):?[^⟧]*⟧')


def log(*a):
    print(*a, flush=True)


def resolve_docx(paper_file_path, cache_index):
    if not paper_file_path:
        return None
    p = Path(paper_file_path)
    if p.suffix.lower() == '.docx' and p.exists():
        return p
    return cache_index.get(p.name) or cache_index.get(Path(p.name).with_suffix('.docx').name)


def question_token_keys(row) -> set:
    """该题字段里出现的 'IMG:rIdN' / 'F:rIdN' 键。"""
    txts = [row['stem'] or '', row['analysis'] or '', row['reference_answer'] or '']
    opts = row['options']
    if isinstance(opts, str):
        try:
            opts = json.loads(opts)
        except Exception:
            opts = {}
    if isinstance(opts, dict):
        txts.extend(str(v) for v in opts.values())
    elif isinstance(opts, list):
        txts.extend(str(v) for v in opts)
    keys = set()
    for t in txts:
        for kind, arg in TOKEN_RE.findall(t):
            keys.add(f'{kind}:{arg}')
    return keys


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--apply', action='store_true', help='写库 (默认只报数)')
    a = ap.parse_args()
    if not a.dsn:
        log('!! 需要 DATABASE_URL')
        return 2

    import asyncpg
    cache_index = {}
    for f in DOCX_CACHE.rglob('*.docx'):
        cache_index.setdefault(f.name, f)

    conn = await asyncpg.connect(a.dsn)
    try:
        papers = await conn.fetch(f"""
            SELECT DISTINCT p.id, p.paper_file_path
              FROM public.exam_questions q JOIN public.exam_papers p ON p.id = q.paper_id
             WHERE q.archive_state = 'active'
               AND (q.stem LIKE '%⟦IMG:%' OR q.stem LIKE '%⟦F:%'
                    OR q.options::text LIKE '%⟦IMG:%' OR q.options::text LIKE '%⟦F:%'
                    OR q.analysis LIKE '%⟦IMG:%' OR q.analysis LIKE '%⟦F:%'
                    OR q.reference_answer LIKE '%⟦IMG:%' OR q.reference_answer LIKE '%⟦F:%')
             ORDER BY p.id""" + (' LIMIT $1' if a.limit else ''),
            *([a.limit] if a.limit else []))
        log(f'含 ⟦IMG:/⟦F:⟧ 的卷: {len(papers)}')

        st = Counter()
        updates = []
        backup = []
        for i, p in enumerate(papers, 1):
            if i % 100 == 0:
                log(f'  … {i}/{len(papers)}')
            dx = resolve_docx(p['paper_file_path'], cache_index)
            if not dx:
                st['paper_no_docx'] += 1
                continue
            try:
                out = qbx.extract_paper(dx)
            except Exception as e:
                st['extract_failed'] += 1
                log(f'  !! extract 失败 {dx.name}: {str(e)[:60]}')
                continue
            ident = out.get('identity') or {}
            prefix = f"{ident.get('subject') or 'na'}/{ident.get('year') or 'na'}"
            try:
                z = zipfile.ZipFile(dx)
            except Exception:
                st['zip_failed'] += 1
                continue
            try:
                # rid → 资产 是**整份 docx 全局**的 (rid 是文档级关系 id), 与「哪道题」无关 →
                # 先建卷级 map, 再按 token 查, 彻底避免「题号在一卷内重复」导致的对齐错误。
                global_map = {}
                for qq in out['questions']:
                    for md in qq.get('media') or []:
                        rid = md.get('rid')
                        kind = md.get('kind')
                        target = md.get('target')
                        if not rid or kind not in ('figure', 'formula'):
                            continue
                        key = f'{"IMG" if kind == "figure" else "F"}:{rid}'
                        if key in global_map:
                            continue
                        if not target or not target.startswith('media/'):
                            global_map[key] = {'kind': kind, 'missing': 'asset_absent'}
                            st['missing_no_target'] += 1
                            continue
                        try:
                            data = z.read('word/' + target)
                        except KeyError:
                            global_map[key] = {'kind': kind, 'missing': 'asset_absent'}
                            st['missing_zip_member'] += 1
                            continue
                        sha = hashlib.sha256(data).hexdigest()
                        ext = os.path.splitext(target)[1].lower() or '.bin'
                        rel = f'{prefix}/{sha[:2]}/{sha}{ext}'
                        if not (OUT_MEDIA / rel).exists():
                            global_map[key] = {'kind': kind, 'sha256': sha, 'ext': ext,
                                               'rel_path': rel, 'missing': 'asset_absent'}
                            st['missing_file'] += 1
                            continue
                        rec = {'kind': kind, 'sha256': sha, 'ext': ext, 'rel_path': rel}
                        if kind == 'formula':
                            vf = OUT_VLM / f'{sha}.json'
                            if vf.exists():
                                try:
                                    v = json.loads(vf.read_text(encoding='utf-8'))
                                    if v.get('latex'):
                                        rec['latex'] = v['latex']
                                        st['formula_latex'] += 1
                                except Exception:
                                    pass
                            st['formula_ref'] += 1
                        else:
                            st['image_ref'] += 1
                        global_map[key] = rec

                qs = await conn.fetch(
                    "SELECT id, question_number, stem, options, analysis, reference_answer, media_refs "
                    "FROM public.exam_questions WHERE paper_id=$1 AND archive_state='active'", p['id'])
                for q in qs:
                    keys = question_token_keys(q)
                    if not keys:
                        continue
                    refs = {}
                    for k in keys:
                        if k in global_map:
                            refs[k] = global_map[k]
                        else:
                            refs[k] = {'kind': 'figure' if k.startswith('IMG') else 'formula',
                                       'missing': 'asset_absent'}
                            st['missing_no_media'] += 1
                    st['questions'] += 1
                    new_json = json.dumps(refs, ensure_ascii=False, sort_keys=True)
                    old_json = None
                    if q['media_refs'] is not None:
                        old_json = json.dumps(
                            q['media_refs'] if isinstance(q['media_refs'], dict)
                            else json.loads(q['media_refs']),
                            ensure_ascii=False, sort_keys=True)
                    if old_json != new_json:
                        updates.append((q['id'], new_json))
                        backup.append({'question_id': q['id'], 'paper_id': p['id'],
                                       'media_refs_after': refs})
            finally:
                z.close()

        log('')
        log('════ 多模态占位符 → 资产映射回填 (P2b) ════')
        log(f"卷 {len(papers)} / 含 token 题 {st['questions']}")
        log(f"ref: 图片 {st['image_ref']} / 公式 {st['formula_ref']} "
            f"(其中有 latex {st['formula_latex']})")
        log(f"缺失: 无 target {st['missing_no_target']} / zip 无成员 {st['missing_zip_member']} / "
            f"文件不存在 {st['missing_file']} / media 无该 rid {st['missing_no_media']}")
        log(f"无 docx {st['paper_no_docx']} / extract 失败 {st['extract_failed']} / 待更新行 {len(updates)}")

        ts = datetime.now().strftime('%Y%m%d-%H%M%S')
        LOGS.mkdir(parents=True, exist_ok=True)
        if a.apply and updates:
            bk = LOGS / f'media-refs-backup-{ts}.json'
            bk.write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding='utf-8')
            log(f'旧值已备份: {bk}')
            await conn.executemany(
                "UPDATE public.exam_questions SET media_refs=$2::jsonb WHERE id=$1",
                [(qid, nj) for qid, nj in updates])
            log(f'已更新 {len(updates)} 题 media_refs')
        else:
            log('dry-run: 未写库 (确认后加 --apply)')
        rep = LOGS / f'media-refs-{ts}.json'
        rep.write_text(json.dumps({'generated_at': ts, 'mode': 'apply' if a.apply else 'dry-run',
                                   'papers': len(papers), 'stats': dict(st),
                                   'updates': len(updates)}, ensure_ascii=False, indent=2), encoding='utf-8')
        log(f'已写入 {rep}')
    finally:
        await conn.close()
    return 0


sys.exit(asyncio.run(main()))
