#!/bin/bash
# scripts/probe_dashscope.sh — 测 Maas 端点
source /home/cx/aitutor/.env.local

echo "=== test 1: compatible-mode text-embedding-v3 ==="
RESP=$(curl -s --max-time 10 "$DASHSCOPE_BASE_URL/embeddings" \
  -H "Authorization: Bearer *** \
  -H "Content-Type: application/json" \
  -d '{"model":"text-embedding-v3","input":"测试"}' 2>&1)
echo "$RESP" | head -c 600
echo

echo "=== test 2: workspace header ==="
RESP=$(curl -s --max-time 10 "$DASHSCOPE_BASE_URL/embeddings" \
  -H "Authorization: Bearer *** \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Id: llm-ecz0dfm8sux9p8y6" \
  -d '{"model":"text-embedding-v3","input":"测试"}' 2>&1)
echo "$RESP" | head -c 600
echo

echo "=== test 3: text-embedding-async (dashscope 原生) ==="
RESP=$(curl -s --max-time 10 "$DASHSCOPE_DASHSCOPE_URL/services/embeddings/text-embedding/text-embedding" \
  -H "Authorization: Bearer *** \
  -H "Content-Type: application/json" \
  -d '{"model":"text-embedding-v3","input":{"texts":["测试"]}}' 2>&1)
echo "$RESP" | head -c 600
echo

echo "=== test 4: simple chat (smoke test) ==="
RESP=$(curl -s --max-time 10 "$DASHSCOPE_BASE_URL/chat/completions" \
  -H "Authorization: Bearer *** \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-turbo","messages":[{"role":"user","content":"hi"}],"max_tokens":10}' 2>&1)
echo "$RESP" | head -c 600
echo