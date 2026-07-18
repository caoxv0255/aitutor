import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { env } from 'process';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

const { Pool } = pg;

const SUBJECT_MAP = {
  chinese: '语文',
  math: '数学',
  english: '英语',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  history: '历史',
  geography: '地理',
  politics: '政治'
};

const EXPORT_DIR = path.join(ROOT, 'database', 'parsed-examples');
const BACKUP_DIR = path.join(ROOT, 'database', 'backups');
const VALIDATION_DIR = path.join(ROOT, 'database', 'validation');

const REQUIRED_FIELDS = ['question_number', 'question_type', 'stem'];
const IMPORTANT_FIELDS = ['answer', 'analysis', 'knowledge_points'];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function safeJsonStringify(obj, replacer = null, space = 2) {
  const seen = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value.replace(/[\x00-\x1F\x7F]/g, '');
    }
    if (typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }
    return replacer ? replacer(key, value) : value;
  }, space);
}

function generateChecksum(data) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
}

class StorageService {
  constructor() {
    this.pool = null;
    this.initPool();
  }

  initPool() {
    const dbUrl = env.DATABASE_URL || 'postgresql://postgres:cxclementine102365@localhost:5432/aitutor';
    const url = new URL(dbUrl);
    
    this.pool = new Pool({
      host: url.hostname,
      port: parseInt(url.port || '5432'),
      user: url.username,
      password: url.password,
      database: url.pathname.substring(1),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000
    });
  }

