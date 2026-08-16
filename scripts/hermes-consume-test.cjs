#!/usr/bin/env node
// scripts/hermes-consume-test.cjs — 模拟 Hermes TUI 消费 .ai/status/*.yaml
//
// 用法: node scripts/hermes-consume-test.cjs
// 目的: 验证 status YAML 可被机器解析 (schema_version / generated_at / 关键字段)
//
// 模拟 Hermes 行为:
//   1. 读所有 .ai/status/*.yaml (用真正的 yaml parser)
//   2. 校验 schema_version
//   3. 提取关键字段 (gate status, container health, kp count, alerts)
//   4. 输出"控制台渲染"(验证 Hermes 能拿到它需要的所有数据)

const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const STATUS_DIR = path.join(__dirname, '..', '.ai', 'status');

console.log('═══ Hermes TUI 数据消费模拟 ═══\n');

const files = fs.readdirSync(STATUS_DIR).filter((f) => f.endsWith('.yaml')).sort();
const data = {};
let errors = 0;

for (const file of files) {
  const filePath = path.join(STATUS_DIR, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = YAML.parse(content);

    if (!parsed || typeof parsed !== 'object') {
      console.error(`❌ ${file}: 解析结果非对象`);
      errors++;
      continue;
    }
    if (!parsed.schema_version) {
      console.error(`❌ ${file}: 缺 schema_version`);
      errors++;
      continue;
    }
    if (!parsed.generated_at && file !== 'backlog.yaml') {
      console.warn(`⚠️  ${file}: 缺 generated_at`);
    }
    data[file.replace('.yaml', '')] = parsed;
    console.log(`✓ ${file.padEnd(22)} schema=${parsed.schema_version}`);
  } catch (e) {
    console.error(`❌ ${file}: ${e.message}`);
    errors++;
  }
}

const d = {
  version: data['version'],
  gate: data['gate-status'],
  docker: data['docker-health'],
  rag: data['rag-components'],
  db: data['database'],
  backlog: data['backlog'],
};
console.log('\n═══ Hermes 控制台渲染 (mock) ═══\n');
console.log('╭──── aitutor Agent Console ────╮');
console.log('│');
console.log(`│  Head:    ${(d.version?.git?.head_commit || 'n/a').padEnd(20)}`);
console.log(`│  Tests:   ${d.gate?.results?.[0]?.passed ?? 'n/a'} pass (vitest)`);
console.log(`│  BCT:     ${d.gate?.results?.[2]?.passed ?? 'n/a'} pass (contract)`);
console.log(`│  Docker:  ${d.docker?.containers?.[0]?.status?.split(' ')?.[0] || 'n/a'}`);
console.log(`│  KP:      ${d.db?.knowledge_points?.total ?? 'n/a'} gaokao`);
console.log(`│  Status:  ${d.gate?.overall || 'n/a'}`);

if (d.backlog?.p0?.length) {
  console.log('│');
  console.log(`│  ⚠️  P0: ${d.backlog.p0.length} 项`);
}

console.log('│');
console.log('╰────────────────────────────────╯\n');

if (errors > 0) {
  console.error(`❌ ${errors} 个 YAML 解析失败`);
  process.exit(1);
}
console.log('✓ 所有 status YAML 可被 Hermes 解析');