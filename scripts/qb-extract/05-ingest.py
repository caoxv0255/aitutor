#!/usr/bin/env python3
"""05-ingest.py —— 把 02-extract 的提取产物写入 exam_papers / exam_questions 及关联表。

设计要点
--------
1. **纯新增, 不动存量**: 实测本次 1634 卷身份与库内既有 283 卷**零重叠**, 所以是新增而非替换。
   存量 6219 卷题一行都不改。
2. **幂等**: 以 paper_uid / question_uid 为准 upsert, 重复执行不产生重复行。
   子表 (question_formulas / question_images / exam_sub_questions) 按 question_id 先删后写。
3. **逐卷事务**: 单卷失败只回滚该卷, 其余照常; 失败清单最后汇总 (可重跑补上)。
4. **--dry-run**: 全流程走一遍然后 ROLLBACK, 只报数不落盘。

字段映射的关键约定
------------------
- `question_section`: 来自 qbx.assign_sections() —— 题号重启点推定 (main / s1 / s2 ...)。
  这是 migration 022 新增列, 也是 (paper_id, question_number) 之外的第二维唯一性来源。
- `question_uid` = f"{paper_uid}|{section}|{number}" —— 卷内 (number, section) 唯一, 故全局唯一。
- `options` / `latex_formulas` / `image_descriptions` 在库中是 **text** 列 (不是 jsonb), 需 json.dumps 后写。
- `math_type` 写 NULL、`paper_variant` 写 'main' —— 与库内既有 283 卷的取值约定一致。
- 媒体路径 = MEDIA_ROOT/<rel_path>; VLM 结果按 sha256 关联, 拿 latex / semantic。
"""
import argparse
import asyncio
import collections
import glob
import hashlib
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PAPERS_DIR = os.path.join(ROOT, 'database/preflight/qb-extract/out/papers')
VLM_DIR = os.path.join(ROOT, 'database/preflight/qb-extract/out/vlm')
MEDIA_ROOT = os.path.join(ROOT, 'database/preflight/qb-extract/out/media')

# 与 exam_papers.paper_type 白名单一致 (migration 017 的 ck_exam_papers_paper_type)
VALID_PAPER_TYPES = {
    'independent', 'national_i', 'national_ii', 'national_iii', 'national_a', 'national_b',
    'new_gaokao_i', 'new_gaokao_ii', 'national_legacy', 'unknown', 'national_outline',
    'national_new', 'new_gaokao_regional',
}
VALID_Q_TYPES = {'choice', 'solve', 'fill', 'unknown'}


def log(*a):
    print(*a, flush=True)


def load_vlm():
    """sha256 -> {latex, semantic, reading, kind, blank}"""
    idx, bad = {}, 0
    for f in glob.glob(os.path.join(VLM_DIR, '*.json')):
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception:
            bad += 1
            continue
        sha = d.get('sha256')
        if sha:
            idx[sha] = d
    log(f'VLM 结果: {len(idx)} 条 (损坏 {bad})')
    return idx


def load_papers():
    out = []
    for f in sorted(glob.glob(os.path.join(PAPERS_DIR, '**/*.json'), recursive=True)):
        try:
            out.append(json.load(open(f, encoding='utf-8')))
        except Exception as e:
            log(f'!! 读卷失败 {f}: {e}')
    return out


def build_variants(papers):
    """给身份完全相同的卷分配 paper_variant, 保证 uq_exam_papers_full_identity 不冲突。

    实测只有 4 份需要: 山东 2008-2011 的「生物试卷」与「生物政治」,
    后者内容其实是政治题 (与生物卷题干重合 0/18) —— 属于放错目录的文件。
    这里不做科目猜测, 只用确定性后缀保证**不丢卷**, 异常在报告里点名。
    """
    groups = collections.defaultdict(list)
    for p in papers:
        i = p.get('identity') or {}
        if (i.get('subject') or 'unknown') == 'gaokao':   # 目录层级被当成科目的脏数据
            continue
        # 分组键必须与 INSERT 时的取值**逐字一致** (同样过一遍 or 'unknown' / int 化),
        # 否则 None 与 'unknown' 会分成两组、却写进同一行 → 撞 uq_exam_papers_full_identity。
        key = (i.get('exam_level') or 'gaokao',
               i.get('province_code') or 'unknown',
               int(i['year']) if str(i.get('year') or '').isdigit() else None,
               i.get('subject') or 'unknown',
               i.get('paper_type') or 'unknown')
        groups[key].append(p)
    assign, collisions = {}, []
    for key, items in groups.items():
        items.sort(key=lambda p: p.get('source_name') or '')
        for n, p in enumerate(items):
            variant = 'main' if n == 0 else f'v{n + 1}'
            assign[id(p)] = variant
            if n > 0:
                collisions.append((key, [x.get('source_name') for x in items]))
    return assign, collisions


