#!/usr/bin/env python3
"""16-kp-map.py —— P6: 把新入库的题映射到 KP 标签 (question_kp_v2)。

链路 (实测确认)
--------------
  kp_unit_cleaned        5493 个概念单元 (unit_graphid / unit_name / unit_subject / unit_chapter)
        ↓  语义映射 (mapping_source='semantic')
  kp_unit_to_tag_mapping 10966 行 → 359 个标签 (tag_id 形如 BIO-G0-001 / HIST-G0-290 / CHEM-B1-040)
        ↓
  question_kp_v2.kp_id   = tag_id   ← 目标

为什么用规则而不是直接 LLM
------------------------
设计文档 P6 明确: 「official/rule 优先, llm 需 C 级审核」。
实测(生物抽样 200 题): **83.5% 的题能命中至少一个 KP 术语** —— 规则路径足够覆盖大头,
且完全可解释、可复现, 不需要审核。规则覆盖不到的再走 LLM。

判据
----
1. 按学科分别建索引: 术语 → {tag_id: 权重}。术语取自概念单元名 (去掉编号/括号)。
2. 权重 = len(term)^2 × idf, idf = log(标签总数 / 含该术语的标签数) —— 长术语更具体, 稀有术语更可辨。
3. 逐题在 (题干 + 选项 + 解析) 上做一次术语扫描, 累加权重得每个标签的分数。
4. 取分数最高的前 K 个标签 (默认 3), confidence = top/(top+second) (只有一个候选时给 0.80,
   并注明「无对照」)。低于 --min-conf 的丢弃。

⚠️ 已知数据问题 (记录, 不擅自修): 标签前缀不一致 —— 历史有 HIST/HIS、语文 CHIN/CHN、物理 PHYS/PHY。
    本脚本按前缀首字母归学科, 三种写法都能识别。

幂等: 只删本脚本写过的 source='rule' 行再重写, 不动 llm_b2 行。

用法:
  python3 16-kp-map.py --subject biology --limit 500 --dry-run
  python3 16-kp-map.py --subject all
"""
import argparse
import asyncio
import collections
import math
import os
import re
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

# 学科前缀 → 我们的 subject code。前缀有 HIST/HIS、CHIN/CHN、PHYS/PHY 等不一致写法, 都收。
PREFIX_SUBJECT = {
    'BIO': 'biology', 'CHEM': 'chemistry', 'PHYS': 'physics', 'PHY': 'physics',
    'MATH': 'math', 'CHIN': 'chinese', 'CHN': 'chinese', 'ENG': 'english',
    'POL': 'politics', 'HIST': 'history', 'HIS': 'history', 'GEO': 'geography',
}
SUBJECT_CN = {'biology': '生物', 'chemistry': '化学', 'physics': '物理', 'math': '数学',
              'chinese': '语文', 'english': '英语', 'politics': '政治',
              'history': '历史', 'geography': '地理'}
PLACEHOLDER = re.compile(r'⟦[^⟧]*⟧')
NUMLEAD = re.compile(r'^[（(]?[0-9一二三四五六七八九十]+[）).．、]?\s*')
TERM = re.compile(r'[A-Za-z0-9\u4e00-\u9fff]{3,12}')
_CJK = re.compile(r'[\u4e00-\u9fff]')


def is_useful_term(t: str) -> bool:
    """术语过滤 —— 实测踩过的坑, 必须同时满足才留:

    1. **不能是纯数字/纯标点**: `200` 这种长度够 3 但毫无区分度, 却会命中一堆标签
       (实测把政治题映射到了 BIO-Z0-001, 命中术语=['200'])。
    2. **纯中文至少 4 字**: 3 字中文里「透明度」这类通用词跨学科乱命中;
       而含字母/数字的术语(如 DNA、ATP、NaCl)3 字符就有区分度, 保留。
    """
    t = t.strip()
    if not t or not t.isalnum():
        return False
    if t.isdigit():
        return False            # ⚠️ 纯数字必须显式排除 —— 实测 '500'/'1300' 长度够长,
                                # 会从年份/数值里命中, 把噪声计进分数 (光合作用题被 1300 拉分)
    if _CJK.search(t):
        return len(t) >= 4 or any(c.isascii() and c.isalnum() for c in t)
    return len(t) >= 3          # 纯拉丁/数字混合: DNA / ATP / NaCl


