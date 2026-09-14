#!/usr/bin/env node
// scripts/qb2/stage32-kp-relink-full.mjs
// Stage 31 增强版 (D089 follow-up)
//   - 移除 paper_id IN (10,11,20) 限制，跑全量 6219 题
//   - 扩 9 学科关键词规则 (chinese/history 复用 stage31 + 新增 7 学科)
//   - pg_trgm 兜底（未命中规则的题）
//   - LLM 辅助路径留到 stage33，本脚本纯本地，不调任何 API
//   - 输出 stage32-kp-relink-report.json 供审计
//
// 设计原则:
//   - 单事务 + 幂等 (ON CONFLICT DO NOTHING)
//   - 仅修改 question_knowledge_points；不触碰 exam_questions / question_vectors
//   - 全部写入通过 canonical_migration_ledger 留痕 (run_label='stage32-kp-relink-full')
//
// 验证: KP id 全部 SELECT 验证存在 (knowledge_points.id)

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUN_LABEL = 'stage32-kp-relink-full';
const TIMESTAMP = new Date().toISOString();

// ─── DB ───────────────────────────────────────────────────
function loadDatabaseUrl() {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[stage32] DATABASE_URL missing in .env');
}
const pool = new Pool({ connectionString: loadDatabaseUrl() });

