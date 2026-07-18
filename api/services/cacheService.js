import { cacheWrapper, clearCache, CACHE_CONFIG } from '../utils/cache.js';

const CACHE_KEYS = {
  KNOWLEDGE_POINTS: (subject, level) => `kp:${subject || 'all'}:${level || 'all'}`,
  PROVINCES: (exam_level, region) => `province:${exam_level || 'all'}:${region || 'all'}`,
  PROVINCE_STATS: (code, subject, years) => `province_stats:${code}:${subject || 'all'}:${years || '5'}`,
  QUESTION_TYPES: () => 'question_types',
  SUBJECT_LIST: () => 'subject_list',
  EXAM_PAPERS: (province, year, subject) => `papers:${province || 'all'}:${year || 'all'}:${subject || 'all'}`,
  USER_PROGRESS: (email) => `user_progress:${email}`,
};

export class CacheService {
  static async getKnowledgePoints(pool, subject, level, includeContent = false) {
    const key = CACHE_KEYS.KNOWLEDGE_POINTS(subject, level);
    const ttl = includeContent ? CACHE_CONFIG.SHORT_TTL : CACHE_CONFIG.LONG_TTL;
    
    const { data, cached } = await cacheWrapper(key, async () => {
      let query = 'SELECT * FROM knowledge_points';
      const params = [];
      const conditions = [];
      let paramIdx = 1;

      if (subject) {
        conditions.push(`subject = $${paramIdx++}`);
        params.push(subject);
      }
      if (level) {
        conditions.push(`level = $${paramIdx++}`);
        params.push(level);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY subject, difficulty DESC';

      const result = await pool.query(query, params);
      return result.rows.map(r => {
        let subtopics;
        try {
          subtopics = JSON.parse(r.subtopics);
        } catch {
          subtopics = [];
        }
        const content = includeContent === 'full'
          ? r.content
          : (r.content ? r.content.slice(0, 200) + (r.content.length > 200 ? '...' : '') : null);
        return { ...r, subtopics, content };
      });
    }, ttl);
    
    return { data, cached };
  }

  static async getProvinces(pool, exam_level, region) {
    const key = CACHE_KEYS.PROVINCES(exam_level, region);
    
    const { data, cached } = await cacheWrapper(key, async () => {
      let query = 'SELECT * FROM provinces';
      const conditions = [];
      const params = [];
      let paramIdx = 1;

      if (exam_level) {
        params.push(exam_level);
        conditions.push(`exam_type = $${paramIdx++}`);
      }

      if (region) {
        params.push(region);
        conditions.push(`region = $${paramIdx++}`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY region, name';

      const result = await pool.query(query, params);
      return result.rows;
    }, CACHE_CONFIG.LONG_TTL);
    
    return { data: { success: true, data, total: data.length }, cached };
  }

  static async getProvinceStats(pool, code, subject, years = 5) {
    const key = CACHE_KEYS.PROVINCE_STATS(code, subject, years);
    
    const { data, cached } = await cacheWrapper(key, async () => {
      const provinceResult = await pool.query(
        'SELECT * FROM provinces WHERE code = $1',
        [code]
      );
      const provinceRows = provinceResult.rows;

      if (provinceRows.length === 0) {
        return null;
      }

      const province = provinceRows[0];

      let paperQuery = `
        SELECT
          year,
          subject,
          question_count,
          total_score,
          difficulty_avg
        FROM exam_papers
        WHERE province_code = $1
        AND year >= EXTRACT(YEAR FROM CURRENT_DATE) - $2
      `;
      const paperParams = [code, parseInt(years)];
      let paramIdx = 3;

      if (subject) {
        paperParams.push(subject);
        paperQuery += ` AND subject = $${paramIdx++}`;
      }

      paperQuery += ' ORDER BY year DESC, subject';

      const papersResult = await pool.query(paperQuery, paperParams);
      const papersRows = papersResult.rows;

      const knowledgeQuery = `
        SELECT
          pk.knowledge_point_id,
          kp.name as knowledge_point_name,
          SUM(pk.frequency) as total_frequency,
          AVG(pk.avg_difficulty) as avg_difficulty,
          SUM(pk.total_score) as total_score
        FROM province_knowledge_stats pk
        LEFT JOIN knowledge_points kp ON pk.knowledge_point_id = kp.id
        WHERE pk.province_code = $1
        AND pk.year >= EXTRACT(YEAR FROM CURRENT_DATE) - $2
      `;
      const knowledgeParams = [code, parseInt(years)];

      if (subject) {
        knowledgeParams.push(subject);
        knowledgeQuery += ' AND pk.subject = $3';
      }

      knowledgeQuery += `
        GROUP BY pk.knowledge_point_id, kp.name
        ORDER BY total_frequency DESC
        LIMIT 20
      `;

      const knowledgeResult = await pool.query(knowledgeQuery, knowledgeParams);
      const knowledgeRows = knowledgeResult.rows;

      return {
        province,
        papers: papersRows,
        knowledge_points: knowledgeRows,
        period: `近${years}年`
      };
    }, CACHE_CONFIG.DEFAULT_TTL);
    
    return { data: data ? { success: true, data } : null, cached };
  }

  static async getQuestionTypes(pool) {
    const key = CACHE_KEYS.QUESTION_TYPES();
    
    const { data, cached } = await cacheWrapper(key, async () => {
      const result = await pool.query(`
        SELECT DISTINCT question_type 
        FROM exam_questions 
        WHERE question_type IS NOT NULL AND question_type != ''
        ORDER BY question_type
      `);
      return result.rows.map(r => r.question_type);
    }, CACHE_CONFIG.LONG_TTL);
    
    return { data, cached };
  }

  static async getSubjectList(pool) {
    const key = CACHE_KEYS.SUBJECT_LIST();
    
    const { data, cached } = await cacheWrapper(key, async () => {
      const result = await pool.query(`
        SELECT DISTINCT subject_code 
        FROM exam_questions 
        WHERE subject_code IS NOT NULL AND subject_code != ''
        ORDER BY subject_code
      `);
      return result.rows.map(r => r.subject_code);
    }, CACHE_CONFIG.LONG_TTL);
    
    return { data, cached };
  }

  static async invalidateKnowledgePoints(subject) {
    const pattern = subject ? `kp:${subject}:*` : 'kp:*';
    await clearCache(pattern);
  }

  static async invalidateProvinces() {
    await clearCache('province:*');
  }

  static async invalidateProvinceStats(code) {
    const pattern = code ? `province_stats:${code}:*` : 'province_stats:*';
    await clearCache(pattern);
  }
}

export { CACHE_KEYS };