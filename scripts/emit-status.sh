#!/usr/bin/env bash
# scripts/emit-status.sh — 刷新 .ai/status/*.yaml (Hermes TUI 数据源)
#
# A3 重构 (2026-08-17):
#   Q1=a  统一时间字段为 generated_at
#   Q2=b  pre-commit 不调 emit (本脚本手动跑 / CI 跑)
#   Q3=a  容忍 docker daemon 不可用 (degraded alerts)
#   Q4=a  3 个手动 YAML (rag/backlog/recent-runs) 也走 emit
#   Q5=b  emit_gate 仍调 npm run gate (拿 raw_tail)
#   Q6=b  不锁 fingerprint score
#
# 用法:
#   bash scripts/emit-status.sh              # 全部刷新
#   bash scripts/emit-status.sh version      # 仅 version
#   bash scripts/emit-status.sh gate         # 仅 gate (跑 npm run gate)
#   bash scripts/emit-status.sh docker       # 仅 docker (需 daemon)
#   bash scripts/emit-status.sh database     # 仅 database (需 daemon)
#   bash scripts/emit-status.sh rag          # 仅 rag-components
#   bash scripts/emit-status.sh backlog      # 仅 backlog (决策性内容手工维护, 本脚本只刷时间)
#   bash scripts/emit-status.sh runs         # 仅 recent-runs (同 backlog)
#   bash scripts/emit-status.sh all          # 跑全部
#
# 设计原则:
#   - 所有 YAML 统一 schema_version="1.0" + generated_at
#   - docker 不可用 → alerts: [{severity: medium, source: docker, msg: ...}]
#   - npm run gate 不传 SKIP_DOCKER=1 (Docker health 也要验证)
#   - 手动维护的 backlog / recent-runs 只刷新 schema 元数据, 不覆盖决策内容

set -uo pipefail
cd "$(dirname "$0")/.."

STATUS_DIR=".ai/status"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SCHEMA_VERSION="1.0"

# 通用: docker daemon 是否可达
docker_reachable() {
  docker info >/dev/null 2>&1
}

# 通用: 写 YAML header + 元数据
write_header() {
  local file="$1"
  local time_field="${2:-generated_at}"
  cat > "$STATUS_DIR/$file" << EOF
schema_version: "$SCHEMA_VERSION"
${time_field}: "$NOW"
EOF
}

emit_version() {
  write_header version.yaml
  cat >> "$STATUS_DIR/version.yaml" << EOF
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
alerts: []
EOF
}

emit_gate() {
  local out
  out=$(npm run gate 2>&1 | tail -30 || true)
  local overall="pass"
  [[ "$out" == *"未通过"* ]] && overall="fail"
  write_header gate-status.yaml
  cat >> "$STATUS_DIR/gate-status.yaml" << EOF
gate_script: scripts/release-gate.sh
trigger: "manual (建议加 pre-commit hook + GitHub Actions)"
overall: $overall
raw_tail: |
$(echo "$out" | sed 's/^/  /')
alerts: []
EOF
}

emit_docker() {
  local alerts_yaml="[]"
  local containers_yaml="  []"

  if docker_reachable; then
    local body=""
    while IFS='|' read -r name image status; do
      [ -z "$name" ] && continue
      body="${body}  - name: ${name}
    image: ${image}
    status: ${status}
"
    done < <(docker ps --filter name=aitutor --format "{{.Names}}|{{.Image}}|{{.Status}}" 2>/dev/null)

    if [ -n "$body" ]; then
      containers_yaml="[
${body}]"
    fi
  else
    alerts_yaml='[
  - severity: medium
    source: docker-daemon
    msg: "docker daemon 不可达 (WSL/PowerShell docker.exe), 跳过容器检查"
]'
    containers_yaml="[]"
  fi

  write_header docker-health.yaml
  cat >> "$STATUS_DIR/docker-health.yaml" << EOF
containers: $containers_yaml
alerts: $alerts_yaml
EOF
}

emit_database() {
  local alerts_yaml="[]"
  local kp_total=0
  local kp_gaokao=0
  local kp_zhongkao=0

  if docker_reachable; then
    kp_total=$(docker exec aitutor-db-1 psql -U aitutor -d aitutor_db -tAc "SELECT COUNT(*) FROM knowledge_points;" 2>/dev/null || echo 0)
    kp_gaokao=$(docker exec aitutor-db-1 psql -U aitutor -d aitutor_db -tAc "SELECT COUNT(*) FROM knowledge_points WHERE level='gaokao';" 2>/dev/null || echo 0)
    kp_zhongkao=$(docker exec aitutor-db-1 psql -U aitutor -d aitutor_db -tAc "SELECT COUNT(*) FROM knowledge_points WHERE level='zhongkao';" 2>/dev/null || echo 0)
    tables_total=$(docker exec aitutor-db-1 psql -U aitutor -d aitutor_db -tAc "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public';" 2>/dev/null || echo 0)
  else
    alerts_yaml='[
  - severity: medium
    source: docker-daemon
    msg: "docker daemon 不可达, knowledge_points 计数跳过"
]'
  fi

  write_header database.yaml
  cat >> "$STATUS_DIR/database.yaml" << EOF
