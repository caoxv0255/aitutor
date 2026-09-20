# aitutor V1.0 · Kill Switch 10 秒回滚 Runbook

> 目标：Sentry 触发 Critical 报警 → 运维 10 秒内一键切回 Legacy 前端 → 业务 0 中断
> 关联：deploy/nginx-gray-cutover.conf · monitoring/sentry-alerts.json

---

## 0. 前置：Kill Switch 3 种触发方式

| 方式 | 触发命令 | 生效范围 | 适用场景 |
|---|---|---|---|
| **A. 全量回滚（默认）** | `echo "aitutor_gray_pct=0;" > /etc/nginx/conf.d/aitutor-gray.env && echo "aitutor_use_legacy=tutor_legacy;" >> /etc/nginx/conf.d/aitutor-gray.env && nginx -s reload` | 所有用户 | 整体 F3 故障 |
| **B. 单用户回滚** | 用户带 `X-Kill-Switch: 1` 请求头访问 | 仅该用户 | 内部 debug / 严重用户投诉 |
| **C. Cookie 强制 Legacy** | 注入 `Cookie: aitutor_bucket=legacy` | 该 Cookie 有效期（24h）| 个性化回滚（如灰度期间发现某用户持续报错）|

---

## 1. 10 秒回滚（标准流程）

### 步骤 1（1 秒）：确认报警

```bash
# 方式 A：通过 PagerDuty 手机 App 收到 Sentry Critical 报警
# 方式 B：通过 Slack #aitutor-oncall 频道通知
# 方式 C：通过 Grafana 仪表盘手动巡检发现
```

### 步骤 2（2 秒）：一键回滚

```bash
# SSH 到生产网关（需 ops 权限）
ssh ops@nginx-aitutor-01

# 一键回滚（执行 < 1 秒）
cat > /etc/nginx/conf.d/aitutor-gray.env <<'EOF'
aitutor_gray_pct=0;
aitutor_use_legacy=tutor_legacy;
EOF

# Reload nginx（reload 不中断现有连接，0 中断）
sudo nginx -t && sudo nginx -s reload
# 输出：nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
#       nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**⏱ 已用时：3 秒**

### 步骤 3（2 秒）：上报 Sentry 事件

```bash
# 主动上报 Kill Switch 触发事件（用于事后追溯）
curl -X POST https://sentry.io/api/0/projects/aitutor-ops/events/ \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "kill_switch_activated",
    "level": "warning",
    "tags": {
      "operator": "'"$USER"'",
      "reason": "Sentry Critical Alert"
    }
  }'
```

### 步骤 4（5 秒）：在 Slack 通报 + 通知 PM

```bash
# Slack 通报
curl -X POST $SLACK_WEBHOOK_URL -d '{
  "channel": "#aitutor-oncall",
  "text": "🚨 *Kill Switch 触发*\n• 灰度比例: 100% → 0%\n• 流量切回 Legacy\n• 触发人: '"$USER"'\n• 触发原因: '"$REASON"'\n• 操作耗时: < 10s"
}'
```

**⏱ 已用时：10 秒（已达成 SLA）**

---

## 2. 灰度回切（问题修复后回到灰度）

### 步骤 1：评估修复

```bash
# 查看 Sentry Issues
open https://sentry.io/issues/?project=aitutor-frontend&environment=production&query=is:unresolved
```

修复确认后再回切。

### 步骤 2：低比例重启灰度

```bash
# 建议：先回到 5% 灰度（不要直接 100%）
cat > /etc/nginx/conf.d/aitutor-gray.env <<'EOF'
aitutor_gray_pct=5;
aitutor_use_legacy=tutor_legacy;
EOF
sudo nginx -t && sudo nginx -s reload
```

### 步骤 3：观察 24 小时

- 重点指标：JS 错误率 / 5xx / P95
- 24h 无 Critical 报警 → 阶梯放量（5% → 20% → 50% → 100%）

---

## 3. 灰度阶段决策树

```
Sentry 报警触发
  ├─ Critical 级（JS 错误率 > 1% / 5xx > 0.5% / 白屏 > 2%）
  │   └─ ⏱ 10 秒内 Kill Switch
  │
  └─ Warning 级（P95 > 200ms / DB > 60%）
      ├─ 当前比例 < 20%?
      │   └─ 暂停放量，保持当前比例
      │   └─ 优化后观察 6 小时
      │   └─ 稳定 → 继续放量
      │
      └─ 当前比例 ≥ 20%?
          └─ 评估风险：影响范围
          ├─ 风险可控 → 保持比例，优化修复
          └─ 风险不可控 → 立即 Kill Switch
```

---

## 4. 演练 Checklist（每 Phase 开始前必跑）

### Phase 1 开始前
- [ ] Sentry 项目 + DSN 配置就绪
- [ ] Sentry alert rules 导入（sentry-cli alerts import）
- [ ] Slack webhook + PagerDuty 集成测试
- [ ] Kill Switch 演练 3 次（10 秒内完成回滚）
- [ ] 灰度 cookie 验证（`aitutor_bucket=f3` / `legacy`）

### 每个 Phase 切换前
- [ ] 上阶段复盘完成
- [ ] 监控指标稳定 24h+
- [ ] 变更窗口预约（业务低峰期）
- [ ] 团队待命（oncall 24h）

### Sunset 全量切流前
- [ ] 100% 灰度稳定 ≥ 7 天
- [ ] Legacy 前端 URL 全部 301 跳转新前端
- [ ] 删除 Legacy 静态文件 + 部署脚本
- [ ] 文档更新（README / Wiki）
- [ ] Git tag 标记 D070 sunset 日期

---

## 5. 紧急联系方式

| 角色 | 联系人 | 联系方式 |
|---|---|---|
| 平台 SRE oncall | PagerDuty rotation | 自动通知 |
| 后端 SDE 负责人 | ____ | 钉钉 / 电话 ____ |
| 前端 SDE 负责人 | ____ | 钉钉 / 电话 ____ |
| 产品 PM | ____ | 钉钉 ____ |
| CTO 升级 | ____ | 电话 ____ |

---

## 6. 演练记录模板

```markdown
## 演练 #____
- 时间：YYYY-MM-DD HH:MM
- 执行人：________
- 监控报警来源：[Sentry / 手动 / Grafana]
- 报警内容：________
- Kill Switch 触发方式：[A 全量 / B 单用户 / C Cookie]
- 操作耗时：____ 秒
- 验证 Legacy 端恢复：✅/❌
- 用户影响：____ (none / <0.1% / [其他])
- 后续行动：________
- 复盘改进项：________
```
