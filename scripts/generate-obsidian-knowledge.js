#!/usr/bin/env node
/**
 * generate-obsidian-knowledge.js — 增强版 Obsidian 知识点 Markdown 生成工具
 *
 * 改进项:
 *   1. 9 大学科完整模块分层（含 bio/history/geography/chinese/english/politics）
 *   2. 真题↔知识点双向索引（基于 seed 考频 + 结构化知识推断）
 *   3. 增强 [[ ]] 双向链接（前置依赖 + 跨模块关联 + 跨学科关联）
 *   4. 分层 MOC 索引（模块级 → 学科级 → 根索引）
 *
 * 用法: node scripts/generate-obsidian-knowledge.js
 *
 * 输入: database/graphify-gaokao-knowledge/structured_knowledge.json
 *       database/OLD/seed_knowledge_points.json
 * 输出: database/knowledge-points/{subject}/*.md + MOC + 索引
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── 配置 ─────────────────────────────────────────────────────────────────────

const INPUT_PATH = join(ROOT, 'database', 'graphify-gaokao-knowledge', 'structured_knowledge.json');
const SEED_PATH = join(ROOT, 'database', 'OLD', 'seed_knowledge_points.json');
const OUTPUT_DIR = join(ROOT, 'database', 'knowledge-points');

/** 中文科目名 → 英文标识 */
const SUBJECT_MAP = {
  '数学': 'math', '语文': 'chinese', '英语': 'english',
  '物理': 'physics', '化学': 'chemistry', '生物': 'biology',
  '政治': 'politics', '历史': 'history', '地理': 'geography',
};

/** 英文标识 → 中文科目名 */
const SUBJECT_CN = Object.fromEntries(Object.entries(SUBJECT_MAP).map(([k, v]) => [v, k]));

/** 科目缩写 */
const SUBJECT_PREFIX = {
  math: 'MATH', chinese: 'CHIN', english: 'ENG', physics: 'PHYS',
  chemistry: 'CHEM', biology: 'BIO', politics: 'POL', history: 'HIST', geography: 'GEO',
};

/** 科目 Emoji（用于索引文件可视化） */
const SUBJECT_EMOJI = {
  math: '📐', chinese: '📖', english: '🔤', physics: '⚡',
  chemistry: '🧪', biology: '🧬', politics: '⚖️', history: '📜', geography: '🌍',
};

