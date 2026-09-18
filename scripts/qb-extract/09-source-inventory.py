#!/usr/bin/env python3
"""09-source-inventory.py —— P0/G1: 把原始语料登记进 source_inventory 并对账。

为什么这一步是地基
------------------
没有源侧基准, 「DB 里这 1634 卷是不是语料全集」永远无法回答。本任务吃过这个亏:
docx→HTML 阶段曾**静默跳过 566 份卷 (34.6%)**, 当时没有任何「源侧应有多少」的基准可对账。

对账三层 (G1 的「无静默漏登记」)
-------------------------------
    source_inventory 文件数  ==  提取产物 papers/*.json 卷数  ==  exam_papers 卷数
任何一层不等的差额都必须能解释, 不能「差不多」。

用法:
  python3 09-source-inventory.py --dry-run
  python3 09-source-inventory.py
  python3 09-source-inventory.py --reconcile-only
"""
import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SRC_ROOT = REPO / 'database' / 'incoming'
OUT_PAPERS = REPO / 'database' / 'preflight' / 'qb-extract' / 'out' / 'papers'
SUPPORTED = {'.docx', '.doc', '.pdf'}

# 版本后缀 → has_answer。文件名是唯一可靠线索。
ANSWER_MARK = re.compile(r'解析卷|答案卷|详解|含答案|答案解析')
# 去掉版本后缀后作为配对键的基础名:  （解析卷）/（答案卷）/（详解）/（解析）/（含答案）
VERSION_SUFFIX = re.compile(r'[（(]\s*(?:解析卷|答案卷|详解|解析|含答案|答案解析|答案)\s*[)）]\s*$')


def log(*a):
    print(*a, flush=True)


def sha256_of(p: Path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def parse_meta(p: Path):
    """从路径取 (exam_level, subject, year)。目录约定 <level>/<subject>/<year>/<file>。"""
    parts = p.parts
    try:
        rel = p.relative_to(SRC_ROOT)
    except ValueError:
        return None, None, None
    rp = rel.parts
    if len(rp) < 3:
        return None, None, None
    level, subject, year = rp[0], rp[1], rp[2]
    m = re.match(r'^(\d{4})', year)
    return level, subject, (int(m.group(1)) if m else None)


def base_key(stem: str) -> str:
    """反复剥掉版本后缀, 得到配对键的基础名。"""
    prev = None
    while prev != stem:
        prev = stem
        stem = VERSION_SUFFIX.sub('', stem).strip()
    return stem


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--reconcile-only', action='store_true')
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    args = ap.parse_args()
    if not args.dsn:
        log('!! 需要 DATABASE_URL'); sys.exit(2)

    rows = []
    if not args.reconcile_only:
        files = [p for p in SRC_ROOT.rglob('*') if p.is_file() and p.suffix.lower() in SUPPORTED]
        log(f'扫描 {SRC_ROOT.relative_to(REPO)}: {len(files)} 个源文件')
        skipped = 0
        for p in files:
            level, subject, year = parse_meta(p)
            if not level:
                skipped += 1
                continue
            stem = p.stem
            rows.append({
                'path': str(p),
                'sha': sha256_of(p),
                'bytes': p.stat().st_size,
                'ext': p.suffix.lower(),
                'level': level,
                'subject': subject,
                'year': year,
                'has_answer': bool(ANSWER_MARK.search(stem)),
                'paper_key': f'{level}|{subject}|{year}|{base_key(stem)}',
            })
        log(f'  可登记 {len(rows)} 份, 路径不合约定跳过 {skipped} 份')
        uniq = {r['sha'] for r in rows}
        log(f'  内容寻址去重后 {len(uniq)} 份 (重复 {len(rows) - len(uniq)})')

    import asyncpg
    conn = await asyncpg.connect(args.dsn)
    try:
        if rows and not args.dry_run:
            await conn.executemany("""
                INSERT INTO source_inventory
                  (source_path, sha256, bytes, ext, exam_level, subject, year, has_answer, paper_key)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                ON CONFLICT (sha256) DO UPDATE
                  SET source_path=EXCLUDED.source_path, bytes=EXCLUDED.bytes,
                      exam_level=EXCLUDED.exam_level, subject=EXCLUDED.subject,
                      year=EXCLUDED.year, has_answer=EXCLUDED.has_answer,
                      paper_key=EXCLUDED.paper_key
            """, [(r['path'], r['sha'], r['bytes'], r['ext'], r['level'], r['subject'],
                   r['year'], r['has_answer'], r['paper_key']) for r in rows])
            log(f'已登记 {len(rows)} 行')
        elif args.dry_run:
            log('DRY-RUN: 未写库')

        # ---------------- 对账 ----------------
        n_inv = await conn.fetchval('SELECT count(*) FROM source_inventory')
        n_pairs = await conn.fetchval('SELECT count(*) FROM v_source_pairs WHERE is_paired')
        n_keys = await conn.fetchval('SELECT count(*) FROM v_source_pairs')
        n_p = await conn.fetchval("SELECT count(*) FROM exam_papers WHERE created_at::date = '2026-09-17'")
        n_json = len(list(OUT_PAPERS.rglob('*.json')))

        log('\n=== G1 三层对账 ===')
        log(f'  source_inventory         {n_inv} 份')
        log(f'  提取产物 papers/*.json   {n_json} 卷')
        log(f'  exam_papers (本次入库)   {n_p} 卷')
        ok = (n_inv == n_json == n_p)
        log(f'  判定: {"✅ 三层一致" if ok else "❌ 不一致 —— 差额必须逐条解释, 不能差不多"}')

        log('\n=== 原卷/解析版成对 (规范 §67 join 依据) ===')
        log(f'  paper_key 共 {n_keys} 组, 其中成对 {n_pairs} 组 ({round(100.0*n_pairs/max(1,n_keys),1)}%)')
        only_plain = await conn.fetchval('SELECT count(*) FROM v_source_pairs WHERE n_answer_versions=0')
        only_ans = await conn.fetchval('SELECT count(*) FROM v_source_pairs WHERE n_plain_versions=0')
        log(f'  只有原卷 (无解析版): {only_plain} 组 —— 这是**已知语料事实**, 不是缺陷')
        log(f'  只有解析版 (无原卷): {only_ans} 组')
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
