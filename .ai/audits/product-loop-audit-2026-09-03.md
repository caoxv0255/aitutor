# AI Tutor 使用闭环审计 (Canonical Frontend) — 2026-09-03

状态: 只读审计（浏览器 + curl 实测，未改产品代码）
范围: /、/login、/register、/dashboard、6 科预测卷、错题本、薄弱点、个性化卷、报告、AI 讲题、学习路径

## 0. 生产数据基线（本次实测）
| 表 | 行数 | 影响 |
|----|-----|------|
| users | 4（含审计新建） | 无真实用户 |
| wrong_questions | 0 | 错题闭环无数据 |
| reports | 0 | 报告为空 |
| exam_papers / exam_questions | 0 | 无真试卷题库 |
| personalized_papers | 0 | 无个性化卷 |
| similar_questions | 0 | 推荐为空 |
| knowledge_points | 426 | ✅ 唯一有数据的核心 |
| provinces | 44 | ✅（上轮已补） |
| 运行时 DASHSCOPE_API_KEY | ❌ 缺失 | 所有 AI 能力不可用 |

## 1. 用户旅程实测结果
| 闭环 | 入口 | 结果 | 判定 |
|------|------|------|------|
| 认知/样例 | / → 样例报告/方法论/政策 | 打开即精美静态页 | ✅ 通（仅展示） |
| 注册/登录 | register/login → dashboard | 真实注册+guest 均可进 | ✅ 通 |
| Dashboard | 统计 0/0/0、省份可选 | 渲染正常但全空 | ⚠️ 空壳 |
| 拍照搜题/上传错题 | dashboard scan | 调 vision → **运行时无 DASHSCOPE key** | ❌ 断 |
| 做预测卷 | 6 科 | **静态内嵌 22 题**，前端判分，交卷自动 POST /api/questions | ✅ 可练（体验级） |
| 错题本 | wrong-book | 交卷错题可写入并显示；**无手动录入 UI** | ⚠️ 半通 |
| 薄弱点 | my-weak-points | API 需结构化 KP 错题；UI 无路径产生 | ❌ 恒空 |
| 个性化预测卷 | personalized-paper | **仍调已废弃 /api/generate-paper**（legacyGone） | ❌ 死链 |
| 我的报告 | my-reports | 无任何生成路径 | ❌ 恒空 |
| AI 讲题 | question-explainer | /api/explain-question 需 DASHSCOPE key | ❌ 断 |
| 学习路径 | learning-path | 依赖薄弱点数据 | ❌ 恒空 |
| 省份分析 | province?code | exam_papers=0 → 全零 | ⚠️ 无数据 |

## 2. 根因（5 个，非 UI）
1. **无「错题录入」用户路径**：错题只能靠「拍照搜题」写入，而该能力依赖
   DASHSCOPE 视觉模型；运行时环境缺少 key → 闭环起点断。
2. **运行时密钥错配**：systemd 加载工作区 `.env`（无 DASHSCOPE_API_KEY），
   密钥在 `.env.prod` 但未被生产进程使用 → AI 讲解/OCR/tutor/ask 全部不可用。
3. **前端调用已废弃 API**：personalized-paper.html → `/api/generate-paper`
   （sunset 2026-09-23，应改用 `/api/tutor/ask`）→ 页面必然失败/空。
4. **无结构化错题 → 无薄弱点**：weak-points 需带 knowledge_point 映射的错题，
   UI 无入口产生（需扫描解析或按 KP 录入），故薄弱/学习路径/个性化恒空。
5. **无报告生成路径 + 内容库空**：reports=0、exam_papers=0 → 报告/试卷分析零数据。

## 3. 结论
Canonical 前端当前 = 「营销/演示壳 + 静态真题练习」。真正的产品闭环
「录入错题 → 薄弱点 → 个性化卷/路径 → 报告」在**生产环境完全未接通**。

---
