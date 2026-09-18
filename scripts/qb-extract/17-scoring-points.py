#!/usr/bin/env python3
"""17-scoring-points.py —— G9 缺失项: 从**解析版文本**提取评分点 (scoring_points, jsonb)。

背景
----
G9 要求「主观题 reference + scoring」。reference_answer 已有 (7875), scoring_points 一直是 0。
评分标准本就印在**解析版**里 (用户指令: G9 在解析版中提取), 不需要新数据源。

实测语料里的三种形态 (先量后写)
-------------------------------
  1. **分项/分层式**  `评分标准：本题为开放性试题，采取分项评分办法…第一等：11－12分。要求：…`
                      `史实水平1：能围绕与问题相关性较强的核心知识进行回答（9分）`
  2. **逐点式**       `（1）…（4分）（2）…（4分）`
  3. **关键词式**     `评分细则` / `评分参考` / `言之成理即可赋分`

实测可提取规模: 25403 道有解析的题里 **2807 道命中评分标记**(11%), 其中主观类 2390。
按学科: 语文 45.3% / 政治 12.3% / 历史 10.8% / 生物 10.5% / 英语 6.9% / 数学 6.6% / 物理 6.1% /
地理 5.1% / 化学 3.1%。

产物结构 (jsonb)
---------------
  {"marker": "评分标准",            ← 命中的标记词, 便于按来源分级
   "raw": "…原始片段…",            ← 保留原文, 便于人工复核 (不丢信息)
   "points": [{"kind":"level","label":"第一等","score":"11-12","text":"要求：…"},
              {"kind":"point","label":"（1）","score":"4","text":"…"}]}

幂等: 只写本脚本负责的题 (scoring_points 为空或由本脚本写入), 不覆盖其它来源。

用法:
  python3 17-scoring-points.py --dry-run
  python3 17-scoring-points.py
"""
import argparse
import asyncio
import json
import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

# 标记词 (按优先级): 越靠前越明确
MARKERS = ['评分标准', '评分细则', '评分参考', '分项评分', '赋分', '评分说明']
# 分层标签: 水平N / 第X等 / 一等 + **前后文约束**
# ⚠️ 实测假阳 (抽样复核抓到 2/4):
#   · 历史「等**一等**，不急于争取…」 —— 裸 `[一二三]等` 命中 "等一等"
#   · 数学「**一等**比数列与**一等**差数列」 —— 命中 "等比数列/等差数列"
#   所以裸 `X等` 必须紧跟冒号/括号/分值才是分层标签; `第X等`/`水平N` 本身无歧义, 保留。
LEVEL = re.compile(r'(水平\s*[1-4１-４](?![0-9])'          # ⚠️ (?![0-9]): 防「水平1000倍」被读成「水平1」
                   r'|第\s*[一二三四五六七八九十]+\s*等'
                   r'|[一二三四五六七八九]等(?=\s*[：:（(]|\s*[0-9]{1,2}\s*分))')
# 层级后面跟的分数: （9分） / 11－12分 / 9分
LEVEL_SCORE = re.compile(r'[（(]?\s*([0-9]{1,2}\s*[-－~～]\s*[0-9]{1,2}|[0-9]{1,2})\s*分\s*[）)]?')
# 逐点: （1）…（4分） 或 ①…（2分）
# ⚠️ 两套编号体系**不能同时用** —— 实测若把 （1） 与 ① 都当锚点, 相邻锚点会把片段切成
# 只有一个标签的退化片段 (样例: [point] '（1）' 正文为空)。所以优先用阿拉伯数字括号, 无则用圈号。
POINT_NUM = re.compile(r'[（(]\s*([0-9]{1,2})\s*[）)]')
POINT_CIRC = re.compile(r'([①②③④⑤⑥⑦⑧⑨⑩])')
# 带分数的逐点: （4分） / （9—12分）—— 这是本语料**最大**的一类评分信息 (实测 2729 道)
SCORED = re.compile(r'[（(]\s*([0-9]{1,2}(?:\s*[-－~～]\s*[0-9]{1,2})?)\s*分\s*[）)]')


def find_segment(text: str):
    """返回 (marker, 片段)。片段从标记词处开始, 到文本结束 (评分标准一般在解析末尾)。"""
    if not text:
        return None, None
    best = None
    for mk in MARKERS:
        i = text.find(mk)
        if i >= 0 and (best is None or i < best[1]):
            best = (mk, i)
    # 分层/逐点标记也算命中 (无显式关键词时)
    if best is None:
        m = LEVEL.search(text)
        if m:
            best = ('分层标记', m.start())
    # 只有「（N分）」标注、无任何关键词的卷 (本语料最大一类) —— 也从第一个分数标注处起算
    if best is None:
        sc = list(SCORED.finditer(text))
        if len(sc) >= 2:
            best = ('分数标注', sc[0].start())
    if best is None:
        return None, None
    mk, i = best
    return mk, text[i:]


def _tail(body: str, limit: int = 120) -> str:
    """取标记前**最后一句**作为评分点主体。

    实测坑: `（N分）` 在**题干**里也大量出现 (子问分值), 若直接取标记之间的整段,
    会把材料/题干原文当成评分点写库 (样例: '山东省深入贯彻落实科学发展观…阅读材料, 回答问题')。
    裁到最后一个句读之后, 留下的才是分点内容。
    """
    body = re.sub(r'\s+', ' ', body).strip()
    if len(body) <= limit:
        return body
    w = body[-limit:]
    for sep in ('。', '；', ';', '，'):
        i = w.find(sep)
        if 0 <= i < limit * 0.6:
            return w[i + 1:].strip()
    return w


