#!/usr/bin/env python3
"""15-dedup-classify.py —— P5: 重复题分类 (G5 出口「分类表落地; 无 unresolved」)。

判据 (可操作定义, 规范 §32–33 原文不在仓库, 见 migration 028 的 COMMENT)
--------------------------------------------------------------------
  EXACT        归一化文本完全相同 且 **同卷**   → 同卷内重复抽取
  SOURCE_COPY  归一化文本完全相同 且 **跨卷**   → 同题被多份卷收录(全国卷多省共用等)
  CONTENT      归一化文本不同, 相似度 >= 0.97    → 排版/空白/标点差异
  VARIANT      相似度 0.85 ~ 0.97                → 改数字/换选项的变式题
  RELATED      同前缀块, 相似度 < 0.85           → 同材料不同设问
  UNIQUE       无任何匹配

为什么这么定
-----------
「完全相同」用**归一化后**的 md5 判, 而不是原始文本 —— 实测语料里同一道题常因空白/全半角
差异而 md5 不同, 直接比原文会把它们误判成不同题。

不删除任何题 (一行未删原则)。VARIANT 的**保留策略**属业务决策, 本脚本只分类。
幂等: 重跑先清空本表再写 (分类是派生结果, 不是事实数据)。

用法:
  python3 15-dedup-classify.py --dry-run
  python3 15-dedup-classify.py
"""
import argparse
import asyncio
import collections
import difflib
import hashlib
import os
import re
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
# 归一化: 去掉占位符/空白/标点/大小写, 只留中英文与数字 —— 同一道题的排版差异由此抹平
PLACEHOLDER = re.compile(r'⟦[^⟧]*⟧')
NORM_STRIP = re.compile(r'[^0-9a-z一-龥]+')


def norm(text: str) -> str:
    s = PLACEHOLDER.sub('', text or '')
    return NORM_STRIP.sub('', s.lower())


