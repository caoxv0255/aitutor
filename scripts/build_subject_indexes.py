#!/usr/bin/env python3
"""
批量构建 GraphRAG 学科索引。
用法：python build_subject_indexes.py [subject_key]
  不带参数：构建所有学科索引
  带参数：构建指定学科索引，如 python build_subject_indexes.py math
"""
import os
import sys
import asyncio
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

SUBJECTS = ["math", "chinese", "english", "physics", "chemistry", "politics"]


async def build_index(subject_key: str):
    index_root = BASE_DIR / "graphrag_workspace" / "indexes" / subject_key

    if not index_root.exists():
        print(f"❌ 索引目录不存在: {index_root}")
        return False

    input_file = index_root / "input" / f"{subject_key}.txt"
    if not input_file.exists():
        print(f"❌ 输入文件不存在: {input_file}")
        return False

    settings_file = index_root / "settings.yaml"
    if not settings_file.exists():
        print(f"❌ 配置文件不存在: {settings_file}")
        return False

    print(f"\n{'=' * 60}")
    print(f"构建索引: {subject_key}")
    print(f"{'=' * 60}")

    try:
        from graphrag.config.load_config import load_config
        from graphrag.api.index import build_index
        from graphrag.callbacks.console_workflow_callbacks import ConsoleWorkflowCallbacks

        config = load_config(index_root)
        print(f"配置加载成功")

        callbacks = [ConsoleWorkflowCallbacks()]
        results = await build_index(
            config=config,
            verbose=True,
            callbacks=callbacks,
        )

        print(f"\n✅ 索引构建完成: {subject_key}")
        for result in results:
            print(f"  Workflow: {result.workflow}")
            print(f"    Result: {result.result}")
        return True

    except Exception as e:
        print(f"\n❌ 索引构建失败: {subject_key}")
        print(f"  错误: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    if len(sys.argv) > 1:
        subject = sys.argv[1]
        if subject not in SUBJECTS:
            print(f"未知学科: {subject}")
            print(f"可用学科: {', '.join(SUBJECTS)}")
            sys.exit(1)
        success = await build_index(subject)
        sys.exit(0 if success else 1)

    results = {}
    for subject in SUBJECTS:
        success = await build_index(subject)
        results[subject] = success

    print(f"\n{'=' * 60}")
    print("索引构建汇总")
    print(f"{'=' * 60}")
    for subject, success in results.items():
        status = "✅ 成功" if success else "❌ 失败"
        print(f"  {subject}: {status}")


if __name__ == "__main__":
    asyncio.run(main())