def paper_uid_of(ident, variant):
    """16 位十六进制哈希 —— 与库内既有 paper_uid 约定一致 (varchar(32), 存量值均为 16 位十六进制)。

    为什么用哈希而不是可读串: 可读串 (gaokao:shandong:2008:biology:independent = 37 字符)
    会超出 varchar(32)。哈希同时天然容纳 variant, 让山东「生物/生物政治」那 4 份不会撞车。
    """
    key = '|'.join(str(ident.get(k) or 'unknown') for k in
                   ('exam_level', 'province_code', 'year', 'subject', 'paper_type')) + f'|{variant}'
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def question_uid_of(ident, variant, section, number, puid):
    """可读优先, 超长回退哈希 —— question_uid 上限 varchar(64)。

    只读串 = subject_year_province_papertype_variant_section_number, 既是全局唯一的
    (身份+节+题号 全在里面), 又比纯哈希好排查。
    """
    s = '_'.join(str(x) for x in (ident.get('subject') or 'unknown', ident.get('year') or 'unknown',
                                  ident.get('province_code') or 'national',
                                  ident.get('paper_type') or 'unknown', variant, section, number))
    return s if len(s) <= 60 else f'{puid}_{section}_{number}'


def plan(papers, vlm):
    """构造待写行, 同时做全量校验 (不碰数据库)。"""
    variants, collisions = build_variants(papers)
    rows, problems = [], []
    stats = collections.Counter()
    seen_uid = set()
    seen_q = set()
    for p in papers:
        ident = p.get('identity') or {}
        name = p.get('source_name') or ''
        variant = variants.get(id(p), 'main')
        pt = ident.get('paper_type') or 'unknown'
        if pt not in VALID_PAPER_TYPES:
            problems.append(f'非法 paper_type={pt!r} ({name})')
            pt = 'unknown'
        subj = ident.get('subject') or 'unknown'
        if subj == 'gaokao':
            problems.append(f'科目被解析成 gaokao ({name})')
        uid = paper_uid_of(ident, variant)
        if uid in seen_uid:
            problems.append(f'paper_uid 重复: {uid}')
        seen_uid.add(uid)

        qrows = []
        for q in (p.get('questions') or []):
            num = q.get('number')
            sec = q.get('section') or 'main'
            if num is None:
                stats['题跳过(无题号)'] += 1
                continue
            quid = question_uid_of(ident, variant, sec, num, uid)
            if len(quid) > 64:
                problems.append(f'question_uid 超 64: {quid}')
            if quid in seen_q:
                problems.append(f'question_uid 重复: {quid} ({name})')
            seen_q.add(quid)
            qt = q.get('question_type') or 'unknown'
            if qt not in VALID_Q_TYPES:
                problems.append(f'非法 question_type={qt!r} ({name} Q{num})')
                qt = 'unknown'
            media = q.get('media_stored') or []
            lats, sems, figs = [], [], []
            first_img = None
            for m in media:
                sha = m.get('sha256')
                rel = m.get('rel_path')
                v = vlm.get(sha) or {}
                if v.get('latex'):
                    lats.append(v['latex'])
                if v.get('semantic'):
                    sems.append(v['semantic'])
                if first_img is None and rel:
                    first_img = os.path.join('out/media', rel)
                if m.get('kind') == 'figure' and rel:
                    figs.append((os.path.join('out/media', rel), v.get('semantic'), v.get('reading')))
            qrows.append({
                'uid': quid,
                'number': num,
                'section': sec,
                'type': qt,
                'stem': q.get('stem') or '',
                'options': json.dumps(q.get('options') or {}, ensure_ascii=False) if q.get('options') else None,
                'answer': (q.get('answer') or None),
                'analysis': (q.get('analysis') or None),
                # G8/G9 状态标注 + 来源溯源 (migration 023):
                # 「100% 标注」要求每题都有状态值(含 MISSING_SOURCE), 不等于每题都有答案。
                # 来源字段对应规范「无静默覆盖」—— 任何写入都要能回答「它从哪来」。
                'answer_source': q.get('answer_source'),
                'analysis_source': q.get('analysis_source'),
                'has_image': bool(q.get('has_image')),
                'has_formula': bool(q.get('has_formula')),
                'raw_image_path': first_img,
                'image_descriptions': json.dumps(sems, ensure_ascii=False) if sems else None,
                'latex_formulas': json.dumps(lats, ensure_ascii=False) if lats else None,
                'formula_semantics': '\n'.join(lats) if lats else None,
                'semantic_description': ' | '.join(sems)[:4000] if sems else None,
                'image_status': 'PRESENT' if media else 'NOT_EXPECTED',
                'image_expected': bool(q.get('has_image')),
                'image_available': bool(media),
                'subs': [s for s in (q.get('sub_questions') or []) if isinstance(s, dict)],
                'figs': figs,
                'media': len(media),
            })
        rows.append({'uid': uid, 'ident': ident, 'variant': variant, 'name': name,
                     'path': (p.get('source_file') or '')[:500], 'qrows': qrows})
        stats['卷'] += 1
        stats['题'] += len(qrows)
        if not qrows:
            stats['空卷'] += 1
    return rows, problems, collisions, stats


