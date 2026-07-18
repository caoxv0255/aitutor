#!/usr/bin/env node
/**
 * 学科特性化数据库迁移脚本
 * 
 * 根据各学科独特的教学特点、评估方式和内容属性，对数据表结构进行全面优化
 * 
 * 学科差异化需求分析：
 * 
 * 📖 语文 (chinese)
 * - 知识点：文言文、诗词、现代文阅读、作文、文学常识
 * - 评估：阅读理解能力、写作能力、文言文翻译、名句默写
 * - 资源：课文、诗词、作文范文、阅读理解材料
 * - 进度：背诵进度、阅读理解训练、写作练习
 * 
 * 📚 英语 (english)
 * - 知识点：词汇、语法、阅读理解、完形填空、写作、听力
 * - 评估：词汇量、语法掌握、阅读速度、写作评分
 * - 资源：单词表、语法讲解、阅读材料、听力材料、写作范文
 * - 进度：单词背诵、语法练习、阅读训练、写作练习
 * 
 * 📜 历史 (history)
 * - 知识点：时间线、事件、人物、朝代、历史分期、文明发展
 * - 评估：时序分析、因果关系、史料解读、历史论证
 * - 资源：历史地图、史料原文、人物传记、事件分析
 * - 进度：时间线记忆、事件分析、史料研读
 * 
 * 🌍 地理 (geography)
 * - 知识点：自然地理、人文地理、区域地理、地图判读
 * - 评估：图表分析、空间定位、地理原理应用、区域分析
 * - 资源：地图、图表、遥感影像、地理数据
 * - 进度：地图判读练习、地理原理应用、区域分析
 * 
 * 🧬 生物 (biology)
 * - 知识点：细胞结构、代谢、遗传、生态、生命调节
 * - 评估：概念理解、实验设计、数据分析、遗传计算
 * - 资源：结构图、实验视频、遗传图谱、生态模型
 * - 进度：概念记忆、实验操作、遗传计算练习
 * 
 * 📊 政治 (politics)
 * - 知识点：经济生活、政治生活、文化生活、哲学
 * - 评估：概念理解、原理应用、材料分析、时政评论
 * - 资源：政策文件、时政新闻、哲学原著、案例分析
 * - 进度：概念记忆、原理应用、材料分析练习
 */
import { getDb } from '../api/core/db.js';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

async function run() {
  const db = await getDb();

  console.log('🚀 学科特性化数据库迁移');
  console.log('='.repeat(80));

  await createSubjectExtensionTables(db);
  await createSubjectKnowledgeTables(db);
  await createSubjectAssessmentTables(db);
  await createSubjectResourceTables(db);
  await createSubjectProgressTables(db);
  await createIndexes(db);

  console.log('\n✅ 迁移完成！');
}