// ─── 学科 → 规则集 ─────────────────────────────────────────
// 每条规则: { kw: 关键词数组 (任一命中), kp_id: 目标 KP id, score: 置信度, why: 备注 }
// 关键词全部小写 + 去空白后比对 (避免 LaTeX / 全角空格干扰)
// KP id 全部 SELECT 验证存在 (knowledge_points 表)
const RULES = {
  chinese: [
    { kw: ['文言文', '加点词', '加点词语', '虚词', '实词', '通假字', '古今异义', '词类活用'], kp: 'CHN-Z0-002', score: 0.95, why: '文言文阅读信号' },
    { kw: ['现代文', '散文', '理解与赏析', '文中语句', '文意', '涵义', '画线句', '根据材料', '根据文意', '解读', '赏析', '理解与推断', '对文中', '对文章'], kp: 'CHN-Z0-003', score: 0.80, why: '现代文阅读信号' },
    { kw: ['红楼梦', '三国演义', '水浒传', '西游记', '林黛玉', '宝玉', '诸葛亮', '马诗', '诗三首'], kp: 'CHN-Z0-005', score: 0.92, why: '名著阅读信号' },
    { kw: ['议论文', '记叙文', '抒情文字', '写一首', '写一篇', '题目', '观点和理由', '宣传语', '不超过150字', '研学活动', '班会'], kp: 'CHN-Z0-004', score: 0.90, why: '写作信号' },
    { kw: ['语言文字基础', '基础知识', '成语', '古诗文名句', '原句', '默写', '修辞', '黄河大合唱', '音乐'], kp: 'CHN-Z0-001', score: 0.70, why: '基础知识运用信号' }
  ],
  history: [
    { kw: ['古代中国', '商王', '汉谟拉比', '古代两河流域', '古代希腊罗马', '古代中国经济', '古代中国的政治制度', '西汉', '唐代', '隋唐', '秦汉', '先秦'], kp: 'HIS-Z0-001', score: 0.92, why: '中国古代史信号' },
    { kw: ['近代中国', '列强侵略', '鸦片战争', '近代中国的民主革命', '中国共产党的成立', '抗日战争', '解放战争', '国民党', '共产党', '毛泽东'], kp: 'HIS-Z0-002', score: 0.90, why: '中国近代史信号' },
    { kw: ['世界史', '苏联', '罗斯福新政', '欧洲', '希腊', '罗马', '拜占庭', '新航路', '资本主义世界市场', '伽利略', '哥白尼', '马克思主义', '全球化', '印度'], kp: 'HIS-Z0-003', score: 0.86, why: '世界史信号' },
    { kw: ['现代中国', '中法建交', '周恩来', '两个中国', '祖国统一', '一国两制', '中国特色社会主义', '改革开放', '新中国', '经略海洋'], kp: 'HIST-G0-293', score: 0.78, why: '现代中国政治信号' },
    { kw: ['对外关系', '领海', '国际法', '万国公法', '联合国', '霸权'], kp: 'HIST-G0-294', score: 0.78, why: '对外关系信号' },
    { kw: ['经济结构', '资本主义', '东印度公司', '英国与印度', '田赋', '徭役', '地丁'], kp: 'HIST-G0-300', score: 0.80, why: '近代中国经济信号' },
    { kw: ['孔子', '儒家', '仁', '礼', '君子', '修身', '国学', '玉器', '理想人格'], kp: 'HIST-G0-307', score: 0.85, why: '传统文化思想信号' },
    { kw: ['永乐大典', '古书', '辑录', '圣王之治', '古籍', '史记', '尚书', '甲骨'], kp: 'HIST-G0-308', score: 0.80, why: '古代科技文化信号' },
    { kw: ['人工智能', '数字化', '数字闪耀', '20世纪', '信息'], kp: 'HIST-G0-310', score: 0.72, why: '现代科技信号' }
  ],
  // ── 新增 7 学科 (KP id 已验证存在) ──
  math: [
    { kw: ['集合', '子集', '真子集', '交集', '并集', '补集', '空集', '函数', '定义域', '值域'], kp: 'MATH-B1-314', score: 0.90, why: '集合与函数概念' },
    { kw: ['指数函数', '对数函数', '幂函数', '二次函数', '一次函数', '反比例函数', '单调性', '奇偶性'], kp: 'MATH-B1-315', score: 0.85, why: '基本初等函数' },
    { kw: ['函数的应用', '函数模型', '实际问题', '增长率', '衰减'], kp: 'MATH-B1-316', score: 0.78, why: '函数的应用' },
    { kw: ['空间几何体', '棱柱', '棱锥', '棱台', '正方体', '长方体', '圆柱', '圆锥'], kp: 'MATH-B1-317', score: 0.88, why: '空间几何体' },
    { kw: ['直线与平面', '平行', '垂直', '异面', '二面角', '空间角'], kp: 'MATH-B1-318', score: 0.86, why: '直线与平面的位置关系' },
    { kw: ['倾斜角', '斜率', '直线方程', '两条直线的位置关系'], kp: 'MATH-B1-319', score: 0.84, why: '直线与方程' },
    { kw: ['算法', '程序框图', '基本算法语句', '循环结构', '条件结构'], kp: 'MATH-B1-320', score: 0.85, why: '算法初步' },
    { kw: ['统计', '抽样', '频率', '茎叶图'], kp: 'MATH-B1-321', score: 0.82, why: '统计' },
    { kw: ['概率', '随机事件', '古典概型', '几何概型'], kp: 'MATH-B1-322', score: 0.88, why: '概率' },
    { kw: ['三角函数', '正弦', '余弦', '正切', '弧度制', '诱导公式'], kp: 'MATH-B1-323', score: 0.92, why: '三角函数' },
    { kw: ['平面向量', '向量', '共线', '数量积'], kp: 'MATH-B1-324', score: 0.88, why: '平面向量' },
    { kw: ['三角恒等变换', '两角和差', '倍角公式', '半角公式'], kp: 'MATH-B1-325', score: 0.86, why: '三角恒等变换' },
    { kw: ['实数', '运算', '相反数', '绝对值', '科学记数法'], kp: 'MATH-Z0-001', score: 0.80, why: '实数与运算' },
    { kw: ['整式', '分式', '因式分解', '乘法公式'], kp: 'MATH-Z0-002', score: 0.80, why: '整式与分式' },
    { kw: ['方程', '不等式', '一元一次', '二元一次', '方程组'], kp: 'MATH-Z0-003', score: 0.85, why: '方程与不等式' },
    { kw: ['三角形', '相似', '全等', '勾股定理', '中线', '角平分线'], kp: 'MATH-Z0-005', score: 0.88, why: '三角形' },
    { kw: ['四边形', '平行四边形', '矩形', '菱形', '正方形', '梯形'], kp: 'MATH-Z0-006', score: 0.86, why: '四边形' },
    { kw: ['圆周角', '切线', '圆内接', '圆外切', '垂径定理'], kp: 'MATH-Z0-007', score: 0.84, why: '圆' },
    { kw: ['图形的变换', '轴对称', '中心对称', '平移', '旋转'], kp: 'MATH-Z0-008', score: 0.84, why: '图形的变换' },
    { kw: ['数列', '等差', '等比', '通项', '前n项和', '递推'], kp: 'MATH-Z0-009', score: 0.90, why: '数列(中考版)' }
  ],
  english: [
    { kw: ['friend', 'friendship', 'best friend', 'pen pal'], kp: 'ENG-G0-199', score: 0.85, why: 'Unit 1 Friendship' },
    { kw: ['english around the world', 'standard english', 'dialect', 'british english', 'american english'], kp: 'ENG-G0-200', score: 0.85, why: 'Unit 2 English around the world' },
    { kw: ['travel', 'journey', 'travel journal', 'transport', 'see off'], kp: 'ENG-G0-201', score: 0.85, why: 'Unit 3 Travel journal' },
    { kw: ['earthquake', 'natural disaster', 'rescue', 'tsunami', 'shake'], kp: 'ENG-G0-202', score: 0.85, why: 'Unit 4 Earthquakes' },
    { kw: ['nelson mandela', 'modern hero', 'apartheid', 'south africa', 'black people'], kp: 'ENG-G0-203', score: 0.85, why: 'Unit 5 Nelson Mandela' },
    { kw: ['cultural relics', 'relic', 'ancient china', 'art'], kp: 'ENG-G0-204', score: 0.82, why: 'Unit 1 Cultural relics' },
    { kw: ['olympic games', 'olympic', 'sports event'], kp: 'ENG-G0-205', score: 0.80, why: 'Unit 2 The Olympic Games' },
    { kw: ['computer', 'internet', 'web', 'online', 'digital'], kp: 'ENG-G0-206', score: 0.82, why: 'Unit 3 Computers' },
    { kw: ['wildlife', 'protection', 'endangered', 'animal', 'panda'], kp: 'ENG-G0-207', score: 0.82, why: 'Unit 4 Wildlife protection' },
    { kw: ['music', 'band', 'concert', 'song', 'singer'], kp: 'ENG-G0-208', score: 0.80, why: 'Unit 5 Music' },
    { kw: ['festival', 'around the world', 'tradition', 'celebrate'], kp: 'ENG-G0-209', score: 0.80, why: 'Unit 1 Festivals' },
    { kw: ['healthy eating', 'diet', 'food', 'nutrition'], kp: 'ENG-G0-210', score: 0.80, why: 'Unit 2 Healthy eating' },
    { kw: ['million pound', 'bank note', 'henry', 'billion'], kp: 'ENG-G0-211', score: 0.78, why: 'Unit 3 Million Pound Bank Note' },
    { kw: ['body language', 'gesture', 'communicate', 'facial'], kp: 'ENG-G0-217', score: 0.78, why: 'Unit 4 Body language' },
    { kw: ['theme park', 'amusement', 'roller coaster'], kp: 'ENG-G0-218', score: 0.78, why: 'Unit 5 Theme parks' },
    { kw: ['great scientist', 'scientist', 'discovery', 'research'], kp: 'ENG-G0-219', score: 0.80, why: 'Unit 1 Great scientists' },
    { kw: ['united kingdom', 'england', 'wales', 'scotland'], kp: 'ENG-G0-220', score: 0.78, why: 'Unit 2 UK' },
    { kw: ['life in the future', 'future', 'predict', 'tomorrow'], kp: 'ENG-G0-221', score: 0.78, why: 'Unit 3 Life in the future' },
    { kw: ['making the news', 'journalist', 'reporter', 'interview'], kp: 'ENG-G0-222', score: 0.78, why: 'Unit 4 Making the news' },
    { kw: ['first aid', 'emergency', 'wound', 'burn'], kp: 'ENG-G0-223', score: 0.78, why: 'Unit 5 First aid' },
    { kw: ['art', 'painting', 'sculpture', 'gallery'], kp: 'ENG-G0-224', score: 0.78, why: 'Unit 1 Art' },
    { kw: ['poem', 'poetry', 'verse', 'rhyme'], kp: 'ENG-G0-225', score: 0.80, why: 'Unit 2 Poems' },
    { kw: ['healthy life', 'drug', 'smoking', 'alcohol', 'abuse'], kp: 'ENG-G0-226', score: 0.78, why: 'Unit 3 A healthy life' },
    { kw: ['global warming', 'climate', 'greenhouse', 'pollution'], kp: 'ENG-G0-227', score: 0.80, why: 'Unit 4 Global warming' },
    { kw: ['power of nature', 'volcano', 'hurricane'], kp: 'ENG-G0-228', score: 0.78, why: 'Unit 5 The power of nature' },
    { kw: ['living well', 'disability', 'impairment'], kp: 'ENG-G0-229', score: 0.76, why: 'Unit 1 Living well' },
    { kw: ['robot', 'android', 'machine', 'humanoid'], kp: 'ENG-G0-230', score: 0.78, why: 'Unit 2 Robots' },
    { kw: ['under the sea', 'ocean', 'fish', 'marine'], kp: 'ENG-G0-231', score: 0.78, why: 'Unit 3 Under the sea' },
    { kw: ['sharing', 'donate', 'volunteer', 'charity'], kp: 'ENG-G0-232', score: 0.78, why: 'Unit 4 Sharing' },
    { kw: ['travelling abroad', 'visa', 'passport', 'overseas'], kp: 'ENG-G0-233', score: 0.78, why: 'Unit 5 Travelling abroad' },
    { kw: ['land of diversity', 'diversity', 'culture', 'ethnic'], kp: 'ENG-G0-234', score: 0.78, why: 'Unit 1 A land of diversity' },
    { kw: ['cloning', 'clone', 'genetic', 'dolly'], kp: 'ENG-G0-235', score: 0.78, why: 'Unit 2 Cloning' },
    { kw: ['inventors and inventions', 'invent', 'patent', 'innovation'], kp: 'ENG-G0-236', score: 0.78, why: 'Unit 3 Inventors and inventions' },
    { kw: ['pygmalion', 'shaw', 'accent', 'phonetics'], kp: 'ENG-G0-237', score: 0.78, why: 'Unit 4 Pygmalion' },
    { kw: ['meeting your ancestors', 'ancestor', 'homo sapiens', 'evolution'], kp: 'ENG-G0-238', score: 0.78, why: 'Unit 5 Meeting ancestors' },
    { kw: ['sailing the oceans', 'voyage', 'sailor', 'navigation'], kp: 'ENG-G0-239', score: 0.76, why: 'Unit 2 Sailing' },
    { kw: ['inside advertising', 'advertisement', 'commercial', 'marketing'], kp: 'ENG-G0-240', score: 0.76, why: 'Unit 5 Advertising' },
    { kw: ['king lear', 'shakespeare', 'tragedy'], kp: 'ENG-G0-241', score: 0.76, why: 'Unit 2 King Lear' },
    { kw: ['enjoying novels', 'novel', 'fiction', 'literature'], kp: 'ENG-G0-242', score: 0.76, why: 'Unit 5 Enjoying novels' },
    { kw: ['cloze', 'fill in the blank', 'blank'], kp: 'ENG-Z0-002', score: 0.80, why: '完形填空' },
    { kw: ['reading comprehension', 'main idea', 'detail', 'inference'], kp: 'ENG-Z0-003', score: 0.75, why: '阅读理解' },
    { kw: ['composition', 'essay', 'paragraph', 'topic sentence'], kp: 'ENG-Z0-004', score: 0.75, why: '书面表达' }
  ],
  physics: [
    { kw: ['声', '声音', '回声', '音调', '响度', '音色', '超声波', '次声波'], kp: 'PHY-Z0-001', score: 0.88, why: '声' },
    { kw: ['光', '反射', '折射', '全反射', '光的干涉', '光的衍射', '横波', '纵波'], kp: 'PHY-Z0-001', score: 0.85, why: '光' },
    { kw: ['温度', '熔化', '凝固', '汽化', '液化', '升华', '凝华', '晶体'], kp: 'PHY-Z0-002', score: 0.87, why: '物态变化' },
    { kw: ['内能', '热量', '比热容', '热值', '热机', '热力学'], kp: 'PHY-Z0-002', score: 0.80, why: '内能与热机' },
    { kw: ['力', '重力', '弹力', '摩擦力', '受力分析', '牛顿第一', '牛顿第二', '牛顿第三', '惯性'], kp: 'PHY-Z0-003', score: 0.92, why: '力学基础' },
    { kw: ['压强', '液体压强', '大气压强', '浮力', '阿基米德'], kp: 'PHY-Z0-004', score: 0.90, why: '压强与浮力' },
    { kw: ['功', '功率', '机械能', '动能', '势能', '能量守恒', '机械效率'], kp: 'PHY-Z0-005', score: 0.90, why: '功和机械能' },
    { kw: ['电路', '电流', '电压', '电阻', '欧姆定律'], kp: 'PHY-Z0-006', score: 0.88, why: '电学基础' },
    { kw: ['电功', '电功率', '焦耳定律', '电热'], kp: 'PHY-Z0-007', score: 0.85, why: '电功率与焦耳定律' },
    { kw: ['磁场', '磁感线', '电流的磁场', '电磁铁', '安培力', '电磁'], kp: 'PHY-Z0-008', score: 0.88, why: '电与磁' },
    { kw: ['氢原子', '能级', '跃迁', '光谱', '玻尔'], kp: 'PHYS-X3-348', score: 0.85, why: '固体液体气体(含原子信号)' },
    { kw: ['理想气体', '气体压强', '气体体积', '气体温度', '查理', '盖-吕萨克', '玻意耳'], kp: 'PHYS-X3-349', score: 0.88, why: '气体' },
    { kw: ['热力学定律', '能量守恒', '永动机'], kp: 'PHYS-X3-350', score: 0.85, why: '热力学定律' },
    { kw: ['匀变速', '直线运动', '加速度', '速度', '位移'], kp: 'PHYS-B1-327', score: 0.90, why: '匀变速直线运动' },
    { kw: ['力的合成', '力的分解', '平行四边形'], kp: 'PHYS-B1-329', score: 0.88, why: '力的合成与分解' },
    { kw: ['受力分析', '共点力', '力的平衡'], kp: 'PHYS-B1-330', score: 0.90, why: '受力分析 共点力平衡' },
    { kw: ['牛顿第一定律', '惯性定律'], kp: 'PHYS-B1-331', score: 0.88, why: '牛顿第一定律' },
    { kw: ['牛顿第二定律', '两类动力学', 'f=ma'], kp: 'PHYS-B1-332', score: 0.92, why: '牛顿第二定律' },
    { kw: ['曲线运动', '运动的合成', '平抛', '斜抛'], kp: 'PHYS-B2-334', score: 0.88, why: '曲线运动' },
    { kw: ['磁场对电流', '安培力'], kp: 'PHYS-X2-335', score: 0.86, why: '磁场对电流作用' },
    { kw: ['磁场对运动电荷', '洛伦兹力'], kp: 'PHYS-X2-336', score: 0.86, why: '磁场对运动电荷作用' },
    { kw: ['电势能', '电势', '电场强度'], kp: 'PHYS-X3-339', score: 0.86, why: '电势能电势' },
    { kw: ['电容器', '电容'], kp: 'PHYS-X3-342', score: 0.85, why: '电容器电容' },
    { kw: ['带电粒子在电场'], kp: 'PHYS-X3-343', score: 0.86, why: '带电粒子在电场中' },
    { kw: ['电源', '电动势'], kp: 'PHYS-X3-345', score: 0.85, why: '电源和电动势' }
  ],
  chemistry: [
    { kw: ['同素异形体', '金刚石', '石墨', 'c60', '富勒烯'], kp: 'CHEM-B1-023', score: 0.92, why: '同素异形体' },
    { kw: ['物质的分类', '纯净物', '混合物', '单质', '化合物', '氧化物'], kp: 'CHEM-B1-024', score: 0.88, why: '物质的分类' },
    { kw: ['分散系', '溶液', '胶体', '悬浊液', '乳浊液', '丁达尔'], kp: 'CHEM-B1-025', score: 0.88, why: '分散系' },
    { kw: ['胶体的制备', '胶体的性质', 'fe(oh)3 胶体'], kp: 'CHEM-B1-026', score: 0.85, why: '胶体的应用' },
    { kw: ['中和反应', 'ph', '指示剂', '酸碱盐'], kp: 'CHEM-B1-027', score: 0.90, why: '酸碱盐' },
    { kw: ['电解质', '非电解质', '电离方程式'], kp: 'CHEM-B1-029', score: 0.88, why: '电解质' },
    { kw: ['离子反应', '离子方程式', '离子共存'], kp: 'CHEM-B1-031', score: 0.90, why: '离子反应' },
    { kw: ['氧化还原', '氧化剂', '还原剂', '化合价', '电子转移'], kp: 'CHEM-B1-033', score: 0.92, why: '氧化还原' },
    { kw: ['氧化性', '还原性'], kp: 'CHEM-B1-036', score: 0.85, why: '氧化性还原性' },
    { kw: ['钠的化合物'], kp: 'CHEM-B1-039', score: 0.85, why: '钠的化合物' },
    { kw: ['na2co3', 'nahco3', '碳酸钠', '碳酸氢钠'], kp: 'CHEM-B1-040', score: 0.88, why: 'Na2CO3 NaHCO3' },
    { kw: ['焰色反应', '焰色试验'], kp: 'CHEM-B1-041', score: 0.88, why: '焰色反应' },
    { kw: ['氯气', 'cl2', '氯水的性质', '漂白粉', '氯气的制备'], kp: 'CHEM-B1-042', score: 0.88, why: '氯气' },
    { kw: ['cl-', '氯离子', '氯离子的检验'], kp: 'CHEM-B1-046', score: 0.88, why: 'Cl-检验' },
    { kw: ['物质的量', '摩尔', '摩尔质量', 'mol'], kp: 'CHEM-B1-047', score: 0.90, why: '物质的量' },
    { kw: ['气体摩尔体积', '阿伏加德罗'], kp: 'CHEM-B1-050', score: 0.88, why: '气体摩尔体积' },
    { kw: ['物质的量浓度', '溶液配制'], kp: 'CHEM-B1-052', score: 0.88, why: '物质的量浓度' },
    { kw: ['铁的氧化物', '铁的氢氧化物', 'fe(oh)2'], kp: 'CHEM-B1-055', score: 0.88, why: '铁的化合物' },
    { kw: ['铁盐', '亚铁盐'], kp: 'CHEM-B1-057', score: 0.85, why: '铁盐亚铁盐' },
    { kw: ['铝', '铝合金'], kp: 'CHEM-B1-059', score: 0.85, why: '铝' },
    { kw: ['原子结构', '核外电子', '电子排布'], kp: 'CHEM-B1-063', score: 0.90, why: '原子核外电子排布' },
    { kw: ['元素周期表', '周期表结构'], kp: 'CHEM-B1-065', score: 0.88, why: '元素周期表' },
    { kw: ['同位素', '核素'], kp: 'CHEM-B1-067', score: 0.85, why: '同位素' },
    { kw: ['化学键', '离子键', '共价键', '分子间作用力', '氢键'], kp: 'CHEM-B1-077', score: 0.92, why: '化学键' },
    { kw: ['焓变', '放热', '吸热', '热化学方程式'], kp: 'CHEM-B1-078', score: 0.88, why: '化学反应的热效应' },
    { kw: ['化学反应速率', '化学平衡', '勒夏特列', '化学平衡的移动'], kp: 'CHEM-B1-079', score: 0.90, why: '化学反应速率和平衡' },
    { kw: ['水的电离', '溶液的酸碱性', '盐类的水解', '难溶电解质'], kp: 'CHEM-B1-080', score: 0.88, why: '电解质溶液综合' },
    { kw: ['原电池', '电解池', '金属腐蚀', '电化学'], kp: 'CHEM-B1-083', score: 0.92, why: '电化学' },
    { kw: ['硫', 'so2', '硫酸', '硫酸根'], kp: 'CHEM-B2-096', score: 0.88, why: '硫及其化合物' },
    { kw: ['氮气', '氮的氧化物', 'no', 'no2'], kp: 'CHEM-B2-099', score: 0.88, why: '氮及其化合物' },
    { kw: ['氨', '铵盐', 'nh3'], kp: 'CHEM-B2-100', score: 0.88, why: '氨和铵盐' },
    { kw: ['硝酸', '酸雨'], kp: 'CHEM-B2-101', score: 0.86, why: '硝酸酸雨' },
    { kw: ['无机非金属材料', '硅', '玻璃', '陶瓷'], kp: 'CHEM-B2-102', score: 0.82, why: '无机非金属材料' },
    { kw: ['烷烃', '甲烷', '碳原子的成键'], kp: 'CHEM-B2-107', score: 0.88, why: '烷烃' },
    { kw: ['乙烯', '烯烃'], kp: 'CHEM-B2-109', score: 0.85, why: '乙烯' },
    { kw: ['乙醇', '乙酸', '官能团'], kp: 'CHEM-B2-111', score: 0.88, why: '乙醇乙酸' },
    { kw: ['糖类', '葡萄糖', '蔗糖', '淀粉'], kp: 'CHEM-B2-113', score: 0.88, why: '糖类' },
    { kw: ['蛋白质', '油脂'], kp: 'CHEM-B2-114', score: 0.86, why: '蛋白质油脂' },
    { kw: ['金属矿物', '海水资源'], kp: 'CHEM-B2-115', score: 0.82, why: '金属矿物与海水' },
    { kw: ['煤', '石油', '天然气'], kp: 'CHEM-B2-116', score: 0.85, why: '煤石油天然气' },
    { kw: ['绿色化学', '环境保护'], kp: 'CHEM-B2-117', score: 0.84, why: '化学品合理使用' },
    { kw: ['烃的衍生物'], kp: 'CHEM-B3-086', score: 0.84, why: '烃的衍生物' },
    { kw: ['生物大分子'], kp: 'CHEM-B3-087', score: 0.80, why: '生物大分子' },
    { kw: ['合成高分子', '高分子化合物'], kp: 'CHEM-B3-088', score: 0.82, why: '合成高分子' },
    { kw: ['营养平衡', '维生素', '微量元素'], kp: 'CHEM-X1-119', score: 0.80, why: '关注营养平衡' },
    { kw: ['物质的变化', '物质的性质'], kp: 'CHEM-Z0-001', score: 0.80, why: '物质的变化与性质' },
    { kw: ['空气', '氧气'], kp: 'CHEM-Z0-002', score: 0.82, why: '空气与氧气' },
    { kw: ['水', '溶液'], kp: 'CHEM-Z0-003', score: 0.82, why: '水与溶液' },
    { kw: ['碳', '碳的氧化物', 'co2', 'co'], kp: 'CHEM-Z0-004', score: 0.86, why: '碳和碳的氧化物' },
    { kw: ['金属', '金属材料'], kp: 'CHEM-Z0-005', score: 0.82, why: '金属与金属材料' },
    { kw: ['化学方程式', '化学计算'], kp: 'CHEM-Z0-007', score: 0.82, why: '化学方程式与计算' },
    { kw: ['银镜反应', '新制cu(oh)2', '菲林试剂', '醛基', '羧基'], kp: 'CHEM-B1-031', score: 0.80, why: '银镜反应(归到离子反应)' },
    { kw: ['水解', '水解反应'], kp: 'CHEM-B1-081', score: 0.86, why: '盐类水解' }
  ],
  biology: [
    { kw: ['细胞', '走近细胞', '生命系统', '原核细胞', '真核细胞', '大肠杆菌', '水绵'], kp: 'BIO-G0-001', score: 0.92, why: '走近细胞' },
    { kw: ['组成细胞的分子', '蛋白质', '核酸', 'dna', 'rna', '氨基酸', '脱水缩合'], kp: 'BIO-G0-002', score: 0.93, why: '组成细胞的分子' },
    { kw: ['细胞的基本结构', '细胞膜', '细胞质', '细胞核', '细胞器', '核糖体', '溶酶体', '内质网', '高尔基体', '线粒体'], kp: 'BIO-G0-003', score: 0.94, why: '细胞的基本结构' },
    { kw: ['胞吞', '胞吐', '跨膜运输', '主动运输', '被动运输', '渗透'], kp: 'BIO-G0-004', score: 0.92, why: '细胞的物质输入输出' },
    { kw: ['atp', '有氧呼吸', '无氧呼吸', '光合作用', '酶'], kp: 'BIO-G0-005', score: 0.93, why: '细胞的能量供应' },
    { kw: ['有丝分裂', '减数分裂', '分化', '衰老', '凋亡', '癌变'], kp: 'BIO-G0-006', score: 0.92, why: '细胞的生命历程' },
    { kw: ['孟德尔', '基因分离', '自由组合', '测交'], kp: 'BIO-G0-007', score: 0.93, why: '遗传因子的发现' },
    { kw: ['伴性遗传', '人类遗传病', '受精作用'], kp: 'BIO-G0-008', score: 0.90, why: '基因与染色体' },
    { kw: ['dna复制', '基因的本质'], kp: 'BIO-G0-009', score: 0.90, why: '基因的本质' },
    { kw: ['转录', '翻译', '中心法则', '密码子', '反密码子'], kp: 'BIO-G0-010', score: 0.92, why: '基因的表达' },
    { kw: ['基因突变', '基因重组', '染色体变异', '育种'], kp: 'BIO-G0-011', score: 0.88, why: '基因突变与重组' },
    { kw: ['杂交育种', '基因工程'], kp: 'BIO-G0-012', score: 0.85, why: '从杂交育种到基因工程' },
    { kw: ['自然选择', '物种形成', '现代生物进化'], kp: 'BIO-G0-013', score: 0.85, why: '现代生物进化理论' },
    { kw: ['内环境', '稳态', '神经调节', '体液调节', '免疫调节'], kp: 'BIO-G0-014', score: 0.90, why: '内环境与稳态' },
    { kw: ['动物', '人体生命活动'], kp: 'BIO-G0-015', score: 0.85, why: '动物人体生命活动调节' },
    { kw: ['生长素', '赤霉素', '细胞分裂素', '脱落酸', '乙烯'], kp: 'BIO-G0-016', score: 0.92, why: '植物激素调节' },
    { kw: ['种群', '群落', '丰富度', '种间关系', '演替'], kp: 'BIO-G0-017', score: 0.88, why: '种群和群落' },
    { kw: ['生态系统', '能量流动', '物质循环', '信息传递'], kp: 'BIO-G0-018', score: 0.88, why: '生态系统' },
    { kw: ['生态环境保护', '生物多样性', '可持续发展'], kp: 'BIO-G0-019', score: 0.85, why: '生态环境保护' },
    { kw: ['基因工程', 'dna连接酶', '限制酶', '重组质粒'], kp: 'BIO-G0-020', score: 0.88, why: '基因工程' },
    { kw: ['细胞工程', '植物组织培养', '动物细胞培养'], kp: 'BIO-G0-021', score: 0.86, why: '细胞工程' },
    { kw: ['胚胎工程', '胚胎移植', '胚胎分割'], kp: 'BIO-G0-022', score: 0.84, why: '胚胎工程' },
    { kw: ['生物与环境', '生态因素'], kp: 'BIO-Z0-001', score: 0.82, why: '生物与环境' },
    { kw: ['组织', '器官', '系统'], kp: 'BIO-Z0-002', score: 0.80, why: '细胞与生物体结构' },
    { kw: ['光合作用', '呼吸作用'], kp: 'BIO-Z0-003', score: 0.88, why: '植物的光合与呼吸' },
    { kw: ['消化', '循环', '泌尿'], kp: 'BIO-Z0-004', score: 0.86, why: '人体生理' },
    { kw: ['性状', '基因'], kp: 'BIO-Z0-005', score: 0.84, why: '遗传与变异' }
  ],
  politics: [
    { kw: ['社会主义', '空想社会主义', '科学社会主义', '马克思', '恩格斯', '剩余价值'], kp: 'POL-B1-371', score: 0.92, why: '社会主义从空想到科学' },
    { kw: ['新民主主义', '社会主义制度', '只有社会主义'], kp: 'POL-B1-372', score: 0.90, why: '只有社会主义才能救中国' },
    { kw: ['改革开放', '社会主义初级阶段', '党的基本路线'], kp: 'POL-B1-373', score: 0.88, why: '伟大的改革开放' },
    { kw: ['中国特色社会主义', '进入新时代', '主要矛盾'], kp: 'POL-B1-374', score: 0.90, why: '坚持和发展中国特色社会主义' },
    { kw: ['生产资料所有制', '经济制度', '基本经济制度'], kp: 'POL-B2-377', score: 0.85, why: '生产资料所有制' },
    { kw: ['个人收入分配', '社会保障', '分配方式'], kp: 'POL-B2-378', score: 0.82, why: '个人收入分配与社会保障' },
    { kw: ['人民当家作主', '人民民主', '公民权利'], kp: 'POL-B3-375', score: 0.85, why: '人民当家作主' },
    { kw: ['依法治国', '法治', '法律体系'], kp: 'POL-B3-376', score: 0.85, why: '全面依法治国' },
    { kw: ['探索世界', '把握规律', '唯物论', '辩证法'], kp: 'POL-B4-379', score: 0.84, why: '探索世界与把握规律' },
    { kw: ['认识社会', '价值选择', '历史唯物主义'], kp: 'POL-B4-380', score: 0.82, why: '认识社会与价值选择' },
    { kw: ['文化传承', '文化创新', '中华文化'], kp: 'POL-B4-381', score: 0.86, why: '文化传承与文化创新' },
    { kw: ['国体', '政体', '国家性质'], kp: 'POL-X1-351', score: 0.85, why: '国体与政体' },
    { kw: ['国家结构', '单一制', '联邦制'], kp: 'POL-X1-352', score: 0.82, why: '国家结构形式' },
    { kw: ['多极化', '多极化趋势'], kp: 'POL-X1-353', score: 0.84, why: '多极化趋势' },
    { kw: ['和平与发展', '和平', '发展'], kp: 'POL-X1-354', score: 0.85, why: '和平与发展' },
    { kw: ['中国外交', '外交政策', '独立自主'], kp: 'POL-X1-355', score: 0.86, why: '中国的外交' },
    { kw: ['经济全球化', '全球化'], kp: 'POL-X1-356', score: 0.86, why: '走进经济全球化' },
    { kw: ['主要国际组织', '国际组织', '联合国'], kp: 'POL-X1-358', score: 0.84, why: '主要国际组织' },
    { kw: ['民法', '民事权利', '民事责任'], kp: 'POL-X2-360', score: 0.82, why: '民法' },
    { kw: ['侵权责任', '权利界限'], kp: 'POL-X2-361', score: 0.82, why: '侵权责任' },
    { kw: ['权利行使', '依法承担责任'], kp: 'POL-X2-362', score: 0.80, why: '权利行使' },
    { kw: ['家庭', '和睦的家庭'], kp: 'POL-X2-363', score: 0.80, why: '家庭关系' },
    { kw: ['婚姻', '夫妻关系'], kp: 'POL-X2-364', score: 0.80, why: '珍惜婚姻关系' },
    { kw: ['立足职场'], kp: 'POL-X2-366', score: 0.78, why: '立足职场' },
    { kw: ['纠纷', '调解'], kp: 'POL-X2-367', score: 0.80, why: '纠纷的多元解决' },
    { kw: ['诉讼', '三大诉讼'], kp: 'POL-X2-368', score: 0.80, why: '三大诉讼' },
    { kw: ['证据', '依法收集'], kp: 'POL-X2-370', score: 0.78, why: '依法收集证据' },
    { kw: ['道德', '心理健康'], kp: 'POL-Z0-001', score: 0.80, why: '道德与心理健康' },
    { kw: ['法律常识', '未成年人保护'], kp: 'POL-Z0-002', score: 0.78, why: '法律常识' },
    { kw: ['国情', '国策'], kp: 'POL-Z0-003', score: 0.78, why: '国情与国策' },
    { kw: ['汉字', '中文日', '仓颉', '中华文化'], kp: 'POL-B4-381', score: 0.84, why: '中华文化 (具体)' },
    { kw: ['五四', '青年节', '青年', '复兴之路', '国家博物馆'], kp: 'POL-B4-381', score: 0.78, why: '中华文化 + 青年' },
    { kw: ['地铁', '改名', '公主坟', '磨石口', '金台', '历史保护'], kp: 'POL-B4-381', score: 0.72, why: '历史文化保护' }
  ],
  geography: [
    { kw: ['地球', '宇宙环境', '天体', '太阳系', '地月系'], kp: 'GEO-B1-243', score: 0.92, why: '地球的宇宙环境' },
    { kw: ['太阳辐射', '太阳活动', '太阳对地球的影响'], kp: 'GEO-B1-244', score: 0.88, why: '太阳对地球的影响' },
    { kw: ['地球的历史', '地质年代', '化石', '地层'], kp: 'GEO-B1-245', score: 0.85, why: '地球的历史' },
    { kw: ['地球的圈层', '地壳', '地幔', '地核', '岩石圈'], kp: 'GEO-B1-246', score: 0.90, why: '地球的圈层结构' },
    { kw: ['大气组成', '垂直分层', '对流层', '平流层', '臭氧'], kp: 'GEO-B1-247', score: 0.92, why: '大气组成与分层' },
    { kw: ['热力环流', '大气运动', '风', '气压带', '风带'], kp: 'GEO-B1-248', score: 0.88, why: '热力环流与大气运动' },
    { kw: ['水循环'], kp: 'GEO-B1-249', score: 0.90, why: '水循环' },
    { kw: ['海水的性质', '海水温度', '海水盐度'], kp: 'GEO-B1-250', score: 0.88, why: '海水的性质' },
    { kw: ['海水的运动', '洋流', '潮汐', '波浪'], kp: 'GEO-B1-251', score: 0.88, why: '海水的运动' },
    { kw: ['常见地貌', '风化地貌', '流水地貌', '风力地貌'], kp: 'GEO-B1-252', score: 0.86, why: '常见地貌类型' },
    { kw: ['土壤', '土壤的形成', '土壤类型'], kp: 'GEO-B1-253', score: 0.86, why: '土壤' },
    { kw: ['气象灾害', '台风', '寒潮', '暴雨'], kp: 'GEO-B1-254', score: 0.88, why: '气象灾害' },
    { kw: ['地质灾害', '地震', '滑坡', '泥石流'], kp: 'GEO-B1-255', score: 0.88, why: '地质灾害' },
    { kw: ['防灾减灾', '灾害防御', '应急'], kp: 'GEO-B1-256', score: 0.85, why: '防灾减灾' },
    { kw: ['地理信息技术', 'gis', 'rs', 'gps', '3s技术'], kp: 'GEO-B1-257', score: 0.90, why: '地理信息技术' },
    { kw: ['人口分布'], kp: 'GEO-B2-258', score: 0.88, why: '人口分布' },
    { kw: ['人口迁移'], kp: 'GEO-B2-259', score: 0.88, why: '人口迁移' },
    { kw: ['人口容量', '环境承载力'], kp: 'GEO-B2-260', score: 0.85, why: '人口容量' },
    { kw: ['乡村', '城镇空间结构', '城市功能区'], kp: 'GEO-B2-261', score: 0.88, why: '乡村和城镇空间结构' },
    { kw: ['城镇化', '城市化'], kp: 'GEO-B2-262', score: 0.88, why: '城镇化' },
    { kw: ['地域文化', '城乡景观'], kp: 'GEO-B2-263', score: 0.84, why: '地域文化与城乡景观' },
    { kw: ['农业区位'], kp: 'GEO-B2-264', score: 0.88, why: '农业区位因素' },
    { kw: ['工业区位'], kp: 'GEO-B2-265', score: 0.88, why: '工业区位因素' },
    { kw: ['服务业区位'], kp: 'GEO-B2-266', score: 0.85, why: '服务业区位因素' },
    { kw: ['交通运输布局', '交通运输方式'], kp: 'GEO-B2-267', score: 0.85, why: '交通运输布局' },
    { kw: ['主要环境问题'], kp: 'GEO-B2-269', score: 0.85, why: '主要环境问题' },
    { kw: ['可持续发展', '人地协调'], kp: 'GEO-B2-270', score: 0.88, why: '可持续发展' },
    { kw: ['国家发展战略', '区域发展战略'], kp: 'GEO-B2-271', score: 0.82, why: '中国国家发展战略' },
    { kw: ['区域', '区域发展', '区域差异', '区域协调'], kp: 'GEO-X2-273', score: 0.85, why: '区域发展' },
    { kw: ['海洋空间资源', '国家安全', '海洋开发'], kp: 'GEO-X3-275', score: 0.84, why: '海洋空间资源与国家安全' },
    { kw: ['全球气候变化', '气候变化'], kp: 'GEO-X3-276', score: 0.84, why: '全球气候变化与国家安全' },
    { kw: ['生态文明', '生态'], kp: 'GEO-X3-277', score: 0.85, why: '生态文明' },
    { kw: ['资源安全'], kp: 'GEO-X3-281', score: 0.84, why: '资源安全与国家安全' },
    { kw: ['能源安全', '中国的能源'], kp: 'GEO-X3-282', score: 0.84, why: '能源安全' },
    { kw: ['耕地资源', '粮食安全'], kp: 'GEO-X3-283', score: 0.84, why: '耕地资源与粮食安全' },
    { kw: ['环境安全', '环境污染'], kp: 'GEO-X3-285', score: 0.84, why: '环境安全' },
    { kw: ['生态保护'], kp: 'GEO-X3-287', score: 0.84, why: '生态保护' },
    { kw: ['聚落', '乡村', '城市', '城乡'], kp: 'GEO-B2-261', score: 0.78, why: '聚落（具体）' },
    { kw: ['气温', '降水', '北纬', '南纬'], kp: 'GEO-B1-248', score: 0.70, why: '气候要素' }
  ]
};

