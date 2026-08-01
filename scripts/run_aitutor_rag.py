"""scripts.run_aitutor_rag —— aitutor RAG 一键流水线 (v0.2, 2026-08-01).

调 scripts/run_pipeline.py (题库分析), 跑 aitutor database 全部 docx:
- 排除 2026 年
- 排除 paper_type = 网络 / 其他 (非完整官方文档)
- per-docx timeout 30s (避免死循环)
- resume: 跳过已处理 (有 .json 文件)
- 输出到 /home/cx/aitutor/database/rag_build/

使用:
    python scripts/run_aitutor_rag.py --limit 1                    # 跑 1 份测试
    python scripts/run_aitutor_rag.py --subject 数学 --year 2024  # 过滤
    python scripts/run_aitutor_rag.py --timeout 30 --resume      # 全跑 + 30s 超时 + 跳过已处理
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
import signal
import sys
import time
from pathlib import Path
from collections import Counter

# 项目根
_aitutor_root = Path(__file__).resolve().parent.parent
_qa_root = Path("/home/cx/题库分析")

# 让 题库分析 pipeline 可 import
sys.path.insert(0, str(_qa_root))

from scripts.build_v5 import build_v5_json, dump_v5_json  # noqa: E402
from scripts.schema_v5 import validate_payload  # noqa: E402
from scripts.exporters import export_all  # noqa: E402

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# aitutor 路径
AITUTOR_DB = _aitutor_root / "database"
RAG_OUT = AITUTOR_DB / "rag_build"
MANIFEST = AITUTOR_DB / "高考真题" / "2026年6月全国高考" / "历年高考真题合集" / "MANIFEST.csv"
MANIFEST_31 = AITUTOR_DB / "高考真题" / "MANIFEST_31sheng.csv"

# Filter 规则
EXCLUDE_PAPER_TYPES = {"网络", "其他"}  # 非完整官方文档
EXCLUDE_YEARS = {2026}  # 2026 年先不动
EXCLUDE_EXTS = {".doc"}  # .doc 老格式, pipeline 不支持 zipfile, 需用户手动转 .docx
VALID_SUBJECTS = {"语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治"}


class TimeoutError(Exception):
    pass


def timeout_handler(signum, frame):
    raise TimeoutError("per-docx timeout")


def process_one(c: dict, latex_json: Path | None, output_dir: Path, timeout_sec: int) -> dict:
    """处理单个 docx, 返回处理结果. 加 timeout."""
    paper_id = c["full_path"].stem
    t0 = time.time()
    timed_out = False
    if timeout_sec > 0:
        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(timeout_sec)
    try:
        payload = build_v5_json(c["full_path"], latex_json, paper_id=paper_id)
        rep = validate_payload(payload)
        t_build = time.time() - t0

        json_out = output_dir / f"{paper_id}.json"
        dump_v5_json(payload, json_out)

        t0 = time.time()
        exports = export_all(payload, output_dir / "exports")
        t_export = time.time() - t0

        return {
            "success": True,
            "paper_id": paper_id,
            "year": c["year"],
            "subject": c["subject"],
            "province": c["province"],
            "paper_type": c["paper_type"],
            "track": c["track"],
            "stats": payload.get("statistics", {}),
            "validation_ok": rep["ok"],
            "validation_issues": len(rep.get("issues", [])),
            "output_json": str(json_out),
            "timing_build": round(t_build, 2),
            "timing_export": round(t_export, 2),
            "timed_out": False,
        }
    except TimeoutError:
        return {
            "success": False,
            "paper_id": paper_id,
            "error": f"timeout after {timeout_sec}s",
            "year": c["year"],
            "subject": c["subject"],
            "timed_out": True,
        }
    except Exception as e:
        return {
            "success": False,
            "paper_id": paper_id,
            "error": str(e)[:300],
            "year": c["year"],
            "subject": c["subject"],
            "timed_out": False,
        }
    finally:
        if timeout_sec > 0:
            signal.alarm(0)


def load_candidates() -> list[dict]:
    """从 manifest 读候选 docx, 应用 filter."""
    candidates = []
    for src, path in [("历年合集", MANIFEST), ("31省", MANIFEST_31)]:
        if not path.exists():
            logger.warning("manifest 不存在: %s", path)
            continue
        for r in csv.DictReader(open(path, encoding="utf-8")):
            if src == "历年合集" and r["status"] != "active":
                continue
            if not r["year"]:
                continue
            year = int(r["year"])
            if year in EXCLUDE_YEARS:
                continue
            if r["paper_type"] in EXCLUDE_PAPER_TYPES:
                continue
            if r["subject"] not in VALID_SUBJECTS:
                continue
            full_path = AITUTOR_DB / "高考真题" / r["path"]
            if not full_path.exists():
                continue
            # 排除 .doc 老格式 (pipeline 只支持 .docx zipfile)
            if full_path.suffix.lower() in EXCLUDE_EXTS:
                continue
            candidates.append({
                "src": src,
                "path": r["path"],
                "full_path": full_path,
                "year": year,
                "subject": r["subject"],
                "province": r["province_or_paper"],
                "track": r["track"],
                "paper_type": r["paper_type"],
            })
    return candidates


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--subject", default="")
    ap.add_argument("--year", type=int, default=0)
    ap.add_argument("--use-llm", action="store_true")
    ap.add_argument("--timeout", type=int, default=30, help="per-docx timeout, 0=不限")
    ap.add_argument("--resume", action="store_true", help="跳过已处理 (有 .json)")
    ap.add_argument("--reset", action="store_true", help="清空 RAG_OUT 重新跑")
    args = ap.parse_args()

    if args.reset and RAG_OUT.exists():
        import shutil
        shutil.rmtree(RAG_OUT)
        logger.info("已清空 %s", RAG_OUT)
    RAG_OUT.mkdir(parents=True, exist_ok=True)

    candidates = load_candidates()
    if args.subject:
        candidates = [c for c in candidates if c["subject"] == args.subject]
    if args.year:
        candidates = [c for c in candidates if c["year"] == args.year]

    # 去重: 同一 stem 跨多个 manifest 来源, 只处理 1 次 (优先 历年合集, 然后 31 省)
    seen_stems = set()
    unique_candidates = []
    for c in candidates:
        if c["full_path"].stem in seen_stems:
            continue
        seen_stems.add(c["full_path"].stem)
        unique_candidates.append(c)
    if len(candidates) != len(unique_candidates):
        logger.info("去重: %d → %d 份 (跨源重复, 同 docx 在 历年合集+31省 重复登记)", len(candidates), len(unique_candidates))
    candidates = unique_candidates

    if args.resume:
        before = len(candidates)
        candidates = [c for c in candidates if not (RAG_OUT / f"{c['full_path'].stem}.json").exists()]
        logger.info("resume 跳过 %d 份已处理, 剩 %d 份", before - len(candidates), len(candidates))

    if args.limit:
        candidates = candidates[:args.limit]

    logger.info("候选: %d 份, timeout=%ds, resume=%s", len(candidates), args.timeout, args.resume)
    if not candidates:
        return 1

    latex_json = AITUTOR_DB / "gaokao2025_beijing_extract" / "latex_results.json"
    if not latex_json.exists():
        latex_json = None
        logger.info("latex_results.json 不存在, 跳过 OLE 公式提取")

    results = []
    t_start = time.time()
    for i, c in enumerate(candidates, 1):
        if i % 100 == 0 or i == 1:
            elapsed = time.time() - t_start
            eta = (elapsed / i) * (len(candidates) - i) if i > 0 else 0
            done = i - 1
            success = sum(1 for r in results if r["success"])
            failed = sum(1 for r in results if not r["success"])
            timed_out = sum(1 for r in results if r.get("timed_out"))
            logger.info(
                "[%d/%d] %s ... | 用 %.0fs, 预计 %.0fs | 成功 %d 失败 %d (timeout %d)",
                i, len(candidates), c["full_path"].name, elapsed, eta, success, failed, timed_out,
            )
        r = process_one(c, latex_json, RAG_OUT, args.timeout)
        results.append(r)

    # manifest (增量追加, 不覆盖)
    manifest_out = RAG_OUT / "aitutor_rag_manifest.json"
    if manifest_out.exists():
        prev = json.load(open(manifest_out, encoding="utf-8"))
        prev_results = prev.get("results", [])
        # 去重: 同一 paper_id 只保留最新
        new_results_dict = {r["paper_id"]: r for r in results}
        merged = list({r["paper_id"]: r for r in prev_results}.values())
        for pid, r in new_results_dict.items():
            merged.append(r)
        results = merged

    summary = {
        "pipeline": "aitutor_rag v0.2",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "total_candidates": len(candidates),
        "success_this_run": sum(1 for r in results if r.get("success", False)),
        "failed_this_run": sum(1 for r in results if not r.get("success", False)),
        "timed_out_this_run": sum(1 for r in results if r.get("timed_out", False)),
        "filter": {
            "exclude_years": list(EXCLUDE_YEARS),
            "exclude_paper_types": list(EXCLUDE_PAPER_TYPES),
            "timeout_sec": args.timeout,
        },
        "results": results,
    }
    manifest_out.write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
    logger.info("manifest → %s", manifest_out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
