/**
 * services/subject-parser.js — 学科专用字段解析器
 *
 * 将题目文本解析为学科专用结构化数据：
 *   1. 数学：公式语义、函数类型、参数讨论
 *   2. 物理：对象、过程、受力、规律、变量
 *   3. 化学：物质、反应、条件、现象、装置、方程式
 *
 * 架构边界：纯解析服务，不操作数据库
 */

import { chatCompletion, safeParseLLMJson } from './llm.js';

const PHYSICS_SYSTEM_PROMPT = `你是一位专业的高中物理教师，擅长分析物理题目的结构化信息。

请分析以下物理题目，并输出严格的结构化 JSON：

物理结构化字段说明：
- objects: 研究对象列表（如：小球、斜面、弹簧、滑块）
- processes: 物理过程列表（如：匀速运动、自由落体、碰撞）
- forces: 受力列表（如：重力、支持力、摩擦力、弹力）
- laws: 涉及的物理规律（如：牛顿第二定律、动能定理、动量守恒）
- variables: 关键变量（如：m, v, t, g）
- diagrams: 图表描述（如有图）
- experiment: 实验相关信息（如：实验目的、仪器、步骤）

输出格式：
{
  "objects": ["小球", "斜面"],
  "processes": ["自由落体运动"],
  "forces": ["重力", "支持力", "摩擦力"],
  "laws": ["牛顿第二定律", "运动学公式"],
  "variables": ["m", "h", "t", "g"],
  "diagrams": "包含一个倾角为θ的斜面和位于顶端的小球",
  "experiment": null,
  "semantic_summary": "题目描述了一个小球在斜面上的运动问题"
}`;

const CHEMISTRY_SYSTEM_PROMPT = `你是一位专业的高中化学教师，擅长分析化学题目的结构化信息。

请分析以下化学题目，并输出严格的结构化 JSON：

化学结构化字段说明：
- reactants: 反应物列表（如：H2O2, Fe）
- products: 生成物列表（如：H2O, O2）
- catalysts: 催化剂列表（如：MnO2）
- reaction_type: 反应类型（如：分解反应、化合反应、置换反应）
- phenomena: 实验现象（如：产生气泡、溶液变色）
- conditions: 反应条件（如：加热、催化剂、点燃）
- apparatus: 实验装置（如：试管、酒精灯、分液漏斗）
- equations: 化学方程式（LaTeX格式）
- knowledge_points: 涉及知识点

输出格式：
{
  "reactants": ["H2O2"],
  "products": ["H2O", "O2"],
  "catalysts": ["MnO2"],
  "reaction_type": "分解反应",
  "phenomena": ["产生大量气泡"],
  "conditions": ["MnO2催化"],
  "apparatus": ["锥形瓶", "分液漏斗", "导管"],
  "equations": ["$2H_2O_2 \\xrightarrow{MnO_2} 2H_2O + O_2 \\uparrow$"],
  "knowledge_points": ["氧气制备", "催化剂", "分解反应"],
  "semantic_summary": "题目涉及过氧化氢在二氧化锰催化下分解制取氧气"
}`;

const MATH_SYSTEM_PROMPT = `你是一位专业的高中数学教师，擅长分析数学题目的结构化信息。

请分析以下数学题目，并输出严格的结构化 JSON：

数学结构化字段说明：
- function_types: 函数类型（如：二次函数、指数函数、三角函数）
- formulas: 关键公式（LaTeX格式）
- formula_semantics: 公式语义描述
- parameters: 参数列表（如：a, b, k）
- problem_type: 问题类型（如：求单调区间、求极值、证明不等式）
- techniques: 解题技巧（如：分类讨论、构造函数、数学归纳法）
- coordinate_system: 是否涉及坐标系
- geometric_elements: 几何元素（如：直线、圆、三角形）
- knowledge_points: 涉及知识点

输出格式：
{
  "function_types": ["三次函数"],
  "formulas": ["$f(x)=x^3-3ax^2+2$", "$f'(x)=3x^2-6ax$"],
  "formula_semantics": ["函数的一阶导数为二次函数，通过求导函数零点研究原函数单调性"],
  "parameters": ["a"],
  "problem_type": "求单调区间与极值点",
  "techniques": ["分类讨论", "导数应用"],
  "coordinate_system": true,
  "geometric_elements": ["函数图像"],
  "knowledge_points": ["导数", "函数单调性", "极值", "参数讨论"],
  "semantic_summary": "题目研究含参数的三次函数的单调性和极值问题"
}`;