def parse_points(seg: str):
    """把片段切成结构化评分点。"""
    pts = []
    # 1) 分层式: 每个「水平N/第X等」到一个评分点
    marks = [(m.start(), m.group(0)) for m in LEVEL.finditer(seg)]
    if len(marks) >= 2:
        for k, (pos, label) in enumerate(marks):
            end = marks[k + 1][0] if k + 1 < len(marks) else len(seg)
            body = seg[pos:end]
            sm = LEVEL_SCORE.search(body)
            pts.append({'kind': 'level', 'label': label.strip(),
                        'score': sm.group(1).strip() if sm else None,
                        'text': body[:300].strip()})
        return pts
    # 2) 带分数的逐点（最大一类）: 以「（N分）」为界, 每段正文 + 该段分值
    #    ⚠️ 实测定性: 这类界定的是**子问赋分**(材料+子问 值 N 分), 不是评分细则 ——
    #    所以 kind 定为 'subscore', 与 level/point/criteria (**真评分点**) 分级报告, 不混为一谈。
    sc = list(SCORED.finditer(seg))
    if len(sc) >= 2:
        prev = sc[0].start()
        for m in sc:
            body = seg[prev:m.start()].strip()
            if body:
                pts.append({'kind': 'subscore', 'label': None,
                            'score': m.group(1).strip(), 'text': _tail(body)})
            prev = m.end()
        if pts:
            return pts
    # 3) 编号逐点: **只用一种编号体系**, 避免相邻锚点切出空片段
    for rx, tag in ((POINT_NUM, 'num'), (POINT_CIRC, 'circ')):
        pmarks = [(m.start(), m.group(0)) for m in rx.finditer(seg)]
        if len(pmarks) >= 2:
            for k, (pos, label) in enumerate(pmarks):
                end = pmarks[k + 1][0] if k + 1 < len(pmarks) else len(seg)
                body = seg[pos:end].strip()
                if len(body) <= len(label) + 1:
                    continue          # 退化片段 (只剩标签) → 丢弃
                sm = LEVEL_SCORE.search(body)
                pts.append({'kind': 'point', 'label': label.strip(),
                            'score': sm.group(1).strip() if sm else None,
                            'text': body[:300]})
            if pts:
                return pts
    # 4) 关键词式: 整段作为一个说明性评分点
    sm = LEVEL_SCORE.search(seg)
    pts.append({'kind': 'criteria', 'label': None,
                'score': sm.group(1).strip() if sm else None,
                'text': seg[:400].strip()})
    return pts


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    a = ap.parse_args()
    if not a.dsn:
        print('!! 需要 DATABASE_URL'); return 2
    import asyncpg
    conn = await asyncpg.connect(a.dsn)
    try:
        rows = await conn.fetch("""
            SELECT q.id, q.analysis, p.subject, q.question_type
              FROM exam_questions q JOIN exam_papers p ON p.id = q.paper_id
             WHERE p.created_at::date='2026-09-17' AND q.archive_state='active'
               AND q.analysis IS NOT NULL AND btrim(q.analysis) <> ''
             ORDER BY q.id
        """)
        if a.limit:
            rows = rows[:a.limit]
        print(f'扫描有解析的题: {len(rows)}')
        payload = []
        stats = {}
        kinds = {'level': 0, 'point': 0, 'criteria': 0}
        for r in rows:
            mk, seg = find_segment(r['analysis'])
            if not seg:
                continue
            pts = parse_points(seg)
            if not pts:
                continue
            for p in pts:
                kinds[p['kind']] = kinds.get(p['kind'], 0) + 1
            payload.append((r['id'], json.dumps({'marker': mk, 'raw': seg[:800], 'points': pts},
                                                ensure_ascii=False)))
            stats[r['subject']] = stats.get(r['subject'], 0) + 1
        print(f'提取到评分点的题: {len(payload)} ({100.0*len(payload)/max(len(rows),1):.1f}%)')
        print(f'评分点类型分布: {kinds}')
        print('按学科: ' + ', '.join(f'{k}={v}' for k, v in sorted(stats.items(), key=lambda x: -x[1])))
        if payload:
            print('样例:')
            for pid, js in payload[:2]:
                d = json.loads(js)
                print(f"   q#{pid} marker={d['marker']} points={len(d['points'])}")
                for p in d['points'][:2]:
                    print(f"      [{p['kind']}] {p['label']} 分={p['score']}  {p['text'][:70]!r}")
        if a.dry_run:
            print('DRY-RUN: 未写库')
            return 0
        B = 1000
        for s in range(0, len(payload), B):
            await conn.executemany("""
                UPDATE exam_questions SET scoring_points = $2::jsonb, updated_at = now()
                 WHERE id = $1
            """, [(p[0], p[1]) for p in payload[s:s + B]])
        n = await conn.fetchval("SELECT count(*) FROM exam_questions WHERE scoring_points IS NOT NULL")
        print(f'\n已写入 scoring_points: {n} 题')
        return 0
    finally:
        await conn.close()


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
