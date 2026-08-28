# Operations — 运维文档索引

> **目的**: 部署 / 备份 / 安全 / 观测相关的运维 SOP
> **最后更新**: 2026-08-28 (D083 补全)

---

## 1. 文档清单

| 文档 | 文件 | 内容 |
|---|---|---|
| **部署** | [`deploy.md`](./deploy.md) | 本地开发 / Docker / 生产 / CI/CD |
| **备份与恢复** | [`backup-recovery.md`](./backup-recovery.md) | DB 备份策略 + 灾难恢复 |
| **安全** | [`security.md`](./security.md) | 密钥管理 / 认证 / 速率限制 / 已知漏洞 |
| **观测** | [`observability.md`](./observability.md) | 日志 / 健康检查 / ai_trace / status YAML |

---

## 2. 运维关键命令

```bash
# 开发
npm run dev
# 或 docker compose up -d

# 测试
npm test                      # vitest
npm run gate                  # 5 项门禁

# 部署
sudo bash deploy/setup.sh     # dev/staging
sudo bash deploy/setup-prod.sh  # 生产

# 监控
curl http://localhost:3002/api/health
docker compose -f docker-compose.prod.yml ps
docker logs aitutor-prod-app --tail 100 -f

# DB
PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -U aitutor aitutor
```

---

## 3. 运维决策点

- **D067**: DEV_AUTH_BYPASS guard (生产绝不设置)
- **D069**: ai_trace 表 (LLM 观测, 接入中)
- **D070**: 生产部署 (docker-compose.prod.yml + CI/CD)
- **D075**: v1.0 release notes

---

## 4. 状态监控源 (Hermes TUI)

```
.ai/status/
├── version.yaml           git head + 总 commits
├── gate-status.yaml       最近 gate 结果
├── docker-health.yaml     容器状态
├── rag-components.yaml    RAG 组件
├── database.yaml          DB schema
├── recent-runs.yaml       agent runs
└── backlog.yaml           P0/P1/P2
```

**Schema**: `schema_version: "1.0"` + `generated_at: ISO-8601` + `alerts: []`

**详细**: [`observability.md`](./observability.md)

---

## 5. 不在本目录范围

- ❌ Sprint 决策流程 → 见 `agents/coding.md`
- ❌ Code 修改 → 见 `agents/coding.md` + `runbooks/`
- ❌ 数据库 schema 设计 → 见 `agents/migration.md` + `architecture/database.md`
- ❌ Hermes TUI 实现细节 → 见 Hermes 仓库

---

**文档结束**