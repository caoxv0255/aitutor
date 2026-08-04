#!/bin/bash
# scripts/start_pgvector.sh — 启官方 pgvector/pgvector:pg15
set -e

CONTAINER_NAME="pgvector-test"
PG_PORT=5433
PG_USER="zhiqui"
PG_PASS="***"
PG_DB="zhiqui_review"

echo "=== remove old (if any) ==="
docker rm -f $CONTAINER_NAME 2>&1 || true

echo "=== run new ==="
docker run -d --name $CONTAINER_NAME \
  -e POSTGRES_USER=$PG_USER \
  -e POSTGRES_PASSWORD=$PG_PASS \
  -e POSTGRES_DB=$PG_DB \
  -p ${PG_PORT}:5432 \
  -v pgvector-test-data:/var/lib/postgresql/data \
  pgvector/pgvector:pg15

sleep 4
echo "=== psql test ==="
docker exec $CONTAINER_NAME psql -U $PG_USER -d $PG_DB -c "SELECT version();"
docker exec $CONTAINER_NAME psql -U $PG_USER -d $PG_DB -c "CREATE EXTENSION IF NOT EXISTS vector; SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"