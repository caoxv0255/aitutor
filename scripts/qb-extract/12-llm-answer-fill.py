#!/usr/bin/env python3
"""12-llm-answer-fill.py —— 联网大模型兜底补答案（**单独标记，不污染已核验口径**）。

为什么必须单独标记
------------------
盲测实测（2026-09-18，拿近 5 年**源里已有答案**的真题喂给模型，看它答对多少）:

    模型        单次准确率        说明
    qwen-plus   18/24 = 75.0%    四选一, 随机基线 25%
    qwen-max     4/20 = 20.0%    **低于随机**, 且多次调用返回无法解析的冗长文本

按「错答案比缺答案更糟」：这样的准确率**不能**写进「经核验的答案」里 ——
否则 3400 道缺答案的题会注入约 850 个错答案, 把全库准确率从 99.2% 拖到 ~93%。

因此本脚本的答案:
  · `answer_source = 'llm_websearch'`  —— 与源提取路径区分, 可一键回滚;
  · `answer_status = 'LLM_PROPOSED'`   —— **不计入 PRESENT**, 读端/统计可自行决定是否采用;
  · 只写**多数票一致**的结果 (默认 3 票取 2), 并把票数记进 `answer_confidence`;
  · 不删不改已有答案 (一行未删原则)。

用法:
  python3 12-llm-answer-fill.py --year-from 2021 --votes 3 --limit 400 --dry-run
  python3 12-llm-answer-fill.py --year-from 2021 --votes 3
"""
import argparse
import asyncio
import collections
import concurrent.futures as cf
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PAPERS = REPO / 'database' / 'preflight' / 'qb-extract' / 'out' / 'papers'
LET = re.compile(r'^[A-D]$')


def log(*a):
    print(*a, flush=True)


def load_creds():
    key = (Path.home() / '.secrets' / 'aliyun_maas_key').read_text().strip()
    base = (Path.home() / '.secrets' / 'aliyun_maas_base').read_text().strip()
    return base.rstrip('/') + '/chat/completions', key


def ask(url, key, model, prompt, timeout=120):
    body = {'model': model, 'messages': [{'role': 'user', 'content': prompt}],
            'temperature': 0, 'max_tokens': 300, 'enable_search': True}
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(),
        headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        d = json.load(r)
    txt = (d['choices'][0]['message'].get('content') or '').strip()
    u = d.get('usage') or {}
    # 严格解析: 只接受「整段就是一个字母」或「答案: X」两种形态, 避免把解释里的 A 当成答案
    m = re.fullmatch(r'[（(]?([A-D])[）).。]?', txt.upper()) or \
        re.search(r'答案\s*[:：]?\s*[（(]?([A-D])\b', txt.upper())
    return (m.group(1) if m else None), u.get('prompt_tokens', 0) + u.get('completion_tokens', 0)


def ask_retry(url, key, model, prompt, attempts=2, timeout=150):
    """单次作答 + 失败重试。

    为什么不做多数投票: 实测 30 题三票**全部一致**却只有 **80%** 正确 —— 模型是
    「自信地错」(系统性偏差)。投票只能消随机误差, 对系统性偏差无效, 却要多付 3 倍成本。
    所以这里只重试**解析失败**(没输出字母)的情况, 不重试「不确定」。
    """
    tok = 0
    for _ in range(attempts):
        try:
            v, t = ask(url, key, model, prompt, timeout=timeout)
            tok += t
            if v:
                return v, tok
        except Exception:
            pass
    return None, tok


