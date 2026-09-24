import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../core/db.js';
import { errorResponse } from '../utils/response.js';
import { placeholderToText } from '../services/questionTables.js';
import { parseOptionsAsArray } from '../services/parseOptions.js';
import mammoth from 'mammoth';
import { execSync } from 'child_process';

const SUBJECT_MAP = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理'
};

// ── 中文字体 (B-1) ─────────────────────────────────────────────
// 原实现硬编码 C:/Windows/Fonts/simhei.ttf, Linux 上 fs.readFileSync 必抛 ENOENT
// → 500「生成PDF失败」(无有效信息)。改为随仓库分发字体, 路径按模块位置解析,
// 不依赖 process.cwd(); 缺字体时在 registerFont 前给出明确报错。
// 选用 Noto Sans CJK SC (SIL OFL 1.1, 可再分发 + 可嵌入), 单文件 TTC, 覆盖简中 + 拉丁。
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(moduleDir, '..', '..');
export const CJK_FONT_PATH = path.join(REPO_ROOT, 'assets', 'fonts', 'NotoSansCJK-Regular.ttc');
const CJK_FONT_FACE = 'NotoSansCJKsc-Regular';

const QUESTION_TYPE_MAP = {
  choice: '单选题', multiple_choice: '多选题',
  fill: '填空题', short_answer: '简答题',
  essay: '论述题', calculation: '计算题',
  comprehensive: '综合题'
};

const PROVINCE_MAP = {
  'beijing': '北京高考', 'shanghai': '上海高考', 'tianjin': '天津高考', 'chongqing': '重庆高考',
  'hebei': '河北高考', 'shanxi': '山西高考', 'neimenggu': '内蒙古高考', 'liaoning': '辽宁高考',
  'jilin': '吉林高考', 'heilongjiang': '黑龙江高考', 'jiangsu': '江苏高考', 'zhejiang': '浙江高考',
  'anhui': '安徽高考', 'fujian': '福建高考', 'jiangxi': '江西高考', 'shandong': '山东高考',
  'henan': '河南高考', 'hubei': '湖北高考', 'hunan': '湖南高考', 'guangdong': '广东高考',
  'guangxi': '广西高考', 'hainan': '海南高考', 'sichuan': '四川高考', 'guizhou': '贵州高考',
  'yunnan': '云南高考', 'xizang': '西藏高考', 'shaanxi': '陕西高考', 'gansu': '甘肃高考',
  'qinghai': '青海高考', 'ningxia': '宁夏高考', 'xinjiang': '新疆高考'
};

function getCachePdfPath(docxPath) {
  const dir = path.dirname(docxPath);
  const basename = path.basename(docxPath, path.extname(docxPath));
  return path.join(dir, `.cache.${basename}.pdf`);
}

function convertDocxToPdfWithWord(docxPath) {
  const cachePath = getCachePdfPath(docxPath);

  if (fs.existsSync(cachePath)) {
    return cachePath;
  }

  const psScriptPath = path.join(process.cwd(), 'temp_convert.ps1');
  const psScript = `
$docPath = '${docxPath.replace(/'/g, "''")}'
$pdfPath = '${cachePath.replace(/'/g, "''")}'
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $doc = $word.Documents.Open($docPath)
    $doc.SaveAs([ref]$pdfPath, [ref]17)
    $doc.Close($false)
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
} catch {
    if ($doc) { try { $doc.Close($false) } catch {} }
    if ($word) { try { $word.Quit() } catch {} }
    exit 1
}
`;

  fs.writeFileSync(psScriptPath, '\uFEFF' + psScript.trim(), 'utf8');

  try {
    execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, {
      encoding: 'utf8',
      timeout: 120000
    });
  } finally {
    try {
      fs.unlinkSync(psScriptPath);
    } catch (e) {}
  }

  if (fs.existsSync(cachePath)) {
    return cachePath;
  }

  throw new Error('Word 转换 PDF 失败');
}