const IMAGE_SEMANTIC_PROMPT = `你是一位专业的学科图像分析专家。请分析以下图像描述，生成详细的语义描述。

输入：图像描述文本
输出：详细的语义描述，包括：
1. 图像内容概述
2. 关键元素识别
3. 图像与题目的关系
4. 辅助理解的信息

请用自然语言描述，不要使用JSON格式。`;

const FORMULA_SEMANTIC_PROMPT = `你是一位专业的公式语义分析专家。请分析以下公式，生成语义描述。

输入：公式文本（LaTeX格式）
输出：详细的语义描述，包括：
1. 公式类型
2. 公式含义
3. 公式在题目中的作用
4. 涉及的数学/物理/化学概念

请用自然语言描述，不要使用JSON格式。`;

export async function parsePhysicsStructure(questionText) {
  try {
    const result = await chatCompletion(
      PHYSICS_SYSTEM_PROMPT,
      `请分析以下物理题目：\n\n${questionText}`,
      { model: 'qwen3.7-plus', temperature: 0.2, max_tokens: 2000 }
    );
    return safeParseLLMJson(result.content);
  } catch {
    return {
      objects: [],
      processes: [],
      forces: [],
      laws: [],
      variables: [],
      diagrams: null,
      experiment: null,
      semantic_summary: ''
    };
  }
}

export async function parseChemistryStructure(questionText) {
  try {
    const result = await chatCompletion(
      CHEMISTRY_SYSTEM_PROMPT,
      `请分析以下化学题目：\n\n${questionText}`,
      { model: 'qwen3.7-plus', temperature: 0.2, max_tokens: 2000 }
    );
    return safeParseLLMJson(result.content);
  } catch {
    return {
      reactants: [],
      products: [],
      catalysts: [],
      reaction_type: null,
      phenomena: [],
      conditions: [],
      apparatus: [],
      equations: [],
      knowledge_points: [],
      semantic_summary: ''
    };
  }
}

export async function parseMathStructure(questionText) {
  try {
    const result = await chatCompletion(
      MATH_SYSTEM_PROMPT,
      `请分析以下数学题目：\n\n${questionText}`,
      { model: 'qwen3.7-plus', temperature: 0.2, max_tokens: 2000 }
    );
    return safeParseLLMJson(result.content);
  } catch {
    return {
      function_types: [],
      formulas: [],
      formula_semantics: [],
      parameters: [],
      problem_type: null,
      techniques: [],
      coordinate_system: false,
      geometric_elements: [],
      knowledge_points: [],
      semantic_summary: ''
    };
  }
}

export async function generateImageSemantics(imageDescription) {
  if (!imageDescription) return '';
  try {
    const result = await chatCompletion(
      IMAGE_SEMANTIC_PROMPT,
      imageDescription,
      { model: 'qwen3.7-plus', temperature: 0.3, max_tokens: 1000, jsonMode: false }
    );
    return result.content.trim();
  } catch {
    return imageDescription;
  }
}

export async function generateFormulaSemantics(formula) {
  if (!formula) return '';
  try {
    const result = await chatCompletion(
      FORMULA_SEMANTIC_PROMPT,
      formula,
      { model: 'qwen3.7-plus', temperature: 0.3, max_tokens: 500, jsonMode: false }
    );
    return result.content.trim();
  } catch {
    return '';
  }
}