  async connect() {
    if (!this.pool) {
      this.initPool();
    }
    await this.pool.query('SELECT 1');
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async exportToJSON(subject, year, options = {}) {
    const { includePaperInfo = true, includeVectors = false, prettyPrint = true } = options;
    
    ensureDir(EXPORT_DIR);
    
    const filePath = path.join(EXPORT_DIR, `${subject}_${year}.json`);
    
    try {
      let questions = [];
      
      const query = `
        SELECT eq.*, ep.province_code, ep.year as paper_year, ep.subject as paper_subject,
               ep.exam_level, ep.paper_file_path, ep.question_count as paper_question_count
        FROM exam_questions eq
        LEFT JOIN exam_papers ep ON eq.paper_id = ep.id
        WHERE eq.subject_code = $1 AND eq.year = $2
        ORDER BY eq.question_number
      `;
      
      const result = await this.pool.query(query, [subject, year]);
      questions = result.rows;
      
      if (includeVectors) {
        const vectorQuery = `
          SELECT * FROM question_vectors WHERE subject_code = $1 AND year = $2
        `;
        const vectorResult = await this.pool.query(vectorQuery, [subject, year]);
        const vectors = vectorResult.rows;
        
        questions = questions.map(q => {
          const vector = vectors.find(v => v.question_id === q.id);
          return { ...q, vectors: vector || null };
        });
      }
      
      const output = {
        metadata: {
          subject,
          subject_name: SUBJECT_MAP[subject] || subject,
          year,
          export_time: new Date().toISOString(),
          question_count: questions.length,
          checksum: generateChecksum(questions)
        },
        paper_info: includePaperInfo ? {
          province_code: questions[0]?.province_code || '',
          exam_level: questions[0]?.exam_level || '',
          paper_file_path: questions[0]?.paper_file_path || '',
          paper_question_count: questions[0]?.paper_question_count || 0
        } : null,
        questions: questions.map(q => this.sanitizeQuestionForExport(q))
      };
      
      const jsonStr = safeJsonStringify(output, null, prettyPrint ? 2 : 0);
      
      const tempFile = filePath + '.tmp';
      fs.writeFileSync(tempFile, jsonStr, 'utf-8');
      
      if (fs.existsSync(filePath)) {
        const backupFile = filePath + '.bak';
        fs.copyFileSync(filePath, backupFile);
      }
      
      fs.renameSync(tempFile, filePath);
      
      return {
        success: true,
        filePath,
        questionCount: questions.length,
        exportedAt: new Date().toISOString(),
        checksum: output.metadata.checksum
      };
    } catch (e) {
      console.error(`❌ 导出失败 [${subject}_${year}]: ${e.message}`);
      return {
        success: false,
        error: e.message
      };
    }
  }

  async exportAll(subjects = null, years = null, options = {}) {
    const targetSubjects = subjects || Object.keys(SUBJECT_MAP);
    const targetYears = years || [2021, 2022, 2023, 2024, 2025];
    
    const results = [];
    
    for (const subject of targetSubjects) {
      for (const year of targetYears) {
        console.log(`📤 导出: ${SUBJECT_MAP[subject]} ${year}年`);
        const result = await this.exportToJSON(subject, year, options);
        
        if (result.success) {
          console.log(`   ✅ 成功导出 ${result.questionCount} 道题目 -> ${result.filePath}`);
        } else {
          console.log(`   ❌ 导出失败: ${result.error}`);
        }
        
        results.push({ subject, year, ...result });
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    return results;
  }

  async importFromJSON(filePath, options = {}) {
    const { overwrite = true, validate = true } = options;
    
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      let data;
      
      try {
        data = JSON.parse(content);
      } catch (parseError) {
        throw new Error(`JSON解析失败: ${parseError.message}`);
      }
      
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error('无效的JSON格式：缺少questions数组');
      }
      
      if (validate) {
        const validation = this.validateData(data);
        if (!validation.valid) {
          console.warn(`⚠️ 数据校验警告:`);
          validation.warnings.forEach(w => console.warn(`   - ${w}`));
        }
      }
      
      const { subject, year } = data.metadata || {};
      
      if (!subject || !year) {
        const filename = path.basename(filePath, '.json');
        const match = filename.match(/^(\w+)_(\d{4})$/);
        if (match) {
          subject = match[1];
          year = parseInt(match[2]);
        } else {
          throw new Error('无法从文件名或元数据中提取subject和year');
        }
      }
      
      let paperId = null;
      const paperQuery = `
        SELECT id FROM exam_papers 
        WHERE province_code = $1 AND year = $2 AND subject = $3 AND exam_level = $4
      `;
      
      const paperResult = await this.pool.query(paperQuery, ['beijing', year, subject, 'gaokao']);
      
      if (paperResult.rows.length > 0) {
        paperId = paperResult.rows[0].id;
        
        if (overwrite) {
          await this.pool.query('DELETE FROM exam_questions WHERE paper_id = $1', [paperId]);
          console.log(`   🗑️ 已删除试卷 ${paperId} 的旧题目记录`);
        }
      } else {
        const insertResult = await this.pool.query(`
          INSERT INTO exam_papers (province_code, year, subject, exam_level, question_count)
          VALUES ($1, $2, $3, $4, 0) RETURNING id
        `, ['beijing', year, subject, 'gaokao']);
        paperId = insertResult.rows[0].id;
        console.log(`   📄 创建新试卷记录: ${paperId}`);
      }
      
      let insertedCount = 0;
      let skippedCount = 0;
      
      for (const q of data.questions) {
        try {
          const questionUid = this.generateQuestionUID(subject, year, 'beijing', q.question_number);
          
          const sanitized = this.sanitizeQuestionForImport(q);
          
          await this.pool.query(`
            INSERT INTO exam_questions (
              question_uid, paper_id, question_number, question_type, stem, options,
              answer, analysis, knowledge_points, difficulty, score,
              subject_code, province_code, year, has_image, has_formula,
              image_descriptions, latex_formulas, formula_semantics,
              semantic_description, solution_description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          `, [
            questionUid, paperId, sanitized.question_number, sanitized.question_type,
            sanitized.stem, sanitized.options, sanitized.answer, sanitized.analysis,
            sanitized.knowledge_points, sanitized.difficulty, sanitized.score,
            subject, 'beijing', year, sanitized.has_image, sanitized.has_formula,
            sanitized.image_descriptions, sanitized.latex_formulas, sanitized.formula_semantics,
            sanitized.semantic_description, sanitized.solution_description
          ]);
          
          insertedCount++;
        } catch (e) {
          if (e.message.includes('unique constraint')) {
            skippedCount++;
          } else {
            console.warn(`   ⚠️ 第${q.question_number}题导入失败: ${e.message}`);
          }
        }
      }
      
      await this.pool.query('UPDATE exam_papers SET question_count = $1 WHERE id = $2', [insertedCount, paperId]);
      
      return {
        success: true,
        subject,
        year,
        insertedCount,
        skippedCount,
        paperId
      };
    } catch (e) {
      console.error(`❌ 导入失败 [${filePath}]: ${e.message}`);
      return {
        success: false,
        error: e.message
      };
    }
  }

  async validateDatabase(options = {}) {
    const { checkSubjects = null, checkYears = null } = options;
    
    ensureDir(VALIDATION_DIR);
    
    const validationReport = {
      generated_at: new Date().toISOString(),
      total_papers: 0,
      total_questions: 0,
      papers: [],
      issues: [],
      summary: {}
    };
    
    const subjects = checkSubjects || Object.keys(SUBJECT_MAP);
    const years = checkYears || [2021, 2022, 2023, 2024, 2025];
    
    for (const subject of subjects) {
      validationReport.summary[subject] = {
        total_papers: 0,
        total_questions: 0,
        avg_difficulty: 0,
        answer_completeness: 0,
        analysis_completeness: 0,
        issues: []
      };
      
      let totalQuestionsForSubject = 0;
      let totalAnswers = 0;
      let totalAnalyses = 0;
      let totalDifficulty = 0;
      
      for (const year of years) {
        const paperQuery = `
          SELECT * FROM exam_papers 
          WHERE province_code = $1 AND year = $2 AND subject = $3 AND exam_level = $4
        `;
        
        const paperResult = await this.pool.query(paperQuery, ['beijing', year, subject, 'gaokao']);
        
        if (paperResult.rows.length === 0) {
          validationReport.issues.push({
            level: 'warning',
            message: `缺少试卷记录: ${SUBJECT_MAP[subject]} ${year}年`
          });
          validationReport.summary[subject].issues.push(`缺少试卷记录`);
          continue;
        }
        
        const paper = paperResult.rows[0];
        validationReport.total_papers++;
        validationReport.summary[subject].total_papers++;
        
        const questionQuery = `
          SELECT * FROM exam_questions WHERE paper_id = $1 ORDER BY question_number
        `;
        
        const questionResult = await this.pool.query(questionQuery, [paper.id]);
        const questions = questionResult.rows;
        
        validationReport.total_questions += questions.length;
        validationReport.summary[subject].total_questions += questions.length;
        totalQuestionsForSubject += questions.length;
        
        const paperValidation = {
          subject,
          subject_name: SUBJECT_MAP[subject],
          year,
          paper_id: paper.id,
          question_count: questions.length,
          paper_question_count: paper.question_count,
          mismatched_count: questions.length !== paper.question_count,
          issues: []
        };
        
        let paperAnswers = 0;
        let paperAnalyses = 0;
        let paperDifficultySum = 0;
        let difficultyCount = 0;
        
        for (const q of questions) {
          for (const field of REQUIRED_FIELDS) {
            if (!q[field] || (typeof q[field] === 'string' && q[field].trim() === '')) {
              paperValidation.issues.push(`第${q.question_number}题缺少必填字段: ${field}`);
            }
          }
          
          if (q.answer && q.answer.trim() !== '') {
            paperAnswers++;
            totalAnswers++;
          }
          
          if (q.analysis && q.analysis.trim() !== '') {
            paperAnalyses++;
            totalAnalyses++;
          }
          
          if (q.difficulty && q.difficulty >= 1 && q.difficulty <= 5) {
            paperDifficultySum += q.difficulty;
            difficultyCount++;
            totalDifficulty += q.difficulty;
          }
        }
        
        paperValidation.answer_completeness = questions.length > 0 
          ? ((paperAnswers / questions.length) * 100).toFixed(1) 
          : 'N/A';
        paperValidation.analysis_completeness = questions.length > 0 
          ? ((paperAnalyses / questions.length) * 100).toFixed(1) 
          : 'N/A';
        paperValidation.avg_difficulty = difficultyCount > 0 
          ? (paperDifficultySum / difficultyCount).toFixed(2) 
          : 'N/A';
        
        if (paperValidation.mismatched_count) {
          paperValidation.issues.push(`题目数量不匹配：数据库${questions.length}题 vs 试卷记录${paper.question_count}题`);
        }
        
        if (questions.length === 0) {
          paperValidation.issues.push('试卷无题目记录');
        }
        
        validationReport.papers.push(paperValidation);
      }
      
      validationReport.summary[subject].answer_completeness = totalQuestionsForSubject > 0 
        ? ((totalAnswers / totalQuestionsForSubject) * 100).toFixed(1) 
        : 'N/A';
      validationReport.summary[subject].analysis_completeness = totalQuestionsForSubject > 0 
        ? ((totalAnalyses / totalQuestionsForSubject) * 100).toFixed(1) 
        : 'N/A';
      validationReport.summary[subject].avg_difficulty = validationReport.summary[subject].total_questions > 0 
        ? (totalDifficulty / validationReport.summary[subject].total_questions).toFixed(2) 
        : 'N/A';
    }
    
    validationReport.valid = validationReport.issues.every(i => i.level !== 'error');
    
    const reportPath = path.join(VALIDATION_DIR, `validation_report_${Date.now()}.json`);
    fs.writeFileSync(reportPath, safeJsonStringify(validationReport, null, 2), 'utf-8');
    
    return {
      ...validationReport,
      reportPath
    };
  }

  async createBackup(options = {}) {
    const { includeData = true, includeSchema = false, description = '' } = options;
    
    ensureDir(BACKUP_DIR);
    
    const backupId = `${Date.now()}`;
    const backupDir = path.join(BACKUP_DIR, backupId);
    fs.mkdirSync(backupDir, { recursive: true });
    
    const backupInfo = {
      id: backupId,
      created_at: new Date().toISOString(),
      description,
      files: [],
      stats: {}
    };
    
    if (includeData) {
      console.log(`📦 创建数据备份...`);
      const results = await this.exportAll();
      
      for (const result of results) {
        if (result.success) {
          const backupFilePath = path.join(backupDir, path.basename(result.filePath));
          fs.copyFileSync(result.filePath, backupFilePath);
          backupInfo.files.push({
            name: path.basename(result.filePath),
            question_count: result.questionCount,
            checksum: result.checksum
          });
        }
      }
      
      backupInfo.stats.total_files = backupInfo.files.length;
      backupInfo.stats.total_questions = backupInfo.files.reduce((sum, f) => sum + f.question_count, 0);
    }
    
    if (includeSchema) {
      console.log(`📄 创建表结构备份...`);
      const schemaTables = ['exam_papers', 'exam_questions', 'question_vectors', 'subjects', 'provinces'];
      
      for (const table of schemaTables) {
        try {
          const result = await this.pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = $1
          `, [table]);
          
          const schemaFilePath = path.join(backupDir, `${table}_schema.json`);
          fs.writeFileSync(schemaFilePath, safeJsonStringify(result.rows, null, 2), 'utf-8');
          backupInfo.files.push({ name: `${table}_schema.json`, type: 'schema' });
        } catch (e) {
          console.warn(`   ⚠️ 备份表结构失败 [${table}]: ${e.message}`);
        }
      }
    }
    
    const infoFilePath = path.join(backupDir, 'backup_info.json');
    fs.writeFileSync(infoFilePath, safeJsonStringify(backupInfo, null, 2), 'utf-8');
    
    console.log(`✅ 备份完成: ${backupDir}`);
    
    return {
      success: true,
      backupId,
      backupDir,
      ...backupInfo
    };
  }

  async restoreBackup(backupId, options = {}) {
    const { overwrite = false } = options;
    
    const backupDir = path.join(BACKUP_DIR, backupId);
    
    if (!fs.existsSync(backupDir)) {
      throw new Error(`备份不存在: ${backupDir}`);
    }
    
    const infoFilePath = path.join(backupDir, 'backup_info.json');
    if (!fs.existsSync(infoFilePath)) {
      throw new Error(`备份信息文件不存在: ${infoFilePath}`);
    }
    
    const backupInfo = JSON.parse(fs.readFileSync(infoFilePath, 'utf-8'));
    
    const results = [];
    
    for (const file of backupInfo.files) {
      if (file.type === 'schema') continue;
      
      const filePath = path.join(backupDir, file.name);
      
      if (!fs.existsSync(filePath)) {
        console.warn(`   ⚠️ 文件不存在: ${file.name}`);
        continue;
      }
      
      console.log(`📥 恢复: ${file.name}`);
      const result = await this.importFromJSON(filePath, { overwrite });
      results.push({ file: file.name, ...result });
    }
    
    return {
      success: true,
      backupId,
      restoredFiles: results.length,
      results
    };
  }

  async getStorageStats() {
    const stats = {
      database: {
        total_papers: 0,
        total_questions: 0,
        questions_by_subject: {},
        questions_by_year: {},
        questions_by_type: {}
      },
      filesystem: {
        export_files: 0,
        backup_count: 0,
        total_export_size: 0
      }
    };
    
    const paperResult = await this.pool.query(`SELECT COUNT(*) as count FROM exam_papers WHERE exam_level = 'gaokao'`);
    stats.database.total_papers = parseInt(paperResult.rows[0].count);
    
    const questionResult = await this.pool.query(`SELECT COUNT(*) as count FROM exam_questions`);
    stats.database.total_questions = parseInt(questionResult.rows[0].count);
    
    const subjectResult = await this.pool.query(`
      SELECT subject_code, COUNT(*) as count 
      FROM exam_questions 
      GROUP BY subject_code 
      ORDER BY count DESC
    `);
    subjectResult.rows.forEach(r => {
      stats.database.questions_by_subject[r.subject_code] = parseInt(r.count);
    });
    
    const yearResult = await this.pool.query(`
      SELECT year, COUNT(*) as count 
      FROM exam_questions 
      WHERE year IS NOT NULL
      GROUP BY year 
      ORDER BY year DESC
    `);
    yearResult.rows.forEach(r => {
      stats.database.questions_by_year[r.year] = parseInt(r.count);
    });
    
    const typeResult = await this.pool.query(`
      SELECT question_type, COUNT(*) as count 
      FROM exam_questions 
      GROUP BY question_type 
      ORDER BY count DESC
    `);
    typeResult.rows.forEach(r => {
      stats.database.questions_by_type[r.question_type] = parseInt(r.count);
    });
    
    if (fs.existsSync(EXPORT_DIR)) {
      const exportFiles = fs.readdirSync(EXPORT_DIR).filter(f => f.endsWith('.json'));
      stats.filesystem.export_files = exportFiles.length;
      
      let totalSize = 0;
      exportFiles.forEach(f => {
        const filePath = path.join(EXPORT_DIR, f);
        totalSize += fs.statSync(filePath).size;
      });
      stats.filesystem.total_export_size = totalSize;
    }
    
    if (fs.existsSync(BACKUP_DIR)) {
      const backupDirs = fs.readdirSync(BACKUP_DIR).filter(f => fs.statSync(path.join(BACKUP_DIR, f)).isDirectory());
      stats.filesystem.backup_count = backupDirs.length;
    }
    
    return stats;
  }

  sanitizeQuestionForExport(question) {
    return {
      id: question.id,
      question_uid: question.question_uid,
      question_number: question.question_number,
      question_type: question.question_type,
      stem: question.stem,
      options: this.parseJSONField(question.options),
      answer: question.answer,
      analysis: question.analysis,
      knowledge_points: this.parseJSONField(question.knowledge_points),
      difficulty: question.difficulty,
      score: question.score,
      ability_tags: this.parseJSONField(question.ability_tags),
      has_image: question.has_image || false,
      has_formula: question.has_formula || false,
      image_descriptions: question.image_descriptions,
      latex_formulas: question.latex_formulas,
      formula_semantics: question.formula_semantics,
      semantic_description: question.semantic_description,
      solution_description: question.solution_description,
      physics_structure: question.physics_structure || {},
      chemistry_structure: question.chemistry_structure || {},
      math_structure: question.math_structure || {},
      created_at: question.created_at,
      updated_at: question.updated_at
    };
  }

  sanitizeQuestionForImport(question) {
    return {
      question_number: question.question_number || 0,
      question_type: question.question_type || 'solve',
      stem: question.stem || '',
      options: this.serializeJSONField(question.options),
      answer: question.answer || '',
      analysis: question.analysis || '',
      knowledge_points: this.serializeJSONField(question.knowledge_points),
      difficulty: question.difficulty || 3,
      score: question.score || 0,
      has_image: question.has_image || false,
      has_formula: question.has_formula || false,
      image_descriptions: question.image_descriptions || null,
      latex_formulas: question.latex_formulas || null,
      formula_semantics: question.formula_semantics || null,
      semantic_description: question.semantic_description || null,
      solution_description: question.solution_description || null
    };
  }

  parseJSONField(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  serializeJSONField(value) {
    if (!value) return null;
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  generateQuestionUID(subject, year, province, number) {
    return `${subject}_${year}_${province}_${String(number).padStart(3, '0')}`;
  }

  validateData(data) {
    const warnings = [];
    
    if (!data.metadata) {
      warnings.push('缺少metadata字段');
    }
    
    if (!data.questions || !Array.isArray(data.questions)) {
      warnings.push('缺少questions数组或格式错误');
      return { valid: false, warnings };
    }
    
    if (data.questions.length === 0) {
      warnings.push('questions数组为空');
    }
    
    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];
      
      for (const field of REQUIRED_FIELDS) {
        if (!q[field] || (typeof q[field] === 'string' && q[field].trim() === '')) {
          warnings.push(`第${i + 1}题缺少必填字段: ${field}`);
        }
      }
      
      if (q.difficulty && (q.difficulty < 1 || q.difficulty > 5)) {
        warnings.push(`第${i + 1}题难度值无效: ${q.difficulty}（应为1-5）`);
      }
    }
    
    return {
      valid: warnings.length === 0,
      warnings,
      question_count: data.questions.length
    };
  }
}

export default StorageService;

export async function main() {
  const service = new StorageService();
  
  await service.connect();
  console.log('✅ 数据库连接成功');
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 当前存储状态');
  console.log('='.repeat(60));
  
  const stats = await service.getStorageStats();
  console.log(JSON.stringify(stats, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('📤 导出所有数据到JSON文件');
  console.log('='.repeat(60));
  
  await service.exportAll();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 数据验证');
  console.log('='.repeat(60));
  
  const validation = await service.validateDatabase();
  console.log(`\n验证结果: ${validation.valid ? '✅ 通过' : '❌ 存在问题'}`);
  
  if (validation.issues.length > 0) {
    console.log('\n发现的问题:');
    validation.issues.forEach((issue, idx) => {
      console.log(`${idx + 1}. [${issue.level}] ${issue.message}`);
    });
  }
  
  console.log(`\n验证报告已保存: ${validation.reportPath}`);
  
  await service.disconnect();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}