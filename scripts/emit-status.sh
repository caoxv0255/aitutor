#!/usr/bin/env bash
# scripts/emit-status.sh — 刷新 .ai/status/*.yaml (Hermes TUI 数据源)
#
# 用法:
#   bash scripts/emit-status.sh              # 全部刷新
#   bash scripts/emit-status.sh docker       # 仅 docker-health
#
# 建议: pre-commit hook 自动跑 (gate 通过后触发)
#   .git/hooks/pre-commit: bash scripts/release-gate.sh && bash scripts/emit-status.sh

set -euo pipefail
cd "$(dirname "$0")/.."

STATUS_DIR=".ai/status"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

emit_version() {
  cat > "$STATUS_DIR/version.yaml" << EOF
# aitutor Project Status — Hermes TUI 数据源
schema_version: "1.0"
generated_at: "$NOW"
project: aitutor
cwd: $(pwd)

git:
  head_commit: $(git rev-parse --short HEAD 2>/dev/null || echo "uncommitted")
  head_message: "$(git log -1 --format="%s" 2>/dev/null | head -c 80 || echo "")"
  total_commits: $(git rev-list --count HEAD 2>/dev/null || echo 0)
  working_tree_changes:
    files_modified: $(git status --short 2>/dev/null | grep -c "^ M" || echo 0)
    files_deleted: $(git status --short 2>/dev/null | grep -c "^ D" || echo 0)
    files_untracked: $(git status --short 2>/dev/null | grep -c "^??" || echo 0)
EOF
}

emit_gate() {
  # 跑 gate, 解析输出写 yaml
  local out
  out=$(npm run gate 2>&1 | tail -30 || true)
  local overall="pass"
  [[ "$out" == *"未通过"* ]] && overall="fail"
  cat > "$STATUS_DIR/gate-status.yaml" << EOF
schema_version: "1.0"
last_run: "$NOW"
gate_script: scripts/release-gate.sh
overall: $overall
raw_tail: |
$(echo "$out" | sed 's/^/  /')
EOF
}

emit_docker() {
  local containers_yaml=""
  # 用 | 分隔避免依赖 jq
  while IFS='|' read -r name image status; do
    [ -z "$name" ] && continue
    containers_yaml="${containers_yaml}  - name: ${name}
    image: ${image}
    status: ${status}
"
  done < <(docker ps --filter name=aitutor --format "{{.Names}}|{{.Image}}|{{.Status}}" 2>/dev/null)

  cat > "$STATUS_DIR/docker-health.yaml" << EOF
schema_version: "1.0"
checked_at: "$NOW"
containers:
${containers_yaml}alerts: []
EOF
}

emit_database() {
  local kp_count=$(docker exec aitutor-db-1 psql -U aitutor -d aitutor_db -tAc "SELECT COUNT(*) FROM knowledge_points;" 2>/dev/null || echo 0)
  cat > "$STATUS_DIR/database.yaml" << EOF
schema_version: "1.0"
generated_at: "$NOW"
knowledge_points:
  total: $kp_count
  level_gaokao: $(docker exec aitutor-db-1 psql -U aitutor -d aitutor_db -tAc "SELECT COUNT(*) FROM knowledge_points WHERE level='gaokao';" 2>/dev/null || echo 0)
  level_zhongkao: $(docker exec aitutor-db-1 psql -U aitutor -d aitutor_db -tAc "SELECT COUNT(*) FROM knowledge_points WHERE level='zhongkao';" 2>/dev/null || echo 0)
tables_total: 34
last_migration: "008_question_uid_and_type_enums.sql"
pending_tables:
  - name: ai_trace
    purpose: RAG 可观测性 (Phase 3)
EOF
}

ALL=1
case "${1:-all}" in
  version) ALL=0; emit_version ;;
  gate) ALL=0; emit_gate ;;
  docker) ALL=0; emit_docker ;;
  database) ALL=0; emit_database ;;
  all)
    emit_version
    emit_docker
    emit_database
    ;;
esac

echo "✓ .ai/status/*.yaml 已刷新 ($NOW)"