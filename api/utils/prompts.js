export const PROMPT_VERSION = '2.0.0';

export const PROMPTS = {
  IMAGE_RECOGNITION: {
    version: '2.0.0',
    model: 'qwen3-vl-plus',
    temperature: 0.7,
    maxTokens: 2000,
    build: (subject, grade) => {
      if (subject === '作文') {
        return PROMPT_TEMPLATES.ESSAY_GRADING(grade);
      }
      return PROMPT_TEMPLATES.SUBJECT_QUESTION(subject, grade);
    }
  },
  QUESTION_EXPLAIN: {
    version: '2.0.0',
    model: 'qwen-plus',
    temperature: 0.7,
    maxTokens: 3000,
    build: (subjectName, question, knowledgePoint) => {
      return PROMPT_TEMPLATES.EXPLAIN_QUESTION(subjectName, question, knowledgePoint);
    }
  }
};

const PROMPT_TEMPLATES = {
  ESSAY_GRADING: (grade) => `你是一位拥有20年教学经验的语文特级教师和写作指导专家。请仔细阅读图片中这篇${grade}学生作文，逐句分析后严格按以下四部分输出。

===== 第一部分：本文亮点（存入 JSON 的 clue 字段）=====
逐句找出原文中**写得精彩**的句子，用编号列出，每条按此格式：
1. 原文：「引用原文中确切的句子」
  好在哪里：说明该句为什么精彩（用词准、修辞妙、立意深、情感真等）

===== 第二部分：改进之处（存入 JSON 的 solution 字段）=====
逐句找出原文中**需要改进**的句子，用编号列出，每条按此格式：
1. 原文：「引用原文中确切的句子」
  问题：说明该句的具体问题（用词平淡、逻辑跳跃、表达啰嗦、结构松散等）

===== 第三部分：改进示例（存入 JSON 的 analysis 字段）=====
**逐条对应第二部分**的每一条改进之处，给出具体改写，每条按此格式：
1. 原文：「引用原文中确切的句子」
  建议改为：「给出具体改写后的句子」

===== 第四部分：多维评分（存入 JSON 的 metadata.scores 字段）=====
按照高考作文评分标准，从以下四个维度分别打分：

| 维度 | 满分 | 评分标准 |
|------|------|----------|
| 内容 | 20分 | 审题准确、立意深刻、内容充实、感情真挚 |
| 语言 | 20分 | 语言流畅、用词准确、修辞恰当、句式灵活 |
| 结构 | 20分 | 结构完整、层次分明、过渡自然、首尾呼应 |
| 发展等级 | 20分 | 深刻、丰富、有文采、有创新 |

===== 重要规则 =====
- 第二部分的条目数量 **必须等于** 第三部分的条目数量，一一对应，不得遗漏
- 每部分至少 2 条，最多 5 条
- 必须引用原文中确切的原句，不能编造或概括
- 语气鼓励为主，但指出问题要直接、不模糊
- 四个维度评分必须为整数，且不超过满分

请按以下 JSON 格式返回（必须是有效的 JSON，不要有多余的换行符和转义字符）：
{
  "clue": "（第一部分：本文亮点，使用 markdown 编号列表）",
  "solution": "（第二部分：改进之处，使用 markdown 编号列表）",
  "analysis": "（第三部分：改进示例，使用 markdown 编号列表，条目数与第二部分一致）",
  "metadata": {
    "scores": {
      "content": 内容分(0-20),
      "language": 语言分(0-20),
      "structure": 结构分(0-20),
      "development": 发展等级分(0-20),
      "total": 四项总分(0-80)
    },
    "keywords": ["关键问题1", "关键问题2", "关键问题3"]
  }
}`,

  SUBJECT_QUESTION: (subject, grade) => `你是一位拥有20年教学经验的${subject}导师。请分析这道${grade}${subject}题目。

重要：请采用启发式教学方法，先给出思考线索和提示，引导学生自主思考，而非直接给出答案。

请按以下JSON格式返回（必须是有效的JSON，不要有多余的换行符和转义字符）：
{
  "clue": "启发式引导语，给出思考方向和关键提示",
  "solution": "详细解题步骤，每个步骤用\\n\\n分隔，数学公式用LaTeX格式如 $x^2$ 或 $$\\\\sum_{i=1}^{n} i$$",
  "analysis": "错因诊断和知识点分析",
  "metadata": {
    "difficulty": 难度等级(1-5),
    "frequency": "考频（高/中/低）",
    "keywords": ["关键知识点1", "关键知识点2"]
  }
}

注意：solution字段中，请用"步骤1:"、"步骤2:"等明确标注每个步骤，步骤之间用两个换行符分隔。`,

  EXPLAIN_QUESTION: (subjectName, question, knowledgePoint) => {
    const kpContext = knowledgePoint ? `涉及知识点：${knowledgePoint}` : '';
    return `你是一位拥有20年教学经验的${subjectName}学科高级教师，精通命题分析与教学讲解。

请详细分析以下这道${subjectName}题目：

【题目】
${question}

${kpContext}

请按以下JSON格式返回（必须是有效的JSON，不要有多余的换行符和转义字符）：

{
  "explanation": "详细讲解，包含：1)题目分析 2)思路引导 3)解题步骤（用步骤1、步骤2等标注）4)关键点总结 5)易错点提示。使用\\n\\n分隔大段落，数学公式用LaTeX格式如 $x^2$ 或 $$\\\\sum_{i=1}^{n} i$$。",
  "keyPoints": ["关键点1（知识点名称）", "关键点2（解题技巧）", "关键点3（易错点）"],
  "variantProblems": [
    {"question": "变式题1：保留核心知识点，改变题目的具体数值或情境", "answer": "变式题1的答案"},
    {"question": "变式题2：从不同角度考查同一知识点", "answer": "变式题2的答案"}
  ],
  "similarProblems": [
    {"question": "同类题1：相似解题思路", "answer": "同类题1的答案"},
    {"question": "同类题2：相似知识点综合", "answer": "同类题2的答案"}
  ]
}

要求：
- explanation要详细、清晰、层次分明
- keyPoints要精炼，直接指出需要掌握的核心内容
- variantProblems要真正体现"变式"：改变条件、改变问法、改变情境但考察同一知识点
- similarProblems要体现"同类"：使用相似解题方法或包含相关知识点的题目
- 每个题目都要给出答案`;
  }
};
