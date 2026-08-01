"""scripts.ingest_rag_to_graphrag — aitutor RAG 1,711 schema v5 接进 GraphRAG."""
from __future__ import annotations
import json, re
from pathlib import Path

WS = Path("/home/cx/aitutor/graphrag_workspace")
MD_DIR = WS / "converted_markdown"
JSONL_PATH = WS / "normalized_jsonl" / "gaokao_all.jsonl"
TXT_PATH = WS / "indexes" / "gaokao_all" / "input" / "gaokao_all.txt"
RAG_OUT = Path("/home/cx/aitutor/database/rag_build")


def render_md(p):
    paper = p.get("paper", {})
    meta = paper.get("metadata", {})
    title = meta.get("title", "未知")
    province = meta.get("region", "未知")
    year = meta.get("year", "未知")
    version = meta.get("version", "")
    subject = meta.get("subject", "未知")
    exam_type = meta.get("exam_type", "高考")

    lines = ["# " + str(title), ""]
    lines.append("**元数据**: 年份=" + str(year) + ", 省份=" + str(province) +
                ", 学科=" + str(subject) + ", 版本=" + str(version) + ", 考试类型=" + str(exam_type))
    lines.append("")
    for sm in paper.get("shared_materials", []):
        sm_title = sm.get("title", "")
        if sm_title:
            lines.append("## 阅读材料: " + sm_title)
            lines.append("")
        content = sm.get("content", "")
        if content:
            lines.append(content); lines.append("")
    sections = paper.get("sections", [])
    questions = {q["question_id"]: q for q in paper.get("questions", []) if "question_id" in q}
    for sec in sections:
        sec_title = sec.get("title", "")
        if sec_title:
            lines.append("## " + sec_title); lines.append("")
        for qid in sec.get("question_ids", []):
            q = questions.get(qid)
            if not q: continue
            lines.append("### " + qid)
            stem = (q.get("stem") or "").strip()
            if stem: lines.append(stem); lines.append("")
            opts = q.get("options", [])
            for opt in opts:
                lines.append("- " + str(opt.get("label","")) + ". " + str(opt.get("text","")))
            if opts: lines.append("")
            answer = q.get("answer") or ""
            if answer: lines.append("**答案**: " + str(answer)); lines.append("")
            analysis = (q.get("analysis") or "").strip()
            if analysis: lines.append("**解析**: " + analysis); lines.append("")
    return "\n".join(lines)


def chunks_from_md(paper_id, p):
    paper = p.get("paper", {})
    meta = paper.get("metadata", {})
    chunks = []
    for q in paper.get("questions", []):
        qid = q.get("question_id")
        if not qid: continue
        parts = []
        stem = (q.get("stem") or "").strip()
        if stem: parts.append(stem)
        for opt in q.get("options", []):
            parts.append(str(opt.get("label","")) + ". " + str(opt.get("text","")))
        answer = q.get("answer") or ""
        if answer: parts.append("答案: " + str(answer))
        analysis = (q.get("analysis") or "").strip()
        if analysis: parts.append("解析: " + analysis)
        text = " | ".join(parts) if parts else ""
        if not text: continue
        chunks.append({
            "id": "gaokao_all_aitutor_" + paper_id + "_" + qid,
            "text": text,
            "metadata": {
                "stage": "高中",
                "exam_type": meta.get("exam_type", "高考"),
                "province": meta.get("region", "未知"),
                "subject": meta.get("subject", "未知"),
                "year": meta.get("year", 0),
                "doc_kind": meta.get("version", "原卷"),
                "source_file": paper_id + ".docx",
                "chunk_idx": 0, "total_chunks": 1,
                "doc_id": paper_id, "qid": qid, "schema": "v5",
            }
        })
    return chunks


def main():
    existing_ids = []
    existing_paper_ids = set()
    for f in MD_DIR.glob("*.md"):
        m = re.match(r"^(\d+)_(.+)\.md$", f.name)
        if m:
            existing_ids.append(int(m.group(1)))
            existing_paper_ids.add(m.group(2))
    next_id = max(existing_ids) + 1 if existing_ids else 1
    print("[1/5] 现有 md 编号: max=" + str(max(existing_ids) if existing_ids else 0) + ", 续编: " + str(next_id))
    print("       现有 unique paper_ids: " + str(len(existing_paper_ids)))

    my_paper_ids = set()
    for f in RAG_OUT.glob("*.json"):
        if f.name == "aitutor_rag_manifest.json": continue
        my_paper_ids.add(f.stem)
    to_add = sorted(my_paper_ids - existing_paper_ids)
    print("[2/5] 我新增 (md 还没有): " + str(len(to_add)))

    if not to_add:
        print("无新增, 退出"); return

    print("[3/5] 生成 markdown + chunks ...")
    new_md_count = 0
    new_chunks = []
    failed = []
    for paper_id in to_add:
        jf = RAG_OUT / (paper_id + ".json")
        try:
            d = json.load(open(jf, encoding="utf-8"))
        except Exception as e:
            failed.append((paper_id, "json: " + str(e))); continue
        md_text = render_md(d)
        if not md_text.strip():
            failed.append((paper_id, "empty md")); continue
        md_filename = str(next_id) + "_" + paper_id + ".md"
        (MD_DIR / md_filename).write_text(md_text, encoding="utf-8")
        new_md_count += 1
        next_id += 1
        chunks = chunks_from_md(paper_id, d)
        new_chunks.extend(chunks)

    print("       新 md: " + str(new_md_count) + ", 新 chunks: " + str(len(new_chunks)) + ", 失败: " + str(len(failed)))
    if failed:
        for pid, err in failed[:3]:
            print("         " + pid + ": " + err)

    print("[4/5] 追加 normalized_jsonl/gaokao_all.jsonl ...")
    with open(JSONL_PATH, "a", encoding="utf-8") as f:
        for c in new_chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    print("       + " + str(len(new_chunks)) + " 行")

    print("[5/5] 更新 gaokao_all.txt ...")
    existing_size = TXT_PATH.stat().st_size if TXT_PATH.exists() else 0
    with open(TXT_PATH, "a", encoding="utf-8") as f:
        f.write("\n\n--- aitutor RAG v0.5 (2026-08-01, " + str(new_md_count) + " papers) ---\n\n")
        for paper_id in to_add:
            for md in MD_DIR.glob("*" + paper_id + ".md"):
                f.write(md.read_text(encoding="utf-8") + "\n\n")
                break
    new_size = TXT_PATH.stat().st_size
    print("       " + str(existing_size/1024) + " KB -> " + str(new_size/1024) + " KB")

    print("\n=== 接入完成 ===")
    print("  converted_markdown/: +" + str(new_md_count) + " (总 " + str(len(list(MD_DIR.glob('*.md')))) + ")")
    print("  normalized_jsonl/gaokao_all.jsonl: +" + str(len(new_chunks)) + " chunks")
    print("  gaokao_all.txt: +" + str((new_size-existing_size)/1024/1024) + " MB")
    print("\n下一步: GraphRAG CLI 重建 gaokao_all 索引 (LLM 限速, 用户拍板)")


if __name__ == "__main__":
    main()
