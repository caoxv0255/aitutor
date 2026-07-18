/**
 * 多模态题目工具函数
 * 
 * 设计理念：一道题 = 一个多模态知识对象
 * 
 * 文件存储结构：
 * questions/
 *   └── [学科]_[年份]_[地区]_[题号]/
 *       ├── question.md（完整题目信息和结构化内容）
 *       ├── original.png（原始题目截图）
 *       ├── [图片资源文件，如figure_01.png]
 *       ├── metadata.json（题目元数据）
 *       └── embedding.txt（专门用于向量检索的优化文本）
 */
import { existsSync, writeFileSync, readFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');
export const QUESTIONS_DIR = join(ROOT, 'database', 'questions');

const PROVINCE_CN = {
  beijing: '北京', shanghai: '上海', tianjin: '天津', chongqing: '重庆',
  hebei: '河北', henan: '河南', shandong: '山东', jiangsu: '江苏',
  zhejiang: '浙江', fujian: '福建', guangdong: '广东', hubei: '湖北',
  hunan: '湖南', anhui: '安徽', jiangxi: '江西', sichuan: '四川',
  shaanxi: '陕西', guizhou: '贵州', yunnan: '云南', xinjiang: '新疆',
  xizang: '西藏', neimenggu: '内蒙古', ningxia: '宁夏', qinghai: '青海',
  gansu: '甘肃', heilongjiang: '黑龙江', jilin: '吉林', shanxi: '山西',
  liaoning: '辽宁', hainan: '海南', guangxi: '广西'
};

export const SUBJECT_CN = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理'
};

export const QUESTION_TYPE_CN = {
  choice: '选择题', fill: '填空题', solve: '解答题',
  judge: '判断题', short: '简答题', essay: '作文题',
  reading: '阅读理解', cloze: '完形填空', translation: '翻译题'
};

export function generateQuestionUID(subjectCode, year, provinceCode, questionNo) {
  const parts = [subjectCode, year, provinceCode, questionNo];
  return parts.join('_').toLowerCase();
}

export function generateQuestionDir(subjectCode, year, provinceCode, questionNo) {
  const dirName = `${subjectCode}_${year}_${provinceCode}_${questionNo}`;
  return join(QUESTIONS_DIR, subjectCode, dirName);
}

export function generateQuestionFileName(subjectCode, year, provinceCode, questionNo) {
  return `${subjectCode}_${year}_${provinceCode}_${questionNo}.md`;
}

export function buildQuestionMD(questionData) {
  const {
    question_id, subject, year, region, question_no,
    question_type, difficulty, knowledge_points,
    content, images, image_descriptions,
    answer, analysis, common_mistakes, related_knowledge
  } = questionData;

  const lines = [];

  lines.push('---');
  lines.push(`question_id: ${question_id}`);
  lines.push(`subject: ${subject}`);
  lines.push(`year: ${year}`);
  lines.push(`region: ${region}`);
  lines.push(`question_no: ${question_no}`);
  lines.push(`question_type: ${question_type}`);
  lines.push(`difficulty: ${difficulty || 3}`);
  if (knowledge_points && knowledge_points.length > 0) {
    lines.push(`knowledge_points: ${JSON.stringify(knowledge_points)}`);
  }
  lines.push('---');
  lines.push('');

  lines.push('## 题目内容');
  lines.push('');
  lines.push(content || '');
  lines.push('');

  if (images && images.length > 0) {
    lines.push('## 图片资源');
    lines.push('');
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      lines.push(`![${img.description || `图${i + 1}`}](${img.path})`);
      if (image_descriptions && image_descriptions[i]) {
        lines.push('');
        lines.push(`### 图${i + 1} 语义描述`);
        lines.push('');
        lines.push(image_descriptions[i]);
        lines.push('');
      }
    }
  }

  if (answer) {
    lines.push('## 标准答案');
    lines.push('');
    lines.push(answer);
    lines.push('');
  }

  if (analysis) {
    lines.push('## 详细解析');
    lines.push('');
    lines.push(analysis);
    lines.push('');
  }

  if (common_mistakes) {
    lines.push('## 易错点');
    lines.push('');
    lines.push(common_mistakes);
    lines.push('');
  }

  if (related_knowledge) {
    lines.push('## 相关知识点');
    lines.push('');
    lines.push(related_knowledge);
    lines.push('');
  }

  return lines.join('\n');
}

