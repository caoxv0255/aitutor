import { getDb } from '../core/db.js';
import { llm, MODELS } from '../../services/llm.js';
import { getEmbedding, getEmbeddingProvenance } from '../../services/embedding.js';
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

// ──────────────────────────────────────────────────────────────────────────
// P0-guard (2026-09-23): 向量溯源一致性守卫
//
// 事故: question_vectors.q_embedding 是 ollama/bge-m3 产物, 查询侧 env 被切到
//   remote/text-embedding-v3 后, 跨模型 cosine 仅 ≈0.635, 且 services/embedding.js
//   的维度校验「只 warn 不拦」, 于是页面静默返回一片 0.6 附近的垃圾相似度。
//
// 本函数在【查询路径】比对「当前 env 生效的 provider+model」与
//   「question_vectors.metadata 记录的 model/provider」:
//   - 一致 → 返回 null, 正常检索。
//   - 不一致 → 返回不一致明细, 调用方拒答 (空数组 + 明确 notice), 绝不返回
//     可能无意义的相似度。
// 谓词匹配口径: metadata 未记录 provider 的历史行 (provider 为 NULL) 不因缺
//   provider 判定不一致, 但 model 必须一致。
// ──────────────────────────────────────────────────────────────────────────
async function detectProvenanceMismatch(pool, prov) {
  const { rows } = await pool.query(
    `SELECT DISTINCT metadata->>'model' AS model, metadata->>'provider' AS provider
       FROM question_vectors
      WHERE q_embedding IS NOT NULL
        AND (
          COALESCE(metadata->>'model', '') IS DISTINCT FROM $1
          OR (metadata->>'provider' IS NOT NULL AND metadata->>'provider' IS DISTINCT FROM $2)
        )
      LIMIT 10`,
    [prov.model, prov.provider]
  );
  if (rows.length === 0) return null;
  return {
    models: [...new Set(rows.map((r) => r.model || '(空)'))],
    providers: [...new Set(rows.map((r) => r.provider || '(空)'))],
  };
}

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
      similarNotice: null,
      learningPlan: null,
      ingest: null
    };

    try {
      // Phase-B-fix (2026-08-24): B4 — 透传 trace_id / user_email 给 vision-parse (B3)
      result.parse = await parseImageToQuestion(imageBase64, {
        subject,
        knowledge_point_id,
        request_id: options.request_id,
        user_email: options.user_email,
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
      // Phase-B-fix (2026-08-24): B4 — task_type='error_analysis' 用于 ai_trace
      const analysisResponse = await llm.chat(analysisPrompt, {
        model: MODELS.QWEN_TURBO,
        temperature: 0.3,
        maxTokens: 2500,
        task_type: 'error_analysis',
        user_id: options.user_email || 'system',
        request_id: options.request_id,
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
        const similar = await this.findSimilarQuestions(
          getDb(),
          result.parse.full_content,
          {
            subjectCode: result.parse.subject_code,
            requestId: options.request_id,
            userId: options.user_email,
          }
        );
        result.similarQuestions = similar.questions;
        result.similarNotice = similar.notice;
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
          maxTokens: 2000,
          // Phase-B-fix (2026-08-24): B4 — task_type='learning_plan' 用于 ai_trace
          task_type: 'learning_plan',
          user_id: options.user_email || 'system',
          request_id: options.request_id,
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

  /**
   * F3-fix (2026-09-22): 相似题改为真实语义相似度检索 (pgvector cosine).
   *
   * 历史问题: 旧实现按学科/难度/年份过滤后用 ORDER BY RANDOM 随机排序，
   *   返回的是"同学科随机题"而非相似题，属功能造假，已移除。
   *
   * 修复哲学: 宁可诚实的空，不要随机的有。
   *   - 查询题干 → services/embedding.js 取向量
   *   - 对 question_vectors.q_embedding 做 cosine 检索 (HNSW 索引 idx_qv_q)
   *   - 相似度阈值过滤 (env SIMILAR_QUESTIONS_MIN_SIMILARITY, 默认 0.60)
   *     依据: bge-m3 中文 K12 题干, 同知识点题对 cosine 通常 ≥0.60,
   *           跨知识点/跨学科题对多落在 0.30~0.55; 0.60 是宁可漏召不可误召的下限
   *   - 排除源题自身 (题干精确相同者)
   *   - 任何一步失败 (文本过短 / embedding 不可用 / 无过阈值结果 / DB 异常)
   *     → 返回空数组 + notice 文案, 绝不回退随机或其他伪相似
   *
   * @param {Promise<Pool>} poolPromise
   * @param {string} queryText 源题题干 (parse.full_content)
   * @param {{subjectCode?:string, limit?:number, requestId?:string, userId?:string}} [options]
   * @returns {Promise<{questions: Array, notice: string|null}>}
   */
  static async findSimilarQuestions(poolPromise, queryText, options = {}) {
    const { subjectCode, limit = 5, requestId, userId } = options;
    const threshold = parseFloat(process.env.SIMILAR_QUESTIONS_MIN_SIMILARITY || '0.60');

    const empty = (notice) => ({ questions: [], notice });

    try {
      const text = (queryText || '').trim();
      if (text.length < 10) {
        return empty('题目文本过短，无法计算语义相似度，未检索相似题');
      }

      let queryEmbedding;
      try {
        queryEmbedding = await getEmbedding(text, { request_id: requestId, user_id: userId });
      } catch (embErr) {
        logger.warn(`[VisionSearch] 相似题 embedding 失败: ${embErr.message}`);
        return empty('相似题检索暂不可用（向量嵌入服务异常），本次不返回相似题');
      }

      const pool = await poolPromise;
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      // P0-guard (2026-09-23): 当前 env 实际生效的 provider+model。
      const prov = getEmbeddingProvenance();

      const params = [embeddingStr, text, threshold];
      let paramIdx = 4;
      let subjectClause = '';
      if (subjectCode) {
        subjectClause = ` AND qv.subject_code = $${paramIdx++}`;
        params.push(subjectCode);
      }
      params.push(limit);
      const limitIdx = paramIdx++;
      params.push(prov.model);
      const modelIdx = paramIdx++;
      params.push(prov.provider);
      const providerIdx = paramIdx++;

      // 溯源守卫 (SQL 层): 只有当库中不存在任何 provider/model 与当前 env 不一致的
      // 向量行时才返回结果。不一致 → 谓词为假 → 0 行 → 下方 probe 区分原因并拒答。
      const query = `
        SELECT q.question_uid, q.stem, q.options, q.answer, q.analysis,
               q.knowledge_points, q.difficulty, q.question_type, q.subject_code, q.year, q.score,
               1 - (qv.q_embedding <=> $1) AS similarity
        FROM question_vectors qv
        JOIN exam_questions q ON q.id = qv.question_id
        WHERE qv.q_embedding IS NOT NULL
          AND q.answer IS NOT NULL AND TRIM(q.answer) != ''
          AND q.stem IS DISTINCT FROM $2
          AND 1 - (qv.q_embedding <=> $1) >= $3
          ${subjectClause}
          AND NOT EXISTS (
            SELECT 1 FROM question_vectors v
            WHERE v.q_embedding IS NOT NULL
              AND (
                COALESCE(v.metadata->>'model', '') IS DISTINCT FROM $${modelIdx}
                OR (v.metadata->>'provider' IS NOT NULL
                    AND v.metadata->>'provider' IS DISTINCT FROM $${providerIdx})
              )
          )
        ORDER BY qv.q_embedding <=> $1
        LIMIT $${limitIdx}
      `;

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        // 区分「无过阈值命中」与「溯源不一致 (SQL 谓词已排除全部行)」。
        const mismatch = await detectProvenanceMismatch(pool, prov);
        if (mismatch) {
          logger.error(
            `[VisionSearch] 向量溯源不一致: 库中 model=[${mismatch.models.join(', ')}] `
            + `provider=[${mismatch.providers.join(', ')}], 当前查询 model=${prov.model} `
            + `provider=${prov.provider}; 拒绝返回相似题`
          );
          return empty(
            `相似题检索已拒绝：向量库溯源不一致（库中为 ${mismatch.models.join('/')}，`
            + `当前查询使用 ${prov.model}），返回的相似度无意义，`
            + `请先用当前 provider 重新嵌入 question_vectors`
          );
        }
        return empty('题库中暂未找到达到相似度阈值的题目');
      }

      return {
        questions: result.rows.map(q => ({
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
          score: q.score,
          // F3-fix: 增量字段 — 真实 cosine 相似度 (0~1), 不删不改既有字段
          similarity: parseFloat(Number(q.similarity).toFixed(4))
        })),
        notice: null
      };
    } catch (error) {
      logger.warn(`[VisionSearch] 查找相似题目失败: ${error.message}`);
      return empty('相似题检索失败，本次不返回相似题');
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

  /**
   * P0-fix (2026-08-24): Phase D — D5
   * 批量解析多张图片 (整卷拍照场景). 并发限制 3, 单题失败不影响整批.
   *
   * @param {string[]} images  base64 编码图片数组 (已剥离 data:image/...;base64, 前缀)
   * @param {object}   userHint 透传给 parseImageToQuestion (subject / knowledge_point_id / request_id / user_email / preprocess 等)
   * @param {object}   options  { concurrency?: number }
   * @returns {Promise<{success:boolean, questions:Array, total_count:number, success_count:number, failed_count:number, errors:Array}>}
   */
  static async batchParse(images, userHint = {}, options = {}) {
    if (!Array.isArray(images)) {
      return {
        success: false,
        questions: [],
        total_count: 0,
        success_count: 0,
        failed_count: 0,
        errors: [{ index: -1, error: 'images must be an array' }],
      };
    }
    if (images.length === 0) {
      return {
        success: true,
        questions: [],
        total_count: 0,
        success_count: 0,
        failed_count: 0,
        errors: [],
      };
    }
    const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 10));
    const results = new Array(images.length);
    const errors = [];
    let cursor = 0;

    async function worker() {
      while (true) {
        const idx = cursor++;
        if (idx >= images.length) return;
        const img = images[idx];
        try {
          // Phase-B-fix (2026-08-24): B4 — 每张图片的 batch 索引记到 trace,
          // 便于失败排查整卷里的具体哪一题.
          const localHint = {
            ...userHint,
            request_id: userHint.request_id
              ? `${userHint.request_id}_batch${idx}`
              : undefined,
          };
          const parsed = await parseImageToQuestion(img, localHint);
          results[idx] = { index: idx, success: true, parse: parsed };
        } catch (err) {
          logger.warn(`[VisionSearch] batchParse idx=${idx} 失败: ${err.message}`);
          results[idx] = { index: idx, success: false, error: err.message };
          errors.push({ index: idx, error: err.message });
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, images.length) }, () => worker());
    await Promise.all(workers);

    const questions = results.filter((r) => r && r.success).map((r) => r.parse);
    const successCount = questions.length;
    const failedCount = images.length - successCount;

    return {
      success: failedCount === 0,
      questions,
      total_count: images.length,
      success_count: successCount,
      failed_count: failedCount,
      errors,
    };
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
        feature: 'vision_multimodal',
        // Phase-B-fix (2026-08-24): B4 — task_type='vision_multimodal' 用于 ai_trace
        task_type: 'vision_multimodal',
        user_id: options.user_email || 'system',
        request_id: options.request_id,
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

  static async parseFormula(imageBase64, options = {}) {
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
        feature: 'vision_multimodal',
        // Phase-B-fix (2026-08-24): B4 — task_type='vision_multimodal' 用于 ai_trace
        task_type: 'vision_multimodal',
        user_id: options.user_email || 'system',
        request_id: options.request_id,
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

  static async analyzeDiagram(imageBase64, subject = 'physics', options = {}) {
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
        feature: 'vision_multimodal',
        // Phase-B-fix (2026-08-24): B4 — task_type='vision_multimodal' 用于 ai_trace
        task_type: 'vision_multimodal',
        user_id: options.user_email || 'system',
        request_id: options.request_id,
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

  // ────────────────────────────────────────────────────────────────────────
  // Phase E (2026-08-24): 整卷 OCR — 批量解析多张图片 / 多页 PDF
  //
  // 设计原则 (核心 UX):
  //   - 单题失败不影响整批 (返回 success=false 但不抛, 由 caller 聚合展示)
  //   - 受控并发 (默认 3, 可由 options.concurrency 调整)
  //   - 复用 parseImageToQuestion (Phase B 已实施, ai_trace / kp_validated 完备)
  //   - 返回结构: { questions: [...], failed: [...], total_count, success_count, failed_count }
  //
  // 入参:
  //   images: [{ data: <base64>, subject?, pageIndex? }]   — 数组, 长度 1..N
  //   userHint: { user_email?, request_id?, default_subject? }  — 透传给单题 parse
  //   options: { concurrency?, mock? }   — mock=true 时跳过真实 LLM, 返回示例数据
  // ────────────────────────────────────────────────────────────────────────

  /**
   * 整卷 OCR 批量解析 (Phase E, 2026-08-24)
   * @param {Array<{data:string, subject?:string, pageIndex?:number}>} images
   * @param {{user_email?:string, request_id?:string, default_subject?:string}} [userHint]
   * @param {{concurrency?:number, mock?:boolean}} [options]
   * @returns {Promise<{questions:Array, failed:Array, total_count:number, success_count:number, failed_count:number}>}
   */
  static async batchParse(images, userHint = {}, options = {}) {
    if (!Array.isArray(images) || images.length === 0) {
      return { questions: [], failed: [], total_count: 0, success_count: 0, failed_count: 0 };
    }

    const concurrency = Math.max(1, Math.min(10, options.concurrency || 3));
    const useMock = options.mock === true || process.env.USE_MOCK === 'true';

    // ── Mock 路径: 返回示例整卷数据, 跳过真实 LLM ──
    if (useMock) {
      return this._batchParseMock(images, userHint);
    }

    // ── 真路径: 受控并发解析 (手写 worker pool, 不依赖 p-limit) ──
    const queue = images.slice();
    const results = [];
    const workerLock = { busy: 0 };

    async function worker() {
      while (true) {
        const img = queue.shift();
        if (!img) break;
        workerLock.busy++;
        const idx = (img.pageIndex != null) ? img.pageIndex : (images.length - queue.length);
        const start = Date.now();
        try {
          if (!img.data || typeof img.data !== 'string') {
            throw new Error('image.data 缺失或非字符串');
          }
          const parsed = await parseImageToQuestion(img.data, {
            subject: img.subject || userHint.default_subject,
            knowledge_point_id: img.knowledge_point_id,
            user_email: userHint.user_email,
            request_id: userHint.request_id
              ? `${userHint.request_id}_p${idx}`
              : undefined,
          });
          results.push({
            success: true,
            pageIndex: idx,
            duration_ms: Date.now() - start,
            ...parsed,
          });
        } catch (err) {
          logger.warn(`[VisionSearch.batchParse] 第 ${idx} 张解析失败: ${err.message}`);
          results.push({
            success: false,
            pageIndex: idx,
            duration_ms: Date.now() - start,
            error: err.message,
          });
        } finally {
          workerLock.busy--;
        }
      }
    }

    const workers = [];
    for (let i = 0; i < concurrency; i++) workers.push(worker());
    await Promise.all(workers);

    // 按 pageIndex 升序, 让前端展示稳定
    results.sort((a, b) => (a.pageIndex || 0) - (b.pageIndex || 0));

    const questions = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    return {
      questions,
      failed,
      total_count: images.length,
      success_count: questions.length,
      failed_count: failed.length,
    };
  }

  /**
   * Mock 模式整卷数据 (Phase E, 2026-08-24)
   * 给前端 demo / 离线开发用, 不调用真实 LLM.
   */
  static _batchParseMock(images, userHint = {}) {
    const sampleSubjects = ['math', 'physics', 'chemistry', 'chinese', 'english'];
    const sampleTypes = ['choice', 'fill', 'calculation', 'short_answer', 'proof'];
    const sampleKps = ['kp_math_015', 'kp_phys_008', 'kp_chem_022', 'kp_chi_003', 'kp_eng_011'];
    const questions = [];
    const failed = [];
    images.forEach((img, i) => {
      const idx = (img.pageIndex != null) ? img.pageIndex : (i + 1);
      // 偶数下标 i%4==3 模拟失败, 让前端可见"部分失败"分支 (UX 测试)
      if (i % 4 === 3) {
        failed.push({
          success: false,
          pageIndex: idx,
          error: 'mock: 模拟图片模糊导致 OCR 失败',
        });
        return;
      }
      const sub = img.subject || sampleSubjects[i % sampleSubjects.length];
      const kpId = sampleKps[i % sampleKps.length];
      const type = sampleTypes[i % sampleTypes.length];
      questions.push({
        success: true,
        pageIndex: idx,
        raw_text: `[Mock 题 ${idx}] 已知集合 A = {${i + 1},${i + 2},${i + 3}}, 求 A ∩ B 的元素个数 (mock 演示)`,
        latex_formulas: [`$A \\cap B$`],
        subject_code: sub,
        difficulty: (i % 5) + 1,
        question_type: type,
        inferred_kp_id: kpId,
        inferred_kp_name: kpId,
        full_content: `[Mock 题 ${idx}] 已知集合 A = {${i + 1},${i + 2},${i + 3}}, 求 A ∩ B 的元素个数`,
        kp_validated: true,
        duration_ms: 800 + Math.floor(Math.random() * 400),
      });
    });
    // 按 pageIndex 升序, 与真路径保持一致 (前端展示稳定)
    const sortByPageIndex = (a, b) => (a.pageIndex || 0) - (b.pageIndex || 0);
    questions.sort(sortByPageIndex);
    failed.sort(sortByPageIndex);
    return {
      questions,
      failed,
      total_count: images.length,
      success_count: questions.length,
      failed_count: failed.length,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Phase E (2026-08-24): 整卷批量入库 — 错题 + mastery + SRS + ai_trace
  //
  // 设计原则:
  //   - 单题失败不中断整批 (每题独立 try/catch, mini-tx)
  //   - mastery -10 触发薄弱点标记 (方案 C 业务表)
  //   - SRS 调度: next_review_at = NOW() + 1 day (待复盘)
  //   - ai_trace: 整批聚合一条 batch_ingest (fire-and-forget, 与 Phase B 一致)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * 批量入库 (Phase E, 2026-08-24)
   * @param {Array<object>} questions — 已 parse 过的题目 (含 full_content, subject_code, inferred_kp_id 等)
   * @param {string} userEmail
   * @param {{request_id?:string, source?:string}} [options]
   * @returns {Promise<{ingested:Array, failed:Array, total_count:number, success_count:number, failed_count:number, mastery_updates:number, srs_scheduled:number}>}
   */
  static async batchIngest(questions, userEmail, options = {}) {
    if (!Array.isArray(questions) || questions.length === 0) {
      return { ingested: [], failed: [], total_count: 0, success_count: 0, failed_count: 0, mastery_updates: 0, srs_scheduled: 0 };
    }
    if (!userEmail) {
      return {
        ingested: [],
        failed: questions.map((q, i) => ({ error: 'userEmail 缺失', pageIndex: q.pageIndex ?? i + 1 })),
        total_count: questions.length, success_count: 0, failed_count: questions.length,
        mastery_updates: 0, srs_scheduled: 0,
      };
    }

    let pool;
    try {
      pool = await getDb();
    } catch (err) {
      logger.error(`[VisionSearch.batchIngest] DB 连接失败: ${err.message}`);
      return {
        ingested: [], failed: questions.map((q, i) => ({ error: 'DB 不可用', pageIndex: q.pageIndex ?? i + 1 })),
        total_count: questions.length, success_count: 0, failed_count: questions.length,
        mastery_updates: 0, srs_scheduled: 0,
      };
    }

    const ingested = [];
    const failed = [];
    let mastery_updates = 0;
    let srs_scheduled = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const idx = (q.pageIndex != null) ? q.pageIndex : (i + 1);
      try {
        // 1) INSERT INTO wrong_questions (mini-tx, 单题失败不影响后续)
        const insResult = await pool.query(
          `INSERT INTO wrong_questions (
             user_email, content, subject_code, knowledge_point_id, knowledge_point_name,
             difficulty, question_type, correct_answer, error_analysis,
             error_types, error_category
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, created_at`,
          [
            userEmail,
            q.full_content || q.raw_text || '',
            q.subject_code || 'math',
            q.inferred_kp_id || null,
            q.inferred_kp_name || null,
            q.difficulty || 3,
            q.question_type || 'short_answer',
            q.correct_answer || null,
            q.error_analysis || null,
            JSON.stringify(q.error_types || []),
            q.error_category || 'unknown',
          ]
        );

        // 2) mastery -10 (方案 C: 每错一题掌握度 -10, 触发薄弱点标记)
        if (q.inferred_kp_id) {
          try {
            await pool.query(
              `INSERT INTO student_knowledge_mastery
                 (user_email, knowledge_point_id, mastery_score, attempt_count, last_practice_at, next_review_at)
               VALUES ($1, $2, 90, 1, NOW(), NOW() + INTERVAL '1 day')
               ON CONFLICT (user_email, knowledge_point_id)
               DO UPDATE SET
                 mastery_score = GREATEST(0, student_knowledge_mastery.mastery_score - 10),
                 attempt_count = student_knowledge_mastery.attempt_count + 1,
                 last_practice_at = NOW(),
                 next_review_at = NOW() + INTERVAL '1 day',
                 updated_at = NOW()`,
              [userEmail, q.inferred_kp_id]
            );
            mastery_updates += 1;
            srs_scheduled += 1;
          } catch (mrErr) {
            // mastery 失败不阻塞错题入库 (核心数据已写入)
            logger.warn(`[VisionSearch.batchIngest] mastery 更新失败 (kp=${q.inferred_kp_id}): ${mrErr.message}`);
          }
        }

        ingested.push({
          success: true,
          pageIndex: idx,
          id: insResult.rows[0].id,
          created_at: insResult.rows[0].created_at,
        });
      } catch (err) {
        logger.error(`[VisionSearch.batchIngest] 第 ${idx} 题入库失败: ${err.message}`);
        failed.push({
          success: false,
          pageIndex: idx,
          error: err.message,
        });
      }
    }

    // 3) 异步 ai_trace (fire-and-forget, 与 Phase B 一致; 失败不抛)
    try {
      const { recordAiTraceAsync } = await import('../../services/aiTrace.js');
      recordAiTraceAsync({
        request_id: options.request_id,
        user_id: userEmail,
        task_type: 'vision_batch_ingest',
        provider: 'local',
        model: 'batch_ingest',
        latency_ms: 0,
        success: failed.length === 0,
        error_message: failed.length > 0 ? `${failed.length}/${questions.length} 题入库失败` : null,
      });
    } catch (_) {
      // ai_trace 失败不影响主流程
    }

    return {
      ingested,
      failed,
      total_count: questions.length,
      success_count: ingested.length,
      failed_count: failed.length,
      mastery_updates,
      srs_scheduled,
    };
  }
}

export { ERROR_ANALYSIS_PROMPT, LEARNING_PLAN_PROMPT, MULTIMODAL_ANALYSIS_PROMPT };