# TD-006 — knowledge_points_v2 (1558 KP) 整合 (Tech Debt)

**Date:** 2026-09-14
**Type:** Tech Debt
**Status:** 🟡 OPEN — **BLOCKED_BY_TD005**
**前置:** D090 覆盖率分析 + TD-005 v1.1 题干残缺根因

---

## 1. 背景

### 1.1 事实（SQL 已验证 2026-09-14）

| 表 | 行数 | 是否被 qkp FK 引用 |
|---|---:|---|
| `knowledge_points` (v1) | 426 | ✅ `fk_qkp_kp_id → knowledge_points(id)` |
| `knowledge_points_v2` | **1558** | ❌ 完全独立，无 FK 引用 |

### 1.2 两表结构对比

**v1 (`knowledge_points`) 字段:**
```
id (varchar PK), subject, name, subtopics, difficulty, frequency,
description, level, updated_at, module, textbook, volume,
volume_code, content, source, tags
```

**v2 (`knowledge_points_v2`) 字段:**
```
kp_id (text PK), subject, name, dimension_type, level, parent_id,
origin, origin_ref, confidence, evidence_count, vocab_version,
status, created_at, updated_at
```

v2 设计意图（基于字段推断）:
- `dimension_type`：维度类型（如 学科概念/学科方法/跨学科）
- `parent_id`：层级关系（v1 用 module/textbook/volume 隐式表达）
- `origin`：来源标识（v1 用 source）
- `confidence`：词条置信度（v1 没有）
- `evidence_count`：证据计数（v1 没有）
- `vocab_version`：版本号（v1 没有）

### 1.3 整合未启动原因

- v2 是另一工作流产物（可能其他会话/外部团队），独立建表未与现有系统打通
- 当前 qkp FK 仍指向 v1
- v2 词表**更细粒度**（1558 vs 426 = 3.7×），但题目题干残缺导致即使接 v2 也会有大量无效关联

---

## 2. 阻塞依赖（BLOCKED_BY_TD005）

**关键判断**：v2 整合必须在 TD-005 题干修复**之后**评估，原因是：

```
题干残缺 (2642 题, TD-005)
    ↓ 即使硬接 v2 也会大量产生"无效关联"
KP 映射失真 → v2 优势 (细粒度/层级) 无法体现
```

**修复 TD-005 是 v2 整合的合理前置**：
- TD-005 Phase 2 完成后：file_path 100%，可定位源 docx
- TD-005 Phase 3 完成后：题干修复，可做高质量 v2 映射
- 此时再评估 v2 整合 ROI 才有意义

---

## 3. 整合方案 A/B/C 选项（待 TD-005 完成后决策）

### 方案 A — 保持现状（最低风险）
- 不动 qkp schema
- v1 继续服务（57.52% 覆盖率）
- v2 保留为备用词表，未来单独使用
- **风险**：零
- **收益**：零（v2 不被利用）
- **适用**：v2 价值未被验证时

### 方案 B — 双轨并行（中等风险）
- qkp schema 加 `kp_v2_id` 字段
- 复用现有 stage32 流程，按规则同时打 v1 + v2 标签
- 双 KP 链：每个 question 可同时关联 v1 + v2 KP
- **风险**：中（schema 变更 + 双倍存储）
- **收益**：保留 v1 业务，叠加 v2 优势
- **适用**：v2 在某场景下有明显优势（如细粒度诊断）

### 方案 C — 迁移到 v2（高风险）
- qkp FK 改指向 v2.kp_id
- 重新跑全量 6219 题（基于修复后题干）
- v1 退化为历史归档
- **风险**：高（动核心 schema + 重新灌入）
- **收益**：单一权威词表
- **适用**：v2 全面优于 v1 且需长期演进

### 当前建议

**倾向方案 B（双轨并行）**，理由：
1. v1 已服务 v1.0 生产业务（57.52% 覆盖率），不可贸然迁移
2. v2 细粒度优势可叠加在薄弱点分析、个性化推荐等场景
3. 双轨可在 TD-005 修复后小流量试跑，验证 ROI 再决策

---

## 4. 待用户决策项

1. **是否立项为独立工作流？**（vs 关闭 v2 不再考虑）
2. **TD-005 修复后再启动，还是并行评估？**
3. **方案 A/B/C 倾向**（倾向 B）

---

## 5. 阻塞状态

```yaml
status: BLOCKED_BY_TD005
blocked_by: TD-005 (题干残缺与 file_path 溯源修复)
blocked_reason: 题干残缺时硬接 v2 会产生大量无效关联，浪费 v2 优势
unblock_when: TD-005 Phase 2 + Phase 3 完成
expected_unblock_date: 待定
estimated_work_after_unblock: 8-12h (方案 B)
```

---

## 6. 不阻塞当前主线的依据

1. v1 已满足 30%+ 覆盖率（D090）
2. v2 未被任何业务逻辑引用
3. TD-005 优先级高于此 TD（题干是用户感知最直接的问题）
4. 双轨或迁移方案都需要干净题干作为基础

---

## 7. 后续动作

- [ ] 等待 TD-005 Phase 2 + Phase 3 闭环
- [ ] 题干修复后，对 50 题做 v2 映射试跑，评估 ROI
- [ ] 基于试跑结果决定 A/B/C 方案
- [ ] 写 D-NNN 决策文档（v2 整合方案）

---

## 8. 备注

- v2 表的 `origin` 字段是"来源标识"，推测来源可能是用户照片/LLM 抽取/人工标注
- v2 表 `parent_id` 暗示有层级（树状），v1 是扁平结构
- v2 的 1558 vs v1 的 426 = 3.7× 扩展，符合"细粒度"定位
- 但若 v2 包含用户标注的高质量 KP 而 v1 是 textbook-derived，整合 v2 价值显著