# ----------------------------------------------------------------------------
SQL_PAPER_INS = """
INSERT INTO exam_papers
  (province_code, year, subject, exam_level, paper_type, math_type,
   paper_file_path, question_count, paper_uid, paper_variant)
VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,$8,$9)
ON CONFLICT (paper_uid) WHERE paper_uid IS NOT NULL
DO UPDATE SET province_code=EXCLUDED.province_code, year=EXCLUDED.year,
              subject=EXCLUDED.subject, exam_level=EXCLUDED.exam_level,
              paper_type=EXCLUDED.paper_type, paper_file_path=EXCLUDED.paper_file_path,
              question_count=EXCLUDED.question_count, paper_variant=EXCLUDED.paper_variant,
              updated_at=now()
RETURNING id
"""

SQL_FIND_PAPER = """
SELECT id, paper_uid, question_count FROM exam_papers
 WHERE province_code = $1 AND year IS NOT DISTINCT FROM $2 AND subject = $3
   AND exam_level = $4 AND paper_type = $5 AND COALESCE(paper_variant,'main') = $6
"""


async def archive_superseded(conn, rows):
    """把「与新卷同一场考试」的旧卷归档, 从而让出 (province,year,subject,level,type,variant='main')
    这个身份位给新卷, 并且**一行都不删**。

    为什么不删旧题: 旧题上挂着大量派生数据, 删除会 CASCADE 连带毁掉 ——
    question_knowledge_points 7361 / question_kp_v2 11952 / question_vectors 5834 /
    question_images 601 / exam_sub_questions 839 / exam_materials 225 行,
    并把 456 条 issue_tickets 的题目关联置空。归档只改 archive_state, 派生数据全部留住。

    幂等: 用 paper_uid 区分「我们写的卷」与「旧卷」。重跑时 SQL_FIND_PAPER 会命中我们自己
    的卷 (paper_uid 相同), 此时跳过 —— 否则第二次运行会把刚灌进去的新卷误归档。
    """
    archived = []
    for p in rows:
        i = p['ident']
        row = await conn.fetchrow(
            SQL_FIND_PAPER,
            i.get('province_code') or 'unknown',
            int(i['year']) if str(i.get('year') or '').isdigit() else None,
            i.get('subject') or 'unknown',
            i.get('exam_level') or 'gaokao',
            i.get('paper_type') or 'unknown',
            p['variant'])
        if not row or row['paper_uid'] == p['uid']:
            continue        # 不存在, 或就是我们自己上次写的 → 无需归档
        await conn.execute(
            "UPDATE exam_papers SET paper_variant='legacy', updated_at=now() WHERE id=$1", row['id'])
        status = await conn.execute(
            "UPDATE exam_questions SET archive_state='archived_legacy', updated_at=now() "
            "WHERE paper_id=$1 AND archive_state='active'", row['id'])
        try:
            n = int(status.split()[-1])       # asyncpg 返回 'UPDATE <n>'
        except (ValueError, IndexError):
            n = 0
        archived.append({'old_id': row['id'], 'old_q': row['question_count'],
                         'new_q': len(p['qrows']), 'name': p['name'], 'archived': n})
    return archived


