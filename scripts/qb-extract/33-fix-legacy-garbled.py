#!/usr/bin/env python3
"""33-fix-legacy-garbled.py —— 把 qb-extract 已抽取的干净文本回写「全表遗留乱码行」。

背景 (2026-09-24)
-----------------
北京数学批 (884aa58) 修完后, 全表 `32-text-integrity-scan.py --all` 仍命中 30 行:
遗留 (legacy) 行的 stem 是 OLE/PDF 文本层误解码 (PUA + æ ä ã ï å 族) 或 .doc 整段
GBK 误码 (U+FFFD)。这些行**不在可检索池** (answer 空 → 被 pool 谓词挡住), 但--
扫描口径全表仍报红, 且其同卷 active 对照行 (管线 uid) 在库里已有干净文本。

本脚本做的事 (与 北京数学批 apply_update.py 同法):
  1. `--plan` : 对给定 ids, 按 (province, subject, year, question_number, section) 对齐
                preflight `out/papers/**` 的抽取结果; 只更新 **管线文本更干净** 的行;
                管线文本仍带错的行 (源级损坏/闸门假阳性) 一律不动, 单独列出。
  2. `--backup`: 建本批专用备份表 (exam_questions_/question_vectors_ ..._bak_<ts>)。
  3. `--apply` : 只改 stem/options/answer/analysis + 从同卷 active 对照行复制
                (latex_formulas / formula_semantics / media_refs / has_formula);
                公式 ⟦F:rIdN⟧ 在 token 数与 HTML 公式项一致且 latex 合法时代入 $LaTeX$,
                否则保留规范 token (不猜)。不改 id / 关联 / subject / 范围外行。
  4. `--reembed`: 变更行重嵌入 (Ollama `bge-m3`, num_gpu=0 强制 CPU), 写入保持
                metadata.model='bge-m3' / provider='ollama'; 无向量行的 INSERT。

用法:
  export DATABASE_URL=postgresql://aitutor:...@localhost:55432/aitutor_db
  python3 scripts/qb-extract/33-fix-legacy-garbled.py --plan --ids 1115,9903,...
  python3 scripts/qb-extract/33-fix-legacy-garbled.py --backup --ids ...
  python3 scripts/qb-extract/33-fix-legacy-garbled.py --apply  --ids ...
  python3 scripts/qb-extract/33-fix-legacy-garbled.py --reembed --ids ...

安全: 默认不写库 (除非显式 --apply/--reembed); --apply 前会校验备份表与当前一致。
"""
from __future__ import annotations

import argparse
import asyncio
import glob
import json
import os
import re
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'database/preflight/qb-extract/out')
sys.path.insert(0, HERE)
import text_gate  # noqa: E402

SUBJECTS = ('chinese', 'math', 'english', 'physics', 'chemistry',
            'biology', 'politics', 'history', 'geography')
F_TOK = re.compile(r'⟦F:rId\d+⟧')


def load_vlm():
    idx = {}
    for f in glob.glob(os.path.join(OUT, 'vlm', '*.json')):
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception:
            continue
        if d.get('sha256'):
            idx[d['sha256']] = d
    return idx


def valid_latex(s):
    if not s or not isinstance(s, str):
        return False
    s = s.strip()
    return bool(s) and not s.startswith('{') and '"latex"' not in s and 'bar{bar' not in s and len(s) <= 300


def _uid_of(ident, variant, sec, num):
    """与 05-ingest.question_uid_of 同法, 用于把卷身份绑到具体某一行。"""
    s = '_'.join(str(x) for x in (ident.get('subject') or 'unknown', ident.get('year') or 'unknown',
                                  ident.get('province_code') or 'national',
                                  ident.get('paper_type') or 'unknown', variant, sec, num))
    return s


def paper_candidates(province, subject, year):
    """返回 (path, paper) 候选: 同 (province, subject, year) 可能有多卷 (如新高考Ⅰ/Ⅱ卷)。"""
    out = []
    for f in glob.glob(os.path.join(OUT, 'papers', '**', str(subject), str(year), '*.json'), recursive=True):
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception:
            continue
        i = d.get('identity') or {}
        if (i.get('province_code') == province and str(i.get('year')) == str(year)
                and i.get('subject') == subject):
            out.append((f, d))
    return sorted(out, key=lambda x: x[0])


def pick_paper(province, subject, year, row_uid, sec, num):
    """按 uid 精确匹配选卷; 失败时若候选唯一则回退到唯一候选 (兼容 legacy uid)。"""
    cands = paper_candidates(province, subject, year)
    for f, d in cands:
        i = d.get('identity') or {}
        by = {(q['number'], q.get('section') or 'main') for q in d['questions']}
        if (num, sec) in by and _uid_of(i, 'main', sec, num) == row_uid:
            return f, d, None
    if len(cands) == 1:
        return cands[0][0], cands[0][1], None
    if not cands:
        return None, None, 'no preflight paper'
    return None, None, f'ambiguous paper ({len(cands)} candidates, uid 未匹配)'


