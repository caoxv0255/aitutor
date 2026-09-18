#!/usr/bin/env python3
"""
P1 Stage 02 — 全量原卷原子化提取 (DRY-RUN)

严格边界 (与 docs/architecture/batch02-ingestion-sop.md 一致):
  ❌ 不写 public.exam_questions / exam_papers / question_knowledge_points / 任何核心表
  ❌ 不写 qb_recovery.*
  ✅ 只写 database/preflight/qb-extract/out/  (per-paper JSON + 报告 + 媒体)
  ✅ 只读 database/incoming/ 与 docx-cache/

工作清单: database/incoming 下每一份原卷 —— .docx 直接用, .doc 用 docx-cache 里的转换产物。

用法:
  python3 02-extract.py --dry-run                  # 只列工作清单与规模
  python3 02-extract.py --limit 40                 # 小样试跑
  python3 02-extract.py                            # 全量
  python3 02-extract.py --no-media                 # 跳过媒体落盘 (快 2-3x)
  python3 02-extract.py --subjects math,physics    # 限学科
  python3 02-extract.py --force                    # 忽略已有产物重跑
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import qbx  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
SRC_ROOT = REPO / 'database' / 'incoming'
BASE = REPO / 'database' / 'preflight' / 'qb-extract'
CACHE = BASE / 'docx-cache'
OUT = BASE / 'out'
PAPERS = OUT / 'papers'
MEDIA = OUT / 'media'
INDEX = OUT / 'paper-index.jsonl'
REPORT = OUT / 'report.json'
REPORT_MD = OUT / 'REPORT.md'


def build_worklist(subjects=None, limit=None):
    """每份源卷一条: {src, docx, subject_hint, exam_level}
    目录结构: database/incoming/<exam_level>/<subject>/<year>/<file>"""
    items = []
    for src in sorted(SRC_ROOT.rglob('*')):
        if src.suffix.lower() not in ('.doc', '.docx') or not src.is_file():
            continue
        rel = src.relative_to(SRC_ROOT)
        parts = rel.parts
        exam_level = parts[0] if parts and parts[0] in qbx.EXAM_LEVELS else None
        subject_hint = None
        for p in parts[:-1]:
            if p in qbx.SUBJECT_SLUGS:
                subject_hint = p
                break
        if subjects and subject_hint not in subjects:
            continue
        if src.suffix.lower() == '.docx':
            docx = src
        else:
            docx = (CACHE / rel).with_suffix('.docx')
            if not docx.exists():
                continue      # 尚未转换, 跳过 (01 跑完后再跑本脚本)
        items.append({'src': str(src), 'docx': str(docx),
                      'subject_hint': subject_hint, 'exam_level': exam_level})
    if limit:
        items = items[:limit]
    return items


def out_path_for(item) -> Path:
    src = Path(item['src'])
    rel = src.relative_to(SRC_ROOT)
    return (PAPERS / rel).with_suffix('.json')


def worker(item, store_media: bool, force: bool):
    op = out_path_for(item)
    if op.exists() and not force:
        return {'status': 'skip', 'out': str(op)}
    try:
        r = qbx.extract_paper(Path(item['docx']), MEDIA if store_media else None,
                              subject_hint=item['subject_hint'])
    except Exception as e:
        return {'status': 'error', 'src': item['src'],
                'error': f'{type(e).__name__}: {e}',
                'trace': traceback.format_exc()[-500:]}
    r['source_path'] = item['src']
    r['docx_path'] = item['docx']
    op.parent.mkdir(parents=True, exist_ok=True)
    tmp = op.with_suffix('.json.part')
    tmp.write_text(json.dumps(r, ensure_ascii=False))
    tmp.rename(op)
    return {'status': 'ok', 'out': str(op), 'src': item['src'],
            'subject': r['identity'].get('subject'), 'year': r['identity'].get('year'),
            'province': r['identity'].get('province_code'),
            'paper_type': r['identity'].get('paper_type'),
            'doc_kind': r['doc_kind'], 'question_count': r['question_count'],
            'stats': r['stats'], 'backfilled': r['backfilled']}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--limit', type=int)
    ap.add_argument('--subjects')
    ap.add_argument('--workers', type=int, default=max(1, (os.cpu_count() or 4) - 1))
    ap.add_argument('--no-media', action='store_true')
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()

    subjects = args.subjects.split(',') if args.subjects else None
    items = build_worklist(subjects, args.limit)
    all_src = [p for p in SRC_ROOT.rglob('*') if p.suffix.lower() in ('.doc', '.docx')]
    pending_conv = sum(1 for p in all_src if p.suffix.lower() == '.doc'
                       and not (CACHE / p.relative_to(SRC_ROOT)).with_suffix('.docx').exists())
    print(f'源目录     : {SRC_ROOT}')
    print(f'源卷总数   : {len(all_src)}  (.doc 待转换 {pending_conv})')
    print(f'本次工作集 : {len(items)}')
    print(f'产物目录   : {OUT}')
    print(f'媒体落盘   : {"否" if args.no_media else "是"}')
    if args.dry_run:
        print('\n--dry-run: 不执行提取')
        return
    if not items:
        print('\n无可处理项 (若 .doc 尚未转换, 先跑 01-convert-docs.py)')
        return

    OUT.mkdir(parents=True, exist_ok=True)
    PAPERS.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    results, errors = [], []
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(worker, it, not args.no_media, args.force): it for it in items}
        for n, fut in enumerate(as_completed(futs), 1):
            res = fut.result()
            if res['status'] == 'error':
                errors.append(res)
            else:
                results.append(res)
            if n % 25 == 0 or n == len(items):
                el = time.time() - t0
                print(f'  [{n}/{len(items)}] ok={sum(1 for r in results if r["status"]=="ok")} '
                      f'skip={sum(1 for r in results if r["status"]=="skip")} err={len(errors)} '
                      f'| {n/el:.1f} 卷/秒 | ETA {(len(items)-n)/(n/el)/60:.1f} 分钟', flush=True)

    el = time.time() - t0
    ok = [r for r in results if r['status'] == 'ok']
    # paper-index 每次由全部 per-paper JSON 重建, 保证多轮跑不重复追加 (可续跑的关键)
    rebuild_index()
    rep = build_report_from_disk(el, len(items), errors)
    REPORT.write_text(json.dumps(rep, ensure_ascii=False, indent=2))
    REPORT_MD.write_text(render_md(rep))
    print(f'\n完成: 本批 {len(ok)} 卷提取 ({sum(1 for r in results if r["status"]=="skip")} 卷跳过), '
          f'{len(errors)} 卷失败, 耗时 {el/60:.1f} 分钟')
    print(f'累计产物: {rep["papers_ok"]} 卷 / {rep["questions_total"]} 题')
    print(f'报告: {REPORT_MD}')
    print_summary(rep)
    if errors:
        print('\n失败样例:')
        for e in errors[:5]:
            print(f"  {Path(e['src']).name}: {e['error'][:100]}")


def rebuild_index():
    """从 out/papers/**/*.json 重建 paper-index.jsonl (幂等)"""
    rows = []
    for p in sorted(PAPERS.rglob('*.json')):
        try:
            d = json.loads(p.read_text())
        except Exception:
            continue
        st = d.get('stats', {})
        idn = d.get('identity') or {}
        rows.append({
            'out': str(p), 'src': d.get('source_path'), 'docx': d.get('docx_path'),
            'subject': idn.get('subject'), 'year': idn.get('year'),
            'province': idn.get('province_code'), 'exam_level': idn.get('exam_level'),
            'paper_type': idn.get('paper_type'),
            'identity_confidence': idn.get('identity_confidence'),
            'doc_kind': d.get('doc_kind'), 'question_count': d.get('question_count', 0),
            'strategy_score': d.get('strategy_score'),
            'stats': st, 'backfilled': d.get('backfilled'),
        })
    tmp = INDEX.with_suffix('.jsonl.part')
    with tmp.open('w', encoding='utf-8') as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + '\n')
    tmp.rename(INDEX)
    return len(rows)


def build_report_from_disk(elapsed, batch_items, errors):
    """报告始终基于磁盘上全部产物 (而非本批), 这样续跑后报告是累积真值"""
    ok = []
    for line in INDEX.read_text(encoding='utf-8').splitlines() if INDEX.exists() else []:
        if not line.strip():
            continue
        r = json.loads(line)
        ok.append({'src': r.get('src'), 'subject': r.get('subject'), 'year': r.get('year'),
                   'doc_kind': r.get('doc_kind'), 'question_count': r.get('question_count', 0),
                   'stats': r.get('stats') or {k: 0 for k in STRAT_KEYS}})
    rep = build_report(ok, errors, batch_items, elapsed)
    rep['cumulative'] = True
    return rep


STRAT_KEYS = ['with_answer', 'with_analysis', 'with_options', 'with_media',
              'with_formula', 'with_image', 'with_subq', 'usable']


def build_report(ok, errors, total_items, elapsed):
    per_subject, per_year, per_kind = {}, {}, {}
    tot = {k: 0 for k in STRAT_KEYS}
    nq = 0
    low = []
    for r in ok:
        s = r.get('subject') or 'na'
        y = r.get('year') or 0
        d = per_subject.setdefault(s, {'papers': 0, 'questions': 0, **{k: 0 for k in STRAT_KEYS}})
        d['papers'] += 1
        d['questions'] += r['question_count']
        for k in STRAT_KEYS:
            d[k] += r['stats'][k]
            tot[k] += r['stats'][k]
        yr = per_year.setdefault(y, {'papers': 0, 'questions': 0, 'usable': 0})
        yr['papers'] += 1
        yr['questions'] += r['question_count']
        yr['usable'] += r['stats']['usable']
        per_kind[r['doc_kind']] = per_kind.get(r['doc_kind'], 0) + 1
        nq += r['question_count']
        if r['question_count'] and r['stats']['usable'] / r['question_count'] < 0.30:
            low.append({'paper': Path(r['src']).name, 'subject': s, 'year': y,
                        'questions': r['question_count'], 'usable': r['stats']['usable'],
                        'doc_kind': r['doc_kind']})
    pct = {k: round(100 * tot[k] / nq, 1) if nq else 0 for k in STRAT_KEYS}
    return {
        'run_at': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'mode': 'dry-run (未写任何核心表)',
        'elapsed_sec': round(elapsed, 1),
        'work_items': total_items,
        'papers_ok': len(ok),
        'papers_error': len(errors),
        'questions_total': nq,
        'coverage_pct': pct,
        'coverage_abs': tot,
        'doc_kind_dist': per_kind,
        'per_subject': per_subject,
        'per_year': dict(sorted(per_year.items())),
        'low_coverage_papers': sorted(low, key=lambda x: x['usable'] / max(x['questions'], 1))[:40],
        'errors': errors[:40],
    }


def print_summary(rep):
    print(f"\n总题数 {rep['questions_total']} | 答案 {rep['coverage_pct']['with_answer']}% "
          f"| 解析 {rep['coverage_pct']['with_analysis']}% | 选项 {rep['coverage_pct']['with_options']}% "
          f"| 含公式 {rep['coverage_pct']['with_formula']}% | 含图 {rep['coverage_pct']['with_image']}% "
          f"| 有小问 {rep['coverage_pct']['with_subq']}% | 严格可用 {rep['coverage_pct']['usable']}%")
    print(f"布局分布: {rep['doc_kind_dist']}")


def render_md(rep):
    L = []
    L.append('# P1 原卷原子化提取 — Dry-Run 报告\n')
    L.append(f"- 运行时间: {rep['run_at']}")
    L.append(f"- 模式: **{rep['mode']}**")
    L.append(f"- 耗时: {rep['elapsed_sec']}s")
    L.append(f"- 卷数: {rep['papers_ok']} 成功 / {rep['papers_error']} 失败 (工作集 {rep['work_items']})")
    L.append(f"- 题数: **{rep['questions_total']}**\n")
    L.append('## 总覆盖率\n')
    L.append('| 指标 | 绝对数 | 占题数 |')
    L.append('|---|---:|---:|')
    for k in STRAT_KEYS:
        L.append(f"| {k} | {rep['coverage_abs'][k]} | {rep['coverage_pct'][k]}% |")
    L.append(f"\n布局自动择优分布: `{rep['doc_kind_dist']}`\n")
    L.append('## 分学科\n')
    L.append('| 学科 | 卷 | 题 | 答案 | 解析 | 选项 | 公式 | 图 | 小问 | 严格可用 |')
    L.append('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
    for s, d in sorted(rep['per_subject'].items(), key=lambda x: -x[1]['questions']):
        pc = lambda k: round(100 * d[k] / d['questions'], 1) if d['questions'] else 0
        L.append(f"| {s} | {d['papers']} | {d['questions']} | {pc('with_answer')}% | "
                 f"{pc('with_analysis')}% | {pc('with_options')}% | {pc('with_formula')}% | "
                 f"{pc('with_image')}% | {pc('with_subq')}% | {pc('usable')}% |")
    L.append('\n## 分年份\n')
    L.append('| 年份 | 卷 | 题 | 严格可用 |')
    L.append('|---|---:|---:|---:|')
    for y, d in rep['per_year'].items():
        L.append(f"| {y} | {d['papers']} | {d['questions']} | {d['usable']} |")
    if rep['low_coverage_papers']:
        L.append('\n## 低覆盖卷 (严格可用 < 30%, 调优待办)\n')
        L.append('| 学科 | 年 | 卷 | 题 | 可用 | 布局 |')
        L.append('|---|---:|---|---:|---:|---|')
        for p in rep['low_coverage_papers']:
            L.append(f"| {p['subject']} | {p['year']} | {p['paper'][:46]} | {p['questions']} "
                     f"| {p['usable']} | {p['doc_kind']} |")
    if rep['errors']:
        L.append('\n## 失败卷\n')
        for e in rep['errors']:
            L.append(f"- `{Path(e['src']).name}`: {e['error'][:140]}")
    L.append('\n---\n')
    L.append('本报告由 `scripts/qb-extract/02-extract.py` 生成。**dry-run 未写任何数据库表。**')
    return '\n'.join(L) + '\n'


if __name__ == '__main__':
    main()
