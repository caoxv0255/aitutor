# 设计交付物 — 练习中心 (Practice Hub)

> 关联文档: [`ANALYSIS.md`](./ANALYSIS.md) (产品 loop + 调性解析)
> 设计目标: 闭环 ④ 薄弱点分析 → ⑤ 行动出口
> 交付物: `practice-hub.html` (单文件、零构建、双主题、响应式)

---

## 1. 为什么是这个页

### 1.1 Loop 中的位置

```
① 拍照错题 → ② AI 识别 → ③ 错题入库 → ④ 薄弱点分析 → ★练习中心★ → ⑤ 行动
                                                                       ↓
                                                          ⑥ 强化练习 → 回到 ③
```

`my-weak-points.html` 只能走到"看清单 + 生成预测卷"，但学生**真正需要的"下一步该练什么"散落在 4 个页面**：

| 当前散落入口 | 路径 |
|---|---|
| 开始练习 | 不存在 (需要进错题本手动选题) |
| 生成预测卷 | `personalized-paper.html` |
| AI 讲题 | `tutor.html` |
| 学习路径 | `learning-path.html` |

**练习中心**把 4 个入口收口到 1 个页面，让"今日必做"只需一次跳转。

### 1.2 设计目标 (3 条)

1. **让数据先说话**：4 个 stat card 把"我今天在哪、还差多少、还有什么不会"在 5 秒内传达
2. **让行动有方向**：4 个 action card 把"我能现在做什么"显式列出
3. **让循环可量化**：每条薄弱点带"薄弱度指数"，让学生看见自己的进步（鼓励向调性）

---

## 2. 调性对应点 (Tone → 决策)

