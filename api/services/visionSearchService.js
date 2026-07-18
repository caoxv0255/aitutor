import { getDb } from '../core/db.js';
import { llm, MODELS } from '../../services/llm.js';
import { logger } from '../core/logger.js';
import { parseImageToQuestion } from '../routes/vision-parse.js';
import { ingestQuestion } from '../routes/rag-search.js';
import sharp from 'sharp';

const ERROR_ANALYSIS_PROMPT = (subjectName, question, studentAnswer = null) => `你是一位拥有20年教学经验的${subjectName}学科高级教师。

请分析以下题目，并推断学生可能出现的错误原因：

【题目】
${question}

${studentAnswer ? `【学生答案】${studentAnswer}` : ''}

请严格按照以下JSON格式返回（必须是有效的JSON，不要有多余的换行符和转义字符）：

{
  "correct_answer": "题目正确答案，选择题返回选项字母（如A、B、C、D），主观题返回完整答案",
  "error_types": [
    {
      "type": "错误类型名称（如：概念理解错误、计算错误、审题错误、公式记错等）",
      "description": "该错误类型的详细说明",
      "common_mistakes": ["常见错误表现1", "常见错误表现2"]
    }
  ],
  "analysis": "详细解析，包含：1)正确答案分析 2)常见错误原因 3)解题思路指导 4)知识点回顾。使用\\n\\n分隔大段落，数学公式用LaTeX格式。",
  "knowledge_points": ["知识点1", "知识点2"],
  "learning_suggestions": ["学习建议1", "学习建议2"]
}

要求：
- correct_answer必须准确无误
- error_types至少列出3种可能的错误类型
- analysis必须详细，不少于150字
- learning_suggestions针对每种错误类型给出具体建议`;

const LEARNING_PLAN_PROMPT = (subjectName, knowledgePoints, weakPoints = []) => `你是一位专业的${subjectName}学科学习规划师。

请根据以下知识点为学生制定学习计划：

【目标知识点】
${knowledgePoints.join('\n')}

${weakPoints.length > 0 ? `【薄弱知识点】\n${weakPoints.join('\n')}` : ''}

请严格按照以下JSON格式返回（必须是有效的JSON，不要有多余的换行符和转义字符）：

{
  "plan_title": "学习计划标题",
  "duration": "计划时长（如：3天）",
  "daily_tasks": [
    {
      "day": 1,
      "focus_knowledge_point": "当天重点知识点",
      "tasks": [
        {"type": "review", "content": "复习教材内容：具体章节和要点"},
        {"type": "practice", "content": "练习题类型和数量"},
        {"type": "summary", "content": "总结要求"}
      ]
    }
  ],
  "key_concepts": ["核心概念1", "核心概念2"],
  "practice_recommendations": ["推荐练习类型1", "推荐练习类型2"],
  "expected_outcome": "预期学习效果"
}

要求：
- daily_tasks至少包含3天的学习计划
- 针对薄弱知识点增加复习强度
- 任务内容具体可执行`;

const MULTIMODAL_ANALYSIS_PROMPT = (subjectName) => `你是一位拥有20年教学经验的${subjectName}学科高级教师和图像分析专家。

请分析这张图片中的题目内容，进行多模态理解：

请严格按照以下JSON格式返回（必须是有效的JSON，不要有多余的换行符和转义字符）：

{
  "image_type": "图像类型（如：数学公式、物理电路图、化学实验装置、几何图形、统计图、表格、其他）",
  "extracted_text": "图片中提取的所有文字内容",
  "formulas": [
    {
      "latex": "公式的LaTeX表达式",
      "semantic_description": "公式的语义描述（如：牛顿第二定律，描述力与加速度的关系）",
      "variables": ["变量1", "变量2"],
      "units": ["单位1", "单位2"]
    }
  ],
  "diagram_elements": [
    {
      "type": "元素类型（如：电阻、电容、电源、电流表、电压表、容器、试剂、几何点、坐标轴）",
      "description": "元素描述",
      "properties": {"属性1": "值1", "属性2": "值2"}
    }
  ],
  "data_table": {
    "headers": ["列1", "列2"],
    "rows": [["值1", "值2"], ["值3", "值4"]],
    "trend_analysis": "数据趋势分析"
  },
  "graphical_info": {
    "axes": {"x": "X轴描述", "y": "Y轴描述"},
    "curves": ["曲线1描述", "曲线2描述"],
    "key_points": ["关键点1", "关键点2"]
  },
  "experimental_setup": {
    "equipment": ["设备1", "设备2"],
    "procedure": "实验步骤描述",
    "expected_results": "预期实验结果"
  },
  "question_context": "从图像中理解的题目上下文和背景信息"
}

要求：
- 根据实际图像内容填写相关字段，无关字段可以留空数组或null
- formulas字段必须提取所有数学/物理/化学公式
- diagram_elements必须详细描述图像中的所有关键元素
- 语义描述必须准确，能够帮助学生理解公式和图表的含义`;

