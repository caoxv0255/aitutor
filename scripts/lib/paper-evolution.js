/**
 * 各省份 2008-2025 年高考试卷演进映射（单一数据源）
 *
 * 数据结构：每个时间段 { start, end, main, minor, comp, mathSplit }
 *   main:      语数英的 paper_type
 *   minor:     物化生政史地的 paper_type（新高考改革后为各省自主命题）
 *   comp:      文综/理综的 paper_type（新高考为 null，无综合卷）
 *   mathSplit: true=文理数学, false=统一数学
 */

export const MAIN_SUBJECTS = ['chinese', 'math', 'english'];
export const MINOR_SUBJECTS = ['physics', 'chemistry', 'biology', 'politics', 'history', 'geography'];
export const COMPREHENSIVE_SUBJECTS = ['science', 'liberal_arts', 'comprehensive_arts', 'comprehensive_science'];

export const PAPER_TYPE_LABELS = {
  'independent': '自主命题',
  'new_gaokao_i': '新高考I卷',
  'new_gaokao_ii': '新高考II卷',
  'national_a': '全国甲卷',
  'national_b': '全国乙卷',
  'national_i': '全国I卷',
  'national_ii': '全国II卷',
  'national_iii': '全国III卷',
  'new_i': '新课标I卷',
  'new_ii': '新课标II卷'
};

