# Bundle 解析 — 产品使用 Loop & 调性

> 解析对象: `aitutor` 仓库 (PC 端 `frontend/` + `ai-tutor-frontend/pages/` + PWA `public/`)
> 解析时间: 2026-09
> 解析方法: 阅读源码 / 设计文档 / 现有组件 / 现有文案

---

## 1. 产品使用 Loop (核心循环)

智启 AI 导师 是一个面向 **K12 应试学生** 的错题诊断 + 预测学习平台。核心闭环由 **6 步组成**，每一步都有对应的页面或 API：

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  ① 拍照错题 ──→ ② AI 识别 ──→ ③ 错题入库 ──→ ④ 薄弱点分析           │
│       │                                                    │       │
│       │            (PWA 端 拍照 / 相册)                  ▲  │       │
│       ▼                                                    │  │       │
│                                                       ───┘  │       │
│                                                         ⑤ 预测卷/学习路径/AI讲题
│  ⑥ 强化练习 ──→ 回到 ③ 错题入库 (loop 闭合)                     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 1.1 Loop 节点映射

| 步 | 入口 | 页面 | 关键 API | 关键文案 |
|---|---|---|---|---|
| ① 拍照 | PWA `拍照搜题` 卡片 | `public/index.html` → `photoPicker` | `POST /api/tasks` (图片上传) | "拍照搜题 · 错题管理 · AI 智能学习" |
| ② AI 识别 | 异步任务队列 | `taskQueue` → `taskDetail` | `GET /api/tasks/:id` | "任务队列"、"查看解析进度和结果" |
| ③ 错题入库 | 学科维度浏览 | `wrongBook` → `subjectQuestions` | `GET /api/wrong-questions` | "错题本"、"回顾错题，生成学科报告" |
| ④ 薄弱点分析 | PC 端 dashboard | `my-weak-points.html`, `mastery.html` | `GET /api/weak-points` | "我的薄弱点分析"、"基于错题记录，分析各知识点的薄弱程度，精准定位提升方向" |
| ⑤ 行动出口 | 三个并行出口 | `personalized-paper.html` / `learning-path.html` / `tutor.html` | `POST /api/generate-paper` / `GET /api/learning-path` / `POST /api/tutor-agent` | "生成个性化预测卷"、"定制你的专属学习计划"、"AI 讲题" |
| ⑥ 强化练习 | 试卷作答 | `exam-view.html` (各科) | `POST /api/exam-submit` | "开始学习"、"今日练习"、"查看详情" |

### 1.2 Loop 的"断裂点" — 设计机会

读完代码后，loop 的**真正薄弱处**在 **④→⑤ 之间的转化**：

- **my-weak-points.html** (235 行) 只有"薄弱列表 + 生成预测卷"两个动作，**没有**"今日该练什么"的入口
- **learning-path.html** (215 行) 内容很薄，无法承接来自分析页的"立即开始"动作
- **dashboard.html** 把 4 个 stat card 和 4 个功能入口**分散在 4 个独立区**，学生找不到"下一步该干什么"

> 🎯 **设计目标**：在 ④ 和 ⑤ 之间，插入一个统一的"练习中心 (Practice Hub)"，作为**单入口的今日行动页**，让 loop 闭合更紧。

---

## 2. 产品调性 (Tone & Voice)

调性来源：
- `.design_library/ai-tutor/README.md` (设计系统文档)
- 现有 30+ 页 HTML 的实际文案
- 现有组件的视觉风格

### 2.1 文案维度 (Voice)

| 维度 | 规则 | 反例 |
|---|---|---|
| **语言** | 中文为主，品牌名 + 标签英文 | ❌ "Click to start learning" |
| **语气** | 专业但温暖，激励式、任务导向 | ❌ "快来做题呀~ 加油！" |
| **CTA 动词** | 动词开头，去除冗余 | ❌ "点击开始学习" → ✅ "开始学习" |
| **卡片标题** | 名词短语 | ❌ "你的错题记录列表" → ✅ "我的错题本" |
| **卡片正文** | "特性 + 收益"双段式 | ✅ "记录和分析你的错题，帮助针对性复习薄弱知识点" |
| **Stat 标签** | 名词短语，绝非句子 | ✅ "综合得分"，❌ "你的综合得分为 78" |
| **Emoji** | UI 内不使用 emoji | ❌ "📚 错题本"，✅ "错题本" |
| **学科标签** | 严格映射课标 | "数学/物理/化学/英语/语文/政治" |

### 2.2 视觉维度 (Visual Tone)

| 维度 | 取值 |
|---|---|
| **主色** | `#d71920` AI Tutor Red (热情 + 学术紧迫感) |
| **辅色** | `#2563eb` 蓝色 (冷静信息) |
| **背景** | 默认浅色 `#f8f9fa`，**Dashboard 优先深色** `#0f1117` (设计文档明文) |
| **圆角** | 输入框 8px / 卡片 14px / 按钮和标签 pill (9999px) |
| **字号节奏** | Display 56 → H1 40 → H2 32 → H3 24 → H4 20 → Body 16 → Caption 12 → Eyebrow 11 |
| **字体** | 标题/数据 DM Sans，正文 Noto Sans SC |
| **阴影** | 5 级，hover 时 `translateY(-3px)` + shadow-2 |
| **动画** | 全局 150ms |
| **图标** | Lucide 1.8.0，sm/md/lg 三档 |

### 2.3 调性的"心智模型"

> **"它像一位严厉但温暖的家教**——用数据告诉你哪里不行，用红色提醒你紧迫，但绝不嘲讽或打击**。"**

这决定了：
- ✅ 数据必须**显眼** (StatCard / 进度条 / 热力图)
- ✅ 紧迫感用**红色 + 数字**表达，不用感叹号
- ✅ 鼓励用**对比 + 增长箭头**（"较上周 +5"），不用 emoji
- ✅ 行动入口必须**pill 按钮 + 动词**，路径单一不绕弯

---

## 3. 设计系统清单 (Design Tokens)

完整 token 见 `.design_library/ai-tutor/colors_and_type.css` 和 `css.json`。本次设计复用了：

- **Color**: primary 10 阶、blue 10 阶、success/warning/error/info 各 10 阶、dark theme surface/border/foreground
- **Spacing**: 4px 网格 (`--space-1` ~ `--space-8`)
- **Radius**: `--radius-sm 8px` / `--radius-md 14px` / `--radius-lg 16px` / `--radius-pill 9999px`
- **Shadow**: shadow-1 (resting) → shadow-5 (overlay)
- **Typography**: DM Sans (display/heading) + Noto Sans SC (body)
- **Component**: button / card / input / navigation / tag / stat-card (来自 `preview/`)

---

## 4. 下一步：设计交付物

基于以上分析，将设计并交付：

1. **`practice-hub.html`** — 练习中心静态页 (浅色 + 深色 双主题，移动端响应式)
   - 顶部: 4 个 stat card (今日练习 / 综合得分 / 薄弱点 / 学习连胜)
   - 中部: 学科维度切换 + 薄弱知识点列表 (按加权评分排序)
   - 底部: 4 个行动出口 (开始练习 / 生成预测卷 / AI 讲题 / 学习路径)
   - 配色 100% 复用 `.design_library/ai-tutor/colors_and_type.css` token
2. **`practice-hub.design.md`** — 设计决策文档，逐项标注调性对应点