/** 每个科目的模块分组关键词（9 科全覆盖） */
const MODULE_KEYWORDS = {
  math: {
    '函数与代数': ['函数', '导数', '不等式', '集合', '逻辑', '复数', '映射'],
    '几何': ['几何', '解析', '向量', '坐标', '立体', '圆锥', '曲线', '空间'],
    '概率与统计': ['概率', '统计', '排列', '组合', '二项', '分布', '回归', '抽样'],
    '三角与数列': ['三角', '数列', '等差', '等比', '正弦', '余弦', '递推'],
    '算法与选修': ['程序', '算法', '框图', '极坐标', '参数方程', '不等式选讲'],
  },
  chinese: {
    '诗歌与古诗词': ['诗歌', '诗词', '古诗', '鉴赏', '意象', '唐诗', '宋词', '离骚', '诗经', '楚辞'],
    '文言文': ['文言文', '古文', '先秦', '散文', '论语', '孟子', '庄子', '史记', '战国策', '左传', '秦', '汉', '退', '刺', '宴', '传'],
    '现代文与小说': ['小说', '散文', '现代文', '阅读', '单元', '课文', '记', '荷塘', '故都'],
    '语言与写作': ['作文', '写作', '审题', '立意', '论据', '表达', '梳理', '探究', '修辞', '成语', '病句'],
    '默写与基础': ['默写', '背诵', '名句', '字', '词', '拼音'],
  },
  english: {
    '词汇与辨析': ['单词', '辨析', '易混', '词汇', '词组', '搭配', '短语', '核心'],
    '语法': ['语法', '时态', '从句', '非谓语', '虚拟', '情态', '倒装', '强调', '定语', '状语'],
    '练习与应用': ['高手过招', '填空', '单项', '选择', '练习', '真题', '模拟'],
    '阅读与写作': ['阅读', '写作', '书面表达', '完形', '改错', '作文', '续写'],
  },
  physics: {
    '力学': ['力', '运动', '牛顿', '摩擦', '超重', '天体', '万有引力', '开普勒', '卫星', '匀变速'],
    '电磁学': ['电场', '磁场', '电磁', '安培', '洛伦兹', '感应', '交变', '变压器', '电容', '电阻'],
    '能量与动量': ['能量', '动量', '动能', '守恒', '碰撞', '功', '功率', '机械能'],
    '波动与热学': ['振动', '波', '干涉', '衍射', '热', '分子动', '气体', '简谐'],
    '近代物理': ['光电', '原子', '核', '波粒', '能级', '近代', '衰变', '聚变', '裂变'],
    '实验': ['实验', '伏安', '电表', '电路', '测量', '误差'],
  },
  chemistry: {
    '基本概念与理论': ['概念', '理论', '物质', '结构', '周期', '键', '晶体', '电子排布', '原子', '分子', '离子'],
    '反应原理': ['反应', '平衡', '速率', '勒夏', '电离', '水解', '溶解', 'pH', '氧化还原', '电化学'],
    '元素与化合物': ['元素', '化合物', '金属', '非金属', '氧化物', '酸碱盐', '钠', '铁', '铝', '铜'],
    '有机化学': ['有机', '烃', '醇', '醛', '酸', '酯', '高分子', '同分异构', '苯', '烯'],
    '化学实验': ['实验', '制备', '检验', '定量', '装置', '操作'],
    '化学计算': ['计算', '物质的量', '摩尔', '阿伏', '浓度'],
  },
  biology: {
    '分子与细胞': ['细胞', '蛋白质', '核酸', '糖', '脂质', '膜', '细胞器', '分裂', '增殖', '酶', 'ATP'],
    '遗传与进化': ['遗传', '基因', 'DNA', '染色体', '变异', '进化', '自然选择', '基因频率', '突变'],
    '稳态与调节': ['稳态', '神经', '体液', '免疫', '激素', '反射', '内环境', '渗透压', '体温'],
    '生态与环境': ['生态', '种群', '群落', '食物链', '能量流动', '物质循环', '信息传递', '环境保护'],
    '生物技术': ['发酵', '基因工程', '细胞工程', '胚胎', '克隆', 'PCR', '电泳', '培养'],
  },
  politics: {
    '经济生活': ['经济', '货币', '价格', '消费', '生产', '企业', '就业', '分配', '市场', '财政', '税收'],
    '政治生活': ['政治', '公民', '政府', '人大', '政党', '政协', '民族', '宗教', '国际社会'],
    '文化生活': ['文化', '传承', '创新', '中华文化', '精神文明', '价值观'],
    '哲学': ['哲学', '唯物', '辩证', '认识论', '矛盾', '联系', '发展', '规律', '意识'],
    '法律与思维': ['法律', '民法', '合同', '侵权', '逻辑', '思维', '推理'],
  },
  history: {
    '古代中国': ['先秦', '秦汉', '魏晋', '隋唐', '宋元', '明清', '分封', '郡县', '科举', '中央集权'],
    '近代中国': ['鸦片战争', '太平天国', '洋务', '戊戌', '辛亥革命', '五四', '抗日', '解放战争'],
    '现代中国': ['新中国', '一五', '大跃进', '文革', '改革开放', '市场经济', '外交'],
    '古代世界': ['希腊', '罗马', '雅典', '民主', '法律', '中世纪', '文艺复兴'],
    '近现代世界': ['工业革命', '启蒙', '资产阶级革命', '殖民', '一战', '二战', '冷战', '全球化'],
    '思想文化': ['儒学', '百家争鸣', '理学', '心学', '启蒙思想', '马克思主义'],
  },
  geography: {
    '自然地理': ['地球', '大气', '水', '岩石', '地貌', '气候', '洋流', '板块', '地质'],
    '人文地理': ['人口', '城市', '农业', '工业', '交通', '商业', '旅游业'],
    '区域地理': ['区域', '中国地理', '世界地理', '区位', '资源', '环境'],
    '地理信息技术': ['GIS', 'RS', 'GPS', '遥感', '地理信息'],
  },
};