export function buildMetadataJSON(questionData) {
  const metadata = {
    question_id: questionData.question_id,
    subject: questionData.subject,
    subject_cn: SUBJECT_CN[questionData.subject] || questionData.subject,
    year: questionData.year,
    region: questionData.region,
    region_cn: PROVINCE_CN[questionData.region] || questionData.region,
    question_no: questionData.question_no,
    question_type: questionData.question_type,
    question_type_cn: QUESTION_TYPE_CN[questionData.question_type] || questionData.question_type,
    difficulty: questionData.difficulty || 3,
    score: questionData.score || 0,
    knowledge_points: questionData.knowledge_points || [],
    has_image: !!(questionData.images && questionData.images.length > 0),
    has_formula: questionData.has_formula || false,
    source_info: questionData.source_info || {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  return JSON.stringify(metadata, null, 2);
}

export function buildEmbeddingText(questionData) {
  const parts = [];

  if (questionData.knowledge_points && questionData.knowledge_points.length > 0) {
    parts.push(`核心知识点: ${questionData.knowledge_points.join('、')}`);
  }

  parts.push(`题目类型: ${QUESTION_TYPE_CN[questionData.question_type] || questionData.question_type}`);

  if (questionData.subject) {
    parts.push(`学科: ${SUBJECT_CN[questionData.subject] || questionData.subject}`);
  }

  if (questionData.difficulty) {
    const difficultyLevels = ['', '简单', '较易', '中等', '较难', '困难'];
    parts.push(`难度: ${difficultyLevels[questionData.difficulty] || questionData.difficulty}`);
  }

  if (questionData.solving_methods) {
    parts.push(`解题方法: ${questionData.solving_methods.join('、')}`);
  }

  if (questionData.image_descriptions && questionData.image_descriptions.length > 0) {
    parts.push(`图像内容描述: ${questionData.image_descriptions.join('；')}`);
  }

  if (questionData.concepts) {
    parts.push(`涉及概念: ${questionData.concepts.join('、')}`);
  }

  if (questionData.typical_category) {
    parts.push(`典型题型分类: ${questionData.typical_category}`);
  }

  if (questionData.key_features) {
    parts.push(`题目特征: ${questionData.key_features}`);
  }

  return parts.join('。');
}

export async function saveQuestion(questionData) {
  const { subject, year, region, question_no } = questionData;
  
  const questionDir = generateQuestionDir(subject, year, region, question_no);
  if (!existsSync(questionDir)) {
    mkdirSync(questionDir, { recursive: true });
  }

  const mdContent = buildQuestionMD(questionData);
  writeFileSync(join(questionDir, 'question.md'), mdContent, 'utf-8');

  const metadataContent = buildMetadataJSON(questionData);
  writeFileSync(join(questionDir, 'metadata.json'), metadataContent, 'utf-8');

  const embeddingContent = buildEmbeddingText(questionData);
  writeFileSync(join(questionDir, 'embedding.txt'), embeddingContent, 'utf-8');

  if (questionData.original_image && questionData.original_image.path) {
    writeFileSync(join(questionDir, 'original.png'), questionData.original_image.data);
  }

  if (questionData.images && questionData.images.length > 0) {
    for (let i = 0; i < questionData.images.length; i++) {
      const img = questionData.images[i];
      const ext = img.path.split('.').pop() || 'png';
      const imgName = `figure_${String(i + 1).padStart(2, '0')}.${ext}`;
      writeFileSync(join(questionDir, imgName), img.data);
    }
  }

  return {
    question_dir: questionDir,
    files_created: ['question.md', 'metadata.json', 'embedding.txt'],
    total_files: questionData.images ? questionData.images.length + 3 : 3
  };
}

export function loadQuestion(subject, year, region, question_no) {
  const questionDir = generateQuestionDir(subject, year, region, question_no);
  
  if (!existsSync(questionDir)) {
    return null;
  }

  const mdPath = join(questionDir, 'question.md');
  const metadataPath = join(questionDir, 'metadata.json');
  const embeddingPath = join(questionDir, 'embedding.txt');
  const originalPath = join(questionDir, 'original.png');

  const question = {};

  if (existsSync(mdPath)) {
    question.md_content = readFileSync(mdPath, 'utf-8');
  }

  if (existsSync(metadataPath)) {
    question.metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
  }

  if (existsSync(embeddingPath)) {
    question.embedding_text = readFileSync(embeddingPath, 'utf-8');
  }

  if (existsSync(originalPath)) {
    question.original_image = readFileSync(originalPath);
  }

  const figureFiles = [];
  const files = readdirSync(questionDir);
  for (const file of files) {
    if (file.startsWith('figure_') && (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))) {
      figureFiles.push({
        name: file,
        path: join(questionDir, file),
        data: readFileSync(join(questionDir, file))
      });
    }
  }
  if (figureFiles.length > 0) {
    question.figures = figureFiles;
  }

  return question;
}

export function parseQuestionMD(mdContent) {
  const lines = mdContent.split('\n');
  const metadata = {};
  let content = [];
  let inMetadata = false;
  let section = '';
  const sections = {};

  for (const line of lines) {
    if (line === '---') {
      inMetadata = !inMetadata;
      continue;
    }

    if (inMetadata) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        metadata[match[1]] = match[2].trim();
      }
      continue;
    }

    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      sections[section] = [];
      continue;
    }

    if (section) {
      sections[section].push(line);
    } else {
      content.push(line);
    }
  }

  return {
    metadata,
    sections,
    raw_content: content.join('\n').trim()
  };
}

