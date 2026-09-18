#!/usr/bin/env python3
"""14-llm-validate.py —— 在**本库真题**上盲测 LLM, 量出真实准确率并出对照报告。

为什么必须做
------------
补答案用的模型准确率此前只有 30 题的小样本 (83.3%)。要决定这 2782 道 LLM 答案
能不能用、错多少, 必须在**自己的语料**上量 —— 那才是能落到决策上的数字。

做法
----
从库里抽 N 道**已有经核验答案**的选择题, 用与补答案**完全相同**的 prompt 问模型,
把「源答案」与「LLM 答案」并列比对。

产物
----
  · 控制台: 总体/按学科/按年份准确率
  · docs/database/llm-answer-validation.md: 含错例明细的人读报告
  · 缓存 logs/llm-validate-<model>.jsonl: 重跑零成本

用法:
  python3 14-llm-validate.py --n 300 --model deepseek-v3.2
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
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LET = re.compile(r'^[A-D]$')


def load_creds():
    key = (Path.home() / '.secrets' / 'aliyun_maas_key').read_text().strip()
    base = (Path.home() / '.secrets' / 'aliyun_maas_base').read_text().strip()
    return base.rstrip('/') + '/chat/completions', key


def parse_letter(txt):
    t = (txt or '').strip().upper()
    m = re.fullmatch(r'[（(]?([A-D])[）).。]?', t) or re.search(r'答案\s*[:：]?\s*[（(]?([A-D])\b', t)
    return m.group(1) if m else None


def ask(url, key, model, prompt, timeout=150):
    body = {'model': model, 'messages': [{'role': 'user', 'content': prompt}],
            'temperature': 0, 'max_tokens': 300, 'enable_search': True}
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(),
        headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        d = json.load(r)
    u = d.get('usage') or {}
    return parse_letter(d['choices'][0]['message'].get('content')), \
        u.get('prompt_tokens', 0) + u.get('completion_tokens', 0)


def build_prompt(y, s, p, stem, opts):
    return (f"这是{y}年高考{s}（{p or '全国'}）的选择题。请检索该场考试的官方答案后作答。\n"
            f"**最终只输出一个选项字母**（A/B/C/D），不要解释、不要标点。\n\n"
            f"题干：{stem[:400]}\n" + "\n".join(f"{k}. {str(opts[k])[:120]}" for k in 'ABCD'))


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=300)
    ap.add_argument('--model', default='deepseek-v3.2')
    ap.add_argument('--workers', type=int, default=8)
    ap.add_argument('--out', default='docs/database/llm-answer-validation.md')
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    a = ap.parse_args()
    if not a.dsn:
        print('!! 需要 DATABASE_URL'); return 2
    url, key = load_creds()

    import asyncpg
    conn = await asyncpg.connect(a.dsn)
    try:
        # 抽样: 已有**经核验**答案的选择题 (排除 LLM 自己补的, 否则是自证)
        rows = await conn.fetch("""
            SELECT p.year, p.subject, coalesce(p.province_code,'-') prov, q.question_number num,
                   coalesce(q.question_section,'') sec, q.stem, q.options, q.answer gold,
                   split_part(coalesce(p.paper_file_path,''), '/', -1) fname
              FROM exam_questions q JOIN exam_papers p ON p.id = q.paper_id
             WHERE p.created_at::date='2026-09-17' AND q.archive_state='active'
               AND NOT q.is_listening AND q.question_type='choice'
               AND q.answer ~ '^[A-D]$'
               AND coalesce(q.answer_source,'') <> 'llm_websearch'
               AND coalesce(q.answer_status,'') <> 'LLM_PROPOSED'
               AND length(q.stem) BETWEEN 15 AND 400
               AND q.options LIKE '%"A":%' AND q.options LIKE '%"D":%'
             ORDER BY random() LIMIT $1
        """, a.n)
    finally:
        await conn.close()
    print(f'抽样 {len(rows)} 道（已有经核验答案的真题）')

    cache_path = REPO / 'database' / 'preflight' / 'qb-extract' / 'logs' / f'llm-validate-{a.model}.jsonl'
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache = {}
    if cache_path.exists():
        for ln in cache_path.read_text(encoding='utf-8').splitlines():
            try:
                r = json.loads(ln)
                cache[(r['fname'], r['num'], r['sec'])] = r['llm']
            except Exception:
                pass

    todo = [r for r in rows if (r['fname'], r['num'], r['sec']) not in cache]
    print(f'需查询 {len(todo)} 道（缓存命中 {len(rows) - len(todo)}）')

    tok = [0]

    def work(r):
        try:
            opts = json.loads(r['options'] or '{}')
        except Exception:
            opts = {}
        v, t = ask(url, key, a.model,
                   build_prompt(r['year'], r['subject'], r['prov'], r['stem'] or '', opts))
        tok[0] += t
        return r, v

    t0 = time.time()
    if todo:
        out = []
        with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
            for r, v in ex.map(work, todo):
                out.append((r, v))
        with open(cache_path, 'a', encoding='utf-8') as fh:
            for r, v in out:
                if v:
                    fh.write(json.dumps({'fname': r['fname'], 'num': r['num'], 'sec': r['sec'],
                                         'llm': v}, ensure_ascii=False) + '\n')
                    cache[(r['fname'], r['num'], r['sec'])] = v
    print(f'查询完成 耗时 {time.time() - t0:.0f}s  token {tok[0]:,}')

    # 统计
    by_sub = collections.defaultdict(lambda: [0, 0])
    by_year = collections.defaultdict(lambda: [0, 0])
    ok = n = fail = 0
    errs = []
    for r in rows:
        v = cache.get((r['fname'], r['num'], r['sec']))
        if not v:
            fail += 1
            continue
        n += 1
        hit = (v == r['gold'])
        ok += hit
        by_sub[r['subject']][0] += 1
        by_sub[r['subject']][1] += hit
        by_year[r['year']][0] += 1
        by_year[r['year']][1] += hit
        if not hit and len(errs) < 20:
            errs.append((r, v))

    acc = 100.0 * ok / max(n, 1)
    print(f'\n>>> {a.model}(联网) 在本库 {n} 道真题上: 答对 {ok} = **{acc:.1f}%**  (无作答 {fail})')

    L = ['# LLM 补答案 —— 本库真题盲测验证报告\n',
         f'生成时间: {datetime.now():%Y-%m-%d %H:%M}　模型: `{a.model}`（`enable_search=True`）　'
         f'样本: {n} 道\n',
         '## 方法\n',
         '从库中随机抽取**已有经核验答案**的选择题，用与补答案**完全相同**的 prompt 问模型，'
         '把「源答案」与「LLM 答案」并列比对。源答案来自试卷原文解析，独立于模型。\n',
         '## 一、总体准确率\n',
         f'**{ok} / {n} = {acc:.1f}%**（无作答 {fail} 道）\n',
         f'即：LLM 补的每条答案，**约 {(100 - acc):.1f}% 的概率是错的**。'
         f'按当前库内 {2782} 条 LLM 兜底答案推算，**约 {int(2782 * (100 - acc) / 100)} 条不正确**。\n',
         '## 二、按学科\n',
         '| 学科 | 样本 | 答对 | 准确率 |',
         '|---|---:|---:|---:|']
    for s, (t, o) in sorted(by_sub.items(), key=lambda x: -(x[1][1] / max(x[1][0], 1))):
        L.append(f'| {s} | {t} | {o} | {100.0 * o / max(t, 1):.1f}% |')
    L += ['\n## 三、按年份\n', '| 年份 | 样本 | 答对 | 准确率 |', '|---|---:|---:|---:|']
    for y, (t, o) in sorted(by_year.items(), reverse=True):
        L.append(f'| {y} | {t} | {o} | {100.0 * o / max(t, 1):.1f}% |')
    L += ['\n## 四、错例明细（源答案 vs LLM 答案）\n']
    for r, v in errs:
        try:
            opts = json.loads(r['options'] or '{}')
        except Exception:
            opts = {}
        L.append(f'### {r["year"]} 年 · {r["subject"]} · {r["prov"]} · 第 {r["num"]} 题\n')
        L.append(f'- 来源卷：`{r["fname"]}`')
        L.append(f'- **源答案 = {r["gold"]}　LLM 答案 = {v}** ❌')
        L.append(f'\n题干：{(r["stem"] or "").strip()[:300]}\n')
        for k in sorted(opts):
            L.append(f'- {k}. {str(opts[k]).strip()[:110]}')
        L.append('\n---\n')
    L.append('\n## 五、结论与建议\n')
    L.append(f'- 实测准确率 **{acc:.1f}%**（对照 30 题小样本的 83.3%）。')
    L.append('- 所有 LLM 答案标 `answer_status=LLM_PROPOSED`，**不计入经核验口径**。')
    L.append('- 整类回滚：'
             "`UPDATE exam_questions SET answer=NULL, answer_source=NULL, "
             "answer_status='MISSING_SOURCE' WHERE answer_source='llm_websearch';`")
    L.append('- 已排除非官方原文卷（回忆版/网友版/估分/预测）。')
    out = REPO / a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text('\n'.join(L) + '\n', encoding='utf-8')
    print(f'报告: {out}')
    print(f'缓存: {cache_path}')
    return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
