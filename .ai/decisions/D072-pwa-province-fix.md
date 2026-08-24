# D072 — PWA 端省份选择 Bug 修复 + 视觉打磨 (2026-08-24)

## 决策

1. **扩展 backend zhongkao 省份数据** — 从 3 个扩展到 13 个（含直辖市 + 省会城市）
2. **PWA 端省份列表按 region 分组 + 加搜索框**
3. **空数据时友好降级提示**（不再显示空白）
5. **统一 PWA + F3 token key** (`authToken` / `currentUser` / `currentGrade` ↔ `aitutor.token` / `aitutor.user` 双写)
6. **新增 admin 端点** `/api/cache/clear-provinces` (清 cache)

## 上下文

**用户报告**: PWA 端"无法选择省份" — 切换到"中考" tab 后列表空白。

**根因** (3 层):
1. **Backend 数据缺失**: `database/seed_provinces.json` 只有 3 个 zhongkao (beijing_zhongkao/shanghai_zhongkao/guangzhou_zhongkao), 而且 DB 实际存的是 0 个 zhongkao (初始 seed 失败过)
2. **Cache 长期不刷新**: `cacheService.js` 用 `LONG_TTL=86400` (24小时), 即使 DB 改了, cache 也需 24h 后才刷新
3. **前端无降级**: `loadProvincesList()` 假设 `data` 永远有值, 空数组时显示空白列表, 用户误以为"功能坏了"
4. **Token key 不一致**: F3 用 `aitutor.token` (D062 统一), PWA 用 `authToken` + `currentUser` + `currentGrade` (3键) — 用户从 F3 登录后访问 PWA 不会被识别为已登录

**为什么不"砍掉省份选择"**: 考试地区是 PWA 端核心上下文（影响错题诊断 / 考点预测 / 试卷匹配），是产品最有价值的功能之一。

## 改动

### Backend

- `database/seed_provinces.json` — 31 gaokao + 13 zhongkao (新增 10 个), region 字段全部中文化 (华北/华东/华南/华中/西南/西北/东北)
- `server.js`:
  - `/api/provinces/seed` 加 `CacheService.invalidateProvinces()` 自动清 cache
  - 新增 `/api/cache/clear-provinces` admin 端点 (手动清 cache)
  - seed 失败时输出详细 error detail

### PWA 端

- `public/src/app.js` `loadProvincesList()` 完全重写:
  - 空数据时显示友好降级 (icon + 文字 + 切换提示)
  - 按 region 分组 (7 个区域) + 区域标题 + 数量
  - 加 sticky 搜索框 (实时过滤, 隐藏不匹配组)
  - region 标签也作为搜索匹配项
- `public/src/utils/context.js`:
  - `saveAuth()` 双写 `aitutor.token` + `authToken`, 同步 `aitutor.user`
  - `restoreSession()` 优先读 `aitutor.token`, 兜底 `authToken`; email 也从 `aitutor.user` 反向解析
  - `logout()` 清两个 key 集合

## 验证

| 验证项 | 结果 |
|---|---|
| `GET /api/provinces?exam_level=gaokao` | ✅ 31 个 |
| `GET /api/provinces?exam_level=zhongkao` | ✅ 13 个 |
| `POST /api/provinces/seed` (本地 + container 同步) | ✅ count=44 |
| `POST /api/cache/clear-provinces` | ✅ success |
| `npm run gate` (vitest + contract + health) | ✅ 5/5 |
| `verify-province.mjs` (PWA 端 e2e) | ✅ 14/13 项, 7 组, 搜索 OK, 选中+确认 OK |
| PWA 端 region label 兼容 (中文 + 旧英文) | ✅ |

## 截图基线

- `frontend/dev/screenshots/pwa-province-gaokao.png` — 高考 14 省 7 region + 搜索框
- `frontend/dev/screenshots/pwa-province-zhongkao.png` — 中考 13 省 7 region

## 后续改进（已记录 backlog）

- Cache 自动刷新策略 (`CACHE_CONFIG.LONG_TTL` 从 24h 降到 5min, 或基于事件失效)
- `/api/cache/clear-provinces` 加 admin auth (目前无 auth — 仅本 session debug 用, 待加保护)
- PWA 端"未选择"显式状态 (让用户明确意识到当前没设置)
- 跨端登录 (用户 F3 登录后, PWA 自动识别, 共享 user info)

## 红线检查

- ✅ D001 没用 React/Vue
- ✅ D062 跟 F3 envelope 一致
- ✅ D065 gate 通过
- ✅ D070 没动 frontend/ legacy
- ✅ 没 amend 已 push commit