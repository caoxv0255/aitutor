#!/usr/bin/env python3
"""
按学科拆分 GraphRAG 输入数据，为每个学科创建独立的索引配置。

学科列表：数学、语文、英语、物理、化学、政治
用法：python split_by_subject.py
"""
import os
import re
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
CONVERTED_DIR = BASE_DIR / "graphrag_workspace" / "converted_markdown"
INDEXES_DIR = BASE_DIR / "graphrag_workspace" / "indexes"
SOURCE_INDEX = INDEXES_DIR / "gaokao_all"

SUBJECTS = {
    "math": "数学",
    "chinese": "语文",
    "english": "英语",
    "physics": "物理",
    "chemistry": "化学",
    "politics": "政治",
}

SUBJECT_PATTERNS = {
    "math": [r"数学"],
    "chinese": [r"语文"],
    "english": [r"英语", r"英文"],
    "physics": [r"物理"],
    "chemistry": [r"化学"],
    "politics": [r"政治", r"思想政治"],
}


def classify_file(filename: str) -> str | None:
    for subject_key, patterns in SUBJECT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, filename):
                return subject_key
    return None


def create_subject_index(subject_key: str, subject_name: str):
    index_dir = INDEXES_DIR / subject_key
    input_dir = index_dir / "input"
    prompts_dir = index_dir / "prompts"

    index_dir.mkdir(parents=True, exist_ok=True)
    input_dir.mkdir(parents=True, exist_ok=True)
    prompts_dir.mkdir(parents=True, exist_ok=True)

    if SOURCE_INDEX.exists():
        for subdir in ["logs", "output", "cache"]:
            (index_dir / subdir).mkdir(parents=True, exist_ok=True)

        src_prompts = SOURCE_INDEX / "prompts"
        if src_prompts.exists():
            for pf in src_prompts.glob("*.txt"):
                dst = prompts_dir / pf.name
                if not dst.exists():
                    shutil.copy2(pf, dst)

        src_settings = SOURCE_INDEX / "settings.yaml"
        if src_settings.exists():
            dst_settings = index_dir / "settings.yaml"
            if not dst_settings.exists():
                content = src_settings.read_text(encoding="utf-8")
                content = content.replace("gaokao_all", subject_key)
                dst_settings.write_text(content, encoding="utf-8")

    return index_dir


def split_files():
    subject_files = {key: [] for key in SUBJECTS}
    unclassified = []

    for md_file in sorted(CONVERTED_DIR.glob("*.md")):
        subject_key = classify_file(md_file.name)
        if subject_key:
            subject_files[subject_key].append(md_file)
        else:
            unclassified.append(md_file)

    print("=" * 60)
    print("学科文件分布统计")
    print("=" * 60)

    for subject_key, subject_name in SUBJECTS.items():
        files = subject_files[subject_key]
        print(f"  {subject_name} ({subject_key}): {len(files)} 个文件")

    print(f"  未分类: {len(unclassified)} 个文件")
    print()

    for subject_key, subject_name in SUBJECTS.items():
        files = subject_files[subject_key]
        if not files:
            print(f"跳过 {subject_name}（无文件）")
            continue

        index_dir = create_subject_index(subject_key, subject_name)
        input_dir = index_dir / "input"

        output_file = input_dir / f"{subject_key}.txt"
        total_chars = 0

        with open(output_file, "w", encoding="utf-8") as out:
            for i, md_file in enumerate(files):
                content = md_file.read_text(encoding="utf-8", errors="replace")
                out.write(f"# {md_file.stem}\n\n")
                out.write(content)
                out.write("\n\n---\n\n")
                total_chars += len(content)

        print(f"✅ {subject_name}: {len(files)} 文件 → {output_file.name} ({total_chars:,} 字符)")

    if unclassified:
        unc_file = INDEXES_DIR / "gaokao_all" / "input" / "other.txt"
        with open(unc_file, "w", encoding="utf-8") as out:
            for md_file in unclassified:
                content = md_file.read_text(encoding="utf-8", errors="replace")
                out.write(f"# {md_file.stem}\n\n")
                out.write(content)
                out.write("\n\n---\n\n")
        print(f"✅ 未分类: {len(unclassified)} 文件 → other.txt")


if __name__ == "__main__":
    split_files()
