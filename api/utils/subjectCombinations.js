export const GAOKAO_MODELS = {
  '3+1+2': {
    name: '新高考3+1+2模式',
    required: ['chinese', 'math', 'english'],
    preferredOne: ['physics', 'history'],
    chooseTwo: ['chemistry', 'biology', 'politics', 'geography'],
    provinces: ['hebei', 'liaoning', 'jiangsu', 'fujian', 'hubei', 'hunan', 'guangdong', 'chongqing', 'anhui', 'jiangxi', 'henan', 'shanxi', 'sichuan', 'yunnan', 'guangxi', 'guizhou', 'gansu', 'heilongjiang', 'jilin']
  },
  '3+3': {
    name: '新高考3+3模式',
    required: ['chinese', 'math', 'english'],
    chooseThree: ['physics', 'chemistry', 'biology', 'politics', 'history', 'geography'],
    provinces: ['beijing', 'shanghai', 'tianjin', 'zhejiang', 'shandong', 'hainan']
  },
  'traditional': {
    name: '传统文理分科',
    required: ['chinese', 'math', 'english'],
    science: ['physics', 'chemistry', 'biology'],
    liberal: ['politics', 'history', 'geography'],
    provinces: []
  }
};

export const SUBJECT_COMBINATIONS = {
  '3+1+2': [
    { id: 'physics-chem-bio', name: '物化生', preferred: 'physics', chosen: ['chemistry', 'biology'], category: 'science' },
    { id: 'physics-chem-geo', name: '物化地', preferred: 'physics', chosen: ['chemistry', 'geography'], category: 'science' },
    { id: 'physics-chem-pol', name: '物化政', preferred: 'physics', chosen: ['chemistry', 'politics'], category: 'mixed' },
    { id: 'physics-bio-geo', name: '物生地', preferred: 'physics', chosen: ['biology', 'geography'], category: 'science' },
    { id: 'physics-bio-pol', name: '物生政', preferred: 'physics', chosen: ['biology', 'politics'], category: 'mixed' },
    { id: 'physics-geo-pol', name: '物地政', preferred: 'physics', chosen: ['geography', 'politics'], category: 'mixed' },
    { id: 'history-chem-bio', name: '史化生', preferred: 'history', chosen: ['chemistry', 'biology'], category: 'mixed' },
    { id: 'history-chem-geo', name: '史化地', preferred: 'history', chosen: ['chemistry', 'geography'], category: 'mixed' },
    { id: 'history-chem-pol', name: '史化政', preferred: 'history', chosen: ['chemistry', 'politics'], category: 'mixed' },
    { id: 'history-bio-geo', name: '史生地', preferred: 'history', chosen: ['biology', 'geography'], category: 'liberal' },
    { id: 'history-bio-pol', name: '史生政', preferred: 'history', chosen: ['biology', 'politics'], category: 'liberal' },
    { id: 'history-geo-pol', name: '史地政', preferred: 'history', chosen: ['geography', 'politics'], category: 'liberal' }
  ],
  '3+3': [
    { id: 'physics-chem-bio', name: '物化生', chosen: ['physics', 'chemistry', 'biology'], category: 'science' },
    { id: 'physics-chem-geo', name: '物化地', chosen: ['physics', 'chemistry', 'geography'], category: 'science' },
    { id: 'physics-chem-hist', name: '物化史', chosen: ['physics', 'chemistry', 'history'], category: 'mixed' },
    { id: 'physics-bio-geo', name: '物生地', chosen: ['physics', 'biology', 'geography'], category: 'science' },
    { id: 'physics-bio-hist', name: '物生史', chosen: ['physics', 'biology', 'history'], category: 'mixed' },
    { id: 'physics-bio-pol', name: '物生政', chosen: ['physics', 'biology', 'politics'], category: 'mixed' },
    { id: 'physics-geo-hist', name: '物地史', chosen: ['physics', 'geography', 'history'], category: 'mixed' },
    { id: 'physics-geo-pol', name: '物地政', chosen: ['physics', 'geography', 'politics'], category: 'mixed' },
    { id: 'physics-hist-pol', name: '物史政', chosen: ['physics', 'history', 'politics'], category: 'mixed' },
    { id: 'chem-bio-geo', name: '化生地', chosen: ['chemistry', 'biology', 'geography'], category: 'mixed' },
    { id: 'chem-bio-hist', name: '化生史', chosen: ['chemistry', 'biology', 'history'], category: 'mixed' },
    { id: 'chem-bio-pol', name: '化生政', chosen: ['chemistry', 'biology', 'politics'], category: 'mixed' },
    { id: 'bio-geo-hist', name: '生地史', chosen: ['biology', 'geography', 'history'], category: 'liberal' },
    { id: 'bio-geo-pol', name: '生地政', chosen: ['biology', 'geography', 'politics'], category: 'liberal' },
    { id: 'bio-hist-pol', name: '生史政', chosen: ['biology', 'history', 'politics'], category: 'liberal' },
    { id: 'geo-hist-pol', name: '地史政', chosen: ['geography', 'history', 'politics'], category: 'liberal' },
    { id: 'chem-geo-hist', name: '化地史', chosen: ['chemistry', 'geography', 'history'], category: 'mixed' },
    { id: 'chem-geo-pol', name: '化地政', chosen: ['chemistry', 'geography', 'politics'], category: 'mixed' },
    { id: 'chem-hist-pol', name: '化史政', chosen: ['chemistry', 'history', 'politics'], category: 'mixed' },
    { id: 'geo-hist-pol-2', name: '地史政', chosen: ['geography', 'history', 'politics'], category: 'liberal' }
  ],
  'traditional': [
    { id: 'science', name: '理科', chosen: ['physics', 'chemistry', 'biology'], category: 'science' },
    { id: 'liberal', name: '文科', chosen: ['politics', 'history', 'geography'], category: 'liberal' }
  ]
};

export function getGaokaoModelForProvince(provinceCode) {
  for (const [model, config] of Object.entries(GAOKAO_MODELS)) {
    if (config.provinces.includes(provinceCode)) {
      return { model, ...config };
    }
  }
  return { model: 'traditional', ...GAOKAO_MODELS.traditional };
}

export function getSubjectsForCombination(combinationId) {
  const allCombinations = Object.values(SUBJECT_COMBINATIONS).flat();
  const combo = allCombinations.find(c => c.id === combinationId);
  if (!combo) return null;

  const subjects = ['chinese', 'math', 'english'];
  if (combo.preferred) subjects.push(combo.preferred);
  if (combo.chosen) subjects.push(...combo.chosen);
  return subjects;
}

export function getCombinationsForModel(modelKey) {
  return SUBJECT_COMBINATIONS[modelKey] || [];
}

export function isSubjectInCombination(subject, combinationId) {
  const subjects = getSubjectsForCombination(combinationId);
  return subjects ? subjects.includes(subject) : false;
}
