# D064 — 启动自动 Seed (knowledge_points)

> **日期**: 2026-08-15
> **阶段**: Phase 3 数据完整性
> **影响范围**: server.js, api/core/ensureSeeds.js, scripts/seed-textbook-knowledge.js

## 问题

- 容器 DB 知识表 `knowledge_points` 为空 → 所有依赖 KP 的端点 (mastery / vision 分类 / 个性化推荐) 返回空数组
- 唯一数据源: `database/graphify-gaokao-knowledge/textbook_knowledge.json` (381 条, 幂等 upsert)
- 旧流程: 人工跑 `scripts/seed-textbook-knowledge.js`, 容易遗忘

## 决策

启动期自动 seed:

1. **新建** `api/core/ensureSeeds.js`:
   ```js
   const r = await pool.query('SELECT COUNT(*)::int FROM knowledge_points');
   if (r.rows[0].n > 0) return { seeded: false, reason: '...' };
   execFileSync('node', ['scripts/seed-textbook-knowledge.js'], { stdio: 'inherit' });
   ```

2. **server.js start()** 在 `getDb()` 后调用 `ensureSeeds()`:
   ```js
   await getDb();
   const seedResult = await ensureSeeds();
   if (seedResult.seeded) logger.info(`[Seed] 自动导入: ${seedResult.count} 条`);
   ```

3. **幂等**: 空表才导入, 非空跳过 (启动日志: `[Seed] 跳过: knowledge_points 已有 381 条`)

## 备选方案

| 方案 | 否决理由 |
|------|----------|
| docker compose command 注入 | compose file 需要改, 增加部署复杂度 |
| 单独的 seed container | 多一个容器, 编排复杂 |
| 永远 seed (覆盖) | 破坏幂等, 生产风险 |
| 应用层懒加载 | KP 用得早 (vision 分类), 懒加载来不及 |
| **✅ 启动空表检查 + execFileSync** | 选定 |

## 后果

- 新部署自动有 381 条知识点
- 已存在的部署不重复 seed
- npm 脚本: `npm run seed:kp` (兼容人工触发)
- 中考知识点仍缺失 (无数据源), 待 `database/graphify-zhongkao-beijing/` 后续建设

## 验证

```bash
docker logs aitutor-app-1 | grep Seed
# → [Seed] 跳过: knowledge_points 已有 381 条, 跳过

curl http://localhost:3002/api/vision/knowledge-points
# → { items: [...], total: 381 }
```

## 变更文件

| 文件 | 改动 |
|------|------|
| `api/core/ensureSeeds.js` | **新增** (~30 行) |
| `server.js` | import + start() 调用 (3 行) |
| `package.json` | `"seed:kp": "node scripts/seed-textbook-knowledge.js"` |