export class VisionSearchService {
  static async preprocessImage(imageBase64, options = {}) {
    const { brightness = 0, contrast = 0, rotate = 0, sharpen = false } = options;
    
    try {
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      
      let pipeline = sharp(imageBuffer)
        .rotate(rotate)
        .resize({
          width: 1200,
          height: 1600,
          fit: sharp.fit.inside,
          withoutEnlargement: true
        });
      
      if (brightness !== 0) {
        pipeline = pipeline.modulate({ brightness: 1 + brightness / 100 });
      }
      
      if (contrast !== 0) {
        pipeline = pipeline.modulate({ saturation: 1 + contrast / 100 });
      }
      
      if (sharpen) {
        pipeline = pipeline.sharpen();
      }
      
      pipeline = pipeline.gamma()
        .normalise();
      
      const processedBuffer = await pipeline.toBuffer();
      return processedBuffer.toString('base64');
    } catch (error) {
      logger.error(`[VisionSearch] 图像预处理失败: ${error.message}`);
      return imageBase64;
    }
  }

  static async search(imageBase64, options = {}) {
    const { 
      subject, 
      knowledge_point_id, 
      studentAnswer,
      includeSimilarQuestions = true,
      generateLearningPlan = true,
      autoIngest = true,
      preprocess = true,
      preprocessOptions = {}
    } = options;

    if (preprocess) {
      imageBase64 = await this.preprocessImage(imageBase64, preprocessOptions);
    }

    const result = {
      parse: null,
      errorAnalysis: null,
      similarQuestions: [],
      learningPlan: null,
      ingest: null
    };

    try {
      result.parse = await parseImageToQuestion(imageBase64, {
        subject,
        knowledge_point_id
      });

      if (autoIngest && result.parse.full_content.length >= 10) {
        try {
          result.ingest = await ingestQuestion({
            content: result.parse.full_content,
            knowledge_point_id: result.parse.inferred_kp_id,
            subject_code: result.parse.subject_code,
            difficulty: result.parse.difficulty,
            question_type: result.parse.question_type,
            metadata: {
              source: 'vision_search',
              latex_formulas: result.parse.latex_formulas,
              raw_text: result.parse.raw_text,
              kp_validated: result.parse.kp_validated,
            },
          });
        } catch (err) {
          logger.warn(`[VisionSearch] 自动入库失败: ${err.message}`);
        }
      }

      const subjectMap = {
        math: '数学', physics: '物理', chemistry: '化学',
        biology: '生物', chinese: '语文', english: '英语',
        history: '历史', geography: '地理', politics: '政治'
      };
      const subjectName = subjectMap[result.parse.subject_code] || result.parse.subject_code || '数学';

      const analysisPrompt = ERROR_ANALYSIS_PROMPT(subjectName, result.parse.full_content, studentAnswer);
      const analysisResponse = await llm.chat(analysisPrompt, {
        model: MODELS.QWEN_TURBO,
        temperature: 0.3,
        maxTokens: 2500
      });

      try {
        result.errorAnalysis = JSON.parse(analysisResponse.content);
      } catch {
        const jsonMatch = analysisResponse.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result.errorAnalysis = JSON.parse(jsonMatch[0]);
          } catch {
            result.errorAnalysis = { analysis: analysisResponse.content };
          }
        } else {
          result.errorAnalysis = { analysis: analysisResponse.content };
        }
      }