SQL_Q_INS = """
INSERT INTO exam_questions
  (question_uid, paper_id, question_number, question_section, question_type, stem,
   options, answer, analysis, subject_code, province_code, year,
   has_image, has_formula, raw_image_path, image_descriptions, latex_formulas,
   formula_semantics, semantic_description, file_path,
   image_status, image_expected, image_available, archive_state,
   answer_status, analysis_status, answer_source, analysis_source,
   analysis_original, reference_answer)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,'active',
        CASE WHEN $8::text IS NOT NULL AND btrim($8::text) <> '' THEN 'PRESENT' ELSE 'MISSING_SOURCE' END,
        CASE WHEN $9::text IS NOT NULL AND btrim($9::text) <> '' THEN 'PRESENT' ELSE 'MISSING_SOURCE' END,
        $24, $25,
        -- G9: 本管线拿到的解析**全部来自原卷**, 故 analysis_original = analysis。
        -- 必须在这里写, 否则每次重跑入库都会让它变 NULL (与 latex 被覆盖同一类 bug)。
        $9,
        -- 主观题的 answer 本身就是参考答案 (§16)。
        -- **不要在 SQL 里用 $5 反推类型**: $5 已赋给 question_type (varchar), 再用 $5::text
        -- 会让 PG 报 'inconsistent types deduced for parameter $5: text versus character varying',
        -- 整批卷静默失败。改成 Python 侧算好当独立参数 ($26) 传入。
        $26)
ON CONFLICT (question_uid)
DO UPDATE SET paper_id=EXCLUDED.paper_id, question_number=EXCLUDED.question_number,
              question_section=EXCLUDED.question_section, question_type=EXCLUDED.question_type,
              stem=EXCLUDED.stem, options=EXCLUDED.options, answer=EXCLUDED.answer,
              analysis=EXCLUDED.analysis, subject_code=EXCLUDED.subject_code,
              province_code=EXCLUDED.province_code, year=EXCLUDED.year,
              has_image=EXCLUDED.has_image, has_formula=EXCLUDED.has_formula,
              raw_image_path=EXCLUDED.raw_image_path,
              -- VLM 派生的四列必须用 COALESCE 保住已有值, 不能直接 EXCLUDED 覆盖。
              -- 原因: 05 走 media_stored.sha256 查 VLM, 而**公式**的 sha256 与 04 的 HTML 渲染
              -- 路径天然不通 (OLE vs LibreOffice, 见 06-backfill-latex.py 文档), 所以 05 永远
              -- 写不出 latex。直接覆盖会让每次重跑入库都抹掉 06/07 回填的成果 ——
              -- 实测重跑一次: latex_formulas 2134 → 59, question_formulas 6673 → 214。
              image_descriptions=COALESCE(EXCLUDED.image_descriptions, exam_questions.image_descriptions),
              latex_formulas=COALESCE(EXCLUDED.latex_formulas, exam_questions.latex_formulas),
              formula_semantics=COALESCE(EXCLUDED.formula_semantics, exam_questions.formula_semantics),
              semantic_description=COALESCE(EXCLUDED.semantic_description, exam_questions.semantic_description),
              file_path=EXCLUDED.file_path, image_status=EXCLUDED.image_status,
              image_expected=EXCLUDED.image_expected, image_available=EXCLUDED.image_available,
              -- **审阅标记优先**: 人/脚本标过的 CONFLICT 不能被管线重跑冲掉 ——
              -- 和 archive_state 是同一类「单向」病: 标记机制必须能存活过重跑。
              answer_status=CASE WHEN exam_questions.answer_status='CONFLICT'
                                 THEN 'CONFLICT' ELSE EXCLUDED.answer_status END,
              analysis_status=EXCLUDED.analysis_status,
              -- **必须把 archive_state 复位**: 否则被任何一轮归档成 archived_stale 的题,
              -- 即使重新回到当前计划里也永远醒不过来 —— 入库变成「单向」的。
              -- 实测后果: 客观题分母从 23242 悄悄缩到 21373 (-1869), 而提取报告完全没变。
              archive_state='active',
              answer_source=COALESCE(EXCLUDED.answer_source, exam_questions.answer_source),
              analysis_source=COALESCE(EXCLUDED.analysis_source, exam_questions.analysis_source),
              analysis_original=EXCLUDED.analysis_original,
              reference_answer=EXCLUDED.reference_answer,
              updated_at=now()
RETURNING id
"""


