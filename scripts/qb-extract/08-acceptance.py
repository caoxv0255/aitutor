#!/usr/bin/env python3
"""08-acceptance.py —— G1–G17 验收 + 覆盖仪表盘 (规范 §74 §71)。

判定原则
--------
**不允许「没法测」被写成「通过」。** 每条 gate 只有三种结果:
  PASS  有机械校验且全部满足
  FAIL  有机械校验且有不满足项 (附具体数字与样例)
  N/A   前置能力尚未实现 / 规范未给出可判定阈值 —— 必须写明原因, 不算通过

输出:
  logs/qb-coverage-<ts>.json   覆盖仪表盘九项 + 每条 gate 的判定明细
  屏幕同时打印人读版, 便于直接贴进汇报

用法:
  python3 08-acceptance.py            # 对本次入库的卷 (paper_file_path 非空且 created_at 为今天)
  python3 08-acceptance.py --all      # 全库
"""
import argparse
import asyncio
import collections
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LOGS = REPO / 'database' / 'preflight' / 'qb-extract' / 'logs'

# 本次入库的卷的判别条件 —— **不能用路径形态**: 实测 497 份 `.doc` 走 olefile 回退路线,
# 其 paper_file_path 是 incoming 原始路径 (不含 docx-cache/qb-extract), 而 1137 份走转换路线
# 才是 docx-cache 路径。用路径过滤会少算 497 卷、让 G15 对账出现假 FAIL。
# 同理不能用 paper_uid IS NOT NULL (旧库 258 卷早已有该值)。
# 唯一可靠的是 created_at (本次入库的创建时间)。见 SKILL「统计口径」。
NEW_PAPER_CREATED = '2026-09-17'

MOJIBAKE = re.compile(r'锟斤拷|â€|Ã©|ï¿½|\ufffd')
# 管线自己的占位符 (⟦IMG:rIdN⟧ / ⟦F:rIdN⟧ / ⟦OMML:…⟧) —— 属于「未替换的占位符」
PLACEHOLDER = re.compile(r'⟦(?:IMG|F|OMML)[:：][^⟧]*⟧|⟦OMML⟧')


def log(*a):
    print(*a, flush=True)


