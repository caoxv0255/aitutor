import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../core/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const KNOWLEDGE_DIR = path.join(__dirname, '../../database/knowledge-points');
const GRAPHRAG_INPUT_DIR = path.join(__dirname, '../../graphrag_workspace/input');

export class ObsidianSyncService {
  constructor() {
    this.watchers = [];
    this.lastSync = {};
  }

  async syncKnowledgeToGraphRAG() {
    const files = await this.scanKnowledgeFiles();
    const markdownContent = await this.buildGraphRAGInput(files);
    
    if (!fs.existsSync(GRAPHRAG_INPUT_DIR)) {
      fs.mkdirSync(GRAPHRAG_INPUT_DIR, { recursive: true });
    }
    
    const outputFile = path.join(GRAPHRAG_INPUT_DIR, 'knowledge_base.md');
    fs.writeFileSync(outputFile, markdownContent);
    
    return {
      status: 'success',
      filesCount: files.length,
      outputFile,
      contentLength: markdownContent.length,
      timestamp: new Date().toISOString()
    };
  }

  async scanKnowledgeFiles() {
    const files = [];
    
    const scanDir = (dir, subject) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          scanDir(fullPath, entry.name);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push({
            path: fullPath,
            name: entry.name,
            subject: subject || 'root',
            relativePath: path.relative(KNOWLEDGE_DIR, fullPath),
            mtime: fs.statSync(fullPath).mtime.getTime()
          });
        }
      }
    };
    
    scanDir(KNOWLEDGE_DIR, null);
    return files;
  }

  async buildGraphRAGInput(files) {
    const sections = [];
    
    for (const file of files) {
      if (file.name.startsWith('00_') && file.name.includes('MOC')) {
        continue;
      }
      
      try {
        const content = fs.readFileSync(file.path, 'utf8');
        const cleanContent = this.cleanMarkdown(content);
        
        if (cleanContent.trim().length < 50) {
          continue;
        }
        
        const frontmatter = this.extractFrontmatter(content);
        const title = frontmatter?.name || file.name.replace('.md', '');
        
        let section = `## ${title}\n\n`;
        if (frontmatter) {
          section += `**学科**: ${frontmatter.subject || file.subject}\n\n`;
          if (frontmatter.tags) {
            section += `**标签**: ${frontmatter.tags.join(', ')}\n\n`;
          }
        }
        section += `${cleanContent}\n\n---\n\n`;
        sections.push(section);
      } catch (err) {
        console.error(`读取文件失败: ${file.path}`, err.message);
      }
    }
    
    return `# 高考知识库\n\n> 自动生成的知识图谱输入文件\n> 来源: Obsidian 知识库\n> 更新时间: ${new Date().toISOString()}\n\n${sections.join('\n')}`;
  }

  cleanMarkdown(content) {
    let cleaned = content;
    
    cleaned = cleaned.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
    
    cleaned = cleaned.replace(/\[\[([^\]]+)\]\]/g, '$1');
    
    cleaned = cleaned.replace(/^#+\s*/gm, '');
    
    cleaned = cleaned.replace(/\*\*/g, '');
    
    cleaned = cleaned.replace(/^-\s*/gm, '');
    
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    return cleaned.trim();
  }

  extractFrontmatter(content) {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!match) return null;
    
    const frontmatter = {};
    const lines = match[1].split('\n');
    
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();
        frontmatter[key.trim()] = this.parseYamlValue(value);
      }
    }
    
    return frontmatter;
  }

  parseYamlValue(value) {
    if (value.startsWith('[') && value.endsWith(']')) {
      return value.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, ''));
    }
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(value)) return parseFloat(value);
    return value.replace(/['"]/g, '');
  }

  async syncGraphRAGToKnowledgeBase() {
    const graphData = await this.extractGraphRAGEntities();
    await this.updateKnowledgeFiles(graphData);
    
    return {
      status: 'success',
      entitiesCount: graphData.entities.length,
      relationsCount: graphData.relations.length,
      timestamp: new Date().toISOString()
    };
  }

  async extractGraphRAGEntities() {
    const entities = [];
    const relations = [];
    
    const outputDir = path.join(__dirname, '../../graphrag_workspace/indexes/beijing_gaokao/output');
    
    try {
      const entityFile = path.join(outputDir, 'entities.parquet');
      if (fs.existsSync(entityFile)) {
        const entityData = await this.readParquet(entityFile);
        entities.push(...entityData);
      }
      
      const relationFile = path.join(outputDir, 'relationships.parquet');
      if (fs.existsSync(relationFile)) {
        const relationData = await this.readParquet(relationFile);
        relations.push(...relationData);
      }
    } catch (err) {
      console.error('提取 GraphRAG 实体失败:', err.message);
    }
    
    return { entities, relations };
  }

  async readParquet(filePath) {
    try {
      const parquet = await import('parquetjs');
      const reader = await parquet.ParquetReader.openFile(filePath);
      const cursor = reader.getCursor();
      const records = [];
      let record;
      
      while ((record = await cursor.next()) !== null) {
        records.push(record);
      }
      
      await reader.close();
      return records;
    } catch (err) {
      console.error('读取 Parquet 文件失败:', err.message);
      return [];
    }
  }

  async updateKnowledgeFiles(graphData) {
    const entityMap = {};
    
    for (const entity of graphData.entities) {
      const normalizedName = (entity.name || entity.id || '').toLowerCase().replace(/\s+/g, '_');
      entityMap[normalizedName] = entity;
    }
    
    for (const relation of graphData.relations) {
      const sourceName = (relation.source || '').toLowerCase().replace(/\s+/g, '_');
      const targetName = (relation.target || '').toLowerCase().replace(/\s+/g, '_');
      
      if (entityMap[sourceName]) {
        entityMap[sourceName].related = entityMap[sourceName].related || [];
        entityMap[sourceName].related.push({
          name: relation.target,
          type: relation.relation || '相关'
        });
      }
    }
    
    for (const [name, entity] of Object.entries(entityMap)) {
      await this.updateOrCreateKnowledgeFile(entity);
    }
  }

  async updateOrCreateKnowledgeFile(entity) {
    const subject = entity.entity_type || 'other';
    const fileName = `${entity.name || entity.id}.md`.replace(/[/\\:*?"<>|]/g, '_');
    const filePath = path.join(KNOWLEDGE_DIR, subject, fileName);
    
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    
    const frontmatter = this.buildFrontmatter(entity);
    const body = this.buildKnowledgeBody(entity);
    
    const content = `---\n${frontmatter}\n---\n\n${body}`;
    fs.writeFileSync(filePath, content);
  }

  buildFrontmatter(entity) {
    const lines = [];
    lines.push(`id: "${entity.id || entity.name}"`);
    lines.push(`name: "${entity.name}"`);
    lines.push(`subject: "${entity.entity_type || 'general'}"`);
    lines.push(`module: "GRAPHRAG"`);
    lines.push(`tags:`);
    lines.push(`  - ${entity.entity_type || 'entity'}`);
    lines.push(`  - graphrag`);
    
    if (entity.related) {
      lines.push(`related:`);
      for (const rel of entity.related) {
        lines.push(`  - name: "${rel.name}"`);
        lines.push(`    type: "${rel.type}"`);
      }
    }
    
    return lines.join('\n');
  }

  buildKnowledgeBody(entity) {
    let body = `# ${entity.name || '未命名实体'}\n\n`;
    
    if (entity.description) {
      body += `${entity.description}\n\n`;
    }
    
    if (entity.related && entity.related.length > 0) {
      body += `## 关联知识点\n\n`;
      for (const rel of entity.related) {
        body += `- [[${rel.name}]] (${rel.type})\n`;
      }
    }
    
    if (entity.attributes) {
      body += `\n## 属性\n\n`;
      for (const [key, value] of Object.entries(entity.attributes)) {
        body += `- **${key}**: ${value}\n`;
      }
    }
    
    return body;
  }

  async getKnowledgeStats() {
    const files = await this.scanKnowledgeFiles();
    
    const stats = {
      totalFiles: files.length,
      bySubject: {},
      lastModified: 0
    };
    
    for (const file of files) {
      stats.bySubject[file.subject] = (stats.bySubject[file.subject] || 0) + 1;
      if (file.mtime > stats.lastModified) {
        stats.lastModified = file.mtime;
      }
    }
    
    stats.lastModified = new Date(stats.lastModified).toISOString();
    
    return stats;
  }

  async searchKnowledge(query, options = {}) {
    const files = await this.scanKnowledgeFiles();
    const results = [];
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file.path, 'utf8');
        const score = this.calculateSearchScore(content, query);
        
        if (score > 0) {
          const frontmatter = this.extractFrontmatter(content);
          results.push({
            score,
            fileName: file.name,
            subject: file.subject,
            title: frontmatter?.name || file.name.replace('.md', ''),
            preview: content.substring(0, 200),
            path: file.relativePath
          });
        }
      } catch (err) {
        console.error(`搜索文件失败: ${file.path}`, err.message);
      }
    }
    
    return results.sort((a, b) => b.score - a.score).slice(0, options.limit || 10);
  }

  calculateSearchScore(content, query) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    if (queryWords.length === 0) return 0;
    
    const contentLower = content.toLowerCase();
    let score = 0;
    
    for (const word of queryWords) {
      const regex = new RegExp(word, 'g');
      const matches = contentLower.match(regex);
      if (matches) {
        score += matches.length * 10;
      }
    }
    
    const titleMatch = contentLower.match(/^#+\s+(.+)$/m);
    if (titleMatch && titleMatch[1].toLowerCase().includes(query.toLowerCase())) {
      score += 50;
    }
    
    return score;
  }

  startWatching() {
    const watcher = fs.watch(KNOWLEDGE_DIR, { recursive: true }, async (eventType, filename) => {
      if (!filename || !filename.endsWith('.md')) return;
      
      const filePath = path.join(KNOWLEDGE_DIR, filename);
      const mtime = fs.statSync(filePath).mtime.getTime();
      
      if (this.lastSync[filePath] && mtime - this.lastSync[filePath] < 1000) {
        return;
      }
      
      this.lastSync[filePath] = mtime;
      
      console.log(`知识文件变化: ${eventType} ${filename}`);
      
      try {
        await this.syncKnowledgeToGraphRAG();
        console.log('GraphRAG 索引已更新');
      } catch (err) {
        console.error('同步失败:', err.message);
      }
    });
    
    this.watchers.push(watcher);
    console.log('Obsidian 知识文件监控已启动');
    
    return watcher;
  }

  stopWatching() {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    console.log('Obsidian 知识文件监控已停止');
  }
}

export default new ObsidianSyncService();