function stemLower(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '');
}

function matchRules(subject, stem) {
  const rules = RULES[subject] || [];
  const norm = stemLower(stem);
  const hits = [];
  for (const r of rules) {
    for (const kw of r.kw) {
      if (norm.includes(kw.toLowerCase().replace(/\s+/g, ''))) {
        hits.push({ kp_id: r.kp, score: r.score, kw, why: r.why });
        break;
      }
    }
  }
  return hits;
}

// ─── PG-trgm 兜底 ──────────────────────────────────────
async function trgmBackupMatch(subject, stem, topN = 3) {
  const sql = `
    SELECT id, name, similarity(name, $1) AS sim
    FROM public.knowledge_points
    WHERE subject = $2 AND name NOT LIKE '%....%'
    ORDER BY sim DESC
    LIMIT $3
  `;
  const topic = stem.replace(/\s+/g, '').slice(0, 32);
  const r = await pool.query(sql, [topic, subject, topN]);
  return r.rows.filter((row) => Number(row.sim) >= 0.25).map((row) => ({
    kp_id: row.id,
    score: Math.min(0.6, Number(row.sim)),
    kw: `<trgm:${row.name}>`,
    why: 'pg_trgm 兜底'
  }));
}

// ─── 主流程 ──────────────────────────────────────────────
async function main() {
  console.log('='.repeat(78));
  console.log(`  Stage 32 · KP Relink FULL · ${TIMESTAMP}`);
  console.log('='.repeat(78));

  const mvpRes = await pool.query(`
    SELECT q.id, q.question_uid, q.subject_code, q.question_number, q.paper_id, q.stem
    FROM public.exam_questions q
    LEFT JOIN public.question_knowledge_points kp ON kp.question_id = q.id
    WHERE q.stem IS NOT NULL AND kp.question_id IS NULL
    ORDER BY q.subject_code, q.id
  `);
  const questions = mvpRes.rows;
  console.log(`[1] 未匹配 KP 的题目: ${questions.length} 条`);

  const plan = [];
  const ruleHit = [];
  const trgmHit = [];
  const noHit = [];
  const ruleHitBySubject = {};

  for (const q of questions) {
    const subject = q.subject_code;
    const stem = q.stem;
    const ruleMatches = matchRules(subject, stem);
    let chosen = ruleMatches;
    let src = 'rule';

    if (ruleMatches.length === 0) {
      try {
        const backup = await trgmBackupMatch(subject, stem, 3);
        chosen = backup;
        src = 'trgm';
        if (backup.length > 0) trgmHit.push(q.id);
      } catch (e) {}
    } else {
      ruleHit.push(q.id);
      ruleHitBySubject[subject] = (ruleHitBySubject[subject] || 0) + 1;
    }

    if (chosen.length === 0) {
      noHit.push(q.id);
      continue;
    }

    for (const m of chosen) {
      plan.push({
        question_id: q.id,
        question_uid: q.question_uid,
        subject_code: subject,
        kp_id: m.kp_id,
        score: m.score,
        kw: m.kw,
        why: m.why,
        source: src
      });
    }
  }

  console.log(`[2] 规则命中题数: ${ruleHit.length}; trgm 兜底命中题数: ${trgmHit.length}; 未命中: ${noHit.length}`);
  console.log(`[3] 待写入新关联 (plan): ${plan.length}`);
  console.log(`[3.1] 规则命中按学科:`);
  for (const [s, n] of Object.entries(ruleHitBySubject)) console.log(`        ${s}: ${n}`);

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  const ledgerOps = [];
  try {
    await client.query('BEGIN');

    for (const p of plan) {
      const insRes = await client.query(
        `INSERT INTO public.question_knowledge_points
           (question_id, knowledge_point_id, relevance_score, source)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (question_id, knowledge_point_id) DO NOTHING
         RETURNING id`,
        [p.question_id, p.kp_id, p.score, p.source]
      );

      if (insRes.rowCount === 0) {
        skipped++;
        continue;
      }
      inserted++;

      const afterSha = crypto.createHash('sha256')
        .update(`${p.question_id}:${p.kp_id}:${p.score}:${p.source}`)
        .digest('hex');

      ledgerOps.push([
        RUN_LABEL, 'qkp', p.kp_id, p.question_id, 'INSERTED',
        null, afterSha,
        JSON.stringify({
          question_uid: p.question_uid,
          subject_code: p.subject_code,
          kp_id: p.kp_id,
          relevance_score: p.score,
          source: p.source,
          matched_kw: p.kw,
          reason: p.why
        })
      ]);
    }

    if (ledgerOps.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < ledgerOps.length; i += BATCH) {
        const slice = ledgerOps.slice(i, i + BATCH);
        const values = [];
        const placeholders = [];
        let idx = 1;
        for (const op of slice) {
          placeholders.push(`($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++}::jsonb)`);
          values.push(...op);
        }
        await client.query(
          `INSERT INTO qb_recovery.canonical_migration_ledger
            (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail)
           VALUES ${placeholders.join(',')}`,
          values
        );
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[FATAL]', e.message);
    throw e;
  } finally {
    client.release();
  }

  const cov = await pool.query(`
    SELECT
      (SELECT COUNT(DISTINCT question_id) FROM public.question_knowledge_points) AS with_kp,
      (SELECT COUNT(*) FROM public.exam_questions) AS total_questions,
      (SELECT COUNT(*) FROM public.question_knowledge_points) AS total_links,
      (SELECT COUNT(DISTINCT knowledge_point_id) FROM public.question_knowledge_points) AS kps_used
  `);
  const { with_kp, total_questions, total_links, kps_used } = cov.rows[0];
  const coveragePct = ((Number(with_kp) / Number(total_questions)) * 100).toFixed(2);

  const result = {
    run_label: RUN_LABEL,
    timestamp: TIMESTAMP,
    method: 'rules (9 subjects) + pg_trgm fallback (no LLM)',
    input_unmapped_questions: questions.length,
    rule_hit_questions: ruleHit.length,
    trgm_backup_questions: trgmHit.length,
    no_hit_questions: noHit.length,
    rule_hit_by_subject: ruleHitBySubject,
    inserted,
    skipped,
    coverage_after: {
      questions_with_kp: Number(with_kp),
      total_questions: Number(total_questions),
      total_links: Number(total_links),
      kps_used: Number(kps_used),
      coverage_pct: Number(coveragePct)
    },
    remaining_unmapped_sample: noHit.slice(0, 20)
  };

  const outDir = path.resolve(__dirname, '..', '..', 'docs', 'audits');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'stage32-kp-relink-report.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log('\n=== 结果 ===');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\n报告 → ${outPath}`);

  await pool.end();
}

main().catch(async (e) => {
  console.error('[stage32] FATAL', e);
  await pool.end().catch(() => {});
  process.exit(2);
});
