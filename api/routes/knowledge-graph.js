import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../core/auth.js';
import { errorResponse } from '../utils/response.js';
import obsidianSyncService from '../services/obsidian-sync.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

router.get('/stats', async (req, res) => {
  try {
    const stats = await obsidianSyncService.getKnowledgeStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('获取知识统计失败:', err.message);
    res.status(500).json(errorResponse('获取知识统计失败'));
  }
});

router.post('/sync', authMiddleware, async (req, res) => {
  try {
    const result = await obsidianSyncService.syncKnowledgeToGraphRAG();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('同步知识失败:', err.message);
    res.status(500).json(errorResponse('同步知识失败'));
  }
});

router.post('/sync-back', authMiddleware, async (req, res) => {
  try {
    const result = await obsidianSyncService.syncGraphRAGToKnowledgeBase();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('反向同步失败:', err.message);
    res.status(500).json(errorResponse('反向同步失败'));
  }
});

router.get('/search', authMiddleware, async (req, res) => {
  const { query, limit } = req.query;
  
  if (!query || query.trim().length === 0) {
    return res.status(400).json(errorResponse('查询内容不能为空'));
  }
  
  try {
    const results = await obsidianSyncService.searchKnowledge(query.trim(), {
      limit: parseInt(limit) || 10
    });
    res.json({ success: true, data: results });
  } catch (err) {
    console.error('知识搜索失败:', err.message);
    res.status(500).json(errorResponse('知识搜索失败'));
  }
});

router.get('/file', authMiddleware, async (req, res) => {
  const { file_path: filePath } = req.query;
  
  if (!filePath) {
    return res.status(400).json(errorResponse('文件路径不能为空'));
  }
  
  try {
    const fullPath = path.join(
      __dirname,
      '../../database/knowledge-points',
      filePath
    );
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json(errorResponse('文件不存在'));
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const frontmatter = obsidianSyncService.extractFrontmatter(content);
    
    res.json({
      success: true,
      data: {
        content,
        frontmatter,
        path: filePath
      }
    });
  } catch (err) {
    console.error('读取知识文件失败:', err.message);
    res.status(500).json(errorResponse('读取知识文件失败'));
  }
});

router.get('/list', authMiddleware, async (req, res) => {
  const { subject } = req.query;
  
  try {
    const files = await obsidianSyncService.scanKnowledgeFiles();
    
    let filtered = files;
    if (subject) {
      filtered = files.filter(f => f.subject === subject);
    }
    
    const result = filtered.map(f => ({
      name: f.name,
      subject: f.subject,
      path: f.relativePath,
      lastModified: new Date(f.mtime).toISOString()
    }));
    
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('获取文件列表失败:', err.message);
    res.status(500).json(errorResponse('获取文件列表失败'));
  }
});

router.post('/reindex', authMiddleware, async (req, res) => {
  if (req.user?.email !== 'admin@uibe.edu.cn') {
    return res.status(403).json(errorResponse('权限不足'));
  }
  
  try {
    await obsidianSyncService.syncKnowledgeToGraphRAG();
    
    const axios = await import('axios');
    const GRAPHRAG_SERVICE_URL = process.env.GRAPHRAG_SERVICE_URL || 'http://127.0.0.1:8100';
    
    const reindexResponse = await axios.post(
      `${GRAPHRAG_SERVICE_URL}/api/admin/graphrag/reindex`,
      { index_name: 'beijing_gaokao' },
      { timeout: 120000 }
    );
    
    res.json({
      success: true,
      data: {
        sync: 'success',
        reindex: reindexResponse.data
      }
    });
  } catch (err) {
    console.error('重新索引失败:', err.message);
    res.status(500).json(errorResponse('重新索引失败'));
  }
});

export default router;
