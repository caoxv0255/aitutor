#!/bin/bash
# scripts/probe_minimax.sh — 测 MiniMax 端点 (不打印 key)
source /home/cx/infra/.env
echo "=== base ==="
echo "$OPENAI_API_BASE"
KEY="$OPENAI_API_KEY"
echo "=== models endpoint ==="
curl -s --max-time 8 "$OPENAI_API_BASE/models" -H "Authorization: Bearer *** 2>&1 | head -c 1500
echo
echo
echo "=== v1 models endpoint ==="
V1_BASE="${OPENAI_API_BASE%/anthropic}"
curl -s --max-time 8 "$V1_BASE/v1/models" -H "Authorization: Bearer *** 2>&1 | head -c 1500
echo
echo
echo "=== embeddings endpoint ==="
curl -s --max-time 8 "$OPENAI_API_BASE/embeddings" -H "Authorization: Bearer *** -H "Content-Type: application/json" -d '{"model":"text-embedding-3-small","input":"test"}' 2>&1 | head -c 1500
echo
echo
echo "=== v1 embeddings endpoint ==="
curl -s --max-time 8 "$V1_BASE/v1/embeddings" -H "Authorization: Bearer *** -H "Content-Type: application/json" -d '{"model":"text-embedding-3-small","input":"test"}' 2>&1 | head -c 1500
echo