export const SUBJECT_FEATURES = {
  math: {
    structure_fields: ['math_structure'],
    formula_types: ['algebra', 'geometry', 'calculus', 'probability'],
    typical_categories: ['函数与导数', '三角函数', '数列', '立体几何', '解析几何', '概率统计'],
    knowledge_dimensions: ['概念理解', '公式应用', '逻辑推理', '计算能力', '空间想象'],
    assessment_criteria: ['准确性', '规范性', '逻辑性', '创新性'],
    resource_types: ['公式表', '例题解析', '习题集', '专题讲义'],
    progress_metrics: ['concept_mastery', 'calculation_accuracy', 'problem_solving_speed'],
    question_types: ['choice', 'fill', 'solve', 'proof', 'calculation']
  },
  physics: {
    structure_fields: ['physics_structure'],
    formula_types: ['mechanics', 'electromagnetism', 'thermodynamics', 'optics'],
    typical_categories: ['力学综合', '电磁感应', '电路分析', '实验题'],
    knowledge_dimensions: ['概念理解', '公式应用', '实验设计', '数据分析', '物理建模'],
    assessment_criteria: ['准确性', '规范性', '实验设计', '数据分析'],
    resource_types: ['公式表', '实验视频', '例题解析', '电路图库'],
    progress_metrics: ['concept_mastery', 'experimental_design_score', 'data_analysis_score'],
    question_types: ['choice', 'fill', 'solve', 'experiment', 'calculation']
  },
  chemistry: {
    structure_fields: ['chemistry_structure'],
    formula_types: ['organic', 'inorganic', 'reaction'],
    typical_categories: ['化学反应原理', '有机化学', '化学实验', '工艺流程'],
    knowledge_dimensions: ['概念理解', '方程式书写', '实验操作', '物质推断', '化学计算'],
    assessment_criteria: ['准确性', '规范性', '实验操作', '推理能力'],
    resource_types: ['方程式表', '实验视频', '物质性质表', '工艺流程'],
    progress_metrics: ['concept_mastery', 'equation_writing_score', 'experimental_skill_score'],
    question_types: ['choice', 'fill', 'solve', 'experiment', 'calculation']
  },
  biology: {
    structure_fields: [],
    formula_types: ['genetics', 'biochemistry'],
    typical_categories: ['细胞生物学', '遗传学', '生态学', '代谢', '生命调节'],
    knowledge_dimensions: ['概念理解', '结构识别', '过程分析', '遗传计算', '生态建模'],
    assessment_criteria: ['准确性', '概念理解', '实验设计', '遗传分析'],
    resource_types: ['结构图', '实验视频', '遗传图谱', '生态模型'],
    progress_metrics: ['concept_mastery', 'experimental_design_score', 'genetic_calculation_score', 'diagram_analysis_score'],
    question_types: ['choice', 'fill', 'solve', 'experiment', 'short_answer']
  },
  chinese: {
    structure_fields: [],
    formula_types: [],
    typical_categories: ['现代文阅读', '古诗文阅读', '作文', '文言文翻译', '名句默写'],
    knowledge_dimensions: ['阅读理解', '文言文翻译', '写作能力', '文学鉴赏', '名句积累'],
    assessment_criteria: ['理解深度', '表达流畅', '翻译准确', '写作质量'],
    resource_types: ['课文', '诗词', '作文范文', '阅读理解材料', '音频朗读'],
    progress_metrics: ['text_memorization', 'translation_accuracy', 'comprehension_score', 'essay_score_avg'],
    question_types: ['reading', 'choice', 'fill', 'short_answer', 'essay', 'translation']
  },
  english: {
    structure_fields: [],
    formula_types: [],
    typical_categories: ['阅读理解', '完形填空', '语法填空', '写作', '听力', '语法'],
    knowledge_dimensions: ['词汇掌握', '语法应用', '阅读理解', '写作能力', '听力理解'],
    assessment_criteria: ['准确性', '流利度', '连贯性', '任务完成'],
    resource_types: ['单词表', '语法讲解', '阅读材料', '听力材料', '写作范文'],
    progress_metrics: ['vocabulary_mastery', 'grammar_accuracy', 'reading_speed_wpm', 'writing_score_avg', 'listening_comprehension'],
    question_types: ['reading', 'cloze', 'grammar_fill', 'choice', 'writing', 'translation', 'listening']
  },
  politics: {
    structure_fields: [],
    formula_types: [],
    typical_categories: ['经济生活', '政治生活', '文化生活', '哲学', '时政分析'],
    knowledge_dimensions: ['概念理解', '原理应用', '政策分析', '哲学思辨', '时政评论'],
    assessment_criteria: ['准确性', '理论深度', '论证能力', '时政联系'],
    resource_types: ['政策文件', '时政新闻', '哲学原著', '案例分析', '理论讲义'],
    progress_metrics: ['concept_mastery', 'principle_application_score', 'policy_analysis_score', 'argumentation_score'],
    question_types: ['choice', 'fill', 'short_answer', 'essay', 'analysis']
  },
  history: {
    structure_fields: [],
    formula_types: [],
    typical_categories: ['中国古代史', '中国近现代史', '世界史', '史料分析', '历史论证'],
    knowledge_dimensions: ['时序分析', '因果关系', '史料解读', '历史论证', '人物评价'],
    assessment_criteria: ['准确性', '时序清晰', '论证充分', '史料运用'],
    resource_types: ['历史地图', '史料原文', '人物传记', '时间线', '事件分析'],
    progress_metrics: ['timeline_mastery', 'event_analysis_score', 'source_analysis_score', 'causal_reasoning_score'],
    question_types: ['choice', 'fill', 'short_answer', 'essay', 'analysis']
  },
  geography: {
    structure_fields: [],
    formula_types: [],
    typical_categories: ['自然地理', '人文地理', '区域地理', '地图判读', '地理计算'],
    knowledge_dimensions: ['地图判读', '空间定位', '地理原理', '区域分析', '数据解读'],
    assessment_criteria: ['准确性', '空间思维', '数据分析', '区域理解'],
    resource_types: ['地图', '图表', '遥感影像', '地理数据', '区域案例'],
    progress_metrics: ['map_interpretation_score', 'spatial_location_score', 'data_analysis_score', 'regional_analysis_score'],
    question_types: ['choice', 'fill', 'solve', 'short_answer', 'analysis']
  }
};

export function getSubjectFeatures(subjectCode) {
  return SUBJECT_FEATURES[subjectCode] || {};
}
