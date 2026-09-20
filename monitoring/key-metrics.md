# aitutor V1.0 · D070 灰度监控大盘规范

> 数据源：Sentry + Prometheus + Nginx access log
> 责任人：SRE oncall（PagerDuty rotation）
> 关联：monitoring/sentry-alerts.json

---

## 1. 监控大盘 3 大类（核心指标）

### 1.1 前端健康度

| 指标 | 源 | 阈值 | 看板面板 |
|---|---|---|---|
| JS 错误率（F3）| Sentry | < 0.5% 警告 / > 1% Critical | "F3 JS Errors" |
| 白屏率（FCP > 3s）| Sentry | < 1% 警告 / > 2% Critical | "F3 White Screen" |
| FCP P75 | Sentry | < 1500ms | "F3 Web Vitals" |
| LCP P75 | Sentry | < 2500ms | "F3 Web Vitals" |
| 资源加载失败率 | Sentry | < 0.1% | "F3 Asset Errors" |
| **F3 vs Legacy 错误率对比** | Sentry | F3 不应 > Legacy × 1.5 | "F3 vs Legacy" |

### 1.2 后端健康度

| 指标 | 源 | 阈值 | 看板面板 |
|---|---|---|---|
| `/api/home/today` P95 | Sentry + Prometheus | < 200ms 警告 / > 300ms Critical | "Home Today Latency" |
| `/api/home/today` 5xx 率 | Sentry | < 0.1% 警告 / > 0.5% Critical | "Home Today Errors" |
| `/api/learning-path/current` P95 | Sentry + Prometheus | < 200ms 警告 / > 300ms Critical | "Learning Path Latency" |
| `/api/learning-path/current` 5xx 率 | Sentry | < 0.1% 警告 / > 0.5% Critical | "Learning Path Errors" |
| PostgreSQL 连接池使用率 | Prometheus | < 60% 警告 / > 80% Critical | "DB Connections" |
| Node.js Event Loop Lag P99 | Prometheus | < 100ms 警告 / > 200ms Critical | "Event Loop" |
| **新旧后端 P95 对比** | Sentry | F3 不应 > Legacy × 1.3 | "F3 vs Legacy Backend" |

### 1.3 业务转化率

| 指标 | 源 | 阈值 | 看板面板 |
|---|---|---|---|
| Dashboard "今日 3 件事" CTA 点击率 | 自研埋点 | 监控趋势（不放阈值）| "Dashboard Engagement" |
| 拍照录题成功率（识别成功 / 提交总数）| 自研埋点 | > 70% | "Photo Upload Success" |
| 错题 → 复习转化率 | 自研埋点 | 监控趋势 | "Wrong Book → Review" |
| 复习完成率 | 自研埋点 | 监控趋势 | "Review Completion" |
| **新旧用户体验差异** | A/B 对比 | F3 不得显著低于 Legacy | "F3 vs Legacy UX" |

---

## 2. 灰度阶段核心看板

### 2.1 Phase 1（内部白名单 1-3 天）

**关注**：
- F3 JS 错误率 < 0.3%（员工容忍度高，但仍要低）
- 内部用户主观反馈

### 2.2 Phase 2（5% 真实流量 3 天）

**关注**：
- **F3 vs Legacy 5xx 对比**（5xx 率差异 > 2x 立即暂停）
- 任何 Critical 级 Sentry 报警
- 用户转化率变化 > 20%

### 2.3 Phase 3（20% → 50% → 100% 阶梯放量）

**关注**：
- P95 实时监控（应保持 < 200ms 趋势）
- 5xx 率保持 < 0.1%
- 无新增 Critical 错误类型

---

## 3. 关键告警阈值

### 3.1 Critical（PagerDuty + 立即叫醒 oncall）

| 告警 | 触发条件 | 行动 |
|---|---|---|
| F3 JS 错误率 > 1% (5min) | F3 抛错激增 | 评估 Kill Switch |
| 任意核心 API 5xx > 0.5% (1min) | 后端故障 | 评估 Kill Switch |
| F3 白屏率 > 2% (5min) | 资源加载失败 | 评估 Kill Switch |
| Kill Switch 触发事件 | 运维主动触发 | 通知 #aitutor-ops |

### 3.2 Warning（Slack #aitutor-oncall）

| 告警 | 触发条件 | 行动 |
|---|---|---|
| F3 P95 > 200ms | 性能下降 | 优化 / 扩容 |
| DB 连接池 > 60% | 即将耗尽 | 扩容 / 优化 |
| FCP P75 > 1500ms | 体验下降 | 优化资源加载 |

### 3.3 Info（Slack #aitutor-eng）

| 告警 | 触发条件 | 行动 |
|---|---|---|
| 灰度比例变更 | 运维调整 aitutor_gray_pct | 通知团队 |
| 业务转化率波动 > 10% | A/B 观察 | 通知 PM |

---

## 4. 仪表盘 JSON（参考）

```json
{
  "title": "D070 灰度监控大盘",
  "timezone": "browser",
  "panels": [
    {
      "title": "F3 vs Legacy P95 对比",
      "type": "timeseries",
      "targets": [
        {"query": "endpoint:/api/learning-path/current tag:use_legacy:false", "legend": "F3 P95"},
        {"query": "endpoint:/api/learning-path/current tag:use_legacy:true",  "legend": "Legacy P95"}
      ]
    },
    {
      "title": "灰度桶流量分布",
      "type": "stackedbar",
      "targets": [
        {"query": "sum by (bucket) (rate(nginx_requests_total[5m]))"}
      ]
    },
    {
      "title": "F3 关键转化漏斗",
      "type": "funnel",
      "targets": [
        {"name": "Dashboard 访问", "query": "page_view: dashboard"},
        {"name": "今日任务点击", "query": "cta_click: today_task"},
        {"name": "复习完成",     "query": "review_complete"}
      ]
    }
  ]
}
```

---

## 5. 告警值班表

| 时段 | oncall | 备份 | 联系方式 |
|---|---|---|---|
| 工作日 9-18 | 平台 SRE | 后端 SDE | 钉钉群 #aitutor-oncall |
| 夜间 / 周末 | 平台 SRE | 值班经理 | PagerDuty 自动轮询 |
| Critical 5min 未响应 | 升级至 CTO | — | 电话 |

---

## 6. 复盘模板

每次灰度阶段结束，需填写《D070 Phase X 复盘》：

- **核心指标对比表**（F3 vs Legacy 7 项核心）
- **Critical 事件清单**（含处理时间）
- **用户反馈摘录**（5-10 条）
- **下一阶段放行决策**（继续 / 暂停 / 回滚）
- **改进项 backlog**