export function registerCjkFonts(doc) {
  if (!fs.existsSync(CJK_FONT_PATH)) {
    throw new Error(
      `中文字体缺失: ${CJK_FONT_PATH} 不存在, 无法渲染中文试卷 (请将 NotoSansCJK-Regular.ttc 置于 assets/fonts/)`
    );
  }
  try {
    doc.registerFont('simhei', CJK_FONT_PATH, CJK_FONT_FACE);
    doc.registerFont('simsun', CJK_FONT_PATH, CJK_FONT_FACE);
  } catch (err) {
    throw new Error(`中文字体加载失败: ${err.message} (文件: ${CJK_FONT_PATH})`);
  }
}

async function generateFromDocx(docxPath, paper) {
  try {
    const pdfPath = convertDocxToPdfWithWord(docxPath);
    return fs.readFileSync(pdfPath);
  } catch (wordErr) {
    console.warn('Word 转换失败，降级使用 mammoth:', wordErr.message);
  }

  const subjectName = SUBJECT_MAP[paper.subject] || paper.subject;
  const year = paper.year || '';

  const result = await mammoth.extractRawText({ path: docxPath });
  const text = result.value;

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    bufferPages: true
  });

  registerCjkFonts(doc);

  return new Promise((resolve) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    doc.font('simhei');

    doc.fontSize(18).text(`${year}年普通高等学校招生全国统一考试`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(20).text(`${subjectName}`, { align: 'center' });
    doc.moveDown(1);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    doc.fontSize(11).font('simsun');

    const paragraphs = text.split(/\n{2,}/);
    paragraphs.forEach(para => {
      const trimmed = para.trim();
      if (trimmed) {
        doc.text(trimmed);
        doc.moveDown(0.5);

        if (doc.y > 750) {
          doc.addPage();
        }
      }
    });

    doc.end();
  });
}

