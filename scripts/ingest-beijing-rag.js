#!/usr/bin/env node
/**
 * 将北京高考真题Markdown向量化并存入 rag_questions 表
 * 利用项目已有的 pgvector + embedding 方案（方案B）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEmbedding } from '../services/embedding.js';
import { getDb } from '../api/core/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MD_DIR = path.join(__dirname, '..', 'graphrag_workspace', 'converted_markdown');

const SUBJECT_MAP = {
  '语文': 'chinese',
  '数学': 'math',
  '英语': 'english',
  '物理': 'physics',
  '化学': 'chemistry',
  '生物': 'biology',
  '政治': 'politics',
  '历史': 'history',
  '地理': 'geography',
};

function parseFilename(filename) {
  const name = filename.replace('.md', '');
  const parts = name.split('_');
  
  let year = null;
  let subject = null;
  let paperType = '原卷';
  
  for (const part of parts) {
    const yearMatch = part.match(/(\d{4})年/);
    if (yearMatch) year = yearMatch[1];
    
    for (const [cn, en] of Object.entries(SUBJECT_MAP)) {
      if (part.includes(cn)) {
        subject = en;
        break;
      }
    }
    
    if (part.includes('解析') || part.includes('答案')) paperType = '解析';
  }
  
  return { year, subject, paperType, originalName: filename };
}

function chunkText(text, maxChars = 800, overlap = 100) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    
    if (end < text.length) {
      const breakPoints = ['\n\n', '\n', '。', '；', '，'];
      for (const bp of breakPoints) {
        const idx = text.lastIndexOf(bp, end);
        if (idx > start + maxChars * 0.5) {
          end = idx + bp.length;
          break;
        }
      }
    }
    
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    
    if (end >= text.length) break;
  }
  
  return chunks.filter(c => c.length > 50);
}

async function main() {
  const pool = await getDb();
  
  const files = fs.readdirSync(MD_DIR)
    .filter(f => f.includes('北京') && f.includes('高考') && f.endsWith('.md'))
    .sort();
  
  console.log(`找到 ${files.length} 个北京高考文件\n`);
  
  let totalChunks = 0;
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const meta = parseFilename(file);
    
    console.log(`[${i + 1}/${files.length}] ${file}`);
    console.log(`  学科: ${meta.subject || '未知'}, 年份: ${meta.year || '未知'}, 类型: ${meta.paperType}`);
    
    try {
      const content = fs.readFileSync(path.join(MD_DIR, file), 'utf-8');
      const chunks = chunkText(content);
      
      console.log(`  分块数: ${chunks.length}`);
      
      for (let j = 0; j < chunks.length; j++) {
        const chunk = chunks[j];
        
        try {
          const embedding = await getEmbedding(chunk);
          
          await pool.query(
            `INSERT INTO rag_questions 
             (content, embedding, subject_code, metadata)
             VALUES ($1, $2, $3, $4)`,
            [
              chunk,
              `[${embedding.join(',')}]`,
              meta.subject || 'unknown',
              {
                source_file: file,
                year: meta.year,
                paper_type: meta.paperType,
                chunk_index: j,
                chunk_total: chunks.length,
                province: '北京',
                exam_type: 'gaokao',
              }
            ]
          );
          
          successCount++;
          totalChunks++;
          
          if ((j + 1) % 10 === 0) {
            process.stdout.write(`  进度: ${j + 1}/${chunks.length}\r`);
          }
          
          await new Promise(r => setTimeout(r, 200));
          
        } catch (err) {
          failCount++;
          console.log(`  块 ${j} 失败: ${err.message}`);
        }
      }
      
      console.log(`  ✅ 完成 (成功 ${chunks.length} 块)`);
      
    } catch (err) {
      console.log(`  ❌ 失败: ${err.message}`);
    }
    
    console.log('');
  }
  
  console.log('='.repeat(60));
  console.log('索引完成!');
  console.log(`  总文件: ${files.length}`);
  console.log(`  总块数: ${totalChunks}`);
  console.log(`  成功: ${successCount}`);
  console.log(`  失败: ${failCount}`);
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