def sig(stem: str, options: str) -> str:
    return hashlib.md5(norm(stem + '|' + (options or '')).encode()).hexdigest()


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--block-prefix', type=int, default=30,
                    help='近重复比对的阻塞前缀长度 (归一化后字符数)')
    ap.add_argument('--content-sim', type=float, default=0.97)
    ap.add_argument('--variant-sim', type=float, default=0.85)
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    a = ap.parse_args()
    if not a.dsn:
        print('!! 需要 DATABASE_URL'); return 2
    import asyncpg
    conn = await asyncpg.connect(a.dsn)
    try:
        rows = await conn.fetch("""
            SELECT q.id, q.paper_id, q.stem, coalesce(q.options,'') AS options
              FROM exam_questions q JOIN exam_papers p ON p.id = q.paper_id
             WHERE p.created_at::date='2026-09-17' AND q.archive_state='active'
        """)
        print(f'参与分类的题: {len(rows)}')

        # 1) 完全相同 (md5 分组) → EXACT(同卷) / SOURCE_COPY(跨卷)
        by_sig = collections.defaultdict(list)
        info = {}
        for r in rows:
            h = sig(r['stem'], r['options'])
            by_sig[h].append(r['id'])
            info[r['id']] = (r['paper_id'], norm(r['stem'] + '|' + r['options']))
        kind = {}
        group_of = {}
        for h, ids in by_sig.items():
            if len(ids) == 1:
                continue
            papers = {info[i][0] for i in ids}
            k = 'SOURCE_COPY' if len(papers) > 1 else 'EXACT'
            ids_sorted = sorted(ids)
            canon = ids_sorted[0]
            for i in ids:
                kind[i] = (k, h, canon, 1.0)
                group_of[i] = h

        # 2) 近重复: 只对「未被 1) 覆盖」的题做前缀阻塞 + 相似度
        rest = [r for r in rows if r['id'] not in kind]
        blocks = collections.defaultdict(list)
        for r in rest:
            t = info[r['id']][1]
            if len(t) >= a.block_prefix:
                blocks[t[:a.block_prefix]].append(r['id'])
        compared = pairs = 0
        t0 = time.time()
        for _blk, ids in blocks.items():
            if len(ids) < 2:
                continue
            for x in range(len(ids)):
                for y in range(x + 1, len(ids)):
                    i, j = ids[x], ids[y]
                    if i in kind or j in kind:
                        continue
                    compared += 1
                    ratio = difflib.SequenceMatcher(None, info[i][1], info[j][1]).ratio()
                    if ratio < a.variant_sim:
                        continue
                    pairs += 1
                    k = 'CONTENT' if ratio >= a.content_sim else 'VARIANT'
                    canon = min(i, j)
                    kind[i] = (k, info[i][1][:32], canon, round(ratio, 3))
                    kind[j] = (k, info[j][1][:32], canon, round(ratio, 3))
        print(f'近重复比对: {compared:,} 对, 命中 {pairs:,} 对, 耗时 {time.time()-t0:.0f}s')

        # 3) 同前缀块但相似度低 → RELATED (同材料不同设问)
        #    ⚠️ 收紧判据: 仅「前 30 字相同」不足以说明同材料 —— 中文题干常用固定句式开头
        #    (如「下列关于……的说法正确的是」), 不同题也会撞前缀。要求共享前缀
        #    **占较短文本的 >=50%**, 才算「共享了实质内容」。
        for _blk, ids in blocks.items():
            if len(ids) < 2:
                continue
            free = [i for i in ids if i not in kind]
            if len(free) < 2:
                continue
            free.sort(key=lambda i: len(info[i][1]))
            base = info[free[0]][1]
            for i in free[1:]:
                cur = info[i][1]
                shared = 0
                for x, y in zip(base, cur):
                    if x != y:
                        break
                    shared += 1
                if shared >= max(40, int(0.5 * len(base))):
                    kind[i] = ('RELATED', base[:a.block_prefix], free[0], None)
            if free and free[0] not in kind and len(free) > 1:
                kind[free[0]] = ('RELATED', base[:a.block_prefix], free[0], None)

        # 4) 其余 UNIQUE
        cnt = collections.Counter()
        payload = []
        for r in rows:
            i = r['id']
            if i in kind:
                k, gk, canon, sim = kind[i]
            else:
                k, gk, canon, sim = 'UNIQUE', None, i, None
            cnt[k] += 1
            payload.append((i, k, gk, canon, sim))
        print('分类结果:', dict(cnt))
        tol = {k: cnt[k] for k in ('EXACT', 'SOURCE_COPY', 'CONTENT', 'VARIANT', 'RELATED')}
        print(f'  → 重复相关题合计 {sum(tol.values())} (占 {100.0*sum(tol.values())/max(len(rows),1):.1f}%)')

        if a.dry_run:
            print('DRY-RUN: 未写库')
            return 0

        await conn.execute('TRUNCATE public.question_dedup RESTART IDENTITY')
        # 分批写入, 避免一次性 executemany 撑爆
        B = 2000
        for s in range(0, len(payload), B):
            await conn.executemany("""
                INSERT INTO public.question_dedup
                       (question_id, dup_kind, group_key, canonical_id, similarity, decided_by)
                VALUES ($1, $2, $3, $4, $5, 'rule')
                ON CONFLICT (question_id) DO UPDATE
                   SET dup_kind = EXCLUDED.dup_kind, group_key = EXCLUDED.group_key,
                       canonical_id = EXCLUDED.canonical_id, similarity = EXCLUDED.similarity,
                       decided_by = 'rule', created_at = now()
            """, payload[s:s + B])
        n = await conn.fetchval('SELECT count(*) FROM public.question_dedup')
        un = await conn.fetchval(
            "SELECT count(*) FROM public.question_dedup WHERE dup_kind IS NULL OR canonical_id IS NULL")
        print(f'已写入 question_dedup: {n} 行；unresolved(=NULL 分类) = {un}')
        return 0
    finally:
        await conn.close()


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
