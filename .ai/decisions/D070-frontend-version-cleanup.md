# D070: 前端版本大清理

**日期**: 2026-08-17
**状态**: 已实施
**相关**: D066 (gate 体系), P0.5 (legacy freeze)

## 背景

项目存在 **5 个前端目录**，版本混乱：

| 目录 | 状态 | 引用 | 大小 |
|---|---|---|---|
| `ai-tutor-frontend/` | ✅ F3 生产版 | server.js `/f3/*` | 808KB |
| `frontend/` | ⚠️ 冻结 legacy | 301 → `/f3/pages/index.html` | 3.3MB |
| `public/` | ⚠️ PWA 旧版 | server.js `/src/*`, `/icons/*`, `/` | 1.8MB |
| `ai-tutor-redesign/` | ❌ 已删除 | 无任何引用 | 720KB |
| `frontend-design-doc/` | ❌ 已删除 | 无任何引用 | 3.9MB |

**问题**：
- `ai-tutor-redesign/` 44 个文件，从未被 F3 或 server.js 引用
- `frontend-design-doc/` 8 个字体 + HTML 文件，纯设计文档，不应入库
- server.js 同时服务 `/assets` (frontend/) 和 `/f3/assets` (ai-tutor-frontend/)，容易混淆
- 总浪费 ~4.6MB git 历史

## 决策

### 1. 删除未引用目录
- `git rm -r ai-tutor-redesign/` — 44 文件, 720KB，无任何代码引用
- `git rm -r frontend-design-doc/` — 8 文件, 3.9MB，纯设计文档

### 2. .gitignore 新增规则
```
ai-tutor-redesign/
frontend-design-doc/
frontend-redesign/  # future experimental, use /f3 instead
```

### 3. server.js 精简
- 移除 `redesign` 路由（因为目录已删除），只保留 `frontend` 301
- 注释更新: "P0.5 + D070"

### 4. frontend/ 冻结但不删除
- 301 保留 30 天（向后兼容）
- 30 天后改 410 Gone
- 不删除原因：旧链接、旧测试可能依赖

## 影响

- git 仓库减小 ~4.6MB
- 减少开发混淆（只剩 ai-tutor-frontend/ F3 + frontend/ legacy + public/ PWA）
- server.js 路由减少 1 条
- F3 功能零变化，gate 全绿
