#!/usr/bin/env node
/**
 * 北京高考真题重新解析脚本
 * 用于重新解析近5年（2021-2025）北京高考真题，按学科和题型生成结构化示例
 * 
 * 输出格式：
 * {
 *   "metadata": {...},
 *   "subjects": [
 *     {
 *       "subject_code": "math",
 *       "subject_name": "数学",
 *       "question_types": [
 *         {
 *           "type_code": "choice",
 *           "type_name": "选择题",
 *           "count": 45,
 *           "examples": [
 *             {
 *               "question_number": 1,
 *               "year": 2025,
 *               "stem": "...",
 *               "options": [...],
 *               "knowledge_points": [...],
 *               "solution_approach": "...",
 *               "answer": "...",
 *               "scoring_criteria": "...",
 *               "difficulty": 3
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

import { getDb } from '../api/core/db.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'database', 'parsed-examples', 'beijing');

const SUBJECT_MAP = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理',
};

const QUESTION_TYPE_MAP = {
  choice: '选择题', multi_choice: '多选题', fill: '填空题',
  solve: '解答题', essay: '作文题', reading: '阅读理解',
  cloze: '完形填空', grammar_fill: '语法填空',
  translation: '翻译题', listening: '听力题',
  seven_choose_five: '七选五', continuation: '读后续写',
  experiment: '实验题', comprehensive: '综合题',
};

const YEAR_RANGE = [2021, 2022, 2023, 2024, 2025];
const PROVINCE_CODE = 'beijing';

async function queryQuestionsBySubjectAndType() {
  const pool = await getDb();
  
  const result = await pool.query(`
    SELECT 
      eq.id, eq.question_number, eq.question_type, eq.stem, eq.options,
      eq.answer, eq.analysis, eq.knowledge_points, eq.difficulty, eq.score,
      eq.year, eq.subject_code, eq.province_code, eq.latex_formulas,
      eq.semantic_description, eq.solution_description, eq.has_image,
      eq.image_descriptions, eq.physics_structure, eq.chemistry_structure,
      eq.math_structure, eq.formula_semantics,
      eq.paper_id, ep.total_score
    FROM exam_questions eq
    JOIN exam_papers ep ON eq.paper_id = ep.id
    WHERE eq.province_code = $1 
      AND eq.year BETWEEN $2 AND $3
      AND ep.exam_level = 'gaokao'
    ORDER BY eq.subject_code, eq.question_type, eq.year, eq.question_number
  `, [PROVINCE_CODE, YEAR_RANGE[0], YEAR_RANGE[YEAR_RANGE.length - 1]]);

  return result.rows;
}

function parseJsonField(value) {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function generateScoringCriteria(question) {
  const { question_type, score } = question;
  
  const baseCriteria = {
    choice: {
      description: '每道选择题按标准答案评分',
      rules: [
        { condition: '选对正确答案', points: score, description: '得满分' },
        { condition: '选错或未选', points: 0, description: '不得分' },
      ]
    },
    multi_choice: {
      description: '多选题按标准答案评分',
      rules: [
        { condition: '全部选对', points: score, description: '得满分' },
        { condition: '部分选对', points: Math.round(score / 2), description: '得一半分数' },
        { condition: '选错或未选', points: 0, description: '不得分' },
      ]
    },
    fill: {
      description: '填空题按标准答案评分',
      rules: [
        { condition: '答案完全正确', points: score, description: '得满分' },
        { condition: '答案部分正确', points: Math.round(score / 2), description: '得一半分数' },
        { condition: '答案错误或未填', points: 0, description: '不得分' },
      ]
    },
    solve: {
      description: '解答题按步骤给分',
      rules: [
        { condition: '解题思路正确，步骤完整，答案正确', points: score, description: '得满分' },
        { condition: '解题思路正确，关键步骤完整，但计算错误', points: Math.round(score * 0.7), description: '得70%分数' },
        { condition: '解题思路正确，但步骤不完整', points: Math.round(score * 0.5), description: '得50%分数' },
        { condition: '解题思路错误', points: 0, description: '不得分' },
      ]
    },
    essay: {
      description: '作文评分标准',
      rules: [
        { condition: '符合题意，中心明确，结构完整，语言流畅', points: score, description: '一类文' },
        { condition: '符合题意，中心较明确，结构较完整，语言较流畅', points: Math.round(score * 0.8), description: '二类文' },
        { condition: '基本符合题意，中心基本明确，结构尚完整', points: Math.round(score * 0.6), description: '三类文' },
        { condition: '偏离题意，中心不明确，结构不完整', points: Math.round(score * 0.4), description: '四类文' },
      ]
    },
    reading: {
      description: '阅读理解题评分标准',
      rules: [
        { condition: '答案完全正确，分析到位', points: score, description: '得满分' },
        { condition: '答案基本正确，有一定分析', points: Math.round(score * 0.8), description: '得80%分数' },
        { condition: '答案部分正确', points: Math.round(score * 0.5), description: '得50%分数' },
        { condition: '答案错误', points: 0, description: '不得分' },
      ]
    },
    cloze: {
      description: '完形填空评分标准',
      rules: [
        { condition: '选对正确答案', points: score, description: '得满分' },
        { condition: '选错或未选', points: 0, description: '不得分' },
      ]
    },
    grammar_fill: {
      description: '语法填空评分标准',
      rules: [
        { condition: '语法正确，用词恰当', points: score, description: '得满分' },
        { condition: '语法基本正确', points: Math.round(score * 0.5), description: '得一半分数' },
        { condition: '语法错误或未填', points: 0, description: '不得分' },
      ]
    },
    translation: {
      description: '翻译题评分标准',
      rules: [
        { condition: '译文准确完整，语言通顺', points: score, description: '得满分' },
        { condition: '译文基本准确', points: Math.round(score * 0.8), description: '得80%分数' },
        { condition: '译文部分准确', points: Math.round(score * 0.5), description: '得50%分数' },
        { condition: '译文错误', points: 0, description: '不得分' },
      ]
    },
    experiment: {
      description: '实验题评分标准',
      rules: [
        { condition: '实验原理正确，步骤完整，结论正确', points: score, description: '得满分' },
        { condition: '实验原理正确，步骤基本完整', points: Math.round(score * 0.7), description: '得70%分数' },
        { condition: '实验原理基本正确', points: Math.round(score * 0.5), description: '得50%分数' },
        { condition: '实验原理错误', points: 0, description: '不得分' },
      ]
    },
    comprehensive: {
      description: '综合题评分标准',
      rules: [
        { condition: '综合运用知识正确，分析全面，结论正确', points: score, description: '得满分' },
        { condition: '综合运用知识基本正确，分析较全面', points: Math.round(score * 0.7), description: '得70%分数' },
        { condition: '综合运用知识有缺陷', points: Math.round(score * 0.4), description: '得40%分数' },
        { condition: '知识运用错误', points: 0, description: '不得分' },
      ]
    },
  };

  return baseCriteria[question_type] || baseCriteria.solve;
}

function generateSolutionApproach(question) {
  const { analysis, solution_description, question_type, subject_code } = question;
  
  if (solution_description) {
    return solution_description;
  }
  
  if (analysis) {
    return analysis;
  }
  
  const defaultApproaches = {
    math: {
      choice: '仔细阅读题目，分析已知条件，运用相关数学公式和定理进行计算，逐一排除错误选项。',
      fill: '根据题目条件，运用相应的数学知识和方法进行推导计算，注意单位和符号。',
      solve: '第一步分析题目条件，确定解题思路；第二步列出相关公式和定理；第三步逐步推导计算；第四步检查验证结果。',
    },
    chinese: {
      reading: '通读全文，理解主旨大意；根据问题定位相关段落；分析文章结构和写作手法；结合上下文推断答案。',
      essay: '审题立意，确定中心论点；构思文章结构；选取恰当论据；组织语言表达；检查修改润色。',
    },
    english: {
      reading: '快速浏览全文，把握主旨；根据题干定位信息；分析选项，排除干扰项；结合语境推断词义。',
      cloze: '通读全文，理解大意；根据上下文和语法知识选择合适词汇；注意固定搭配和逻辑关系。',
      grammar_fill: '分析句子结构，确定所缺成分；根据语法规则和上下文选择正确形式；注意时态、语态和词性变化。',
    },
    physics: {
      choice: '分析物理过程，确定研究对象；运用物理公式进行计算；注意单位换算和方向判断。',
      solve: '确定研究对象和物理过程；画出受力分析图；列出物理方程；求解并验证结果。',
      experiment: '理解实验原理；分析实验步骤；处理实验数据；得出实验结论。',
    },
    chemistry: {
      choice: '分析化学反应原理；运用化学方程式进行计算；注意物质的量和浓度关系。',
      solve: '写出相关化学方程式；计算物质的量；根据守恒定律求解；验证结果合理性。',
    },
    biology: {
      choice: '理解生物学概念；分析生命活动规律；结合图表信息进行判断。',
      solve: '分析生物过程；运用生物学原理进行推理；结合实验数据得出结论。',
    },
    history: {
      choice: '理解历史事件背景；分析历史人物和事件的关系；结合历史发展规律进行判断。',
      solve: '分析历史背景；阐述历史事件经过；评价历史意义和影响。',
    },
    politics: {
      choice: '理解政治概念；分析政治现象；运用政治原理进行判断。',
      solve: '分析材料内容；运用政治理论进行阐述；结合实际提出对策建议。',
    },
    geography: {
      choice: '分析地理图表；运用地理原理进行判断；注意时空分布规律。',
      solve: '分析地理现象；运用地理原理进行解释；结合图表数据进行论证。',
    },
  };

  return defaultApproaches[subject_code]?.[question_type] || 
         defaultApproaches[subject_code]?.solve ||
         '根据题目要求，运用相关知识进行分析解答。';
}

function buildStructuredExample(question) {
  const options = parseJsonField(question.options);
  const knowledge_points = parseJsonField(question.knowledge_points);
  const latex_formulas = parseJsonField(question.latex_formulas);
  
  return {
    question_id: question.id,
    question_number: question.question_number,
    year: question.year,
    question_type: question.question_type,
    question_type_name: QUESTION_TYPE_MAP[question.question_type] || question.question_type,
    subject_code: question.subject_code,
    subject_name: SUBJECT_MAP[question.subject_code] || question.subject_code,
    stem: question.stem,
    options: options.length > 0 ? options : null,
    knowledge_points: knowledge_points.length > 0 ? knowledge_points : [],
    knowledge_points_detail: knowledge_points.map(kp => ({
      name: kp,
      relevance: 'high',
    })),
    difficulty: question.difficulty,
    difficulty_level: question.difficulty ? ['', '简单', '较易', '中等', '较难', '困难'][question.difficulty] : '未知',
    score: question.score,
    solution_approach: generateSolutionApproach(question),
    answer: question.answer,
    analysis: question.analysis,
    scoring_criteria: generateScoringCriteria(question),
    has_image: question.has_image || false,
    image_description: question.image_descriptions || null,
    has_formula: (latex_formulas && latex_formulas.length > 0) || false,
    latex_formulas: latex_formulas.length > 0 ? latex_formulas : [],
    semantic_description: question.semantic_description || null,
    formula_semantics: question.formula_semantics || null,
    physics_structure: question.physics_structure ? (typeof question.physics_structure === 'object' ? question.physics_structure : JSON.parse(question.physics_structure)) : null,
    chemistry_structure: question.chemistry_structure ? (typeof question.chemistry_structure === 'object' ? question.chemistry_structure : JSON.parse(question.chemistry_structure)) : null,
    math_structure: question.math_structure ? (typeof question.math_structure === 'object' ? question.math_structure : JSON.parse(question.math_structure)) : null,
    source: {
      province: PROVINCE_CODE,
      province_name: '北京',
      year: question.year,
      exam_level: '高考',
      paper_id: question.paper_id,
    },
  };
}

async function generateStructuredOutput() {
  console.log('📋 北京高考真题重新解析脚本');
  console.log('='.repeat(60));
  console.log(`📍 解析范围：${PROVINCE_CODE} ${YEAR_RANGE[0]}-${YEAR_RANGE[YEAR_RANGE.length - 1]}`);
  console.log('');

  const questions = await queryQuestionsBySubjectAndType();
  console.log(`📊 查询到题目总数：${questions.length} 道`);

  const subjectGroups = {};
  
  for (const question of questions) {
    const { subject_code, question_type } = question;
    
    if (!subjectGroups[subject_code]) {
      subjectGroups[subject_code] = {
        subject_code,
        subject_name: SUBJECT_MAP[subject_code] || subject_code,
        question_types: {},
        total_questions: 0,
      };
    }
    
    if (!subjectGroups[subject_code].question_types[question_type]) {
      subjectGroups[subject_code].question_types[question_type] = {
        type_code: question_type,
        type_name: QUESTION_TYPE_MAP[question_type] || question_type,
        questions: [],
        examples: [],
      };
    }
    
    subjectGroups[subject_code].question_types[question_type].questions.push(question);
    subjectGroups[subject_code].total_questions++;
  }

  const output = {
    metadata: {
      province_code: PROVINCE_CODE,
      province_name: '北京',
      year_range: `${YEAR_RANGE[0]}-${YEAR_RANGE[YEAR_RANGE.length - 1]}`,
      exam_level: '高考',
      generated_at: new Date().toISOString(),
      total_subjects: Object.keys(subjectGroups).length,
      total_question_types: 0,
      total_questions: questions.length,
    },
    subjects: [],
  };

  for (const [subjectCode, subjectData] of Object.entries(subjectGroups)) {
    const subjectOutput = {
      subject_code: subjectData.subject_code,
      subject_name: subjectData.subject_name,
      total_questions: subjectData.total_questions,
      question_types: [],
    };

    for (const [typeCode, typeData] of Object.entries(subjectData.question_types)) {
      const typeOutput = {
        type_code: typeData.type_code,
        type_name: typeData.type_name,
        count: typeData.questions.length,
        examples: [],
      };

      const sampledQuestions = typeData.questions.slice(0, 3);
      for (const q of sampledQuestions) {
        typeOutput.examples.push(buildStructuredExample(q));
      }

      subjectOutput.question_types.push(typeOutput);
      output.metadata.total_question_types++;
    }

    subjectOutput.question_types.sort((a, b) => a.count > b.count ? -1 : 1);
    output.subjects.push(subjectOutput);
  }

  output.subjects.sort((a, b) => a.total_questions > b.total_questions ? -1 : 1);

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = join(OUTPUT_DIR, `beijing-gaokao-${YEAR_RANGE[0]}-${YEAR_RANGE[YEAR_RANGE.length - 1]}-structured.json`);
  
  writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`💾 结构化数据已保存至：${outputFile}`);

  const summaryFile = join(OUTPUT_DIR, `beijing-gaokao-${YEAR_RANGE[0]}-${YEAR_RANGE[YEAR_RANGE.length - 1]}-summary.txt`);
  let summary = `北京高考真题解析报告 (${YEAR_RANGE[0]}-${YEAR_RANGE[YEAR_RANGE.length - 1]})\n`;
  summary += '='.repeat(60) + '\n\n';
  summary += `总题目数：${questions.length}\n`;
  summary += `涉及学科：${output.metadata.total_subjects} 个\n`;
  summary += `涉及题型：${output.metadata.total_question_types} 种\n\n`;
  summary += '学科分布：\n';
  for (const subject of output.subjects) {
    summary += `  • ${subject.subject_name}：${subject.total_questions} 题\n`;
    for (const type of subject.question_types) {
      summary += `    └─ ${type.type_name}：${type.count} 题（示例数：${type.examples.length}）\n`;
    }
  }
  
  writeFileSync(summaryFile, summary, 'utf-8');
  console.log(`📊 解析报告已保存至：${summaryFile}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ 解析完成！');
  console.log('');

  const pool = await getDb();
  await pool.end();
  
  return output;
}

generateStructuredOutput().catch(err => {
  console.error('❌ 解析失败:', err.message);
  process.exit(1);
});