async function generateFromDatabase(paper, questions, includeAnswer, includeAnalysis) {
  const subjectName = SUBJECT_MAP[paper.subject] || paper.subject;
  const year = paper.year || '';

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    bufferPages: true
  });

  registerCjkFonts(doc);

  return new Promise((resolve) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    doc.font('simhei');

    doc.fontSize(18).text(`${year}年普通高等学校招生全国统一考试`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(20).text(`${subjectName}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(11).text(`姓名：__________  准考证号：________________  考场：______  座位号：______`, { align: 'center' });
    doc.moveDown(1.5);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    const typeGroups = {};
    questions.forEach(q => {
      if (!typeGroups[q.question_type]) {
        typeGroups[q.question_type] = [];
      }
      typeGroups[q.question_type].push(q);
    });

    const typeOrder = ['choice', 'multiple_choice', 'fill', 'short_answer', 'calculation', 'comprehensive', 'essay'];
    let globalNum = 1;
    let typeIndex = 0;

    typeOrder.forEach(type => {
      if (!typeGroups[type]) return;
      const typeQuestions = typeGroups[type];
      const typeName = QUESTION_TYPE_MAP[type] || type;
      typeIndex++;

      doc.fontSize(13).font('simhei');
      doc.text(`${['一', '二', '三', '四', '五', '六', '七', '八'][typeIndex - 1] || typeIndex}、${typeName}（共${typeQuestions.length}题）`);
      doc.moveDown(0.5);

      typeQuestions.forEach((q) => {
        doc.fontSize(11).font('simsun');
        doc.text(`${globalNum}. ${placeholderToText(q.stem)}`, { indent: 0 });

        const options = parseOptionsAsArray(q.options);
        if (options.length > 0) {
          doc.moveDown(0.3);
          options.forEach(opt => {
            doc.text(opt, { indent: 20 });
          });
        }

        if (includeAnswer === 'true' && q.answer) {
          doc.moveDown(0.3);
          doc.font('simhei').fillColor('#4caf50');
          doc.text(`【答案】${q.answer}`, { indent: 0 });
          doc.fillColor('black').font('simsun');
        }

        if (includeAnalysis === 'true' && q.analysis) {
          doc.moveDown(0.3);
          doc.font('simhei').fillColor('#2196f3');
          doc.text('【解析】', { indent: 0, continued: true });
          doc.fillColor('black').font('simsun');
          doc.text(q.analysis, { indent: 0 });
        }

        doc.moveDown(0.8);
        globalNum++;

        if (doc.y > 750) {
          doc.addPage();
        }
      });

      doc.moveDown(0.5);
    });

    doc.end();
  });
}

export async function generateExamPdf(req, res) {
  const pool = await getDb();
  const { paperId } = req.params;
  const { includeAnswer = 'false', includeAnalysis = 'false' } = req.query;

  const wantAnswerVersion = includeAnswer === 'true' || includeAnalysis === 'true';

  try {
    const paperResult = await pool.query('SELECT * FROM exam_papers WHERE id = $1', [paperId]);
    if (paperResult.rows.length === 0) {
      return res.status(404).json(errorResponse('试卷不存在'));
    }

    const paper = paperResult.rows[0];
    const subjectName = SUBJECT_MAP[paper.subject] || paper.subject;
    const year = paper.year || '';

    let pdfBuffer = null;

    if (paper.paper_file_path) {
      let filePath = paper.paper_file_path.trim();

      if (wantAnswerVersion) {
        filePath = filePath.replace(/原卷版/g, '解析版');
      } else {
        filePath = filePath.replace(/解析版/g, '原卷版');
      }

      // C2-fix: 防路径穿越 — paper_file_path 来自 DB 写入口 (createExamPaper),
      // 拒绝绝对路径与 .. 逃逸; 解析后必须落在允许目录集合 (database/ uploads/) 内.
      // 原实现 baseDirs 含 '.' 且存在 fs.existsSync(filePath) 直读兜底, 等于任意文件读.
      const allowedRoots = [
        path.resolve(process.cwd(), 'database'),
        path.resolve(process.cwd(), 'uploads')
      ];
      const isPathAllowed = (p) =>
        allowedRoots.some((root) => p.startsWith(root + path.sep));

      if (path.isAbsolute(filePath) || filePath.split(/[\\/]+/).includes('..')) {
        return res.status(400).json(errorResponse('非法文件路径'));
      }

      const provinceName = PROVINCE_MAP[paper.province_code] || paper.province_code;

      const baseDirs = [
        path.join('database', '高考真题', provinceName),
        path.join('database', '高考真题'),
        'database',
        'uploads'
      ];

      let foundFilePath = null;
      for (const baseDir of baseDirs) {
        const fullPath = path.resolve(process.cwd(), baseDir, filePath);
        if (isPathAllowed(fullPath) && fs.existsSync(fullPath)) {
          foundFilePath = fullPath;
          break;
        }
      }

      // 兼容「DB 里存了 database/... 或 uploads/... 全相对路径」的历史数据,
      // 但同样强制落在允许目录内 (替代原 fs.existsSync(filePath) 无校验兜底).
      if (!foundFilePath) {
        const directPath = path.resolve(process.cwd(), filePath);
        if (isPathAllowed(directPath) && fs.existsSync(directPath)) {
          foundFilePath = directPath;
        }
      }

      if (foundFilePath) {
        if (foundFilePath.toLowerCase().endsWith('.pdf')) {
          pdfBuffer = fs.readFileSync(foundFilePath);
        } else if (foundFilePath.toLowerCase().endsWith('.docx') || foundFilePath.toLowerCase().endsWith('.doc')) {
          pdfBuffer = await generateFromDocx(foundFilePath, paper);
        }
      }
    }

    if (!pdfBuffer) {
      const questionsResult = await pool.query(
        'SELECT * FROM exam_questions WHERE paper_id = $1 ORDER BY question_number ASC',
        [paperId]
      );
      const questions = questionsResult.rows;

      if (questions.length === 0) {
        return res.status(404).json(errorResponse('试卷没有题目数据'));
      }

      pdfBuffer = await generateFromDatabase(paper, questions, includeAnswer, includeAnalysis);
    }

    const filename = `${year}年${subjectName}试卷.pdf`;
    const encodedFilename = encodeURIComponent(filename);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('生成PDF失败:', error.message);
    res.status(500).json(errorResponse('生成PDF失败'));
  }
}