def formula_prop(paper_path, year, subject):
    hp = os.path.join(OUT, 'html', 'gaokao', subject, str(year),
                      os.path.basename(paper_path).replace('.json', '.json'))
    if not os.path.exists(hp):
        return {}
    h = json.load(open(hp, encoding='utf-8'))
    cur, prop = None, {}
    for it in h.get('items') or []:
        mm = re.match(r'^\s*(\d{1,2})\s*[.．、]', it.get('context') or '')
        if mm:
            cur = int(mm.group(1))
        if it['kind'] == 'formula' and cur is not None:
            prop.setdefault(cur, []).append(it)
    return prop


async def build_plan(conn, ids, vlm):
    rows = await conn.fetch(
        "SELECT id, question_uid, province_code, subject_code, year, question_number, "
        "COALESCE(question_section,'main') sec, archive_state, stem, options, answer, analysis "
        "FROM exam_questions WHERE id = ANY($1::int[]) ORDER BY id", ids)
    plan, unfix = {}, []
    for r in rows:
        province, subject, year = r['province_code'], r['subject_code'], r['year']
        path, paper, why = pick_paper(province, subject, year, r['question_uid'], r['sec'], r['question_number'])
        if not paper:
            unfix.append((r['id'], why or 'no preflight paper')); continue
        by = {(q['number'], q.get('section') or 'main'): q for q in paper['questions']}
        q = by.get((r['question_number'], r['sec']))
        if q is None:
            unfix.append((r['id'], 'no aligned question (number/section)')); continue
        _popt = json.dumps(q.get('options'), ensure_ascii=False) if q.get('options') else None
        _cl, rep = text_gate.evaluate_question(
            {'stem': q.get('stem') or '', 'options': _popt, 'analysis': q.get('analysis')})
        if rep['has_error']:
            unfix.append((r['id'], f"pipeline text still flagged {rep['counts']} (源级/假阳性, 不猜)"))
            continue
        prop = formula_prop(path, year, subject)
        nt = len(F_TOK.findall(q['stem'] or ''))
        lats = [(vlm.get(x['sha256']) or {}).get('latex') for x in prop.get(r['question_number'], [])[:nt]]
        ok = nt > 0 and len(lats) == nt and all(valid_latex(x) for x in lats)
        it = iter(lats)
        stem = F_TOK.sub(lambda _m: '$' + next(it) + '$', q['stem']) if ok else q['stem']
        plan[r['id']] = {
            'uid': r['question_uid'], 'subject': subject, 'province': province, 'year': year,
            'qn': r['question_number'], 'stem': stem, 'raw_stem': q.get('stem'),
            'options': json.dumps(q['options'], ensure_ascii=False) if q.get('options') else None,
            'answer': q.get('answer') or None, 'analysis': q.get('analysis'),
            'has_formula': bool(q.get('has_formula')), 'resolvable': ok,
        }
    return plan, unfix


async def do_backup(conn, ids, ts):
    eq, qv = f'exam_questions_garbled_fix_bak_{ts}', f'question_vectors_garbled_fix_bak_{ts}'
    await conn.execute(f'CREATE TABLE IF NOT EXISTS {eq} AS SELECT * FROM exam_questions WHERE id=ANY($1::int[])', ids)
    await conn.execute(f'CREATE TABLE IF NOT EXISTS {qv} AS SELECT * FROM question_vectors WHERE question_id=ANY($1::int[])', ids)
    print(f'备份: {eq} ({await conn.fetchval(f"select count(*) from {eq}")} 行), '
          f'{qv} ({await conn.fetchval(f"select count(*) from {qv}")} 行)')
    return eq, qv


async def do_apply(conn, plan, bak):
    if bak:
        diff = await conn.fetchval(
            f"SELECT count(*) FROM {bak} b JOIN exam_questions c USING(id) "
            "WHERE b.id = ANY($1::int[]) AND (b.stem IS DISTINCT FROM c.stem "
            "OR b.updated_at IS DISTINCT FROM c.updated_at)", list(plan))
        if diff != 0:
            print(f'ABORT: 备份与当前不一致 ({diff})'); return
    derived = {}
    for rid, r in plan.items():
        derived[rid] = await conn.fetchrow(
            "SELECT latex_formulas, formula_semantics, media_refs FROM exam_questions "
            "WHERE province_code=$1 AND subject_code=$2 AND year=$3 AND question_number=$4 "
            "AND archive_state='active' AND question_uid LIKE '%\\_main\\_main\\_%' ESCAPE '\\'",
            r['province'], r['subject'], r['year'], r['qn'])
    async with conn.transaction():
        for rid, r in plan.items():
            d = derived.get(rid) or {}
            await conn.execute(
                "UPDATE exam_questions SET stem=$2, options=$3, answer=COALESCE($4, answer), "
                "analysis=COALESCE($5, analysis), has_formula=$6, "
                "latex_formulas=COALESCE($7, latex_formulas), "
                "formula_semantics=COALESCE($8, formula_semantics), "
                "media_refs=COALESCE($9::jsonb, media_refs), updated_at=now() WHERE id=$1",
                rid, r['stem'], r['options'], r['answer'], r['analysis'], r['has_formula'],
                d.get('latex_formulas'), d.get('formula_semantics'), d.get('media_refs'))
    print(f'exam_questions 更新: {len(plan)} 行')