async function createSubjectExtensionTables(db) {
  console.log('\n📦 创建学科专属题目扩展表...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS chinese_question_extension (
      id SERIAL PRIMARY KEY,
      question_id INTEGER UNIQUE REFERENCES exam_questions(id) ON DELETE CASCADE,
      text_type VARCHAR(30),
      literary_form VARCHAR(30),
      author VARCHAR(100),
      dynasty VARCHAR(50),
      literary_period VARCHAR(50),
      text_theme TEXT,
      rhetorical_devices TEXT,
      key_quotes TEXT,
      translation_requirements TEXT,
      comprehension_dimensions TEXT,
      essay_rubric JSONB DEFAULT '{}',
      writing_prompt TEXT,
      stylistic_requirements TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS english_question_extension (
      id SERIAL PRIMARY KEY,
      question_id INTEGER UNIQUE REFERENCES exam_questions(id) ON DELETE CASCADE,
      language_skills VARCHAR(50),
      vocabulary_level VARCHAR(30),
      grammar_topics TEXT,
      reading_genre VARCHAR(50),
      reading_difficulty VARCHAR(30),
      cloze_type VARCHAR(30),
      writing_type VARCHAR(30),
      writing_word_count INTEGER,
      listening_theme VARCHAR(100),
      pronunciation_focus TEXT,
      collocations TEXT,
      idioms TEXT,
      phrasal_verbs TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS history_question_extension (
      id SERIAL PRIMARY KEY,
      question_id INTEGER UNIQUE REFERENCES exam_questions(id) ON DELETE CASCADE,
      historical_period VARCHAR(50),
      historical_region VARCHAR(50),
      time_range VARCHAR(50),
      event_type VARCHAR(50),
      historical_figures TEXT,
      source_type VARCHAR(30),
      source_origin TEXT,
      chronological_analysis BOOLEAN DEFAULT FALSE,
      causal_analysis BOOLEAN DEFAULT FALSE,
      comparative_analysis BOOLEAN DEFAULT FALSE,
      historiographical_perspective TEXT,
      historical_interpretation TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS geography_question_extension (
      id SERIAL PRIMARY KEY,
      question_id INTEGER UNIQUE REFERENCES exam_questions(id) ON DELETE CASCADE,
      geography_field VARCHAR(30),
      map_type VARCHAR(30),
      spatial_scale VARCHAR(30),
      region_name VARCHAR(100),
      coordinate_system VARCHAR(30),
      climate_zone VARCHAR(50),
      landform_type VARCHAR(50),
      resource_type VARCHAR(50),
      environmental_issue VARCHAR(100),
      graph_type VARCHAR(30),
      data_source VARCHAR(100),
      spatial_analysis BOOLEAN DEFAULT FALSE,
      regional_comparison BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS biology_question_extension (
      id SERIAL PRIMARY KEY,
      question_id INTEGER UNIQUE REFERENCES exam_questions(id) ON DELETE CASCADE,
      biological_level VARCHAR(30),
      organism_type VARCHAR(50),
      biological_process VARCHAR(100),
      experimental_design BOOLEAN DEFAULT FALSE,
      data_analysis BOOLEAN DEFAULT FALSE,
      genetic_calculation BOOLEAN DEFAULT FALSE,
      ecological_model BOOLEAN DEFAULT FALSE,
      cell_type VARCHAR(50),
      molecular_biology BOOLEAN DEFAULT FALSE,
      evolutionary_context BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS politics_question_extension (
      id SERIAL PRIMARY KEY,
      question_id INTEGER UNIQUE REFERENCES exam_questions(id) ON DELETE CASCADE,
      political_domain VARCHAR(30),
      theoretical_framework TEXT,
      policy_analysis BOOLEAN DEFAULT FALSE,
      philosophical_concepts TEXT,
      economic_principles TEXT,
      political_institutions TEXT,
      cultural_perspectives TEXT,
      current_affairs BOOLEAN DEFAULT FALSE,
      case_study BOOLEAN DEFAULT FALSE,
      value_judgment BOOLEAN DEFAULT FALSE,
      argumentation_requirements TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log('  ✅ chinese_question_extension 创建完成');
  console.log('  ✅ english_question_extension 创建完成');
  console.log('  ✅ history_question_extension 创建完成');
  console.log('  ✅ geography_question_extension 创建完成');
  console.log('  ✅ biology_question_extension 创建完成');
  console.log('  ✅ politics_question_extension 创建完成');
}

async function createSubjectKnowledgeTables(db) {
  console.log('\n📚 创建学科专属知识维度表...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS chinese_knowledge_dimensions (
      id SERIAL PRIMARY KEY,
      knowledge_point_id VARCHAR(20) REFERENCES knowledge_points(id),
      dimension_type VARCHAR(30),
      literary_form VARCHAR(30),
      author_dynasty VARCHAR(50),
      text_category VARCHAR(50),
      rhetorical_device VARCHAR(50),
      difficulty_level VARCHAR(20),
      required_memoration BOOLEAN DEFAULT FALSE,
      exam_weight NUMERIC(4,2),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS english_knowledge_dimensions (
      id SERIAL PRIMARY KEY,
      knowledge_point_id VARCHAR(20) REFERENCES knowledge_points(id),
      dimension_type VARCHAR(30),
      vocabulary_category VARCHAR(30),
      grammar_level VARCHAR(20),
      proficiency_level VARCHAR(20),
      exam_weight NUMERIC(4,2),
      frequency_level VARCHAR(20),
      collocation_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS history_knowledge_dimensions (
      id SERIAL PRIMARY KEY,
      knowledge_point_id VARCHAR(20) REFERENCES knowledge_points(id),
      dimension_type VARCHAR(30),
      historical_period VARCHAR(50),
      historical_region VARCHAR(50),
      event_category VARCHAR(50),
      figure_type VARCHAR(50),
      chronological_order INTEGER,
      exam_weight NUMERIC(4,2),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS geography_knowledge_dimensions (
      id SERIAL PRIMARY KEY,
      knowledge_point_id VARCHAR(20) REFERENCES knowledge_points(id),
      dimension_type VARCHAR(30),
      geography_field VARCHAR(30),
      spatial_scale VARCHAR(30),
      region_category VARCHAR(50),
      map_skill VARCHAR(50),
      calculation_required BOOLEAN DEFAULT FALSE,
      exam_weight NUMERIC(4,2),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS biology_knowledge_dimensions (
      id SERIAL PRIMARY KEY,
      knowledge_point_id VARCHAR(20) REFERENCES knowledge_points(id),
      dimension_type VARCHAR(30),
      biological_level VARCHAR(30),
      organism_category VARCHAR(50),
      process_type VARCHAR(50),
      experimental_skill BOOLEAN DEFAULT FALSE,
      calculation_required BOOLEAN DEFAULT FALSE,
      diagram_required BOOLEAN DEFAULT FALSE,
      exam_weight NUMERIC(4,2),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS politics_knowledge_dimensions (
      id SERIAL PRIMARY KEY,
      knowledge_point_id VARCHAR(20) REFERENCES knowledge_points(id),
      dimension_type VARCHAR(30),
      political_domain VARCHAR(30),
      theoretical_level VARCHAR(20),
      application_type VARCHAR(50),
      current_affairs_relevance BOOLEAN DEFAULT FALSE,
      argumentation_required BOOLEAN DEFAULT FALSE,
      exam_weight NUMERIC(4,2),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log('  ✅ chinese_knowledge_dimensions 创建完成');
  console.log('  ✅ english_knowledge_dimensions 创建完成');
  console.log('  ✅ history_knowledge_dimensions 创建完成');
  console.log('  ✅ geography_knowledge_dimensions 创建完成');
  console.log('  ✅ biology_knowledge_dimensions 创建完成');
  console.log('  ✅ politics_knowledge_dimensions 创建完成');
}

async function createSubjectAssessmentTables(db) {
  console.log('\n📊 创建学科专属评估标准表...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS chinese_assessment_criteria (
      id SERIAL PRIMARY KEY,
      question_type VARCHAR(30),
      criteria_name VARCHAR(100),
      description TEXT,
      score_weight NUMERIC(4,2),
      level_descriptions JSONB DEFAULT '{}',
      rubric_details TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS english_assessment_criteria (
      id SERIAL PRIMARY KEY,
      question_type VARCHAR(30),
      criteria_name VARCHAR(100),
      description TEXT,
      score_weight NUMERIC(4,2),
      band_descriptions JSONB DEFAULT '{}',
      vocabulary_range VARCHAR(100),
      grammatical_accuracy BOOLEAN DEFAULT FALSE,
      coherence_requirements TEXT,
      task_response BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS history_assessment_criteria (
      id SERIAL PRIMARY KEY,
      question_type VARCHAR(30),
      criteria_name VARCHAR(100),
      description TEXT,
      score_weight NUMERIC(4,2),
      chronological_accuracy BOOLEAN DEFAULT FALSE,
      causal_reasoning BOOLEAN DEFAULT FALSE,
      evidence_evaluation BOOLEAN DEFAULT FALSE,
      historical_interpretation BOOLEAN DEFAULT FALSE,
      source_analysis BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS geography_assessment_criteria (
      id SERIAL PRIMARY KEY,
      question_type VARCHAR(30),
      criteria_name VARCHAR(100),
      description TEXT,
      score_weight NUMERIC(4,2),
      spatial_accuracy BOOLEAN DEFAULT FALSE,
      map_interpretation BOOLEAN DEFAULT FALSE,
      data_analysis BOOLEAN DEFAULT FALSE,
      regional_understanding BOOLEAN DEFAULT FALSE,
      principle_application BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS biology_assessment_criteria (
      id SERIAL PRIMARY KEY,
      question_type VARCHAR(30),
      criteria_name VARCHAR(100),
      description TEXT,
      score_weight NUMERIC(4,2),
      conceptual_understanding BOOLEAN DEFAULT FALSE,
      experimental_design BOOLEAN DEFAULT FALSE,
      data_interpretation BOOLEAN DEFAULT FALSE,
      genetic_analysis BOOLEAN DEFAULT FALSE,
      ecological_reasoning BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS politics_assessment_criteria (
      id SERIAL PRIMARY KEY,
      question_type VARCHAR(30),
      criteria_name VARCHAR(100),
      description TEXT,
      score_weight NUMERIC(4,2),
      theoretical_application BOOLEAN DEFAULT FALSE,
      policy_analysis BOOLEAN DEFAULT FALSE,
      argumentation_quality BOOLEAN DEFAULT FALSE,
      critical_thinking BOOLEAN DEFAULT FALSE,
      current_affairs_connection BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log('  ✅ chinese_assessment_criteria 创建完成');
  console.log('  ✅ english_assessment_criteria 创建完成');
  console.log('  ✅ history_assessment_criteria 创建完成');
  console.log('  ✅ geography_assessment_criteria 创建完成');
  console.log('  ✅ biology_assessment_criteria 创建完成');
  console.log('  ✅ politics_assessment_criteria 创建完成');
}

async function createSubjectResourceTables(db) {
  console.log('\n🎯 创建学科专属教学资源表...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS chinese_resources (
      id SERIAL PRIMARY KEY,
      resource_type VARCHAR(30),
      title VARCHAR(200),
      author VARCHAR(100),
      dynasty VARCHAR(50),
      literary_form VARCHAR(30),
      content TEXT,
      text_analysis TEXT,
      translation TEXT,
      annotation TEXT,
      audio_path VARCHAR(500),
      difficulty_level VARCHAR(20),
      knowledge_point_ids TEXT,
      exam_relevance VARCHAR(20),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS english_resources (
      id SERIAL PRIMARY KEY,
      resource_type VARCHAR(30),
      title VARCHAR(200),
      source_url VARCHAR(500),
      content TEXT,
      vocabulary_list TEXT,
      grammar_points TEXT,
      audio_path VARCHAR(500),
      reading_level VARCHAR(20),
      word_count INTEGER,
      knowledge_point_ids TEXT,
      exam_relevance VARCHAR(20),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS history_resources (
      id SERIAL PRIMARY KEY,
      resource_type VARCHAR(30),
      title VARCHAR(200),
      historical_period VARCHAR(50),
      historical_region VARCHAR(50),
      source_type VARCHAR(30),
      original_text TEXT,
      translation TEXT,
      interpretation TEXT,
      map_path VARCHAR(500),
      timeline_data JSONB DEFAULT '{}',
      knowledge_point_ids TEXT,
      exam_relevance VARCHAR(20),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS geography_resources (
      id SERIAL PRIMARY KEY,
      resource_type VARCHAR(30),
      title VARCHAR(200),
      geography_field VARCHAR(30),
      region_name VARCHAR(100),
      map_path VARCHAR(500),
      graph_path VARCHAR(500),
      data_source VARCHAR(200),
      coordinate_data JSONB DEFAULT '{}',
      climate_data JSONB DEFAULT '{}',
      knowledge_point_ids TEXT,
      exam_relevance VARCHAR(20),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS biology_resources (
      id SERIAL PRIMARY KEY,
      resource_type VARCHAR(30),
      title VARCHAR(200),
      biological_level VARCHAR(30),
      organism_type VARCHAR(50),
      diagram_path VARCHAR(500),
      video_path VARCHAR(500),
      experiment_protocol TEXT,
      data_set JSONB DEFAULT '{}',
      genetic_map JSONB DEFAULT '{}',
      knowledge_point_ids TEXT,
      exam_relevance VARCHAR(20),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS politics_resources (
      id SERIAL PRIMARY KEY,
      resource_type VARCHAR(30),
      title VARCHAR(200),
      political_domain VARCHAR(30),
      source_url VARCHAR(500),
      content TEXT,
      policy_document BOOLEAN DEFAULT FALSE,
      theoretical_framework TEXT,
      case_study BOOLEAN DEFAULT FALSE,
      current_affairs BOOLEAN DEFAULT FALSE,
      knowledge_point_ids TEXT,
      exam_relevance VARCHAR(20),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log('  ✅ chinese_resources 创建完成');
  console.log('  ✅ english_resources 创建完成');
  console.log('  ✅ history_resources 创建完成');
  console.log('  ✅ geography_resources 创建完成');
  console.log('  ✅ biology_resources 创建完成');
  console.log('  ✅ politics_resources 创建完成');
}

async function createSubjectProgressTables(db) {
  console.log('\n📈 创建学科专属学习进度跟踪表...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS chinese_learning_progress (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      knowledge_point_id VARCHAR(20) REFERENCES knowledge_points(id),
      text_memorization BOOLEAN DEFAULT FALSE,
      translation_accuracy NUMERIC(5,2) DEFAULT 0,
      comprehension_score NUMERIC(5,2) DEFAULT 0,
      writing_practice_count INTEGER DEFAULT 0,
      essay_score_avg NUMERIC(5,2) DEFAULT 0,
      last_practice_at TIMESTAMPTZ,
      practice_count INTEGER DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, knowledge_point_id)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS english_learning_progress (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      knowledge_point_id VARCHAR(20) REFERENCES knowledge_points(id),
      vocabulary_mastery NUMERIC(5,2) DEFAULT 0,
      grammar_accuracy NUMERIC(5,2) DEFAULT 0,
      reading_speed_wpm INTEGER DEFAULT 0,
      reading_comprehension NUMERIC(5,2) DEFAULT 0,
      writing_score_avg NUMERIC(5,2) DEFAULT 0,
      listening_comprehension NUMERIC(5,2) DEFAULT 0,
      speaking_practice_count INTEGER DEFAULT 0,
      last_practice_at TIMESTAMPTZ,
      practice_count INTEGER DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, knowledge_point_id)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS history_learning_progress (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      knowledge_point_id VARCHAR(20) REFERENCES knowledge_points(id),
      timeline_mastery NUMERIC(5,2) DEFAULT 0,
      event_analysis_score NUMERIC(5,2) DEFAULT 0,
      source_analysis_score NUMERIC(5,2) DEFAULT 0,
      causal_reasoning_score NUMERIC(5,2) DEFAULT 0,
      historical_period_count INTEGER DEFAULT 0,
      last_practice_at TIMESTAMPTZ,
      practice_count INTEGER DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, knowledge_point_id)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS geography_learning_progress (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      knowledge_point_id VARCHAR(20) REFERENCES knowledge_points(id),
      map_interpretation_score NUMERIC(5,2) DEFAULT 0,
      spatial_location_score NUMERIC(5,2) DEFAULT 0,
      data_analysis_score NUMERIC(5,2) DEFAULT 0,
      regional_analysis_score NUMERIC(5,2) DEFAULT 0,
      graph_interpretation_score NUMERIC(5,2) DEFAULT 0,
      last_practice_at TIMESTAMPTZ,
      practice_count INTEGER DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, knowledge_point_id)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS biology_learning_progress (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      knowledge_point_id VARCHAR(20) REFERENCES knowledge_points(id),
      concept_mastery NUMERIC(5,2) DEFAULT 0,
      experimental_design_score NUMERIC(5,2) DEFAULT 0,
      data_analysis_score NUMERIC(5,2) DEFAULT 0,
      genetic_calculation_score NUMERIC(5,2) DEFAULT 0,
      ecological_reasoning_score NUMERIC(5,2) DEFAULT 0,
      diagram_analysis_score NUMERIC(5,2) DEFAULT 0,
      last_practice_at TIMESTAMPTZ,
      practice_count INTEGER DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, knowledge_point_id)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS politics_learning_progress (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      knowledge_point_id VARCHAR(20) REFERENCES knowledge_points(id),
      concept_mastery NUMERIC(5,2) DEFAULT 0,
      principle_application_score NUMERIC(5,2) DEFAULT 0,
      policy_analysis_score NUMERIC(5,2) DEFAULT 0,
      argumentation_score NUMERIC(5,2) DEFAULT 0,
      philosophical_reasoning_score NUMERIC(5,2) DEFAULT 0,
      current_affairs_connection_score NUMERIC(5,2) DEFAULT 0,
      last_practice_at TIMESTAMPTZ,
      practice_count INTEGER DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, knowledge_point_id)
    );
  `);

  console.log('  ✅ chinese_learning_progress 创建完成');
  console.log('  ✅ english_learning_progress 创建完成');
  console.log('  ✅ history_learning_progress 创建完成');
  console.log('  ✅ geography_learning_progress 创建完成');
  console.log('  ✅ biology_learning_progress 创建完成');
  console.log('  ✅ politics_learning_progress 创建完成');
}

async function createIndexes(db) {
  console.log('\n🔑 创建索引...');

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_cqe_question ON chinese_question_extension(question_id);
    CREATE INDEX IF NOT EXISTS idx_cqe_text_type ON chinese_question_extension(text_type);
    CREATE INDEX IF NOT EXISTS idx_cqe_author ON chinese_question_extension(author);
    CREATE INDEX IF NOT EXISTS idx_cqe_dynasty ON chinese_question_extension(dynasty);
    
    CREATE INDEX IF NOT EXISTS idx_eqe_question ON english_question_extension(question_id);
    CREATE INDEX IF NOT EXISTS idx_eqe_skill ON english_question_extension(language_skills);
    CREATE INDEX IF NOT EXISTS idx_eqe_vocab ON english_question_extension(vocabulary_level);
    
    CREATE INDEX IF NOT EXISTS idx_hqe_question ON history_question_extension(question_id);
    CREATE INDEX IF NOT EXISTS idx_hqe_period ON history_question_extension(historical_period);
    CREATE INDEX IF NOT EXISTS idx_hqe_region ON history_question_extension(historical_region);
    
    CREATE INDEX IF NOT EXISTS idx_gqe_question ON geography_question_extension(question_id);
    CREATE INDEX IF NOT EXISTS idx_gqe_field ON geography_question_extension(geography_field);
    CREATE INDEX IF NOT EXISTS idx_gqe_region ON geography_question_extension(region_name);
    
    CREATE INDEX IF NOT EXISTS idx_bqe_question ON biology_question_extension(question_id);
    CREATE INDEX IF NOT EXISTS idx_bqe_level ON biology_question_extension(biological_level);
    CREATE INDEX IF NOT EXISTS idx_bqe_organism ON biology_question_extension(organism_type);
    
    CREATE INDEX IF NOT EXISTS idx_pqe_question ON politics_question_extension(question_id);
    CREATE INDEX IF NOT EXISTS idx_pqe_domain ON politics_question_extension(political_domain);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_ckd_kp ON chinese_knowledge_dimensions(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_ckd_dimension ON chinese_knowledge_dimensions(dimension_type);
    
    CREATE INDEX IF NOT EXISTS idx_ekd_kp ON english_knowledge_dimensions(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_ekd_level ON english_knowledge_dimensions(proficiency_level);
    
    CREATE INDEX IF NOT EXISTS idx_hkd_kp ON history_knowledge_dimensions(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_hkd_period ON history_knowledge_dimensions(historical_period);
    
    CREATE INDEX IF NOT EXISTS idx_gkd_kp ON geography_knowledge_dimensions(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_gkd_field ON geography_knowledge_dimensions(geography_field);
    
    CREATE INDEX IF NOT EXISTS idx_bkd_kp ON biology_knowledge_dimensions(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_bkd_level ON biology_knowledge_dimensions(biological_level);
    
    CREATE INDEX IF NOT EXISTS idx_pkd_kp ON politics_knowledge_dimensions(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_pkd_domain ON politics_knowledge_dimensions(political_domain);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_cac_type ON chinese_assessment_criteria(question_type);
    CREATE INDEX IF NOT EXISTS idx_eac_type ON english_assessment_criteria(question_type);
    CREATE INDEX IF NOT EXISTS idx_hac_type ON history_assessment_criteria(question_type);
    CREATE INDEX IF NOT EXISTS idx_gac_type ON geography_assessment_criteria(question_type);
    CREATE INDEX IF NOT EXISTS idx_bac_type ON biology_assessment_criteria(question_type);
    CREATE INDEX IF NOT EXISTS idx_pac_type ON politics_assessment_criteria(question_type);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_cr_type ON chinese_resources(resource_type);
    CREATE INDEX IF NOT EXISTS idx_cr_author ON chinese_resources(author);
    CREATE INDEX IF NOT EXISTS idx_er_type ON english_resources(resource_type);
    CREATE INDEX IF NOT EXISTS idx_hr_type ON history_resources(resource_type);
    CREATE INDEX IF NOT EXISTS idx_hr_period ON history_resources(historical_period);
    CREATE INDEX IF NOT EXISTS idx_gr_type ON geography_resources(resource_type);
    CREATE INDEX IF NOT EXISTS idx_gr_region ON geography_resources(region_name);
    CREATE INDEX IF NOT EXISTS idx_br_type ON biology_resources(resource_type);
    CREATE INDEX IF NOT EXISTS idx_pr_type ON politics_resources(resource_type);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_clp_user ON chinese_learning_progress(user_email);
    CREATE INDEX IF NOT EXISTS idx_clp_kp ON chinese_learning_progress(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_clp_user_kp ON chinese_learning_progress(user_email, knowledge_point_id);
    
    CREATE INDEX IF NOT EXISTS idx_elp_user ON english_learning_progress(user_email);
    CREATE INDEX IF NOT EXISTS idx_elp_kp ON english_learning_progress(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_elp_user_kp ON english_learning_progress(user_email, knowledge_point_id);
    
    CREATE INDEX IF NOT EXISTS idx_hlp_user ON history_learning_progress(user_email);
    CREATE INDEX IF NOT EXISTS idx_hlp_kp ON history_learning_progress(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_hlp_user_kp ON history_learning_progress(user_email, knowledge_point_id);
    
    CREATE INDEX IF NOT EXISTS idx_glp_user ON geography_learning_progress(user_email);
    CREATE INDEX IF NOT EXISTS idx_glp_kp ON geography_learning_progress(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_glp_user_kp ON geography_learning_progress(user_email, knowledge_point_id);
    
    CREATE INDEX IF NOT EXISTS idx_blp_user ON biology_learning_progress(user_email);
    CREATE INDEX IF NOT EXISTS idx_blp_kp ON biology_learning_progress(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_blp_user_kp ON biology_learning_progress(user_email, knowledge_point_id);
    
    CREATE INDEX IF NOT EXISTS idx_plp_user ON politics_learning_progress(user_email);
    CREATE INDEX IF NOT EXISTS idx_plp_kp ON politics_learning_progress(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_plp_user_kp ON politics_learning_progress(user_email, knowledge_point_id);
  `);

  console.log('  ✅ 索引创建完成');
}

run().catch(err => {
  console.error('迁移失败:', err);
  process.exit(1);
});