async def ingest(conn, rows, dry, limit):
    written = collections.Counter()
    failures = []
    for n, p in enumerate(rows, 1):
        if limit and n > limit:
            break
        ident = p['ident']
        try:
            async with conn.transaction():
                pid = await conn.fetchval(
                    SQL_PAPER_INS,
                    ident.get('province_code') or 'national',
                    int(ident['year']) if str(ident.get('year') or '').isdigit() else None,
                    ident.get('subject') or 'unknown',
                    ident.get('exam_level') or 'gaokao',
                    ident.get('paper_type') or 'unknown',
                    p['path'], len(p['qrows']), p['uid'], p['variant'])
                written['卷'] += 1
                for q in p['qrows']:
                    qid = await conn.fetchval(
                        SQL_Q_INS, q['uid'], pid, q['number'], q['section'], q['type'], q['stem'],
                        q['options'], q['answer'], q['analysis'],
                        ident.get('subject'), ident.get('province_code'),
                        int(ident['year']) if str(ident.get('year') or '').isdigit() else None,
                        q['has_image'], q['has_formula'], q['raw_image_path'],
                        q['image_descriptions'], q['latex_formulas'],
                        q['formula_semantics'], q['semantic_description'], p['path'],
                        q['image_status'], q['image_expected'], q['image_available'],
                        q['answer_source'], q['analysis_source'],
                        (q['answer'] if q['type'] in ('solve', 'fill', 'unknown') else None))
                    written['题'] += 1
                    # 子表: 先删后写, 保证幂等
                    for tbl in ('question_images', 'exam_sub_questions'):
                        await conn.execute(f'DELETE FROM {tbl} WHERE question_id=$1 '
                                           if tbl != 'exam_sub_questions'
                                           else 'DELETE FROM exam_sub_questions WHERE parent_question_id=$1', qid)
                    # question_formulas 只在本次确有必要时才先删后写。
                    # 它是唯一一条**不由 05 供数**的子表: 数据来自 07-formulas-table.py
                    # (源于 04 的 HTML 路径, 见 06-backfill-latex.py 文档), 而 05 的 media_stored
                    # sha256 查不到公式 latex。无条件删会把 07 的回填整批删光 (实测 6673 → 214)。
                    if q['latex_formulas']:
                        await conn.execute('DELETE FROM question_formulas WHERE question_id=$1', qid)
                    if q['latex_formulas']:
                        for i, lat in enumerate(json.loads(q['latex_formulas'])):
                            await conn.execute(
                                'INSERT INTO question_formulas (question_id, latex, sort_order) VALUES ($1,$2,$3)',
                                qid, lat, i)
                            written['公式'] += 1
                    for i, (fp, sem, read) in enumerate(q['figs']):
                        await conn.execute(
                            'INSERT INTO question_images (question_id, file_path, semantic_description, '
                            'caption, sort_order, image_type) VALUES ($1,$2,$3,$4,$5,$6)',
                            qid, fp, sem, read, i, 'figure')
                        written['插图'] += 1
                    used_sub = set()
                    for i, s in enumerate(q['subs']):
                        sn = str(s.get('number') or s.get('label') or (i + 1))[:16]
                        # sub_number 在同一题内唯一 (约束 exam_sub_questions_parent_question_id_sub_number_key)。
                        # 实测提取出的子问标签会重复 (同一题里出现两个「①」), 必须加后缀去重。
                        _base, _k = sn, 2
                        while sn in used_sub:
                            sn = f'{_base}_{_k}'[:16]
                            _k += 1
                        used_sub.add(sn)
                        await conn.execute(
                            'INSERT INTO exam_sub_questions (parent_question_id, sub_number, sub_index, '
                            'stem, options, answer, analysis) VALUES ($1,$2,$3,$4,$5,$6,$7)',
                            qid, sn, i,
                            s.get('stem') or '', json.dumps(s.get('options') or {}, ensure_ascii=False)
                            if s.get('options') else None,
                            s.get('answer'), s.get('analysis'))
                        written['小问'] += 1
                # 对账归档: 本卷重跑后仍 active、但已不在本次计划里的题 = 上一轮策略产出的陈旧题。
                # 为什么必需: 05 用 question_uid upsert, **只增不删**。策略改选 (如 tail→inline) 后
                # 新题号集合与旧的并不重合, 不归档就会让同一卷同时留着两套题 (实测 2015 安徽英语
                # tail 的 24 题 + inline 的 76 题 = 100 行, 其中 24 行是废的)。
                # 为什么不用 DELETE: 与旧库同一考虑 —— 删题会 CASCADE 掉挂在它上面的
                # question_knowledge_points / question_kp_v2 / question_vectors / question_images。
                keep_uids = [q['uid'] for q in p['qrows']]
                st = await conn.execute(
                    "UPDATE exam_questions SET archive_state='archived_stale', updated_at=now() "
                    "WHERE paper_id=$1 AND archive_state='active' "
                    "AND NOT (question_uid = ANY($2::text[]))", pid, keep_uids)
                try:
                    written['归档陈旧题'] += int(st.split()[-1])
                except (ValueError, IndexError):
                    pass
        except Exception as e:
            failures.append(f'{p["name"]}: {type(e).__name__}: {str(e)[:160]}')
        if n % 200 == 0:
            log(f'  ... {n}/{len(rows)} 卷  {dict(written)}')
    if dry:
        raise _Rollback()
    return written, failures