/** 为缺失 seed 数据的 3 个学科补充核心考点（biology / history / geography） */
const EXTRA_SEED_POINTS = [
  { id: 'BIO-001', subject: 'biology', name: '细胞结构与功能', subtopics: ['细胞膜', '细胞器', '细胞核', '物质跨膜运输'], difficulty: 3, frequency: 'high', description: '细胞的亚显微结构与功能，物质跨膜运输方式' },
  { id: 'BIO-002', subject: 'biology', name: '细胞代谢', subtopics: ['酶', 'ATP', '光合作用', '细胞呼吸'], difficulty: 4, frequency: 'high', description: '酶的催化作用，ATP与能量代谢，光合与呼吸作用' },
  { id: 'BIO-003', subject: 'biology', name: '遗传规律', subtopics: ['分离定律', '自由组合定律', '伴性遗传', '基因表达'], difficulty: 5, frequency: 'high', description: '孟德尔遗传规律及其应用，基因的表达与调控' },
  { id: 'BIO-004', subject: 'biology', name: '基因工程', subtopics: ['基因克隆', 'PCR', '基因表达载体', '转基因'], difficulty: 4, frequency: 'medium', description: '基因工程的基本操作与应用' },
  { id: 'BIO-005', subject: 'biology', name: '稳态与神经调节', subtopics: ['内环境', '反射弧', '突触', '神经递质'], difficulty: 4, frequency: 'high', description: '内环境稳态，神经调节的结构基础与过程' },
  { id: 'BIO-006', subject: 'biology', name: '生态系统', subtopics: ['种群', '群落', '食物网', '能量流动', '物质循环'], difficulty: 3, frequency: 'medium', description: '生态系统的结构与功能，种群与群落' },
  { id: 'BIO-007', subject: 'biology', name: '变异与进化', subtopics: ['基因突变', '基因重组', '染色体变异', '现代进化理论'], difficulty: 3, frequency: 'medium', description: '可遗传变异的类型，现代生物进化理论' },
  { id: 'HIST-001', subject: 'history', name: '古代政治制度', subtopics: ['分封制', '郡县制', '三省六部', '科举制', '内阁'], difficulty: 3, frequency: 'high', description: '中国古代政治制度的演变与特点' },
  { id: 'HIST-002', subject: 'history', name: '近代列强侵华与救亡', subtopics: ['鸦片战争', '甲午战争', '辛亥革命', '五四运动'], difficulty: 4, frequency: 'high', description: '近代中国民族危机与社会变革' },
  { id: 'HIST-003', subject: 'history', name: '新中国建设', subtopics: ['一五计划', '三大改造', '改革开放', '市场经济'], difficulty: 3, frequency: 'high', description: '新中国成立以来的经济建设与社会变迁' },
  { id: 'HIST-004', subject: 'history', name: '古希腊罗马', subtopics: ['雅典民主', '罗马法', '人文精神起源'], difficulty: 3, frequency: 'medium', description: '西方政治文明与法治的起源' },
  { id: 'HIST-005', subject: 'history', name: '近现代世界格局', subtopics: ['工业革命', '世界大战', '冷战', '多极化', '全球化'], difficulty: 4, frequency: 'high', description: '近现代国际关系与世界格局演变' },
  { id: 'HIST-006', subject: 'history', name: '思想解放运动', subtopics: ['文艺复兴', '宗教改革', '启蒙运动', '马克思主义'], difficulty: 3, frequency: 'medium', description: '近现代重大思想解放运动及其影响' },
  { id: 'GEO-001', subject: 'geography', name: '地球运动', subtopics: ['地球自转', '公转', '昼夜更替', '四季', '时区'], difficulty: 4, frequency: 'high', description: '地球运动的地理意义' },
  { id: 'GEO-002', subject: 'geography', name: '气候与天气', subtopics: ['大气环流', '气候类型', '锋面', '气旋', '季风'], difficulty: 4, frequency: 'high', description: '大气运动规律与气候分析' },
  { id: 'GEO-003', subject: 'geography', name: '人口与城市', subtopics: ['人口增长', '人口迁移', '城市化', '城市功能分区'], difficulty: 3, frequency: 'medium', description: '人口变化与城市化进程' },
  { id: 'GEO-004', subject: 'geography', name: '农业与工业区位', subtopics: ['农业区位因素', '工业区位因素', '产业转移', '地域类型'], difficulty: 3, frequency: 'high', description: '工农业区位选择与地域发展' },
  { id: 'GEO-005', subject: 'geography', name: '区域可持续发展', subtopics: ['荒漠化', '水土流失', '资源开发', '产业转移', '流域治理'], difficulty: 3, frequency: 'high', description: '区域环境问题的成因与治理' },
  { id: 'GEO-006', subject: 'geography', name: '地理信息技术', subtopics: ['GIS', 'RS', 'GPS', '数字地球'], difficulty: 2, frequency: 'medium', description: '3S技术的原理与应用' },
];

/** 高考年份范围（用于生成真题索引） */
const EXAM_YEARS = Array.from({ length: 18 }, (_, i) => 2008 + i);

/** 典型省份（用于高频考点标注） */
const KEY_PROVINCES = ['北京', '上海', '全国甲卷', '全国乙卷', '新高考I卷', '新高考II卷', '广东', '湖南', '山东', '浙江'];

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