def embed(text):
    base = (os.environ.get('EMBEDDING_BASE_URL') or 'http://localhost:11434').rstrip('/')
    model = os.environ.get('EMBEDDING_MODEL') or 'bge-m3'
    body = json.dumps({'model': model, 'prompt': str(text)[:8000], 'options': {'num_gpu': 0}}).encode()
    req = urllib.request.Request(f'{base}/api/embeddings', data=body,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.loads(r.read().decode())
    e = d.get('embedding')
    if not e or not isinstance(e, list):
        raise RuntimeError(f'ollama bad response: {str(d)[:150]}')
    return e


async def do_reembed(conn, ids):
    model = os.environ.get('EMBEDDING_MODEL') or 'bge-m3'
    t0, ins, upd, fail = time.time(), 0, 0, 0
    rows = await conn.fetch(
        "SELECT id, question_uid, subject_code, question_type, difficulty, stem, "
        "(SELECT count(*) FROM question_vectors v WHERE v.question_id=q.id) has_vec "
        "FROM exam_questions q WHERE id=ANY($1::int[]) ORDER BY id", ids)
    for r in rows:
        try:
            vec = embed(r['stem'])
        except Exception as e:
            fail += 1; print(f'  FAIL {r["id"]}: {e}'); continue
        vstr = '[' + ','.join(repr(float(x)) for x in vec) + ']'
        meta = json.dumps({'model': model, 'provider': 'ollama', 'dim': len(vec),
                           'source': 'reembed-garbled-fix'})
        if r['has_vec']:
            await conn.execute(
                "UPDATE question_vectors SET q_text=$2, q_embedding=$3::vector, "
                "metadata=COALESCE(metadata,'{}'::jsonb)||$4::jsonb, updated_at=now() WHERE question_id=$1",
                r['id'], r['stem'], vstr, meta); upd += 1
        else:
            await conn.execute(
                "INSERT INTO question_vectors (question_id, question_uid, subject_code, question_type, "
                "difficulty, q_text, q_embedding, metadata, created_at, updated_at) "
                "VALUES ($1,$2,$3,$4,$5,$6,$7::vector,$8::jsonb, now(), now())",
                r['id'], r['question_uid'], r['subject_code'], r['question_type'], r['difficulty'],
                r['stem'], vstr, meta); ins += 1
    print(json.dumps({'inserted': ins, 'updated': upd, 'failed': fail,
                      'elapsed_sec': round(time.time() - t0, 1)}, ensure_ascii=False))


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', required=True, help='逗号分隔的 exam_questions.id')
    ap.add_argument('--plan', action='store_true')
    ap.add_argument('--backup', action='store_true')
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--reembed', action='store_true')
    ap.add_argument('--backup-table', help='--apply 时用作一致性校验的备份表')
    a = ap.parse_args()
    ids = [int(x) for x in a.ids.split(',') if x.strip()]
    import asyncpg
    dsn = (os.environ.get('DATABASE_URL') or '').split('?')[0]
    if not dsn:
        print('缺少 DATABASE_URL'); return 2
    conn = await asyncpg.connect(dsn)
    try:
        vlm = load_vlm() if a.plan else {}
        plan, unfix = await build_plan(conn, ids, vlm) if (a.plan or a.apply) else ({}, [])
        if a.plan:
            nres = sum(1 for r in plan.values() if r['resolvable'])
            print(f'可修: {len(plan)} (代入LaTeX={nres}, 保留token={len(plan)-nres}) | 不修: {len(unfix)}')
            for rid, r in sorted(plan.items()):
                print(f"  [{'LaTeX' if r['resolvable'] else 'TOKEN'}] id{rid} {r['subject']}/{r['year']}"
                      f"-Q{r['qn']} {r['stem'][:60]!r}")
            for rid, why in unfix:
                print(f'  跳过 id{rid}: {why}')
        if a.backup:
            await do_backup(conn, ids, time.strftime('%Y%m%d%H%M%S'))
        if a.apply:
            await do_apply(conn, plan, a.backup_table)
        if a.reembed:
            await do_reembed(conn, ids)
    finally:
        await conn.close()
    return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