> 每条决策都对应 [`ANALYSIS.md §2`](./ANALYSIS.md#2-产品调性-tone--voice) 中的一条调性规则。

| 设计决策 | 调性来源 | 实现 |
|---|---|---|
| 文案"练习中心"不用"开始刷题吧" | CTA 动词开头，无 emoji | `<h1>练习中心</h1>` 配 eyebrow "今日必做" |
| 卡片标题用名词短语 | "我的错题本"模式 | "薄弱知识点"、"下一步动作"、"学习连胜" |
| StatCard 标签是名词 | "综合得分"模式 | "学习连胜 / 综合得分 / 薄弱知识点 / 已完成题目" |
| StatCard 副标是短语 | "较上周"模式 | "较昨日 +1" / "今日目标 40" |
| 数字显眼但不用感叹号 | 鼓励用增长箭头，不卖萌 | `trending-up` 图标 + success 绿色 |
| 学科标签严格映射课标 | "数学/物理/化学..." | 6 个学科 pill，按 theme-utils 配色 |
| 不使用 emoji | README §Voice 明文 | 全图标用 Lucide，无 emoji |
| Pill 按钮 | 系统签名形状 | 所有按钮 `radius: 9999px` |
| Hover 时 `translateY(-3px)` + shadow-2 | 视觉约定 | `.action-card:hover` 与 `.stat-card:hover` |
| 全局 150ms 过渡 | 视觉约定 | 所有 `transition: .15s` |
| 红色作为行动主色 | `var(--primary)` = `#d71920` | 主 CTA、综合得分 stat、今日必做 action card |
| 蓝色作为信息色 | `var(--secondary)` = `#2563eb` | 综合得分 stat icon |
| DM Sans 数字 + Noto Sans SC 文字 | 字体约定 | `font-variant-numeric: tabular-nums` 让数字纵向对齐 |
| Dark theme 优先 | README 明文 "Dashboard 优先深色" | 默认浅色，navy header 已是 dark, 提供 toggle |

---

## 3. 关键组件决策

### 3.1 StatCard 4 件套

| Card | 主色 | 触发行动 | 调性 |
|---|---|---|---|
| 学习连胜 | primary red | 持续练习 | 用数据鼓励，不卖萌 |
| 综合得分 | blue | 看整体 | 冷静信息位 |
| 薄弱知识点 | warning | 优先级（向下=好事） | 红色降 = 进步 |
| 已完成题目 | success | 目标进度 | 今日目标感 |

### 3.2 薄弱度指数条 (新增组件)

设计库 (`.design_library/ai-tutor/components/`) 原本没有 progress-bar / bar-chart，这是本次**新增组件**。

- 颜色梯度：高分(>70%) 红、中分(40-70%) 黄、低分(<40%) 蓝
  - 调性来源: 红色 = 紧迫；黄色 = 警示；蓝色 = 信息
- 数字永远显示在右：`9.6 / 10`，`tabular-nums` 对齐
- 与 StatCard 共享 `--space-4` 的 padding 节奏

### 3.3 Subject Pill Selector

复刻 `mastery.html` 已有的 subject 切换器，升级为：
- 激活态：实心红 + 白字 + pill
- 默认态：透明背景 + 边框
- 加 **badge** 数字显示每个学科的薄弱数量 (新增)

### 3.4 Action Card 4 件套

- "开始今日练习" 设为 **featured** 状态 (渐变背景 + 红色边框)：因为它是 ⑥ 强化练习的**直接入口**
- 其他 3 个 action card 是普通态：信息密度相同、视觉权重略低
- Hover 时：边框变红 + 上浮 3px + shadow-2 (与设计库约定一致)

---

## 4. 视觉对照 (vs 现有 `my-weak-points.html`)

| 维度 | 现有 `my-weak-points.html` | 练习中心 |
|---|---|---|
| 信息密度 | 低 (235 行，无 stat) | 中高 (4 stat + 5 weak + 4 action) |
| 行动入口 | 1 个 (生成预测卷) | 4 个 (开始练习 / 预测卷 / AI讲题 / 学习路径) |
| 数据可见性 | 隐藏 (需展开) | 首屏可见 |
| 主题支持 | 仅浅色 | 浅 + 深 (toggle) |
| 移动端 | 仅基础 | 完整响应式 |

---

## 5. 落地路径 (下一步建议)

> ⚠️ 不在本次任务范围内，仅作为产品落地建议

1. **接到 `dashboard.html` 的入口**：在 dashboard 的"待复习任务"卡片加"进入练习中心"按钮
2. **接到 PWA `wrongbook` 入口**：在 PWA 错题本底部加"今日必做"快捷入口
3. **API 契约**：
   - `GET /api/practice/today` → 返回今日 stat 数字 + 学科分布
   - `GET /api/weak-points?subject=math&limit=5` → 现有接口加 limit 参数即可
   - `POST /api/practice/start` → 启动一组练习题
4. **A/B 指标**：
   - 主指标：日活用户中"开始今日练习"按钮点击率
   - 次指标：从练习中心到强化练习页的转化率
   - 护栏指标：平均练习时长 (避免被"今日必做"压迫)

---

## 6. 文件清单

```
docs/design/
├── ANALYSIS.md           ← 产品 loop + 调性解析 (已完成)
├── README.md             ← 本文件: 设计决策与调性对应
└── practice-hub.html     ← 设计交付物: 单文件、双主题、响应式
```

---

## 7. 设计原则 (供后续页面复用)

1. **数据先行**：每页首屏必须有 ≥1 个 stat / 数字，告诉学生"我现在在哪"
2. **行动收口**：每页最多 4 个 action card，超过就要分 tab / 路由
3. **学科严格用 tag**：6 个学科只能用"数学/物理/化学/英语/语文/政治"的标准名
4. **不混用 emoji**：UI 内零 emoji，需要图标用 Lucide
5. **CTA 动词开头**："开始学习" 不要 "点击开始学习"
6. **不卖萌**：用增长箭头 (`trending-up`) 鼓励，不用感叹号或 emoji
7. **可量化**：每条建议、每个行动都要带数字反馈 (薄弱度 / 进步 / 完成度)