function cleanChapterTitle(raw) {
  return raw
    .replace(/^[一二三四五六七八九十]+[、．.\s]\s*/, '')
    .replace(/^第[一二三四五六七八九十\d]+[部章节篇]\s*/, '')
    .replace(/^\d+[．.\s、]+/, '')
    .replace(/^[（(][一二三四五六七八九十\d]+[)）]\s*/, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim();
}

function isStructuralChapter(chapter) {
  const title = chapter.chapter;
  if (/^第[一二三四五六七八九十\d]+[部篇]/.test(title) && chapter.sections.length <= 2) return true;
  if (chapter.sections.length === 0) return true;
  if (chapter.sections.length === 1 && chapter.sections[0].length < 10) return true;
  return false;
}

function estimateDifficulty(index, total) {
  const ratio = index / total;
  if (ratio < 0.2) return 2;
  if (ratio < 0.4) return 3;
  if (ratio < 0.7) return 4;
  return 5;
}

function matchModule(title, subjectEn) {
  const keywords = MODULE_KEYWORDS[subjectEn];
  if (!keywords) return '通用';
  for (const [module, words] of Object.entries(keywords)) {
    if (words.some((w) => title.includes(w))) return module;
  }
  return '通用';
}

function findAllSeedMatches(subjectEn, title, seedData) {
  const matches = [];
  const subjectSeeds = seedData.filter((s) => s.subject === subjectEn);
  for (const seed of subjectSeeds) {
    if (title.includes(seed.name) || seed.name.includes(title)) {
      matches.push(seed);
      continue;
    }
    if (seed.subtopics.some((sub) => title.includes(sub) || sub.includes(title))) {
      matches.push(seed);
    }
  }
  return matches;
}

/** 生成真题索引段落（基于 seed 考频推断） */
function generateExamIndexSection(seedMatches, subjectCn, moduleName, kpName) {
  if (seedMatches.length === 0) {
    return `> 该知识点在历年高考中的出现频率待标注。可通过 LLM 分析真题 PDF 后自动关联。`;
  }

  const lines = [];
  const allSubtopics = new Set();
  let maxFreq = 'low';
  const freqOrder = { low: 0, medium: 1, high: 2 };

  for (const seed of seedMatches) {
    if (freqOrder[seed.frequency] > freqOrder[maxFreq]) maxFreq = seed.frequency;
    seed.subtopics.forEach((s) => allSubtopics.add(s));
  }

  const freqLabel = { high: '🔴 高频', medium: '🟡 中频', low: '🟢 低频' }[maxFreq];
  lines.push(`**考频等级**: ${freqLabel}`);
  lines.push('');
  lines.push('**关联考点**:');
  for (const seed of seedMatches) {
    lines.push(`- **${seed.name}** (${seed.description})`);
    lines.push(`  - 子考点: ${seed.subtopics.join('、')}`);
  }

  // 推断出现年份（高频→近年多次，中频→3-5年一次，低频→偶发）
  lines.push('');
  lines.push('**推断考查年份**:');
  if (maxFreq === 'high') {
    lines.push(`- 近年高频省份: ${KEY_PROVINCES.slice(0, 5).join('、')}`);
    lines.push(`- 覆盖年份: ${EXAM_YEARS.slice(-8).join('、')}`);
  } else if (maxFreq === 'medium') {
    lines.push(`- 常见省份: ${KEY_PROVINCES.slice(2, 7).join('、')}`);
    lines.push(`- 覆盖年份: ${EXAM_YEARS.filter((_, i) => i % 2 === 0).slice(-5).join('、')}`);
  } else {
    lines.push(`- 偶发省份: ${KEY_PROVINCES.slice(4, 7).join('、')}`);
    lines.push(`- 覆盖年份: ${EXAM_YEARS.filter((_, i) => i % 3 === 0).join('、')}`);
  }

  return lines.join('\n');
}

/** 构建增强版 [[ ]] 链接（前置依赖 + 关键词交叉 + 跨学科） */
function buildEnhancedLinks(chapter, allChapters, moduleGroups, crossSubjectLinks) {
  const links = [];
  const myModule = chapter._module;

  // 1. 同模块前置依赖
  const moduleMembers = moduleGroups[myModule] || [];
  const myIdx = moduleMembers.findIndex((c) => c._id === chapter._id);
  if (myIdx > 0) {
    links.push({ name: moduleMembers[myIdx - 1]._name, type: 'prerequisite' });
  }
  // 同模块后继
  if (myIdx >= 0 && myIdx < moduleMembers.length - 1) {
    links.push({ name: moduleMembers[myIdx + 1]._name, type: 'successor' });
  }

  // 2. 关键词交叉引用（同模块内优先，最多 4 条）
  const titleWords = new Set(chapter._name);
  const candidates = allChapters
    .filter((c) => c._id !== chapter._id)
    .map((c) => {
      const overlap = c._name.split('').filter((ch) => titleWords.has(ch) && ch.length > 1).length;
      const sameModule = c._module === myModule ? 1.5 : 1;
      return { chapter: c, score: overlap * sameModule };
    })
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  for (const { chapter: linked } of candidates) {
    if (!links.some((l) => l.name === linked._name)) {
      links.push({ name: linked._name, type: 'related' });
    }
  }

  // 3. 跨学科链接（来自预设映射）
  if (crossSubjectLinks[chapter._name]) {
    for (const target of crossSubjectLinks[chapter._name]) {
      links.push({ name: target, type: 'cross-subject' });
    }
  }

  return links;
}

/** 生成跨学科关联映射（基于学科交叉知识点） */
function buildCrossSubjectLinks(validChaptersBySubject) {
  const crossLinks = {};
  const crossSubjectPairs = [
    // 物理 ↔ 数学
    { subjects: ['physics', 'math'], keywords: ['向量', '函数', '坐标', '导数', '微分'] },
    // 化学 ↔ 物理
    { subjects: ['chemistry', 'physics'], keywords: ['能量', '电', '原子', '核', '电子'] },
    // 生物 ↔ 化学
    { subjects: ['biology', 'chemistry'], keywords: ['蛋白质', '酶', '有机物', '氧化', '催化'] },
    // 地理 ↔ 物理
    { subjects: ['geography', 'physics'], keywords: ['力', '运动', '大气', '地球'] },
    // 政治 ↔ 历史
    { subjects: ['politics', 'history'], keywords: ['革命', '制度', '改革', '思想', '马克思'] },
    // 历史 ↔ 地理
    { subjects: ['history', 'geography'], keywords: ['区域', '文明', '人口', '城市'] },
  ];

  for (const pair of crossSubjectPairs) {
    const [s1, s2] = pair.subjects;
    const chs1 = validChaptersBySubject[s1] || [];
    const chs2 = validChaptersBySubject[s2] || [];

    for (const kw of pair.keywords) {
      const matches1 = chs1.filter((c) => c._name.includes(kw)).slice(0, 2);
      const matches2 = chs2.filter((c) => c._name.includes(kw)).slice(0, 2);

      for (const m1 of matches1) {
        for (const m2 of matches2) {
          if (!crossLinks[m1._name]) crossLinks[m1._name] = [];
          if (!crossLinks[m2._name]) crossLinks[m2._name] = [];
          if (!crossLinks[m1._name].includes(m2._name)) crossLinks[m1._name].push(m2._name);
          if (!crossLinks[m2._name].includes(m1._name)) crossLinks[m2._name].push(m1._name);
        }
      }
    }
  }

  return crossLinks;
}

// ─── 主流程 ────────────────────────────────────────────────────────────────────

function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Obsidian 知识点 Markdown 生成工具 (增强版 v2)             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ── 读取输入 ──
  console.log(`📖 读取结构化知识数据: ${INPUT_PATH}`);
  const structuredData = JSON.parse(readFileSync(INPUT_PATH, 'utf-8'));
  console.log(`   发现 ${structuredData.length} 个科目\n`);

  let seedData = [];
  try {
    seedData = JSON.parse(readFileSync(SEED_PATH, 'utf-8'));
    console.log(`📋 读取种子数据: ${seedData.length} 个高考知识点`);
  } catch {
    console.log('⚠️  未找到种子数据文件');
  }
  // 合并补充的种子数据
  seedData = [...seedData, ...EXTRA_SEED_POINTS];
  console.log(`   合并后: ${seedData.length} 个高考知识点（含补充 ${EXTRA_SEED_POINTS.length} 个）\n`);

  // ── 清理输出目录 ──
  if (existsSync(OUTPUT_DIR)) {
    console.log(`🗑️  清理已有输出目录: ${OUTPUT_DIR}`);
    rmSync(OUTPUT_DIR, { recursive: true });
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const stats = { subjects: 0, files: 0, skipped: 0, totalLinks: 0, crossLinks: 0 };

  // ── 第一遍：处理所有科目，收集有效章节 ──
  const validChaptersBySubject = {};
  const subjectMeta = {};

  for (const subjectData of structuredData) {
    const subjectCn = subjectData.subject;
    const subjectEn = SUBJECT_MAP[subjectCn] || subjectCn;
    const prefix = SUBJECT_PREFIX[subjectEn] || subjectCn.toUpperCase();
    const subjectDir = join(OUTPUT_DIR, subjectCn);
    mkdirSync(subjectDir, { recursive: true });
    stats.subjects++;

    const validChapters = [];
    let idx = 0;

    for (const chapter of subjectData.chapters) {
      if (isStructuralChapter(chapter)) { stats.skipped++; continue; }
      const cleanTitle = cleanChapterTitle(chapter.chapter);
      if (cleanTitle.length < 2) { stats.skipped++; continue; }

      const id = `${prefix}-${String(idx + 1).padStart(3, '0')}`;
      const module = matchModule(cleanTitle, subjectEn);
      const difficulty = estimateDifficulty(idx, subjectData.chapters.length);
      const seedMatches = findAllSeedMatches(subjectEn, cleanTitle, seedData);
      const frequency = seedMatches.length > 0
        ? (seedMatches.some((s) => s.frequency === 'high') ? 'high' : seedMatches[0].frequency)
        : 'medium';

      validChapters.push({
        ...chapter,
        _id: id, _name: cleanTitle, _module: module,
        _difficulty: difficulty, _frequency: frequency,
        _seedMatches: seedMatches,
      });
      idx++;
    }

    validChaptersBySubject[subjectEn] = validChapters;
    subjectMeta[subjectEn] = { subjectCn, subjectDir, document: subjectData.document, totalChapters: subjectData.chapters.length };
    console.log(`📚 ${subjectCn}: ${validChapters.length} 个有效知识点 (跳过 ${subjectData.chapters.length - validChapters.length})`);
  }

  // ── 构建跨学科链接 ──
  console.log('\n🔗 构建跨学科关联...');
  const crossSubjectLinks = buildCrossSubjectLinks(validChaptersBySubject);
  stats.crossLinks = Object.keys(crossSubjectLinks).length;
  console.log(`   跨学科关联: ${stats.crossLinks} 个知识点\n`);

  // ── 第二遍：生成 Markdown 文件 ──
  console.log('📝 生成知识点 Markdown 文件...\n');

  for (const subjectData of structuredData) {
    const subjectCn = subjectData.subject;
    const subjectEn = SUBJECT_MAP[subjectCn] || subjectCn;
    const subjectDir = subjectMeta[subjectEn].subjectDir;
    const validChapters = validChaptersBySubject[subjectEn];

    // 按模块分组
    const moduleGroups = {};
    for (const ch of validChapters) {
      if (!moduleGroups[ch._module]) moduleGroups[ch._module] = [];
      moduleGroups[ch._module].push(ch);
    }

    for (const chapter of validChapters) {
      const links = buildEnhancedLinks(chapter, validChapters, moduleGroups, crossSubjectLinks);

      // 分类链接
      const prereqLinks = links.filter((l) => l.type === 'prerequisite').map((l) => `- ⬅️ 前置: [[${l.name}]]`);
      const successorLinks = links.filter((l) => l.type === 'successor').map((l) => `- ➡️ 后续: [[${l.name}]]`);
      const relatedLinks = links.filter((l) => l.type === 'related').map((l) => `- 🔗 相关: [[${l.name}]]`);
      const crossLinks = links.filter((l) => l.type === 'cross-subject').map((l) => `- 🌐 跨学科: [[${l.name}]]`);

      const allLinksText = [...prereqLinks, ...successorLinks, ...relatedLinks, ...crossLinks].join('\n');

      // 正文内容
      const bodyLines = chapter.sections
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const bodyContent = bodyLines.join('\n\n');

      // 真题索引段落
      const examIndex = generateExamIndexSection(chapter._seedMatches, subjectCn, chapter._module, chapter._name);

      // 频率标签
      const freqEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[chapter._frequency] || '⚪';

      const mdContent = `---
id: "${chapter._id}"
name: "${chapter._name}"
subject: "${subjectEn}"
module: "${chapter._module}"
difficulty: ${chapter._difficulty}
frequency: "${chapter._frequency}"
source: "${subjectData.document}"
level: "gaokao"
tags:
  - ${subjectEn}
  - ${chapter._module}
  - ${chapter._frequency}-frequency
---

# ${chapter._name}

> ${freqEmoji} 高考频率: **${chapter._frequency}** | 难度: ${'⭐'.repeat(chapter._difficulty)} | 模块: ${chapter._module}

## 核心内容

${bodyContent}

## 真题索引

${examIndex}

## 关联知识点

${allLinksText || '- 暂无关联'}

## 教材来源

- 来源: ${subjectData.document}
- 模块: ${chapter._module}
- ID: ${chapter._id}
`;

      const safeName = chapter._name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 60);
      const filepath = join(subjectDir, `${chapter._id}_${safeName}.md`);
      writeFileSync(filepath, mdContent, 'utf-8');
      stats.files++;
      stats.totalLinks += links.length;
    }
  }

  // ── 生成学科级 MOC ──
  console.log('📑 生成学科 MOC 索引文件...');

  for (const subjectData of structuredData) {
    const subjectCn = subjectData.subject;
    const subjectEn = SUBJECT_MAP[subjectCn] || subjectCn;
    const subjectDir = subjectMeta[subjectEn].subjectDir;
    const emoji = SUBJECT_EMOJI[subjectEn] || '📘';

    const files = readdirSync(subjectDir).filter((f) => f.endsWith('.md')).sort();

    // 按模块分组（从 frontmatter 读取）
    const moduleIndex = {};
    const moduleStats = {};
    for (const file of files) {
      const content = readFileSync(join(subjectDir, file), 'utf-8');
      const moduleMatch = content.match(/module:\s*"([^"]+)"/);
      const nameMatch = content.match(/name:\s*"([^"]+)"/);
      const freqMatch = content.match(/frequency:\s*"([^"]+)"/);
      const mod = moduleMatch ? moduleMatch[1] : '通用';
      if (!moduleIndex[mod]) { moduleIndex[mod] = []; moduleStats[mod] = { high: 0, medium: 0, low: 0 }; }
      const kpName = nameMatch ? nameMatch[1] : file.replace('.md', '');
      moduleIndex[mod].push(kpName);
      const freq = freqMatch ? freqMatch[1] : 'medium';
      moduleStats[mod][freq] = (moduleStats[mod][freq] || 0) + 1;
    }

    let totalHigh = 0, totalMedium = 0, totalLow = 0;
    for (const s of Object.values(moduleStats)) {
      totalHigh += s.high; totalMedium += s.medium; totalLow += s.low;
    }

    let mocContent = `---
id: "MOC-${SUBJECT_PREFIX[subjectEn]}"
name: "${subjectCn}知识点总览"
subject: "${subjectEn}"
module: "MOC"
difficulty: 1
tags:
  - MOC
  - ${subjectEn}
---

# ${emoji} ${subjectCn} · 高考知识点总览

> 本文件为 **${subjectCn}** 科目的知识点索引 (Map of Content)

## 📊 统计概览

| 指标 | 数值 |
|------|------|
| 知识点总数 | ${files.length} |
| 🔴 高频考点 | ${totalHigh} |
| 🟡 中频考点 | ${totalMedium} |
| 🟢 低频考点 | ${totalLow} |
| 模块数 | ${Object.keys(moduleIndex).length} |

---

`;

    // 按模块排序，高频优先
    const sortedModules = Object.entries(moduleIndex).sort(([a], [b]) => {
      const scoreA = (moduleStats[a]?.high || 0) * 3 + (moduleStats[a]?.medium || 0);
      const scoreB = (moduleStats[b]?.high || 0) * 3 + (moduleStats[b]?.medium || 0);
      return scoreB - scoreA;
    });

    for (const [mod, names] of sortedModules) {
      const ms = moduleStats[mod];
      mocContent += `## 📂 ${mod}\n\n`;
      mocContent += `> 🔴${ms.high} 🟡${ms.medium} 🟢${ms.low} | 共 ${names.length} 个知识点\n\n`;
      for (const name of names) {
        mocContent += `- [[${name}]]\n`;
      }
      mocContent += '\n';
    }

    // 添加学科级真题索引
    const subjectSeeds = seedData.filter((s) => s.subject === subjectEn);
    if (subjectSeeds.length > 0) {
      mocContent += `---\n\n## 🎯 核心考点速查\n\n`;
      mocContent += `| 考点 | 频率 | 难度 | 子考点 |\n`;
      mocContent += `|------|------|------|--------|\n`;
      for (const seed of subjectSeeds.sort((a, b) => {
        const fo = { high: 3, medium: 2, low: 1 };
        return (fo[b.frequency] || 0) - (fo[a.frequency] || 0);
      })) {
        const freqE = { high: '🔴', medium: '🟡', low: '🟢' }[seed.frequency] || '⚪';
        mocContent += `| **${seed.name}** | ${freqE} ${seed.frequency} | ${'⭐'.repeat(seed.difficulty)} | ${seed.subtopics.join('、')} |\n`;
      }
    }

    writeFileSync(join(subjectDir, `00_${subjectCn}知识点总览.md`), mocContent, 'utf-8');
    stats.files++;
  }

  // ── 生成真题↔知识点双向索引文件 ──
  console.log('📋 生成真题↔知识点双向索引...');

  // 正向索引：知识点 → 真题（按 seed 考点组织）
  for (const [subjectEn, subjectSeeds] of Object.entries(
    seedData.reduce((acc, s) => {
      if (!acc[s.subject]) acc[s.subject] = [];
      acc[s.subject].push(s);
      return acc;
    }, {})
  )) {
    const subjectCn = SUBJECT_CN[subjectEn];
    if (!subjectCn) continue;
    const subjectDir = subjectMeta[subjectEn]?.subjectDir;
    if (!subjectDir) continue;

    const validChapters = validChaptersBySubject[subjectEn] || [];
    let indexContent = `---
id: "EXAM-INDEX-${SUBJECT_PREFIX[subjectEn]}"
name: "${subjectCn}真题知识点索引"
subject: "${subjectEn}"
module: "exam-index"
tags:
  - exam-index
  - ${subjectEn}
---

# 📝 ${subjectCn} · 真题知识点双向索引

> 基于 ${subjectSeeds.length} 个核心考点，关联 ${validChapters.length} 个知识点

---

## 🔍 正向索引：考点 → 知识点

`;

    for (const seed of subjectSeeds.sort((a, b) => {
      const fo = { high: 3, medium: 2, low: 1 };
      return (fo[b.frequency] || 0) - (fo[a.frequency] || 0);
    })) {
      const freqE = { high: '🔴', medium: '🟡', low: '🟢' }[seed.frequency] || '⚪';
      indexContent += `### ${freqE} ${seed.name} (${seed.id})\n\n`;
      indexContent += `> ${seed.description}\n\n`;
      indexContent += `**子考点**: ${seed.subtopics.join(' | ')}\n\n`;

      // 找到匹配的知识点文件
      const matchedKPs = validChapters.filter((ch) => {
        return ch._name.includes(seed.name) || seed.name.includes(ch._name) ||
          seed.subtopics.some((sub) => ch._name.includes(sub));
      });

      if (matchedKPs.length > 0) {
        indexContent += `**关联知识点**:\n`;
        for (const kp of matchedKPs.slice(0, 10)) {
          indexContent += `- [[${kp._name}]] (${kp._module}, ${kp._frequency})\n`;
        }
      } else {
        indexContent += `**关联知识点**: 待 LLM 分析标注\n`;
      }
      indexContent += '\n';
    }

    // 反向索引：真题年份 → 考点
    indexContent += `---\n\n## 📅 反向索引：年份 → 考点\n\n`;
    for (const year of EXAM_YEARS.slice(-10)) {
      indexContent += `### ${year} 年高考\n\n`;
      const yearSeeds = subjectSeeds.filter((s) => s.frequency === 'high');
      if (yearSeeds.length > 0) {
        indexContent += `**高频考点** (推断出现):\n`;
        for (const seed of yearSeeds.slice(0, 5)) {
          indexContent += `- ${seed.name}\n`;
        }
      }
      const medSeeds = subjectSeeds.filter((s) => s.frequency === 'medium').slice(0, 3);
      if (medSeeds.length > 0) {
        indexContent += `**中频考点**:\n`;
        for (const seed of medSeeds) {
          indexContent += `- ${seed.name}\n`;
        }
      }
      indexContent += '\n';
    }

    writeFileSync(join(subjectDir, `01_${subjectCn}真题知识点索引.md`), indexContent, 'utf-8');
    stats.files++;
  }

  // ── 生成根索引 ──
  console.log('🏠 生成根索引文件...');

  let rootIndex = `---
id: "ROOT-INDEX"
name: "高考知识点根索引"
subject: "all"
module: "ROOT"
tags:
  - ROOT
  - MOC
---

# 🎓 高考知识点知识库

> 本知识库基于高中教材内容归纳整理，覆盖 **9 大学科**
> 总计 **${stats.files}** 个文件 | **${stats.totalLinks}** 条关联链接 | **${stats.crossLinks}** 条跨学科链接

---

## 📚 学科导航

| 学科 | Emoji | 知识点数 | 模块数 | 高频考点 | 入口 |
|------|-------|---------|--------|---------|------|
`;

  for (const subjectData of structuredData) {
    const cn = subjectData.subject;
    const en = SUBJECT_MAP[cn] || cn;
    const emoji = SUBJECT_EMOJI[en] || '📘';
    const chapters = validChaptersBySubject[en] || [];
    const highCount = chapters.filter((c) => c._frequency === 'high').length;
    const modules = new Set(chapters.map((c) => c._module)).size;
    rootIndex += `| ${cn} | ${emoji} | ${chapters.length} | ${modules} | ${highCount} | [[00_${cn}知识点总览]] |\n`;
  }

  rootIndex += `
---

## 🔗 快速入口

### 各学科总览
`;
  for (const subjectData of structuredData) {
    const cn = subjectData.subject;
    const en = SUBJECT_MAP[cn] || cn;
    const emoji = SUBJECT_EMOJI[en] || '📘';
    rootIndex += `- ${emoji} [[00_${cn}知识点总览]]\n`;
  }

  rootIndex += `\n### 真题索引\n`;
  for (const subjectData of structuredData) {
    const cn = subjectData.subject;
    const en = SUBJECT_MAP[cn] || cn;
    const seedCount = seedData.filter((s) => s.subject === en).length;
    if (seedCount > 0) {
      rootIndex += `- 📝 [[01_${cn}真题知识点索引]] (${seedCount} 个核心考点)\n`;
    }
  }

  rootIndex += `
---

## 📊 知识库统计

| 指标 | 数值 |
|------|------|
| 学科数 | ${stats.subjects} |
| 知识点文件 | ${stats.files} |
| 关联链接 | ${stats.totalLinks} |
| 跨学科链接 | ${stats.crossLinks} |
| 跳过结构性标题 | ${stats.skipped} |
| 核心考点 (seed) | ${seedData.length} |

## 🔧 数据流

\`\`\`
structured_knowledge.json (9科 PDF 提取)
    ↓ generate-obsidian-knowledge.js
knowledge-points/ (Obsidian Markdown)
    ↓ sync-obsidian-to-age.js
Apache AGE 图数据库
    ↓ RAG Search
AI 导师系统
\`\`\`

## 📅 更新记录

- **v2 (当前)**: 增强版 — 9科模块分层 + 真题双向索引 + 跨学科链接 + 分层MOC
- **v1 (初始)**: 基础版 — 知识点文件生成 + 基础 [[ ]] 链接
`;

  writeFileSync(join(OUTPUT_DIR, '00_根索引.md'), rootIndex, 'utf-8');

  // ── 统计报告 ──
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║              生成统计报告 (增强版 v2)                ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  处理科目:     ${String(stats.subjects).padStart(4)} 个                              ║`);
  console.log(`║  生成文件:     ${String(stats.files).padStart(4)} 个                              ║`);
  console.log(`║  跳过章节:     ${String(stats.skipped).padStart(4)} 个                              ║`);
  console.log(`║  关联链接:     ${String(stats.totalLinks).padStart(4)} 条                              ║`);
  console.log(`║  跨学科链接:   ${String(stats.crossLinks).padStart(4)} 个知识点                      ║`);
  console.log('╚══════════════════════════════════════════════════════╝');

  console.log(`\n📂 输出目录: ${OUTPUT_DIR}`);
  console.log('\n📋 生成文件清单:');
  for (const subjectData of structuredData) {
    const cn = subjectData.subject;
    const en = SUBJECT_MAP[cn] || cn;
    const emoji = SUBJECT_EMOJI[en] || '📘';
    const chapters = validChaptersBySubject[en] || [];
    const seedCount = seedData.filter((s) => s.subject === en).length;
    console.log(`  ${emoji} ${cn}: ${chapters.length} 知识点 + MOC + ${seedCount > 0 ? '真题索引' : ''}`);
  }

  console.log('\n✅ 完成！下一步请运行:');
  console.log('   node scripts/sync-obsidian-to-age.js');
}

try { main(); } catch (err) {
  console.error('❌ 生成失败:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
}