class _Rollback(Exception):
    pass


async def amain():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--dsn', default=os.environ.get('DATABASE_URL'))
    args = ap.parse_args()
    if not args.dsn:
        log('缺少 DATABASE_URL'); return 1
    dsn = args.dsn.split('?')[0]

    vlm = load_vlm()
    papers = load_papers()
    log(f'读入卷: {len(papers)}')
    rows, problems, collisions, stats = plan(papers, vlm)
    log(f'计划: {dict(stats)}')
    if collisions:
        log(f'\n身份重复需消歧的组 ({len(collisions)}):')
        for key, names in collisions:
            log(f'  · {key}')
            for nm in names:
                log(f'      {nm}')
    if problems:
        log(f'\n校验告警 {len(problems)} 条, 前 10:')
        for x in problems[:10]:
            log(f'  ! {x}')

    import asyncpg
    conn = await asyncpg.connect(dsn)
    rolled = False
    written, failures, arch = collections.Counter(), [], []
    target = rows[:args.limit] if args.limit else rows
    try:
        if args.dry_run:
            async with conn.transaction():
                arch = await archive_superseded(conn, target)
                written, failures = await ingest(conn, rows, dry=False, limit=args.limit)
                rolled = True
                raise _Rollback()      # 外层事务回滚, 但上面已拿到计数
        else:
            arch = await archive_superseded(conn, target)
            written, failures = await ingest(conn, rows, dry=False, limit=args.limit)
    except _Rollback:
        pass
    finally:
        await conn.close()
    log(f'\n=== {"DRY-RUN (已回滚)" if rolled else "已写入"} ===')
    log(f'写入: {dict(written)}')
    if arch:
        lost = sum(1 for a in arch if a['new_q'] < a['old_q'])
        log(f'\n归档旧卷 {len(arch)} 份 (共 {sum(a["archived"] for a in arch)} 道旧题 → archived_legacy, 一行未删):')
        log(f'  其中新卷题数**少于**旧卷的有 {lost} 份 (新管线在这些卷上覆盖不如旧的)')
        for a in sorted(arch, key=lambda x: x['old_q'] - x['new_q'], reverse=True)[:10]:
            log(f'  旧{a["old_q"]:>3} → 新{a["new_q"]:>3} 题  #{a["old_id"]:<4} {a["name"]}')
    if failures:
        log(f'失败 {len(failures)} 卷:')
        for f in failures[:15]:
            log(f'  ! {f}')
    return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(amain()))
