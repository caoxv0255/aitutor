#!/usr/bin/env node
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
process.chdir(projectRoot);

const obsidianSyncPath = path.join(projectRoot, 'api', 'services', 'obsidian-sync.js');
const { default: obsidianSyncService } = await import('file://' + obsidianSyncPath);

async function main() {
  const action = process.argv[2];
  
  if (!action) {
    console.log('Usage: npm run sync <action>');
    console.log('Actions:');
    console.log('  stats    - 显示知识统计');
    console.log('  sync     - 同步 Obsidian -> GraphRAG');
    console.log('  sync-back - 同步 GraphRAG -> Obsidian');
    console.log('  search <query> - 搜索知识');
    console.log('  watch    - 监控文件变化自动同步');
    process.exit(0);
  }
  
  try {
    switch (action) {
      case 'stats': {
        const stats = await obsidianSyncService.getKnowledgeStats();
        console.log(JSON.stringify(stats, null, 2));
        break;
      }
      case 'sync': {
        console.log('正在同步 Obsidian 知识库到 GraphRAG...');
        const result = await obsidianSyncService.syncKnowledgeToGraphRAG();
        console.log('同步完成:', JSON.stringify(result, null, 2));
        break;
      }
      case 'sync-back': {
        console.log('正在同步 GraphRAG 实体到 Obsidian...');
        const result = await obsidianSyncService.syncGraphRAGToKnowledgeBase();
        console.log('反向同步完成:', JSON.stringify(result, null, 2));
        break;
      }
      case 'search': {
        const query = process.argv[3];
        if (!query) {
          console.log('Usage: npm run sync search <query>');
          process.exit(1);
        }
        const results = await obsidianSyncService.searchKnowledge(query);
        console.log(`搜索结果 (${results.length} 条):`);
        results.forEach((r, i) => {
          console.log(`${i + 1}. [${r.score}] ${r.title} (${r.subject})`);
        });
        break;
      }
      case 'watch': {
        console.log('启动文件监控...');
        obsidianSyncService.startWatching();
        console.log('按 Ctrl+C 停止监控');
        process.on('SIGINT', () => {
          obsidianSyncService.stopWatching();
          process.exit(0);
        });
        break;
      }
      default: {
        console.log(`未知操作: ${action}`);
        process.exit(1);
      }
    }
  } catch (err) {
    console.error('执行失败:', err.message);
    process.exit(1);
  }
}

main();