def log(*a):
    print(*a, flush=True)


def subject_of(tag_id: str):
    return PREFIX_SUBJECT.get((tag_id or '').split('-')[0].upper())


def build_index(unit_rows, max_df_ratio=0.35):
    """unit_rows: [(tag_id, unit_name)] → {term: {tag: weight}}"""
    tag_terms = collections.defaultdict(set)
    for tag, name in unit_rows:
        if not name:
            continue
        n = NUMLEAD.sub('', PLACEHOLDER.sub('', name)).strip()
        for t in TERM.findall(n):
            if is_useful_term(t):
                tag_terms[tag].add(t)
    n_tags = max(len(tag_terms), 1)
    df = collections.Counter()
    for tag, ts in tag_terms.items():
        for t in ts:
            df[t] += 1
    idx = collections.defaultdict(dict)
    for tag, ts in tag_terms.items():
        for t in ts:
            # 太通用的术语 (出现在 >35% 标签里) 没有区分度, 丢弃
            if df[t] / n_tags > max_df_ratio:
                continue
            idx[t][tag] = (len(t) ** 2) * math.log(n_tags / df[t])
    return idx


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--subject', default='all', help='biology|chemistry|...|all')
    ap.add_argument('--topk', type=int, default=3)
    ap.add_argument('--min-conf', type=float, default=0.55)
    ap.add_argument('--limit', type=int, default=0, help='0=不限')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    a = ap.parse_args()
    if not a.dsn:
        log('!! 需要 DATABASE_URL'); return 2
    import asyncpg
    conn = await asyncpg.connect(a.dsn)
    try:
        units = await conn.fetch("""
            SELECT m.tag_id, m.unit_name
              FROM kp_unit_to_tag_mapping m
             WHERE m.tag_id IS NOT NULL
        """)
        log(f'概念单元→标签映射: {len(units)} 行')
        # ⚠️ **两套编码必须过桥**: kp_unit_to_tag_mapping.tag_id 是**连字符**格式 (BIO-G0-001),
        # 而 question_kp_v2.kp_id 的规范格式是**下划线**格式 (BIO_H_0016);
        # kp_v2_legacy_map 就是这座桥 (legacy_id → kp_id, method='normalized_name')。
        # 实测教训: 不过桥直接写 tag_id, 旧数据 11952 行会被判「无效 kp_id」(命名空间互不相认)。
        legacy_rows = await conn.fetch("""
            SELECT legacy_id, kp_id FROM kp_v2_legacy_map WHERE legacy_id IS NOT NULL
        """)
        bridge = {r['legacy_id']: r['kp_id'] for r in legacy_rows}
        log(f'legacy→规范 id 桥接: {len(bridge)} 条')
        miss_bridge = 0
        by_subj = collections.defaultdict(list)
        for r in units:
            s = subject_of(r['tag_id'])
            if s:
                by_subj[s].append((r['tag_id'], r['unit_name']))
        log('按学科: ' + ', '.join(f'{k}={len(v)}' for k, v in sorted(by_subj.items())))

        subs = sorted(by_subj) if a.subject == 'all' else [a.subject]
        total_mapped = total_q = 0
        payload = []
        for sub in subs:
            if sub not in by_subj:
                log(f'!! 学科 {sub} 无标签, 跳过'); continue
            idx = build_index(by_subj[sub])
            terms = sorted(idx, key=len, reverse=True)
            rx = re.compile('|'.join(re.escape(t) for t in terms)) if terms else None
            log(f'\n--- {sub}: 术语 {len(terms)}, 标签 {len({t for d in idx.values() for t in d})} ---')
            qs = await conn.fetch("""
                SELECT q.id, q.stem, coalesce(q.options,'') AS options,
                       coalesce(q.analysis,'') AS analysis
                  FROM exam_questions q JOIN exam_papers p ON p.id = q.paper_id
                 WHERE p.created_at::date='2026-09-17' AND q.archive_state='active'
                   AND p.subject = $1
                 ORDER BY q.id
            """, sub)
            if a.limit:
                qs = qs[:a.limit]
            hit = 0
            t0 = time.time()
            for r in qs:
                total_q += 1
                txt = PLACEHOLDER.sub('', (r['stem'] or '') + ' ' + (r['options'] or '')
                                      + ' ' + (r['analysis'] or ''))
                if not rx:
                    continue
                scores = collections.defaultdict(float)
                for m in rx.finditer(txt):
                    for tag, w in idx[m.group(0)].items():
                        scores[tag] += w
                if not scores:
                    continue
                top = sorted(scores.items(), key=lambda x: -x[1])[:a.topk]
                # 置信度: 第 1 名用「相对优势」top/(top+second); 其余按分数占比递减 ——
                # 实测问题: 原先三个标签拿到**同一个** confidence, 无法区分主次, 下游没法排序。
                if len(top) >= 2:
                    conf_top = top[0][1] / (top[0][1] + top[1][1])
                else:
                    conf_top = 0.80          # 无对照, 给保守值
                added = 0
                for tag, sc in top:
                    conf = conf_top * (sc / top[0][1]) if top[0][1] > 0 else 0.0
                    if conf >= a.min_conf:
                        # 连字符 legacy id → 规范下划线 id
                        canon = bridge.get(tag)
                        if canon is None:
                            miss_bridge += 1
                            continue
                        payload.append((r['id'], canon, 'rule', round(min(conf, 0.99), 2),
                                        f'规则匹配: 术语命中分数 {sc:.1f} (相对优势 {conf_top:.2f}; '
                                        f'legacy={tag})'))
                        added += 1
                if added:
                    hit += 1
            log(f'  题 {len(qs)}, 至少映射 1 个标签 {hit} ({100.0*hit/max(len(qs),1):.1f}%), '
                f'耗时 {time.time()-t0:.0f}s')
            total_mapped += hit

        log(f'\n>>> 合计: {total_mapped}/{total_q} 题获得规则映射 '
            f'({100.0*total_mapped/max(total_q,1):.1f}%), 待写入 {len(payload)} 行; '
            f'无桥接被丢弃 {miss_bridge} 次')
        if a.dry_run:
            for p in payload[:8]:
                log(f'   q#{p[0]} → {p[1]} conf={p[3]}')
            log('DRY-RUN: 未写库')
            return 0

        # 幂等: 只清 rule 行
        cleared = await conn.execute("DELETE FROM question_kp_v2 WHERE source='rule'")
        B = 2000
        for s in range(0, len(payload), B):
            await conn.executemany("""
                INSERT INTO question_kp_v2 (question_id, kp_id, source, confidence, reasoning)
                VALUES ($1,$2,$3,$4,$5)
                ON CONFLICT (question_id, kp_id, source) DO UPDATE
                   SET confidence = EXCLUDED.confidence, reasoning = EXCLUDED.reasoning
            """, [(p[0], p[1], p[2], p[3], p[4]) for p in payload[s:s + B]])
        n = await conn.fetchval("SELECT count(*) FROM question_kp_v2 WHERE source='rule'")
        nq = await conn.fetchval("SELECT count(DISTINCT question_id) FROM question_kp_v2 WHERE source='rule'")
        log(f'已写入 rule 映射 {n} 行 (覆盖 {nq} 题); 清理旧 rule 行: {cleared}')
        return 0
    finally:
        await conn.close()


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