def build_prompt(y, s, p, stem, opts):
    return (f"这是{y}年高考{s}（{p or '全国'}）的选择题。请检索该场考试的官方答案后作答。\n"
            f"**最终只输出一个选项字母**（A/B/C/D），不要解释、不要标点。\n\n"
            f"题干：{stem[:400]}\n" + "\n".join(f"{k}. {str(opts[k])[:120]}" for k in 'ABCD'))


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--year-from', type=int, default=2021)
    ap.add_argument('--votes', type=int, default=3)
    ap.add_argument('--limit', type=int, default=400)
    ap.add_argument('--model', default='deepseek-v3.2')
    ap.add_argument('--workers', type=int, default=5)
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    a = ap.parse_args()
    if not a.dsn:
        log('!! 需要 DATABASE_URL'); return 2
    url, key = load_creds()

    # 1) 收集缺答案的选择题 (近 N 年, 有完整 A-D 选项)
    todo = []
    for f in PAPERS.rglob('*.json'):
        try:
            d = json.loads(f.read_text(encoding='utf-8'))
        except Exception:
            continue
        ident = d.get('identity') or {}
        y = ident.get('year') or 0
        if y < a.year_from:
            continue
        # 排除**非官方原文**的卷 —— 实测这类卷连原文都可能不是官方的, 联网也难找到权威答案,
        # 让模型去猜等于把噪声写进库。(用户指令 2026-09-18: 回忆版这类要排除)
        _sp = str(d.get('source_path') or '')
        if any(k in _sp for k in ('回忆', '网友', '估分', '预测')):
            continue
        # 按学科排除: 本库 300 题盲测显示这两个学科的 LLM 准确率接近随机猜,
        # 补进去等于把噪声写进库 (用户指令 2026-09-18: 回滚这两科并停止再补)。
        #   地理 68.2% (22 题)  语文 57.1% (7 题)   ← 对照: 生物 94.1% / 物理 90.9%
        if (ident.get('subject') or '') in ('geography', 'chinese'):
            continue
        for q in (d.get('questions') or []):
            if q.get('question_type') != 'choice' or q.get('answer'):
                continue
            opts = q.get('options') or {}
            if sorted(opts.keys()) != ['A', 'B', 'C', 'D']:
                continue
            st = (q.get('stem') or '').strip()
            if not (12 <= len(st) <= 420):
                continue
            todo.append({'y': y, 's': ident.get('subject'), 'p': ident.get('province'),
                         'num': q['number'], 'stem': st, 'opts': opts,
                         'src': d.get('source_path'), 'ident': ident,
                         'sec': q.get('section')})
    todo = todo[:a.limit]
    log(f'待补答案的选择题: {len(todo)} 道 (年份>={a.year_from}, 有完整 A-D 选项)')
    if not todo:
        return 0

    # 2) 作答 (单次 + 解析失败重试; 投票已实测无效, 见 ask_retry 文档)
    #    ⚠️ **先落盘缓存再写库** —— 教训: 首跑因写库匹配失败废掉 5.9M token,
    #    而答案本身已算出来却没留下。缓存使重跑零成本、且可复现。
    cache_path = REPO / 'database' / 'preflight' / 'qb-extract' / 'logs' / f'llm-answers-{a.model}.jsonl'
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache = {}
    cache_by_paper = {}
    if cache_path.exists():
        for ln in cache_path.read_text(encoding='utf-8').splitlines():
            try:
                r = json.loads(ln)
                cache[(r['sub'], r['year'], r['prov'], r['ptype'], r['sec'], r['num'])] = r['ans']
                # 备用索引: 按「源文件 stem + 题号」—— 字段名/身份键变化时仍能复用,
                # **避免因匹配 bug 重复烧钱** (首跑就是这个问题)。
                if r.get('src'):
                    cache_by_paper[(Path(r['src']).stem, r['num'])] = r['ans']
            except Exception:
                pass
        log(f'缓存命中 {len(cache)} 条 (按源文件索引 {len(cache_by_paper)} 条)')

    def key_of(it):
        pid = it['ident']
        # ⚠️ 提取产物的身份键是 **province_code**(不是 province) —— 写错会导致
        # province 传 NULL, SQL 谓词静默匹配 0 行 (实测: 2704 条答案一条没写进去)。
        return (pid.get('subject'), pid.get('year'),
                pid.get('province_code') or pid.get('province'),
                pid.get('paper_type'), it['sec'], it['num'])

    def lookup(it):
        v = cache.get(key_of(it))
        if v is None and it.get('src'):
            v = cache_by_paper.get((Path(it['src']).stem, it['num']))
        return v

    todo_all = todo
    todo = [it for it in todo_all if lookup(it) is None]
    log(f'待查询 {len(todo)} 道 (已有缓存 {len(todo_all) - len(todo)} 道)')

    tok_total = [0]

    def work(item):
        pr = build_prompt(item['y'], item['s'], item['p'], item['stem'], item['opts'])
        v, t = ask_retry(url, key, a.model, pr)
        tok_total[0] += t
        return item, v

    results = []
    t0 = time.time()
    if todo:
        with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
            for item, v in ex.map(work, todo):
                results.append((item, v))
        # 立刻落盘: 即使后续写库失败, 答案也不会丢
        with open(cache_path, 'a', encoding='utf-8') as fh:
            for item, v in results:
                if v:
                    pid = item['ident']
                    fh.write(json.dumps({'sub': pid.get('subject'), 'year': pid.get('year'),
                                         'prov': pid.get('province'), 'ptype': pid.get('paper_type'),
                                         'sec': item['sec'], 'num': item['num'], 'ans': v,
                                         'src': str(item.get('src') or '')}, ensure_ascii=False) + '\n')
        for item, v in results:
            if v:
                cache[key_of(item)] = v

    accepted = []
    for item in todo_all:
        v = lookup(item)
        if v:
            item['final'] = v
            accepted.append(item)

    log(f'作答完成: {len(accepted)}/{len(todo_all)} 有效 '
        f'({100.0 * len(accepted) / max(len(todo_all), 1):.0f}%), 本轮耗时 {time.time() - t0:.0f}s, '
        f'本轮 token {tok_total[0]:,} ({tok_total[0] / max(len(todo), 1):.0f}/题)')
    log(f'⚠️ 盲测: deepseek-v3.2+联网 在已知答案真题上 83.3% (25/30, 样本 30) —— '
        f'入库后标 answer_status=LLM_PROPOSED, **不计入**「经核验答案」口径')
    if a.dry_run:
        for it in accepted[:10]:
            log(f"   {it['y']} {it['s']} Q{it['num']} → {it['final']}")
        log('DRY-RUN: 未写库')
        return 0

    import asyncpg
    conn = await asyncpg.connect(a.dsn)
    written = 0
    try:
        for it in accepted:
            pid = it['ident']
            # 按「卷身份 + 分节 + 题号」精确匹配 —— 不用 paper_file_path:
            # 提取产物的 source_path 与库内 paper_file_path 可能是不同路径(docx-cache vs incoming),
            # 用它匹配会静默漏写 (首跑 2700 条只落 494 条就是这么来的)。
            st = await conn.execute("""
                UPDATE exam_questions q
                   SET answer = $1, answer_source = 'llm_websearch',
                       answer_status = 'LLM_PROPOSED', updated_at = now()
                  FROM exam_papers p
                 WHERE p.id = q.paper_id
                   AND p.created_at::date = '2026-09-17'
                   AND p.subject = $2 AND p.year = $3
                   AND coalesce(p.province_code, '') = coalesce($4, '')
                   AND coalesce(p.paper_type, '') = coalesce($5, '')
                   AND q.question_number = $6
                   AND coalesce(q.question_section, '') = coalesce($7, '')
                   AND q.archive_state = 'active'
                   AND (q.answer IS NULL OR q.answer = '')
            """, it['final'], pid.get('subject'), pid.get('year'),
                pid.get('province_code') or pid.get('province'),
                pid.get('paper_type'), it['num'], it['sec'])
            try:
                written += int(st.split()[-1])
            except (ValueError, IndexError):
                pass
        log(f'\n已写入 LLM_PROPOSED 答案: {written} / 尝试 {len(accepted)}')
        n = await conn.fetchval(
            "SELECT count(*) FROM exam_questions WHERE answer_source='llm_websearch'")
        log(f'库内 llm_websearch 总数: {n}')
        log(f'缓存文件: {cache_path}')
    finally:
        await conn.close()
    return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