export async function generateSemanticDescription(questionText, subject) {
  const prompts = {
    math: '请用简洁的语言描述这道数学题的核心内容和考察意图。',
    physics: '请用简洁的语言描述这道物理题的核心内容和考察意图。',
    chemistry: '请用简洁的语言描述这道化学题的核心内容和考察意图。',
    biology: '请用简洁的语言描述这道生物题的核心内容和考察意图。',
    chinese: '请用简洁的语言描述这道语文题的核心内容和考察意图。',
    english: '请用简洁的语言描述这道英语题的核心内容和考察意图。',
    history: '请用简洁的语言描述这道历史题的核心内容和考察意图。',
    geography: '请用简洁的语言描述这道地理题的核心内容和考察意图。',
    politics: '请用简洁的语言描述这道政治题的核心内容和考察意图。'
  };

  const prompt = prompts[subject] || '请用简洁的语言描述这道题的核心内容和考察意图。';

  try {
    const result = await chatCompletion(
      '你是一位专业的学科教师，擅长用简洁的语言总结题目。',
      `${prompt}\n\n题目：${questionText}`,
      { model: 'qwen3.7-plus', temperature: 0.3, max_tokens: 500, jsonMode: false }
    );
    return result.content.trim();
  } catch {
    return '';
  }
}

export async function generateSolutionDescription(questionText, answer, analysis, subject) {
  const prompts = {
    math: '请总结这道数学题的解题方法和关键步骤。',
    physics: '请总结这道物理题的解题方法和关键步骤。',
    chemistry: '请总结这道化学题的解题方法和关键步骤。',
    biology: '请总结这道生物题的解题方法和关键步骤。',
    chinese: '请总结这道语文题的解题方法和关键步骤。',
    english: '请总结这道英语题的解题方法和关键步骤。',
    history: '请总结这道历史题的解题方法和关键步骤。',
    geography: '请总结这道地理题的解题方法和关键步骤。',
    politics: '请总结这道政治题的解题方法和关键步骤。'
  };

  const prompt = prompts[subject] || '请总结这道题的解题方法和关键步骤。';

  try {
    const result = await chatCompletion(
      '你是一位专业的学科教师，擅长总结解题方法。',
      `${prompt}\n\n题目：${questionText}\n\n答案：${answer || '暂无'}\n\n解析：${analysis || '暂无'}`,
      { model: 'qwen3.7-plus', temperature: 0.3, max_tokens: 800, jsonMode: false }
    );
    return result.content.trim();
  } catch {
    return '';
  }
}

export function buildQText(question) {
  const parts = [];
  if (question.stem) parts.push(question.stem);
  if (question.options) {
    try {
      const opts = JSON.parse(question.options);
      if (Array.isArray(opts)) {
        parts.push(opts.join('\n'));
      }
    } catch {}
  }
  return parts.join('\n\n').trim();
}

export function buildSText(question) {
  const parts = [];
  if (question.semantic_description) {
    parts.push(question.semantic_description);
  }
  if (question.image_descriptions) {
    parts.push(`图片描述：${question.image_descriptions}`);
  }
  if (question.formula_semantics) {
    parts.push(`公式语义：${question.formula_semantics}`);
  }
  return parts.join('\n\n').trim();
}

export function buildKText(question) {
  const parts = [];
  if (question.knowledge_points) {
    try {
      const kps = JSON.parse(question.knowledge_points);
      if (Array.isArray(kps)) {
        parts.push('知识点：' + kps.join('、'));
      }
    } catch {
      parts.push('知识点：' + question.knowledge_points);
    }
  }
  if (question.subject_code) {
    const subjectNames = {
      math: '数学', physics: '物理', chemistry: '化学', biology: '生物',
      chinese: '语文', english: '英语', history: '历史', geography: '地理', politics: '政治'
    };
    parts.push(`学科：${subjectNames[question.subject_code] || question.subject_code}`);
  }
  if (question.question_type) {
    const typeNames = {
      choice: '选择题', fill: '填空题', solve: '解答题', calculation: '计算题',
      proof: '证明题', experiment: '实验题', essay: '作文题'
    };
    parts.push(`题型：${typeNames[question.question_type] || question.question_type}`);
  }
  if (question.difficulty) {
    parts.push(`难度：${question.difficulty}`);
  }
  return parts.join('\n').trim();
}

export function buildAText(question) {
  const parts = [];
  if (question.solution_description) {
    parts.push(question.solution_description);
  } else if (question.analysis) {
    parts.push(`解题方法：${question.analysis}`);
  }
  if (question.answer) {
    parts.push(`答案：${question.answer}`);
  }
  return parts.join('\n\n').trim();
}