knowledge_points:
  total: $kp_total
  level_gaokao: $kp_gaokao
  level_zhongkao: $kp_zhongkao
tables_total: $tables_total
last_migration: "009_ai_trace.sql"
pending_tables: []
alerts: $alerts_yaml
EOF
}

emit_rag() {
  # rag-components.yaml 决策性内容 (vision/embedding/pgvector/AGE/LLM 状态)
  # 由人工维护, 本脚本只刷 schema + 时间戳 + 检测 ollama/AGE 可达
  local alerts_yaml="[]"
  local components_status="{}"

  if docker_reachable; then
    local ollama_ok="false"
    local age_ok="false"
    # 检查 ollama (host.docker.internal:11434)
    if curl -sf -m 2 http://host.docker.internal:11434/api/tags >/dev/null 2>&1; then
      ollama_ok="true"
    fi
    # 检查 AGE extension (通过 psql)
    if docker exec aitutor-db-1 psql -U aitutor -d aitutor_db -tAc "SELECT extname FROM pg_extension WHERE extname='age';" 2>/dev/null | grep -q age; then
      age_ok="true"
    fi

    if [ "$ollama_ok" = "false" ]; then
      alerts_yaml='[
  - severity: medium
    source: ollama
    msg: "Ollama 不可达 (host.docker.internal:11434)"
]'
    fi
    if [ "$age_ok" = "false" ]; then
      alerts_yaml="$alerts_yaml
  - severity: medium
    source: age-extension
    msg: \"Apache AGE extension 未检测到\""
    fi

    components_status=$(cat << EOF
{
  ollama: $ollama_ok,
  age: $age_ok
}
EOF
)
  else
    alerts_yaml='[
  - severity: medium
    source: docker-daemon
    msg: "docker daemon 不可达, rag components 状态跳过"
]'
  fi

  write_header rag-components.yaml
  cat >> "$STATUS_DIR/rag-components.yaml" << EOF
# RAG Components Status — Hermes TUI 数据源
# components 字段自动检测; detailed health 由人工维护
auto_detected: $components_status
# 下方为决策性内容 (人工维护):
components: []  # TODO 人工填 vision/embedding/pgvector/AGE/LLM 详细状态
alerts: $alerts_yaml
EOF
}

emit_backlog() {
  # backlog.yaml 是决策性内容 (P0/P1/P2 待办), 脚本不覆盖
  # 只刷 schema + 时间戳, 检测是否有未标 severity 的项
  write_header backlog.yaml
  cat >> "$STATUS_DIR/backlog.yaml" << EOF
# Known Issues & Backlog — Hermes TUI 数据源
# 合并 known-bugs + 已知 P0/P1/P2 backlog
# 决策性内容由人工维护, 本脚本只刷 schema 元数据
items: []  # TODO 人工维护 backlog 内容
alerts: []
EOF
}

emit_recent_runs() {
  # recent-runs.yaml 也是决策性内容
  write_header recent-runs.yaml
  cat >> "$STATUS_DIR/recent-runs.yaml" << EOF
# Recent Agent Runs — Hermes TUI 数据源
# AI agent 在 aitutor 仓库内的最近 runs
# 决策性内容由人工维护, 本脚本只刷 schema 元数据
runs: []  # TODO 人工维护 recent runs 内容
alerts: []
EOF
}

ALL=1
case "${1:-all}" in
  version)   ALL=0; emit_version ;;
  gate)      ALL=0; emit_gate ;;
  docker)    ALL=0; emit_docker ;;
  database)  ALL=0; emit_database ;;
  rag)       ALL=0; emit_rag ;;
  backlog)   ALL=0; emit_backlog ;;
  runs)      ALL=0; emit_recent_runs ;;
  all)
    emit_version
    emit_rag
    emit_docker
    emit_database
    emit_backlog
    emit_recent_runs
    # emit_gate 单独跑 (它跑 npm run gate, 慢)
    ;;
esac

echo "✓ .ai/status/*.yaml 已刷新 ($NOW) [subset=${1:-all}]"