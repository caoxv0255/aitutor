# frontend-legacy/

**状态**: Archived (2026-08-21). 冻结于 D070 (`0fe7a77c refactor: frontend cleanup`).

这个目录曾是 PC 端"重新设计"前端原型 (`frontend/redesign/`), 在 v1.0 产品化阶段
被 `ai-tutor-frontend/` (F3) + `public/` (PWA) 完全替代.

## 为什么保留而不是删除

- `git mv` 保留完整 history, 可通过 git log/blame 追溯最后一次提交记录.
- D070 决策文档 (`docs/d070-dead-routes.md`, `docs/audit-dead-routes-checked.md`)
  仍然引用 `frontend/redesign/*.html` 文件路径做审计参考.
- 30 天回退窗口期内 (server.js `301 → /f3/pages/index.html` 的迁移缓冲),
  如需还原旧路径仍可定位源码.

## 不要做的事

- ❌ 不要再编辑这里的文件 — F3 是唯一在维护的 PC 端 (`/f3/pages/*`).
- ❌ 不要从 `server.js` 删除 `/frontend*` 301 redirect — 那才是冻结期的官方入口.
- ❌ 不要从 production nginx 配置移除对 `/frontend` 的兜底 — 仍有 SEO 老链接.

## 何时彻底删除

- 30 天回退窗口期结束 (D070 commit 之后 + 30 天) 后, 可执行:
  `git rm -r frontend-legacy/redesign`
- 当前 `frontend/redesign/` 全部文件仍可访问 (git 会保留), 但 `frontend/` 目录下
  已经看不到它们 — server.js 的 301 会接管.