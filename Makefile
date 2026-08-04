# aitutor Makefile
# 一行 dev workflow: make push / make lint / make rag / make install-hooks

.PHONY: help lint test push push-uibe push-gh rag install-hooks clean

help:  ## 显示帮助
	@echo "aitutor Makefile"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

lint:  ## Python + JS lint
	bash scripts/automation/lint.sh

test:  ## 跑 Contract Test (39 端点, F2 完成)
	node tests/contract.test.js

contract:  ## Contract Test 同 test
	node tests/contract.test.js

e2e:  ## 跑 Playwright E2E (F2 完成, demo.spec.js)
	node node_modules/@playwright/test/cli.js test tests/e2e/

push:  ## 一键推 uibe + GitHub (GH_TOKEN env)
	bash scripts/automation/push_all.sh

push-uibe:  ## 只推 uibe
	git push uibe main --tags

push-gh:  ## 只推 GitHub (GH_TOKEN env)
	@if [ -z "$$GH_TOKEN" ]; then echo "FAIL: GH_TOKEN not set"; exit 1; fi
	git push https://x-access-token:$${GH_TOKEN}@github.com/caoxv0255/aitutor.git main --tags
	@echo "REMINDER: revoke GH_TOKEN (https://github.com/settings/tokens)"

rag:  ## 跑 RAG 流水线 (1,711 schema v5)
	cd database && python3 ../题库分析/scripts/run_pipeline.py

start-pgvector:  ## 启 pgvector/pgvector:pg15 容器 (P3 RAG)
	bash scripts/start_pgvector.sh

ingest-pgvector:  ## P3: schema v5 → rag_questions (Ollama nomic-embed-text 768 dim)
	@echo "=== P3 RAG ingest ==="
	@echo "需要: ollama + nomic-embed-text (ollama pull nomic-embed-text)"
	@echo "需要: pgvector container running (make start-pgvector)"
	@echo ""
	python3 scripts/ingest_rag_to_pgvector.py

ingest-pgvector-dry:  ## P3 dry-run: 5 文件验证 (估速度)
	python3 scripts/ingest_rag_to_pgvector.py --limit 5

stop-pgvector:  ## 停 pgvector 容器
	docker rm -f pgvector-test 2>&1 || true

test-embedding:  ## 测 embedding service 端到端 (Node, 3 provider)
	node scripts/test_embedding.mjs

dev:  ## 启动后端 (F5+)
	npm run dev

install-hooks:  ## 装 git hooks (pre-commit lint + pre-push ahead 报告)
	bash scripts/automation/install_hooks.sh

clean:  ## 清 build artifact (保留 .git)
	rm -rf database/rag_build/_dup
	rm -rf node_modules/.cache
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
	@echo "OK: clean 完成"
