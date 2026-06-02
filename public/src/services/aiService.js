import { MODEL_CONFIG } from '../config/modelConfig.js';

/**
 * AI适配器 - 统一的AI服务接口
 * 支持随时切换模型，前端无需修改
 */
class AIAdapter {
  constructor() {
    this.config = MODEL_CONFIG;
  }

  /** 获取认证请求头 */
  getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  /**
   * 请求题目解答
   */
  async requestSolution(imageBase64, subject, grade) {
    const isEssay = subject === '作文';
    const prompt = isEssay
      ? `你是一位拥有20年教学经验的语文特级教师和写作指导专家。请仔细阅读图片中这篇${grade}学生作文，逐句分析后严格按以下三部分输出。

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

===== 重要规则 =====
- 第二部分的条目数量 **必须等于** 第三部分的条目数量，一一对应，不得遗漏
- 每部分至少 2 条，最多 5 条
- 必须引用原文中确切的原句，不能编造或概括
- 语气鼓励为主，但指出问题要直接、不模糊

请按以下 JSON 格式返回（必须是有效的 JSON，不要有多余换行符和转义字符）：
{
  "clue": "（第一部分：本文亮点，使用 markdown 编号列表）",
  "solution": "（第二部分：改进之处，使用 markdown 编号列表）",
  "analysis": "（第三部分：改进示例，使用 markdown 编号列表，条目数与第二部分一致）",
  "metadata": {
    "keywords": ["关键问题1", "关键问题2", "关键问题3"]
  }
}`
      : `你是一位拥有20年教学经验的${subject}导师。请分析这道${grade}${subject}题目。

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

注意：solution字段中，请用"步骤1:"、"步骤2:"等明确标注每个步骤，步骤之间用两个换行符分隔。`;

    try {
      const response = await fetch(this.config.baseURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          model: this.config.currentModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
              ]
            }
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens
        })
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const data = await response.json();

      // 打印 token 消耗信息
      if (data.usage) {
        console.log('📊 Token 消耗:', {
          输入: data.usage.prompt_tokens,
          输出: data.usage.completion_tokens,
          总计: data.usage.total_tokens
        });
      }

      const content = data.choices[0].message.content;
      return this.parseResponse(content);
    } catch (error) {
      console.error('AI请求错误:', error);
      throw error;
    }
  }

  /**
   * 生成学科报告
   */
  async generateReport(subject, grade, questionSummaries) {
    const prompt = `你是一位资深教育分析专家。请根据以下学生的${subject}错题数据，生成一份详细的学科分析报告，并构建知识图谱。

年级：${grade}
学科：${subject}
错题数量：${questionSummaries.length}
错题摘要：
${questionSummaries.map((q, i) => `${i + 1}. 关键词: ${(q.keywords || []).join('、') || '未知'} | 难度: ${q.difficulty || 3}/5 | 考频: ${q.frequency || '中'}`).join('\n')}

请按以下JSON格式返回（必须是有效的JSON）：
{
  "summary": "总体学情评估（2-3句话）",
  "weakPoints": ["薄弱知识点1", "薄弱知识点2", "薄弱知识点3"],
  "suggestions": "针对性学习建议（包含具体的学习方法和资源推荐）",
  "encouragement": "给学生的鼓励和激励（1-2句话）",
  "knowledgeGraph": {
    "nodes": [
      {"id": "节点唯一ID", "label": "知识点名称", "type": "weak|normal|strong", "weight": 错误频次数字}
    ],
    "edges": [
      {"source": "源节点ID", "target": "目标节点ID", "label": "关系描述"}
    ]
  }
}

知识图谱说明：
- nodes: 列出所有涉及的知识点，type为weak表示薄弱点，normal表示一般，strong表示掌握较好
- edges: 表示知识点之间的依赖或关联关系
- 节点数量控制在5-15个，边数量控制在4-20个`;

    try {
      const response = await fetch(this.config.baseURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 2500
        })
      });

      if (!response.ok) throw new Error(`API请求失败: ${response.status}`);

      const data = await response.json();

      // 打印 token 消耗信息
      if (data.usage) {
        console.log('📊 报告生成 Token 消耗:', {
          输入: data.usage.prompt_tokens,
          输出: data.usage.completion_tokens,
          总计: data.usage.total_tokens
        });
      }

      const content = data.choices[0].message.content;
      const parsed = this.parseResponse(content);
      return parsed;
    } catch (error) {
      console.error('报告生成错误:', error);
      throw error;
    }
  }

  /**
   * 根据薄弱知识点生成类题推荐（带自动重试）
   * 类题 = 与错题相似、覆盖相同关键知识点的新题目
   */
  async generateSimilarQuestions(subject, grade, weakPoints, existingKeywords, questionSummaries) {
    const sampleQuestions = (questionSummaries || []).slice(0, 5)
      .map((q, i) => {
        // 拼接AI对题目的解析文本，让prompt了解题目实际内容
        const analysisText = [q.clue, q.solution, q.analysis]
          .filter(Boolean)
          .join(' ')
          .slice(0, 300); // 每道题最多取300字符，避免prompt过长
        let desc = `  错题${i + 1}: 知识点[${(q.keywords || []).join(', ')}], 难度${q.difficulty || 3}/5, 考频${q.frequency || '中'}`;
        if (analysisText) {
          desc += `\n    题目内容: ${analysisText}`;
        }
        return desc;
      })
      .join('\n');

    const prompt = `你是一位资深${subject}教师。请根据学生以下错题和薄弱知识点，为${grade}学生生成2道与错题难度、风格相似的全新练习题。

学生的错题概况：
${sampleQuestions || '暂无详细错题数据'}

薄弱知识点：${weakPoints.slice(0, 5).join('、')}
需覆盖的关键词：${(existingKeywords || []).slice(0, 10).join('、')}

要求：
- 生成**全新**题目，不得与已有错题重复
- 与错题难度相当、题型相似、覆盖相同知识点
- 2道题题型不同（一道选择或填空，一道解答题）
- 每道题的knowledgePoints必须包含至少一个薄弱知识点和1-2个关键词

请按以下JSON格式返回（只返回JSON，不要有任何其他文字）：
{
  "questions": [
    {
      "id": "q1",
      "title": "题目完整描述（包含所有已知条件和问题，数学公式用LaTeX如 $x^2$）",
      "type": "选择题|填空题|解答题",
      "difficulty": 难度1-5的数字,
      "knowledgePoints": ["涉及知识点1", "涉及知识点2"],
      "hint": "解题思路提示（1-2句话，启发式引导）",
      "answer": "参考答案（简洁明了，数学公式用LaTeX）",
      "solution": "详细解题步骤",
      "imageDescription": "如果是几何题或需要图形辅助理解，描述图形内容；否则为空字符串"
    }
  ]
}`;

    const simplePrompt = `为${grade}的${subject}学生出1道与错题相似的新题。薄弱知识点：${weakPoints.slice(0, 3).join('、')}。错题关键词：${(existingKeywords || []).slice(0, 5).join('、')}。只返回JSON：{"questions":[{"id":"q1","title":"...","type":"选择题|填空题|解答题","difficulty":3,"knowledgePoints":["..."],"hint":"...","answer":"...","solution":"..."}]}`;

    const callLLM = async (promptText, maxTokens) => {
      const response = await fetch(this.config.baseURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          model: this.config.currentModel,
          messages: [{ role: 'user', content: promptText }],
          temperature: 0.7,
          max_tokens: maxTokens
        })
      });
      if (!response.ok) throw new Error(`API请求失败: ${response.status}`);
      return response.json();
    };

    try {
      // 第一次尝试：完整prompt（大token预算，但也需要AI返回可能更多内容）
      const data = await callLLM(prompt, 4096);
      if (data.usage) {
        console.log('📊 类题推荐 Token 消耗:', {
          输入: data.usage.prompt_tokens,
          输出: data.usage.completion_tokens,
          总计: data.usage.total_tokens
        });
      }

      let content = data.choices[0].message.content;
      let questions = this.parseQuestionsResponse(content);

      // 第一次失败，用简化prompt重试一次
      if (questions.length === 0) {
        console.warn('类题推荐: 首次解析失败，简化prompt重试。原始返回:', content.slice(0, 300));
        const retryData = await callLLM(simplePrompt, 4096);
        content = retryData.choices[0].message.content;
        questions = this.parseQuestionsResponse(content);
      }

      if (questions.length === 0) {
        console.warn('类题推荐: 重试后仍无有效题目。AI返回:', content.slice(0, 500));
      }
      return questions;
    } catch (error) {
      console.error('类题推荐生成错误:', error);
      throw error;
    }
  }

  /**
   * 专门解析类题推荐返回的JSON，支持更宽松的格式
   * 修复：用字符串感知的平衡括号匹配替代贪婪正则，避免被尾部文本中的 } 干扰
   */
  parseQuestionsResponse(content) {
    if (!content) return [];

    // 剥离思维链和代码标记
    let cleaned = content
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // 字符串感知的括号匹配提取器
    const extractBracket = (text, open, close, startPos) => {
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (let i = startPos; i < text.length; i++) {
        const ch = text[i];
        if (esc) { esc = false; continue; }
        if (ch === '\\' && inStr) { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === open) depth++;
        else if (ch === close) {
          depth--;
          if (depth === 0) return i;
        }
      }
      return -1;
    };

    // 尝试解析 JSON，先用原始值，失败后用 sanitize 修复（不擅自改好JSON）
    const tryParseQuestions = (jsonStr) => {
      // 第1优先：直接解析（AI 正确转义时）
      try {
        const p = JSON.parse(jsonStr);
        if (Array.isArray(p.questions)) return p.questions;
        if (typeof p.questions === 'string') {
          try { return JSON.parse(p.questions); } catch (_) {}
        }
      } catch (_) {}
      // 第2优先：修复尾逗号 + 单引号（不影响正确转义）
      try {
        const fixed = jsonStr
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/'/g, '"');
        const p = JSON.parse(fixed);
        if (Array.isArray(p.questions)) return p.questions;
        if (typeof p.questions === 'string') {
          try { return JSON.parse(p.questions); } catch (_) {}
        }
      } catch (_) {}
      // 第3优先：暴力修复非法转义（如 LaTeX \vec, \angle 未转义 → \\vec, \\angle）
      try {
        const fixed = jsonStr
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/'/g, '"')
          .replace(/\\(?!"|\\|\/|b|f|n|r|t|u)/g, '\\\\');
        const p = JSON.parse(fixed);
        if (Array.isArray(p.questions)) return p.questions;
        if (typeof p.questions === 'string') {
          try { return JSON.parse(p.questions); } catch (_) {}
        }
      } catch (_) {}
      return null;
    };

    // --- 策略1: 平衡括号提取顶层 JSON 对象 ---
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace !== -1) {
      const endIdx = extractBracket(cleaned, '{', '}', firstBrace);
      if (endIdx !== -1) {
        const rawJson = cleaned.slice(firstBrace, endIdx + 1);
        const result = tryParseQuestions(rawJson);
        if (result) return result;
      }
    }

    // --- 策略2: 平衡括号提取 questions 数组 ---
    const arrMatch = cleaned.match(/"questions"\s*:\s*(\[)/);
    if (arrMatch) {
      const startIdx = arrMatch.index + arrMatch[0].length - 1;
      const endIdx = extractBracket(cleaned, '[', ']', startIdx);
      if (endIdx !== -1) {
        const arrStr = cleaned.slice(startIdx, endIdx + 1);
        const result = tryParseQuestions(arrStr);
        if (result) return result;
      }
    }

    // --- 策略3: 贪婪正则兜底 ---
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = tryParseQuestions(jsonMatch[0]);
      if (result) return result;
    }

    return [];
  }

  /**
   * 解析AI返回内容为标准格式
   */
  parseResponse(content) {
    try {
      // 剥离 qwen3 等思维链模型的 <think>...</think> 推理块
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        ['clue', 'solution', 'analysis', 'summary', 'suggestions', 'encouragement'].forEach(field => {
          if (parsed[field]) {
            parsed[field] = parsed[field]
              .replace(/\\n/g, '\n')
              .replace(/\\\\/g, '\\')
              .replace(/\\"/g, '"');
          }
        });

        return parsed;
      }

      return {
        clue: '请仔细观察题目条件',
        solution: content,
        analysis: '请根据解答过程总结知识点',
        metadata: { difficulty: 3, frequency: '中', keywords: [] }
      };
    } catch (error) {
      console.error('解析响应失败:', error);
      return {
        clue: '思考题目的关键信息',
        solution: content,
        analysis: '分析解题思路',
        metadata: { difficulty: 3, frequency: '中', keywords: [] }
      };
    }
  }
}

export const aiService = new AIAdapter();