      if (includeSimilarQuestions) {
        result.similarQuestions = await this.findSimilarQuestions(
          getDb(),
          result.parse.subject_code,
          result.parse.inferred_kp_id,
          result.parse.question_type,
          result.parse.difficulty
        );
      }

      if (generateLearningPlan && result.errorAnalysis.knowledge_points) {
        const planPrompt = LEARNING_PLAN_PROMPT(
          subjectName,
          result.errorAnalysis.knowledge_points,
          result.errorAnalysis.error_types?.map(e => e.type) || []
        );
        const planResponse = await llm.chat(planPrompt, {
          model: MODELS.QWEN_TURBO,
          temperature: 0.5,
          maxTokens: 2000
        });

        try {
          result.learningPlan = JSON.parse(planResponse.content);
        } catch {
          const jsonMatch = planResponse.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              result.learningPlan = JSON.parse(jsonMatch[0]);
            } catch {
              result.learningPlan = { plan_title: '学习计划', duration: '3天' };
            }
          }
        }
      }

      return { success: true, ...result };
    } catch (error) {
      logger.error(`[VisionSearch] 拍照搜题失败: ${error.message}`);
      return { success: false, error: error.message, ...result };
    }
  }

  static async findSimilarQuestions(poolPromise, subjectCode, kpId, questionType, difficulty, limit = 5) {
    try {
      const pool = await poolPromise;
      const minYear = new Date().getFullYear() - 3;
      
      let query = `
        SELECT id, question_uid, stem, options, answer, analysis, 
               knowledge_points, difficulty, question_type, subject_code, year, score
        FROM exam_questions
        WHERE subject_code = $1
          AND year >= $2
          AND answer IS NOT NULL AND TRIM(answer) != ''
          AND difficulty >= $3 AND difficulty <= $4
      `;
      
      const params = [subjectCode, minYear, Math.max(1, difficulty - 1), Math.min(5, difficulty + 1)];
      let paramIdx = 5;

      if (questionType) {
        query += ` AND question_type = $${paramIdx++}`;
        params.push(questionType);
      }

      if (kpId) {
        query += ` AND (knowledge_points LIKE $${paramIdx} OR knowledge_points IS NULL)`;
        params.push(`%${kpId}%`);
      }

      query += ' ORDER BY RANDOM() LIMIT $' + paramIdx;
      params.push(limit);

      const result = await pool.query(query, params);

      return result.rows.map(q => ({
        id: q.question_uid,
        content: q.stem,
        options: q.options ? JSON.parse(q.options) : [],
        answer: q.answer,
        explanation: q.analysis,
        knowledge_points: q.knowledge_points,
        difficulty: q.difficulty,
        question_type: q.question_type,
        subject_code: q.subject_code,
        year: q.year,
        score: q.score
      }));
    } catch (error) {
      logger.warn(`[VisionSearch] 查找相似题目失败: ${error.message}`);
      return [];
    }
  }

  static async saveWrongQuestion(email, parseResult, errorAnalysis, similarQuestions) {
    try {
      const pool = await getDb();

      await pool.query(`
        INSERT INTO wrong_questions (
          user_email, content, subject_code, knowledge_point_id, knowledge_point_name,
          difficulty, question_type, correct_answer, error_analysis,
          error_types, error_category
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        email,
        parseResult.full_content,
        parseResult.subject_code,
        parseResult.inferred_kp_id,
        parseResult.inferred_kp_name,
        parseResult.difficulty,
        parseResult.question_type,
        errorAnalysis?.correct_answer,
        errorAnalysis?.analysis,
        JSON.stringify(errorAnalysis?.error_types?.map(e => e.type) || []),
        'unknown'
      ]);

      return { success: true };
    } catch (error) {
      logger.error(`[VisionSearch] 保存错题失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  static async analyzeImage(imageBase64, options = {}) {
    const { subject = 'math' } = options;
    
    const subjectMap = {
      math: '数学', physics: '物理', chemistry: '化学',
      biology: '生物', chinese: '语文', english: '英语',
      history: '历史', geography: '地理', politics: '政治'
    };
    const subjectName = subjectMap[subject] || subject;
    
    const prompt = MULTIMODAL_ANALYSIS_PROMPT(subjectName);
    
    try {
      const response = await llm.visionChat(prompt, '', imageBase64, {
        model: MODELS.QWEN_VL_PLUS,
        temperature: 0.2,
        maxTokens: 3000,
        feature: 'vision_multimodal'
      });
      
      try {
        return {
          success: true,
          analysis: JSON.parse(response.content),
          cost: response.cost,
          tokens: response.usage?.total_tokens || 0
        };
      } catch {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return {
              success: true,
              analysis: JSON.parse(jsonMatch[0]),
              cost: response.cost,
              tokens: response.usage?.total_tokens || 0
            };
          } catch {
            return {
              success: true,
              analysis: { extracted_text: response.content },
              cost: response.cost,
              tokens: response.usage?.total_tokens || 0
            };
          }
        }
        return {
          success: true,
          analysis: { extracted_text: response.content },
          cost: response.cost,
          tokens: response.usage?.total_tokens || 0
        };
      }
    } catch (error) {
      logger.error(`[VisionSearch] 图像分析失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async parseFormula(imageBase64) {
    const prompt = `请将图片中的数学公式转换为LaTeX格式，并提供语义解释。

返回格式：
{
  "latex": "LaTeX表达式",
  "semantic_description": "公式的语义描述",
  "type": "公式类型（如：代数、几何、三角函数、微积分、概率统计）",
  "variables": ["变量名称"],
  "applications": ["应用场景"]
}`;
    
    try {
      const response = await llm.visionChat(prompt, '', imageBase64, {
        model: MODELS.QWEN_VL_PLUS,
        temperature: 0.1,
        maxTokens: 1500,
        feature: 'vision_multimodal'
      });
      
      try {
        return { success: true, formula: JSON.parse(response.content) };
      } catch {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return { success: true, formula: JSON.parse(jsonMatch[0]) };
          } catch {
            return { success: true, formula: { latex: response.content } };
          }
        }
        return { success: true, formula: { latex: response.content } };
      }
    } catch (error) {
      logger.error(`[VisionSearch] 公式解析失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  static async analyzeDiagram(imageBase64, subject = 'physics') {
    const subjectMap = {
      math: '数学几何图形',
      physics: '物理电路图/力学图',
      chemistry: '化学实验装置',
      biology: '生物结构图'
    };
    const subjectName = subjectMap[subject] || '科学图表';
    
    const prompt = `请分析这张${subjectName}，识别所有元素并理解其物理意义。

返回格式：
{
  "diagram_type": "图表类型",
  "elements": [
    {
      "type": "元素类型",
      "label": "标签",
      "properties": {"属性": "值"},
      "connections": ["连接到的元素"]
    }
  ],
  "relationships": ["元素间的关系描述"],
  "physical_meanings": ["物理意义解释"],
  "problem_context": "由此图表可能引出的问题类型"
}`;
    
    try {
      const response = await llm.visionChat(prompt, '', imageBase64, {
        model: MODELS.QWEN_VL_PLUS,
        temperature: 0.2,
        maxTokens: 2000,
        feature: 'vision_multimodal'
      });
      
      try {
        return { success: true, diagram: JSON.parse(response.content) };
      } catch {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return { success: true, diagram: JSON.parse(jsonMatch[0]) };
          } catch {
            return { success: true, diagram: { diagram_type: subjectName, elements: [] } };
          }
        }
        return { success: true, diagram: { diagram_type: subjectName, elements: [] } };
      }
    } catch (error) {
      logger.error(`[VisionSearch] 图表分析失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

export { ERROR_ANALYSIS_PROMPT, LEARNING_PLAN_PROMPT, MULTIMODAL_ANALYSIS_PROMPT };