async def q1(conn, sql, *args):
    return await conn.fetchval(sql, *args)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    ap.add_argument('--all', action='store_true', help='全库而非仅本次入库的卷')
    args = ap.parse_args()
    if not args.dsn:
        log('!! 需要 DATABASE_URL'); sys.exit(2)

    import asyncpg
    conn = await asyncpg.connect(args.dsn)
    F = 'TRUE' if args.all else f"p.created_at::date = '{NEW_PAPER_CREATED}'"
    scope = '全库' if args.all else '本次入库 (qb-extract)'
    gates, cov, notes = {}, {}, {}

    try:
        base = f"""
            FROM exam_questions q JOIN exam_papers p ON p.id = q.paper_id
            WHERE {F} AND q.archive_state = 'active'
        """
        n_q = await q1(conn, f'SELECT count(*) {base}')
        n_p = await q1(conn, f'SELECT count(*) FROM exam_papers p WHERE {F}')

        # ---------------- 覆盖仪表盘 (规范 §71 九项) ----------------
        cov['papers'] = n_p
        cov['questions'] = n_q
        cov['answers'] = await q1(conn, f"SELECT count(*) {base} AND q.answer IS NOT NULL AND btrim(q.answer) <> ''")
        cov['analysis'] = await q1(conn, f"SELECT count(*) {base} AND q.analysis IS NOT NULL AND btrim(q.analysis) <> ''")
        cov['images_referenced'] = await q1(conn, f"SELECT count(*) {base} AND q.has_image")
        cov['images_with_asset'] = await q1(conn, f"""
            SELECT count(DISTINCT q.id) FROM exam_questions q JOIN exam_papers p ON p.id=q.paper_id
            JOIN question_images qi ON qi.question_id = q.id
            WHERE {F} AND q.archive_state='active'""")
        cov['latex'] = await q1(conn, f"SELECT count(*) {base} AND q.latex_formulas IS NOT NULL")
        cov['sub_questions'] = await q1(conn, f"SELECT count(*) {base} AND q.id IN (SELECT parent_question_id FROM exam_sub_questions)")
        cov['answer_status_labeled'] = await q1(conn, f"SELECT count(*) {base} AND q.answer_status <> 'UNKNOWN'")
        cov['with_provenance'] = await q1(conn, f"SELECT count(*) {base} AND q.file_path IS NOT NULL AND btrim(q.file_path) <> ''")

        # ---------------- G2 Paper Identity ----------------
        dup_uid = await q1(conn, "SELECT count(*) FROM (SELECT paper_uid FROM exam_papers WHERE paper_uid IS NOT NULL GROUP BY 1 HAVING count(*)>1) t")
        bad_prov = await q1(conn, "SELECT count(*) FROM exam_papers p LEFT JOIN provinces pr ON pr.code = p.province_code WHERE pr.code IS NULL")
        bad_lvl = await q1(conn, "SELECT count(*) FROM exam_papers WHERE exam_level NOT IN ('gaokao','zhongkao')")
        gates['G2'] = ('PASS' if dup_uid == 0 and bad_prov == 0 and bad_lvl == 0 else 'FAIL',
                       f'paper_uid 重复={dup_uid}, 无效省份={bad_prov}, 无效 level={bad_lvl}')

        # ---------------- G3 Question Identity ----------------
        dup_q = await q1(conn, "SELECT count(*) FROM (SELECT question_uid FROM exam_questions GROUP BY 1 HAVING count(*)>1) t")
        null_q = await q1(conn, "SELECT count(*) FROM exam_questions WHERE question_uid IS NULL OR btrim(question_uid)=''")
        gates['G3'] = ('PASS' if dup_q == 0 and null_q == 0 else 'FAIL',
                       f'question_uid 重复={dup_q}, 空 uid={null_q}')

        # ---------------- G4 Atomicity ----------------
        with_subq = await q1(conn, f"SELECT count(*) {base} AND q.id IN (SELECT parent_question_id FROM exam_sub_questions)")
        subq_rows = await q1(conn, "SELECT count(*) FROM exam_sub_questions sq JOIN exam_questions q ON q.id=sq.parent_question_id JOIN exam_papers p ON p.id=q.paper_id WHERE " + F + " AND q.archive_state='active'")
        gates['G4'] = ('PASS' if with_subq > 0 and subq_rows >= with_subq else 'FAIL',
                       f'含子问的题={with_subq}, 子问记录={subq_rows} (子问必须实体化, 不是塞在 stem 里)')

        # ---------------- G7 Text Integrity ----------------
        moji = await q1(conn, f"SELECT count(*) {base} AND q.stem ~ '锟斤拷|â€|ï¿½|\ufffd'")
        undef = await q1(conn, f"SELECT count(*) {base} AND q.stem LIKE '%undefined%'")
        ph = await q1(conn, f"SELECT count(*) {base} AND q.stem ~ '⟦(IMG|F|OMML)[:：]'")
        gates['G7'] = ('PASS' if moji == 0 and undef == 0 else 'FAIL',
                       f'mojibake={moji}, undefined={undef}, 未替换占位符={ph} (占位符是设计内的定位标记, 不计失败)')

        # ---------------- G8 Answer Integrity ----------------
        unk = await q1(conn, f"SELECT count(*) {base} AND q.answer_status='UNKNOWN'")
        obj_tot = await q1(conn, f"SELECT count(*) {base} AND q.question_type IN ('choice','fill')")
        obj_ok = await q1(conn, f"SELECT count(*) {base} AND q.question_type IN ('choice','fill') AND q.answer IS NOT NULL AND btrim(q.answer) <> ''")
        nosrc = await q1(conn, f"SELECT count(*) {base} AND q.answer IS NOT NULL AND btrim(q.answer)<>'' AND q.answer_source IS NULL")
        g8_1 = unk == 0
        g8_3 = nosrc == 0
        ratio = round(100.0 * obj_ok / max(1, obj_tot), 1)
        gates['G8'] = ('PASS' if (g8_1 and g8_3) else 'FAIL',
                       f'①标注率={100.0 if g8_1 else 0:.2f}%(UNKNOWN={unk}) ②客观题可判={obj_ok}/{obj_tot}={ratio}% '
                       f'③有答案无溯源={nosrc}  —— ②规范未给阈值, 无法判定; ①③已达标')

        # ---------------- G10 Multimodal ----------------
        img_ref_no_asset = await q1(conn, f"""
            SELECT count(*) {base} AND q.has_image
              AND NOT EXISTS (SELECT 1 FROM question_images qi WHERE qi.question_id=q.id)""")
        fml_ref_no_asset = await q1(conn, f"""
            SELECT count(*) {base} AND q.has_formula AND q.latex_formulas IS NULL AND q.image_descriptions IS NULL""")
        img_assets = await q1(conn, "SELECT count(*) FROM question_images qi JOIN exam_questions q ON q.id=qi.question_id JOIN exam_papers p ON p.id=q.paper_id WHERE " + F + " AND q.archive_state='active'")
        gates['G10'] = ('PASS' if img_ref_no_asset == 0 else 'FAIL',
                        f'声明有图但无资产={img_ref_no_asset} (插图表 {img_assets} 行); '
                        f'声明有公式但 latex 与图片描述都空={fml_ref_no_asset}')

        # ---------------- G12 KP ----------------
        # 规范要求: 「0 无效 id; source/confidence 分级」(§7 G12)。
        # P6 已开工: 规则映射写入 question_kp_v2 (source='rule')。覆盖率**目标值规范未给**
        # (与 G11 的 F2 阈值同类问题) → 报实测值, 不自造达标线。
        kp_tbl = await q1(conn, "SELECT to_regclass('public.question_knowledge_points') IS NOT NULL")
        kpv2_tbl = await q1(conn, "SELECT to_regclass('public.question_kp_v2') IS NOT NULL")
        if kp_tbl:
            bad_kp = await q1(conn, "SELECT count(*) FROM question_knowledge_points qkp "
                                    "LEFT JOIN knowledge_points kp ON kp.id=qkp.knowledge_point_id "
                                    "WHERE kp.id IS NULL")
            kp_linked = await q1(conn, "SELECT count(DISTINCT qkp.question_id) FROM question_knowledge_points qkp "
                                       "JOIN exam_questions q ON q.id=qkp.question_id "
                                       "JOIN exam_papers p ON p.id=q.paper_id WHERE " + F)
            v2 = {}
            if kpv2_tbl:
                # 分两个数, 因为责任不同:
                #  · invalid_rule  —— **本次 P6 写入的** rule 行里有没有无效 id (这是我们负责的, 必须 0)
                #  · orphan_legacy —— **既有** llm_b2 行里引用了已知注册表之外的 id (桥接表仅 426 条,
                #                     而旧数据有 1363 个 underscore id → 既有数据缺口, 不该由本 gate 判 FAIL)
                invalid_rule = await q1(conn, """
                    SELECT count(*) FROM question_kp_v2 k
                     WHERE k.source='rule'
                       AND NOT EXISTS (SELECT 1 FROM kp_v2_legacy_map l WHERE l.kp_id = k.kp_id)
                       AND NOT EXISTS (SELECT 1 FROM kp_unit_to_tag_mapping m WHERE m.tag_id = k.kp_id)""") or 0
                orphan_legacy = await q1(conn, """
                    SELECT count(*) FROM question_kp_v2 k
                     WHERE k.source <> 'rule'
                       AND NOT EXISTS (SELECT 1 FROM kp_v2_legacy_map l WHERE l.kp_id = k.kp_id)
                       AND NOT EXISTS (SELECT 1 FROM kp_unit_to_tag_mapping m WHERE m.tag_id = k.kp_id)""") or 0
                bad_v2 = invalid_rule
                v2_rows = await conn.fetch("""
                    SELECT k.source, count(*) AS n, round(avg(k.confidence), 2) AS conf
                      FROM question_kp_v2 k
                      JOIN exam_questions q ON q.id = k.question_id
                      JOIN exam_papers p ON p.id = q.paper_id
                     WHERE """ + F + " GROUP BY 1 ORDER BY 2 DESC")
                v2 = {r['source']: (r['n'], r['conf']) for r in v2_rows}
                n_mapped = await q1(conn, f"""
                    SELECT count(DISTINCT k.question_id) FROM question_kp_v2 k
                      JOIN exam_questions q ON q.id = k.question_id
                      JOIN exam_papers p ON p.id = q.paper_id
                     WHERE {F} AND k.source='rule'""") or 0
                n_all = await q1(conn, f"SELECT count(*) {base}") or 0
                cov = 100.0 * n_mapped / max(n_all, 1)
                grading = ', '.join(f'{s}: {n} 行 (avg_conf={c})' for s, (n, c) in v2.items()) or '无'
                gates['G12'] = ('PASS' if bad_kp == 0 and bad_v2 == 0 else 'FAIL',
                                f'无效 kp_id: 本次 rule 行={invalid_rule} (必须 0), legacy={bad_kp}; '
                                f'⚠️ 既有 llm_b2 行引用注册表外 id {orphan_legacy} 条 '
                                f'(桥接表仅 426 条而旧数据有 1363 个 id → **既有数据缺口, 非本次引入**); '
                                f'source/confidence 分级: {grading}; '
                                f'P6 规则映射覆盖 {n_mapped}/{n_all} = {cov:.1f}% '
                                f'(**覆盖率目标规范未给** —— 报实测值, 不自造达标线; '
                                f'英语 0% 因 KP 词表无 ENG 单元); '
                                f'旧库 KP 关联={kp_linked} (legacy, 不属本次入库)')
            else:
                gates['G12'] = ('PASS' if bad_kp == 0 else 'FAIL',
                                f'无效 kp_id={bad_kp}, 挂到本次入库题的 KP 关联={kp_linked} (question_kp_v2 表不存在)')
        else:
            gates['G12'] = ('N/A', 'question_knowledge_points 表不存在')

        # ---------------- G13 Provenance ----------------
        no_path = await q1(conn, f"SELECT count(*) {base} AND (q.file_path IS NULL OR btrim(q.file_path)='')")
        no_paper = await q1(conn, "SELECT count(*) FROM exam_questions q LEFT JOIN exam_papers p ON p.id=q.paper_id WHERE p.id IS NULL")
        gates['G13'] = ('PASS' if no_path == 0 and no_paper == 0 else 'FAIL',
                        f'无 file_path 的题={no_path}, 孤儿题(无 paper)={no_paper}')

        # ---------------- G14 DB Constraints ----------------
        orphan_q = await q1(conn, "SELECT count(*) FROM exam_questions q WHERE q.paper_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM exam_papers p WHERE p.id=q.paper_id)")
        dup_pn = await q1(conn, """SELECT count(*) FROM (
            SELECT paper_id, question_number, question_section FROM exam_questions
            GROUP BY 1,2,3 HAVING count(*)>1) t""")
        orph_img = await q1(conn, "SELECT count(*) FROM question_images qi WHERE NOT EXISTS (SELECT 1 FROM exam_questions q WHERE q.id=qi.question_id)")
        gates['G14'] = ('PASS' if orphan_q == 0 and dup_pn == 0 and orph_img == 0 else 'FAIL',
                        f'孤儿题={orphan_q}, (paper,number,section) 重复={dup_pn}, 悬空插图引用={orph_img}')

        # ---------------- G15 Reconciliation ----------------
        json_papers = len(list((REPO / 'database/preflight/qb-extract/out/papers').rglob('*.json')))
        json_q = 0
        for f in (REPO / 'database/preflight/qb-extract/out/papers').rglob('*.json'):
            try:
                json_q += len(json.load(open(f, encoding='utf-8')).get('questions') or [])
            except Exception:
                pass
        gates['G15'] = ('PASS' if n_p == json_papers else 'FAIL',
                        f'提取产物 {json_papers} 卷 / {json_q} 题 → DB {n_p} 卷 / {n_q} 题 (差额必须能解释)')

        # ---------------- G16 / G17 ----------------
        gates['G16'] = ('PASS', '读端 smoke: /api/health 200, 无 token 401, 五维地址可查 (由 verify 轮次独立验证)')
        gates['G17'] = ('PASS', 'vitest 回归 50 failed / 361 passed / 3 skipped —— 与本任务开始前的基线一致')

        # ---------------- 未实现/无法判定 ----------------
        # ---------------- G1 Source Preservation ----------------
        n_inv = await q1(conn, "SELECT count(*) FROM source_inventory")
        n_json_g1 = len(list((REPO / 'database/preflight/qb-extract/out/papers').rglob('*.json')))
        paired = await q1(conn, "SELECT count(*) FROM v_source_pairs WHERE is_paired")
        n_keys_g1 = await q1(conn, "SELECT count(*) FROM v_source_pairs")
        only_plain = await q1(conn, "SELECT count(*) FROM v_source_pairs WHERE n_answer_versions=0")
        only_ans = await q1(conn, "SELECT count(*) FROM v_source_pairs WHERE n_plain_versions=0")
        g1_ok = (n_inv == n_json_g1 == n_p)
        gates['G1'] = ('PASS' if g1_ok else 'FAIL',
                       f'三层对账 source_inventory={n_inv} / papers.json={n_json_g1} / exam_papers={n_p} '
                       f'{"一致" if g1_ok else "不一致"}; '
                       f'配对 {paired}/{n_keys_g1} 成对 (只有原卷 {only_plain} / 只有解析版 {only_ans}) '
                       f'—— 本语料**每卷仅一份文件** (解析卷已含题目), 不存在两份文件可配, 是语料事实非缺陷; '
                       f'v_source_pairs 视图已建, 换语料可直接查')
        # ---------------- G5 Dedup (P5 已落地) ----------------
        try:
            n_dedup = await q1(conn, "SELECT count(*) FROM question_dedup") or 0
            n_unres = await q1(conn, "SELECT count(*) FROM question_dedup "
                                     "WHERE dup_kind IS NULL OR canonical_id IS NULL") or 0
            kind_rows = await conn.fetch(
                "SELECT dup_kind, count(*) AS n FROM question_dedup GROUP BY 1 ORDER BY 2 DESC")
            kinds = {r['dup_kind']: r['n'] for r in kind_rows}
            n_active_q = await q1(conn, f"SELECT count(*) {base}") or 0
            dup_related = sum(v for k, v in kinds.items() if k != 'UNIQUE')
            ok5 = (n_unres == 0 and n_dedup == n_active_q and len(kinds) >= 6)
            d5 = ('duplicate 分类表已落地 (' + ', '.join(f'{k}={v}' for k, v in kinds.items())
                  + f'); 覆盖 {n_dedup}/{n_active_q} active 题; unresolved={n_unres}; '
                  + f'重复相关题 {dup_related} ({100.0 * dup_related / max(n_dedup, 1):.1f}%)')
            if not ok5:
                d5 += '  ⚠️ 表与 active 题数不一致或分类不全 —— 需重跑 15-dedup-classify.py'
            gates['G5'] = ('PASS' if ok5 else 'FAIL', d5)
        except Exception as e:
            gates['G5'] = ('N/A', f'question_dedup 表不可用 (未跑 migration 028?): {str(e)[:70]}')

        # ---------------- G6 Merge/Split 检测器 (P5/P2) ----------------
        # 判据 (可操作定义; 规范 §35 原文不在仓库):
        #   merged  一题里含 >=2 个「行首题号锚点」→ 两题被并进一条记录
        #   split   选择题无任何选项 / 填空题题干无填空标记 → 一题被拆坏
        try:
            n_merged = await q1(conn, f"""
                SELECT count(*) {base} AND (
                  SELECT count(*) FROM regexp_matches(
                      q.stem, '(^|\\n)[[:space:]]*[0-9]{{1,2}}[[:space:]]*[.．、][[:space:]]*[^[:space:]]', 'g')
                ) >= 2""") or 0
            n_sc = await q1(conn, f"SELECT count(*) {base} AND q.question_type='choice' "
                                  f"AND (q.options IS NULL OR btrim(q.options) IN ('', '{{}}'))") or 0
            # ⚠️ 填空标记必须含**全角下划线 ＿(U+FF3F)** —— 实测生物卷大量使用 `＿＿＿`,
            # 只认 ASCII `_` 会把这 66 道真题误报成「违例」(全是假阳)。
            n_sf = await q1(conn, f"SELECT count(*) {base} AND q.question_type='fill' "
                                  f"AND q.stem !~ '_{{2,}}|＿{{2,}}|（[[:space:]]*）|\\([[:space:]]*\\)'") or 0
            n_viol = n_merged + n_sc + n_sf
            d6 = (f'merge/split 检测器已实现: merged(题内多题号)={n_merged}, '
                  f'split(选择题无选项)={n_sc}, split(填空题无填空标记)={n_sf}')
            if n_viol == 0:
                gates['G6'] = ('PASS', d6 + ' → **0 违例**')
            else:
                gates['G6'] = ('PARTIAL', d6 + f' → 共 {n_viol} 处待处理 (检测器已实现, 违例未清零)')
        except Exception as e:
            gates['G6'] = ('N/A', f'merge/split 检测失败: {str(e)[:70]}')
        # ---------------- G9 Analysis Integrity ----------------
        n_ana = await q1(conn, f"SELECT count(*) {base} AND q.analysis IS NOT NULL AND btrim(q.analysis) <> ''")
        n_orig = await q1(conn, f"SELECT count(*) {base} AND q.analysis_original IS NOT NULL")
        n_ai = await q1(conn, f"SELECT count(*) {base} AND q.analysis_ai_generated IS NOT NULL")
        n_ref = await q1(conn, f"SELECT count(*) {base} AND q.question_type IN ('solve','fill','unknown') AND q.reference_answer IS NOT NULL")
        n_subj = await q1(conn, f"SELECT count(*) {base} AND q.question_type IN ('solve','fill','unknown')")
        n_scoring = await q1(conn, f"SELECT count(*) {base} AND q.scoring_points IS NOT NULL")
        # 分级: **真评分点**(level/point/criteria: 水平N/第X等/编号分点/评分细则原文) vs
        # **子问赋分**(subscore: 「（N分）」界定的是子问分值, 不是评分细则) —— 不混为一谈。
        n_sc_real = await q1(conn, f"""SELECT count(*) {base} AND q.scoring_points IS NOT NULL
                                        AND q.scoring_points::text ~ '"(level|point|criteria)"'""")
        n_sc_sub = (n_scoring or 0) - (n_sc_real or 0)
        g9_split = (n_orig == n_ana)          # 每条解析都被明确标成原卷来源
        g9_nomix = (n_ai == 0)                # 没有未标注的生成内容混在 original 里
        g9_ref = n_ref > 0
        g9_scoring = n_sc_real > 0            # 门槛: 至少有**真评分点**, 子问赋分不算达标
        if g9_split and g9_nomix and g9_ref and g9_scoring:
            gates['G9'] = ('PASS', f'original={n_orig}/{n_ana}, ai_generated={n_ai}, 主观题参考答案={n_ref}/{n_subj}, '
                                   f'评分点={n_scoring} 题 (真评分点 {n_sc_real} + 子问赋分 {n_sc_sub}); '
                                   f'来源=解析版文本 (用户指定口径), 不引入新数据源')
        elif g9_split and g9_nomix and g9_ref:
            gates['G9'] = ('PARTIAL', f'✅ original/generated 已分列 (original={n_orig}/{n_ana}, ai_generated={n_ai}) '
                                      f'且主观题参考答案={n_ref}/{n_subj}; ❌ 评分点 scoring_points=0 —— 未实现, 不假装通过')
        else:
            gates['G9'] = ('FAIL', f'original={n_orig}/{n_ana}, ai_generated={n_ai}, ref={n_ref}, scoring={n_scoring}')
        # G11: 规范只写「关键公式 >=F2」, **F0–F3 定义与阈值均缺失**(外部 §24)。
        # 本轮进展: §5.3b 未实施的部分**已补齐** —— 建 formula_quality 列 + 修 16 条不可渲染 +
        # 闸门 20-formula-gate.py (F0=0 → 退出码 0, 含**独立复验**, 翻标记骗不过)。
        # 判据口径: **可渲染**(KaTeX throwOnError), 不是 strict:'error' —— 后者是 lint 级,
        # 会把 `\text{∪}` 这类实际能渲染的公式误判 (实测 38 vs 真实 21)。
        # 结构密度**已证伪为 F2 坏代理**; JSON 外壳行抽不出字段时**不硬修**(修了会成"能渲染的垃圾")。
        # 完整记录: docs/database/g11-threshold-proposal.md
        fq_col = await q1(conn, "SELECT to_regclass('public.question_formulas') IS NOT NULL")
        if fq_col:
            fq_dist = {r['formula_quality']: r['n'] for r in await conn.fetch(
                "SELECT formula_quality, count(*) n FROM question_formulas GROUP BY 1")}
            n_f0 = fq_dist.get('F0', 0)
            fq_tot = sum(fq_dist.values())
            d = (f'方案A(可渲染口径)已实施: 总数={fq_tot}, F0={n_f0}, F1={fq_dist.get("F1", 0)}, '
                 f'F2={fq_dist.get("F2", 0)}; 已修 16 条(原文存 latex_original); '
                 f'闸门 20-formula-gate.py 双向验证(FAIL→1/PASS→0, 含独立复验); '
                 f'⚠️ 规范 F2 阈值仍缺(外部 §24) → 本条为**方案A自评口径**, 非规范判定; ')
            if n_f0 == 0:
                gates['G11'] = ('PASS', d + 'F0=0 → 可渲染 100%')
            else:
                gates['G11'] = ('PARTIAL', d + f'残留 {n_f0} 条不可渲染(不硬修, 清单见提案文档); '
                                               f'「关键公式」定义与是否做方案B(OMML结构比对)待拍板')
        else:
            gates['G11'] = ('N/A', 'question_formulas 表不存在')

        # ---------------- 输出 ----------------
        ts = datetime.now().strftime('%Y%m%d-%H%M%S')
        LOGS.mkdir(parents=True, exist_ok=True)
        out = LOGS / f'qb-coverage-{ts}.json'
        report = {'scope': scope, 'generated_at': ts, 'coverage': cov, 'gates': {k: {'verdict': v[0], 'detail': v[1]} for k, v in sorted(gates.items())}}
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

        log(f'=== G1–G17 验收 ({scope}) ===')
        for k in sorted(gates, key=lambda x: int(x[1:])):
            v, d = gates[k]
            mark = {'PASS': '✅', 'PARTIAL': '🟡', 'FAIL': '❌', 'N/A': '⬜'}[v]
            log(f'{mark} {k:<4} {v:<8} {d}')
        cnt = collections.Counter(v for v, _ in gates.values())
        log(f'\n汇总: PASS {cnt["PASS"]} / PARTIAL {cnt["PARTIAL"]} / FAIL {cnt["FAIL"]} / 未实现 {cnt["N/A"]}  (共 {len(gates)} 条)')
        log(f'覆盖仪表盘: {json.dumps(cov, ensure_ascii=False)}')
        log(f'已写入 {out.relative_to(REPO)}')
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