export const PROVINCE_PAPER_EVOLUTION = {
  beijing: [
    { start: 2008, end: 2019, main: 'independent', minor: 'independent', comp: 'independent', mathSplit: true },
    { start: 2020, end: 2025, main: 'independent', minor: 'independent', comp: null, mathSplit: false }
  ],
  tianjin: [
    { start: 2008, end: 2019, main: 'independent', minor: 'independent', comp: 'independent', mathSplit: true },
    { start: 2020, end: 2025, main: 'independent', minor: 'independent', comp: null, mathSplit: false }
  ],
  shanghai: [
    { start: 2008, end: 2016, main: 'independent', minor: 'independent', comp: 'independent', mathSplit: true },
    { start: 2017, end: 2025, main: 'independent', minor: 'independent', comp: null, mathSplit: false }
  ],
  zhejiang: [
    { start: 2008, end: 2016, main: 'independent', minor: 'independent', comp: 'independent', mathSplit: true },
    { start: 2017, end: 2022, main: 'independent', minor: 'independent', comp: null, mathSplit: false },
    { start: 2023, end: 2025, main: 'new_gaokao_i', minor: 'independent', comp: null, mathSplit: false }
  ],
  shandong: [
    { start: 2008, end: 2019, main: 'independent', minor: 'independent', comp: 'independent', mathSplit: true },
    { start: 2020, end: 2025, main: 'new_gaokao_i', minor: 'independent', comp: null, mathSplit: false }
  ],
  hainan: [
    { start: 2008, end: 2019, main: 'national_ii', minor: 'national_ii', comp: 'national_ii', mathSplit: true },
    { start: 2020, end: 2025, main: 'new_gaokao_ii', minor: 'independent', comp: null, mathSplit: false }
  ],
  hebei: [
    { start: 2008, end: 2020, main: 'national_i', minor: 'national_i', comp: 'national_i', mathSplit: true },
    { start: 2021, end: 2025, main: 'new_gaokao_i', minor: 'independent', comp: null, mathSplit: false }
  ],
  jiangsu: [
    { start: 2008, end: 2020, main: 'independent', minor: 'independent', comp: 'independent', mathSplit: true },
    { start: 2021, end: 2025, main: 'new_gaokao_i', minor: 'independent', comp: null, mathSplit: false }
  ],
  fujian: [
    { start: 2008, end: 2020, main: 'national_i', minor: 'national_i', comp: 'national_i', mathSplit: true },
    { start: 2021, end: 2025, main: 'new_gaokao_i', minor: 'independent', comp: null, mathSplit: false }
  ],
  hubei: [
    { start: 2008, end: 2020, main: 'independent', minor: 'independent', comp: 'independent', mathSplit: true },
    { start: 2021, end: 2025, main: 'new_gaokao_i', minor: 'independent', comp: null, mathSplit: false }
  ],
  hunan: [
    { start: 2008, end: 2020, main: 'independent', minor: 'independent', comp: 'independent', mathSplit: true },
    { start: 2021, end: 2025, main: 'new_gaokao_i', minor: 'independent', comp: null, mathSplit: false }
  ],
  guangdong: [
    { start: 2008, end: 2020, main: 'independent', minor: 'independent', comp: 'independent', mathSplit: true },
    { start: 2021, end: 2025, main: 'new_gaokao_i', minor: 'independent', comp: null, mathSplit: false }
  ],
  liaoning: [
    { start: 2008, end: 2020, main: 'national_ii', minor: 'national_ii', comp: 'national_ii', mathSplit: true },
    { start: 2021, end: 2025, main: 'new_gaokao_ii', minor: 'independent', comp: null, mathSplit: false }
  ],
  chongqing: [
    { start: 2008, end: 2020, main: 'independent', minor: 'independent', comp: 'independent', mathSplit: true },
    { start: 2021, end: 2025, main: 'new_gaokao_ii', minor: 'independent', comp: null, mathSplit: false }
  ],
  anhui: [
    { start: 2008, end: 2015, main: 'independent', minor: 'independent', comp: 'independent', mathSplit: true },
    { start: 2016, end: 2021, main: 'national_i', minor: 'national_i', comp: 'national_i', mathSplit: true },
    { start: 2022, end: 2023, main: 'national_b', minor: 'national_b', comp: 'national_b', mathSplit: true },
    { start: 2024, end: 2025, main: 'new_gaokao_i', minor: 'independent', comp: null, mathSplit: false }
  ],
  jiangxi: [
    { start: 2008, end: 2021, main: 'national_i', minor: 'national_i', comp: 'national_i', mathSplit: true },
    { start: 2022, end: 2023, main: 'national_b', minor: 'national_b', comp: 'national_b', mathSplit: true },
    { start: 2024, end: 2025, main: 'new_gaokao_i', minor: 'independent', comp: null, mathSplit: false }
  ],
  jilin: [
    { start: 2008, end: 2021, main: 'national_ii', minor: 'national_ii', comp: 'national_ii', mathSplit: true },
    { start: 2022, end: 2023, main: 'national_b', minor: 'national_b', comp: 'national_b', mathSplit: true },
    { start: 2024, end: 2025, main: 'new_gaokao_ii', minor: 'independent', comp: null, mathSplit: false }
  ],
  heilongjiang: [
    { start: 2008, end: 2021, main: 'national_ii', minor: 'national_ii', comp: 'national_ii', mathSplit: true },
    { start: 2022, end: 2023, main: 'national_b', minor: 'national_b', comp: 'national_b', mathSplit: true },
    { start: 2024, end: 2025, main: 'new_gaokao_ii', minor: 'independent', comp: null, mathSplit: false }
  ],
  guangxi: [
    { start: 2008, end: 2015, main: 'national_ii', minor: 'national_ii', comp: 'national_ii', mathSplit: true },
    { start: 2016, end: 2021, main: 'national_iii', minor: 'national_iii', comp: 'national_iii', mathSplit: true },
    { start: 2022, end: 2023, main: 'national_a', minor: 'national_a', comp: 'national_a', mathSplit: true },
    { start: 2024, end: 2025, main: 'new_gaokao_ii', minor: 'independent', comp: null, mathSplit: false }
  ],
  guizhou: [
    { start: 2008, end: 2015, main: 'national_ii', minor: 'national_ii', comp: 'national_ii', mathSplit: true },
    { start: 2016, end: 2021, main: 'national_iii', minor: 'national_iii', comp: 'national_iii', mathSplit: true },
    { start: 2022, end: 2023, main: 'national_a', minor: 'national_a', comp: 'national_a', mathSplit: true },
    { start: 2024, end: 2025, main: 'new_gaokao_ii', minor: 'independent', comp: null, mathSplit: false }
  ],
  gansu: [
    { start: 2008, end: 2021, main: 'national_ii', minor: 'national_ii', comp: 'national_ii', mathSplit: true },
    { start: 2022, end: 2023, main: 'national_b', minor: 'national_b', comp: 'national_b', mathSplit: true },
    { start: 2024, end: 2025, main: 'new_gaokao_ii', minor: 'independent', comp: null, mathSplit: false }
  ],
  shanxi: [
    { start: 2008, end: 2021, main: 'national_i', minor: 'national_i', comp: 'national_i', mathSplit: true },
    { start: 2022, end: 2024, main: 'national_b', minor: 'national_b', comp: 'national_b', mathSplit: true },
    { start: 2025, end: 2025, main: 'new_gaokao_ii', minor: 'independent', comp: null, mathSplit: false }
  ],
  henan: [
    { start: 2008, end: 2021, main: 'national_i', minor: 'national_i', comp: 'national_i', mathSplit: true },
    { start: 2022, end: 2024, main: 'national_b', minor: 'national_b', comp: 'national_b', mathSplit: true },
    { start: 2025, end: 2025, main: 'new_gaokao_i', minor: 'independent', comp: null, mathSplit: false }
  ],
  shaanxi: [
    { start: 2008, end: 2021, main: 'national_ii', minor: 'national_ii', comp: 'national_ii', mathSplit: true },
    { start: 2022, end: 2024, main: 'national_b', minor: 'national_b', comp: 'national_b', mathSplit: true },
    { start: 2025, end: 2025, main: 'new_gaokao_ii', minor: 'independent', comp: null, mathSplit: false }
  ],
  sichuan: [
    { start: 2008, end: 2015, main: 'national_ii', minor: 'national_ii', comp: 'national_ii', mathSplit: true },
    { start: 2016, end: 2021, main: 'national_iii', minor: 'national_iii', comp: 'national_iii', mathSplit: true },
    { start: 2022, end: 2024, main: 'national_a', minor: 'national_a', comp: 'national_a', mathSplit: true },
    { start: 2025, end: 2025, main: 'new_gaokao_ii', minor: 'independent', comp: null, mathSplit: false }
  ],
  yunnan: [
    { start: 2008, end: 2015, main: 'national_ii', minor: 'national_ii', comp: 'national_ii', mathSplit: true },
    { start: 2016, end: 2021, main: 'national_iii', minor: 'national_iii', comp: 'national_iii', mathSplit: true },
    { start: 2022, end: 2024, main: 'national_a', minor: 'national_a', comp: 'national_a', mathSplit: true },
    { start: 2025, end: 2025, main: 'new_gaokao_ii', minor: 'independent', comp: null, mathSplit: false }
  ],
  neimenggu: [
    { start: 2008, end: 2021, main: 'national_ii', minor: 'national_ii', comp: 'national_ii', mathSplit: true },
    { start: 2022, end: 2024, main: 'national_b', minor: 'national_b', comp: 'national_b', mathSplit: true },
    { start: 2025, end: 2025, main: 'new_gaokao_ii', minor: 'independent', comp: null, mathSplit: false }
  ],
  ningxia: [
    { start: 2008, end: 2021, main: 'national_ii', minor: 'national_ii', comp: 'national_ii', mathSplit: true },
    { start: 2022, end: 2024, main: 'national_b', minor: 'national_b', comp: 'national_b', mathSplit: true },
    { start: 2025, end: 2025, main: 'new_gaokao_ii', minor: 'independent', comp: null, mathSplit: false }
  ],
  qinghai: [
    { start: 2008, end: 2021, main: 'national_ii', minor: 'national_ii', comp: 'national_ii', mathSplit: true },
    { start: 2022, end: 2024, main: 'national_b', minor: 'national_b', comp: 'national_b', mathSplit: true },
    { start: 2025, end: 2025, main: 'new_gaokao_ii', minor: 'independent', comp: null, mathSplit: false }
  ],
  xinjiang: [
    { start: 2008, end: 2021, main: 'national_ii', minor: 'national_ii', comp: 'national_ii', mathSplit: true },
    { start: 2022, end: 2024, main: 'national_b', minor: 'national_b', comp: 'national_b', mathSplit: true },
    { start: 2025, end: 2025, main: 'new_gaokao_ii', minor: 'national_b', comp: 'national_b', mathSplit: true }
  ],
  xizang: [
    { start: 2008, end: 2015, main: 'national_ii', minor: 'national_ii', comp: 'national_ii', mathSplit: true },
    { start: 2016, end: 2021, main: 'national_iii', minor: 'national_iii', comp: 'national_iii', mathSplit: true },
    { start: 2022, end: 2024, main: 'national_a', minor: 'national_a', comp: 'national_a', mathSplit: true },
    { start: 2025, end: 2025, main: 'new_gaokao_ii', minor: 'national_a', comp: 'national_a', mathSplit: true }
  ]
};

