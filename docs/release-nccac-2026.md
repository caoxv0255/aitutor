# 华北五省计算机应用大赛版本（release/nccac-2026）发布与维护

## 定位

- 基线 tag：`nccac-2026.1`（annotated，基线提交 `8b57468`，2026-09-26）。
- 发布分支：`release/nccac-2026`，从 `nccac-2026.1` 拉出，**长期存在**。
- 比赛版基线，**只收 bug fix**；功能演进一律留在 `main`。

## 小 bug 标准流程

1. **main 先改**：在 `main` 修复并跑全量门禁（`npm test` + `npm run gate`，12 段全绿）。
2. **回灌 release**：`git cherry-pick -x <sha>`（`-x` 记录来源）到 `release/nccac-2026`。
3. **release 复验**：在 release 分支重跑门禁。
4. **递增 tag**：`nccac-2026.N`（N 从 2 起，annotated）。
5. **推双远端**：`origin` 与 `github` 都推，推后用 `git ls-remote` 复核。

## 例外

仅比赛环境相关的改动（如演示配置、比赛专用参数）**只落 release**，不回灌 `main`。

## 三条禁令

1. 不移动 / 不重打**已推送**的 tag（只能新增 `nccac-2026.N`）。
2. 不 `force push`。
3. 不把 `main` 的新功能 `merge` 进 `release/nccac-2026`（只 `cherry-pick` bug fix）。
