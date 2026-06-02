#!/usr/bin/env python3
"""使用 GraphRAG 3.0.9 Python API 运行索引"""
import os
import sys
import asyncio
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from graphrag.config.load_config import load_config
from graphrag.api.index import build_index
from graphrag.callbacks.console_workflow_callbacks import ConsoleWorkflowCallbacks


async def run_index():
    index_name = sys.argv[1] if len(sys.argv) > 1 else "gaokao_all"
    index_root = BASE_DIR / "graphrag_workspace" / "indexes" / index_name

    print(f"加载配置: {index_root}")

    try:
        config = load_config(index_root)
        print(f"配置加载成功")
        cm = config.completion_models
        if isinstance(cm, dict):
            default_cm = cm.get('default_completion_model')
            if default_cm:
                print(f"  LLM: {getattr(default_cm, 'model', 'unknown')}")
        else:
            print(f"  LLM: {getattr(cm, 'model', 'unknown')}")
    except Exception as e:
        print(f"配置加载失败: {e}")
        import traceback
        traceback.print_exc()
        return 1

    print(f"\n开始构建索引: {index_name}")
    print("=" * 60)

    try:
        callbacks = [ConsoleWorkflowCallbacks()]
        results = await build_index(
            config=config,
            verbose=True,
            callbacks=callbacks,
        )

        print("\n" + "=" * 60)
        print("索引构建完成!")
        for result in results:
            print(f"  Workflow: {result.workflow}")
            print(f"    Result: {result.result}")
        return 0

    except Exception as e:
        print(f"\n索引构建失败: {e}")
        import traceback
        traceback.print_exc()
        return 1


def main():
    return asyncio.run(run_index())


if __name__ == "__main__":
    sys.exit(main())