export const PROVINCE_NAME_MAP = {
  'beijing': '北京', 'shanghai': '上海', 'tianjin': '天津', 'chongqing': '重庆',
  'hebei': '河北', 'henan': '河南', 'shandong': '山东', 'jiangsu': '江苏',
  'zhejiang': '浙江', 'fujian': '福建', 'guangdong': '广东', 'hubei': '湖北',
  'hunan': '湖南', 'anhui': '安徽', 'jiangxi': '江西', 'sichuan': '四川',
  'shaanxi': '陕西', 'guizhou': '贵州', 'yunnan': '云南', 'xinjiang': '新疆',
  'xizang': '西藏', 'neimenggu': '内蒙古', 'ningxia': '宁夏', 'qinghai': '青海',
  'gansu': '甘肃', 'heilongjiang': '黑龙江', 'jilin': '吉林', 'shanxi': '山西',
  'liaoning': '辽宁', 'hainan': '海南', 'guangxi': '广西'
};

function findPeriod(provinceCode, year) {
  const evolution = PROVINCE_PAPER_EVOLUTION[provinceCode];
  if (!evolution) return null;
  for (const period of evolution) {
    if (year >= period.start && year <= period.end) {
      return period;
    }
  }
  return null;
}

export function getPaperType(provinceCode, year, subject) {
  const period = findPeriod(provinceCode, year);
  if (!period) return null;

  if (MAIN_SUBJECTS.includes(subject)) {
    return period.main;
  }
  if (COMPREHENSIVE_SUBJECTS.includes(subject)) {
    return period.comp;
  }
  // minor subjects: physics/chemistry/biology/politics/history/geography
  return period.minor;
}

export function getMathSplit(provinceCode, year) {
  const period = findPeriod(provinceCode, year);
  if (!period) return null;
  return period.mathSplit;
}

export function getSubjectMode(provinceCode, year) {
  const period = findPeriod(provinceCode, year);
  if (!period) return null;
  const hasComprehensive = period.comp !== null;
  const isNewGaokaoMain = period.main && period.main.startsWith('new_gaokao');
  if (hasComprehensive && isNewGaokaoMain) return 'mixed';
  if (hasComprehensive) return 'comprehensive';
  return 'single';
}

export function getEvolutionInfo(provinceCode, year) {
  return findPeriod(provinceCode, year);
}
