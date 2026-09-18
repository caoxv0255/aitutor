#!/usr/bin/env python3
"""13-sample-report.py —— 抽 10 道「LLM 兜底补答案」的题, 出一份人读 md 报告。

目的: 让用户能**亲眼抽查** LLM 补的答案是否可信 —— 数字(83.3%)之外, 人眼判断也需要样本。

报告含:
  · 数据来源与两个口径的总览
  · 10 道题的完整信息 (年份/学科/省份/卷名/题号/分节/题干/选项/答案/来源状态)
  · 每道题标注「该题在源文档里确实没有答案」(即这是 LLM 独立给出的)
  · 诚实的准确率提示与回滚命令

用法: python3 13-sample-report.py [--n 10] [--out docs/database/llm-answer-samples.md]
"""
import argparse
import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=10)
    ap.add_argument('--out', default='docs/database/llm-answer-samples.md')
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    a = ap.parse_args()
    if not a.dsn:
        print('!! 需要 DATABASE_URL'); return 2
    import asyncpg
    conn = await asyncpg.connect(a.dsn)
    try:
        rows = await conn.fetch("""
            SELECT p.year, p.subject, coalesce(p.province_code,'-') AS prov,
                   coalesce(p.paper_type,'-') AS ptype,
                   split_part(coalesce(p.paper_file_path,''), '/', -1) AS fname,
                   q.question_number AS num, coalesce(q.question_section,'') AS sec,
                   q.stem, q.options, q.answer, q.answer_source, q.answer_status
              FROM exam_questions q JOIN exam_papers p ON p.id = q.paper_id
             WHERE q.answer_source = 'llm_websearch'
               AND q.answer_status = 'LLM_PROPOSED'
               AND q.archive_state = 'active'
               AND q.question_type = 'choice'
               AND length(q.stem) BETWEEN 15 AND 400
             ORDER BY p.year DESC, random()
             LIMIT $1
        """, a.n)
        stats = await conn.fetchrow("""
            SELECT count(*) FILTER (WHERE answer IS NOT NULL AND answer <> '') AS with_ans,
                   count(*) AS total,
                   count(*) FILTER (WHERE answer_source='llm_websearch') AS llm,
                   count(*) FILTER (WHERE answer IS NOT NULL AND answer <> ''
                                      AND answer_status <> 'LLM_PROPOSED') AS verified
              FROM exam_questions q JOIN exam_papers p ON p.id=q.paper_id
             WHERE p.created_at::date='2026-09-17' AND q.archive_state='active'
               AND NOT q.is_listening AND q.question_type IN ('choice','fill')
        """)
        stats5 = await conn.fetchrow("""
            SELECT count(*) FILTER (WHERE answer IS NOT NULL AND answer <> '') AS with_ans,
                   count(*) AS total,
                   count(*) FILTER (WHERE answer IS NOT NULL AND answer <> ''
                                      AND answer_status <> 'LLM_PROPOSED') AS verified
              FROM exam_questions q JOIN exam_papers p ON p.id=q.paper_id
             WHERE p.created_at::date='2026-09-17' AND q.archive_state='active'
               AND NOT q.is_listening AND q.question_type IN ('choice','fill')
               AND p.year >= 2021
        """)
    finally:
        await conn.close()

    import json
    L = []
    L.append('# LLM 兜底答案抽样报告\n')
    L.append(f'生成时间: {datetime.now():%Y-%m-%d %H:%M}   抽样数: {len(rows)}\n')
    L.append('## 一、背景与口径\n')
    L.append('源语料里**确实没有答案**的选择题，按用户要求用**联网大模型兜底补全**。'
             '模型为 `deepseek-v3.2`（`enable_search=True`）。\n')
    L.append('| 口径 | 全库 | 近 5 年 (2021–2025) |')
    L.append('|---|---:|---:|')
    L.append(f'| 经核验可判率（只用源提取+独立核对的答案） | '
             f'{100.0*stats["verified"]/stats["total"]:.2f}% | '
             f'{100.0*stats5["verified"]/stats5["total"]:.2f}% |')
    L.append(f'| 含 LLM 兜底可判率 | {100.0*stats["with_ans"]/stats["total"]:.2f}% | '
             f'{100.0*stats5["with_ans"]/stats5["total"]:.2f}% |')
    L.append(f'\nLLM 已补入 **{stats["llm"]}** 道，全部标记 `answer_status=LLM_PROPOSED`。\n')
    L.append('## 二、⚠️ 准确率提示（必读）\n')
    L.append('拿**近 5 年源里已有答案的真题**做盲测（30 题，题目不告诉模型答案）：\n')
    L.append('| 模型 | 联网 | 准确率 | token/题 | 耗时/题 |')
    L.append('|---|---|---:|---:|---:|')
    L.append('| **deepseek-v3.2（本次采用）** | 是 | **83.3%** | 160 | 0.7 s |')
    L.append('| kimi-k3 | 是 | 96.0% | 675 | 16.3 s |')
    L.append('| qwen-plus | 是 | 80.0% | 182 | 0.3 s |')
    L.append(f'\n**按 83.3% 推算，这 {stats["llm"]} 道里约有 {int(stats["llm"]*0.167)} 道答案不正确。**'
             '因此它们：\n')
    L.append('- 全部标 `answer_status=LLM_PROPOSED`，**不计入「经核验可判率」**；')
    L.append('- 可用一条 SQL 整类回滚：'
             '`UPDATE exam_questions SET answer=NULL, answer_source=NULL, '
             "answer_status='MISSING_SOURCE' WHERE answer_source='llm_websearch';`\n")
    L.append('## 三、抽样（人眼复核用）\n')
    for i, r in enumerate(rows, 1):
        try:
            opts = json.loads(r['options'] or '{}')
        except Exception:
            opts = {}
        L.append(f'### {i}. {r["year"]} 年 · {r["subject"]} · {r["prov"]} · 第 {r["num"]} 题'
                 f'{"（分节 " + r["sec"] + "）" if r["sec"] else ""}\n')
        L.append(f'- **来源卷**：`{r["fname"]}`')
        L.append(f'- **题型**：choice　**答案状态**：`{r["answer_status"]}`　'
                 f'**答案来源**：`{r["answer_source"]}`')
        L.append(f'- **LLM 给出的答案**：**{r["answer"]}**')
        L.append(f'\n**题干**：{r["stem"].strip()}\n')
        if opts:
            L.append('**选项**：\n')
            for k in sorted(opts):
                L.append(f'- {k}. {str(opts[k]).strip()}')
            L.append('')
        L.append('> 该题在源文档中**没有**可提取的答案，此答案是模型联网检索后独立给出，'
                 '**未经人工复核**。\n')
        L.append('---\n')
    out = REPO / a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text('\n'.join(L) + '\n', encoding='utf-8')
    print(f'报告已写入: {out}')
    print(f'  抽样 {len(rows)} 道 | 全库含LLM {100.0*stats["with_ans"]/stats["total"]:.2f}% '
          f'| 近5年 {100.0*stats5["with_ans"]/stats5["total"]:.2f}%')
    return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
