#!/usr/bin/env python3
"""将北京高考的Markdown文件合并为GraphRAG输入格式"""
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
MD_DIR = BASE_DIR / "graphrag_workspace" / "converted_markdown"
OUTPUT_FILE = BASE_DIR / "graphrag_workspace" / "indexes" / "beijing_gaokao" / "input" / "beijing_gaokao.txt"

def parse_filename(filename):
    """从文件名解析元数据"""
    parts = filename.replace(".md", "").split("_")
    year = None
    subject = None
    province = "北京"
    paper_type = "原卷"
    
    for part in parts:
        if "年" in part and "高考" in part:
            year = part[:4]
        elif part in ["语文", "数学", "英语", "物理", "化学", "生物", "政治", "历史", "地理"]:
            subject = part
        elif "解析版" in part:
            paper_type = "解析"
        elif "原卷版" in part:
            paper_type = "原卷"
    
    return year, subject, province, paper_type

def main():
    beijing_files = sorted(MD_DIR.glob("*北京*高考*"))
    print(f"找到 {len(beijing_files)} 个北京高考文件")
    
    if not beijing_files:
        print("❌ 没有找到北京高考文件")
        return 1
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for idx, filepath in enumerate(beijing_files, 1):
            year, subject, province, paper_type = parse_filename(filepath.name)
            
            print(f"[{idx}/{len(beijing_files)}] {filepath.name}")
            
            try:
                content = filepath.read_text(encoding="utf-8")
            except Exception as e:
                print(f"  读取失败: {e}")
                continue
            
            f.write(f"\n---\n")
            f.write(f"Source: {filepath.name}\n")
            f.write(f"Subject: {subject}\n")
            f.write(f"Province: {province}\n")
            f.write(f"Year: {year}\n")
            f.write(f"Type: {paper_type}\n")
            f.write(f"---\n\n")
            f.write(content)
            f.write("\n\n")
    
    print(f"\n✅ 输出文件: {OUTPUT_FILE}")
    print(f"   文件数: {len(beijing_files)}")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
