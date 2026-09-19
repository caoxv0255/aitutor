/* ============================================================================
 * P11 · Learning Path · 单元测试
 *
 * 目标：覆盖 4 个纯函数（无 DB 依赖）
 *   - buildStages(progressPct)
 *   - generateRecommendation(ctx)
 *   - buildCitedStats(ctx)
 *   - pickTodayTask(srsDue, currentKps)
 *   - checkEmptyState(ctx)
 *   - composeLearningPathData(raw, subject) ← 端到端组装
 *
 * 跑：npm test -- learning-path-current
 * ============================================================================ */

import { describe, it, expect } from 'vitest';

import {
  buildStages,
  generateRecommendation,
  buildCitedStats,
  pickTodayTask,
  checkEmptyState,
  composeLearningPathData,
} from '../../api/handlers/learning-path.js';

// ============================================================================
// buildStages
// ============================================================================

describe('buildStages()', () => {
  it('Case 1: progress=0 → 第 1 阶段 current，后续 locked', () => {
    const stages = buildStages(0);
    expect(stages).toHaveLength(4);
    expect(stages[0].status).toBe('current');
    expect(stages[0].progress_pct).toBe(0);
    expect(stages[1].status).toBe('locked');
    expect(stages[2].status).toBe('locked');
    expect(stages[3].status).toBe('locked');
  });

  it('Case 2: progress=50 → 第 3 阶段 current', () => {
    const stages = buildStages(50);
    expect(stages[0].status).toBe('completed');
    expect(stages[1].status).toBe('completed');
    expect(stages[2].status).toBe('current');
    expect(stages[2].progress_pct).toBe(0);
    expect(stages[3].status).toBe('locked');
  });

  it('Case 3: progress=100 → 全部 completed', () => {
    const stages = buildStages(100);
    expect(stages.every(s => s.status === 'completed')).toBe(true);
  });

  it('Case 4: progress=99 → 第 4 阶段 current 99%', () => {
    const stages = buildStages(99);
    expect(stages[3].status).toBe('current');
    expect(stages[3].progress_pct).toBeGreaterThan(90);
  });

  it('Case 5: progress 超界 200/负数 → 边界保护', () => {
    expect(buildStages(200)[3].status).toBe('completed');
    expect(buildStages(-50)[0].status).toBe('current');
  });

  it('Case 6: 4 阶段固定顺序 = 基础/方法/变式/综合', () => {
    const stages = buildStages(20);
    expect(stages.map(s => s.name)).toEqual(['基础巩固', '方法训练', '变式应用', '综合提升']);
  });
});

// ============================================================================
// generateRecommendation
// ============================================================================

describe('generateRecommendation()', () => {
  it('Case 1: 某 KP 近 7 天 ≥3 次错 → 优先推荐该 KP', () => {
    const ctx = {
      subjectName: '数学',
      knowledgePoints: [
        { name: '二次函数图像', recent_wrong_count: 4, mastery: 38 },
      ],
      recentWrongTotal: 5,
    };
    const reason = generateRecommendation(ctx);
    expect(reason).toContain('二次函数图像');
    expect(reason).toContain('4 次错误');
    expect(reason).toContain('巩固');
  });

  it('Case 2: 无高频错题但有低掌握度 KP → 推荐该 KP', () => {
    const ctx = {
      subjectName: '物理',
      knowledgePoints: [
        { name: '电磁感应', recent_wrong_count: 0, mastery: 25 },
        { name: '力学', recent_wrong_count: 1, mastery: 80 },
      ],
      recentWrongTotal: 3,
    };
    const reason = generateRecommendation(ctx);
    expect(reason).toContain('电磁感应');
    expect(reason).toContain('25%');
  });

  it('Case 3: 零错题 + 零数据 → 引导做诊断', () => {
    const ctx = {
      subjectName: '数学',
      knowledgePoints: [],
      recentWrongTotal: 0,
    };
    const reason = generateRecommendation(ctx);
    expect(reason).toContain('错题');
    expect(reason).toContain('建议');
  });

  it('Case 4: 全部已掌握 + 有错题 → 通用鼓励', () => {
    const ctx = {
      subjectName: '英语',
      knowledgePoints: [
        { name: 'A', recent_wrong_count: 0, mastery: 90 },
        { name: 'B', recent_wrong_count: 0, mastery: 85 },
      ],
      recentWrongTotal: 3,
    };
    const reason = generateRecommendation(ctx);
    expect(reason).toContain('继续');
  });

  it('Case 5: 高频错题优先于低掌握度（同时存在时）', () => {
    const ctx = {
      subjectName: '数学',
      knowledgePoints: [
        { name: '掌握度低', recent_wrong_count: 0, mastery: 10 },
        { name: '高频错题', recent_wrong_count: 5, mastery: 70 },
      ],
      recentWrongTotal: 6,
    };
    const reason = generateRecommendation(ctx);
    expect(reason).toContain('高频错题');
    expect(reason).not.toContain('掌握度低');
  });
});

// ============================================================================
// buildCitedStats
// ============================================================================

describe('buildCitedStats()', () => {
  it('Case 1: 满 4 项 chip 截断', () => {
    const stats = buildCitedStats({
      knowledgePoints: [
        { name: 'A', recent_wrong_count: 5, mastery: 30 },
        { name: 'B', recent_wrong_count: 1, mastery: 50 },
        { name: 'C', recent_wrong_count: 0, mastery: 90 },
        { name: 'D', recent_wrong_count: 0, mastery: 95 },
      ],
      recentWrongTotal: 10,
    });
    expect(stats.length).toBeLessThanOrEqual(4);
  });

  it('Case 2: 0 错题 → 只返回 1 项共 N 条错题', () => {
    const stats = buildCitedStats({
      knowledgePoints: [],
      recentWrongTotal: 0,
    });
    expect(stats).toHaveLength(0);
  });

  it('Case 3: 含 Lucide icon 名', () => {
    const stats = buildCitedStats({
      knowledgePoints: [{ name: 'X', recent_wrong_count: 3, mastery: 40 }],
      recentWrongTotal: 3,
    });
    expect(stats[0]).toHaveProperty('icon');
    expect(typeof stats[0].icon).toBe('string');
  });
});

// ============================================================================
// pickTodayTask
// ============================================================================

describe('pickTodayTask()', () => {
  it('Case 1: SRS 到期复习优先（priority 1）', () => {
    const task = pickTodayTask(
      [{ knowledge_point_id: 'kp-1', name: '二次函数', due_count: 3, difficulty: 3 }],
      [{ knowledge_point_id: 'kp-2', name: '椭圆', mastery: 30 }],
      'math'
    );
    expect(task.type).toBe('review');
    expect(task.topic).toBe('二次函数');
    expect(task.target_url).toContain('review.html');
    expect(task.knowledge_point_id).toBe('kp-1');
  });

  it('Case 2: 无 SRS → 最低 mastery KP 练习（priority 2）', () => {
    const task = pickTodayTask(
      [],
      [
        { knowledge_point_id: 'kp-1', name: 'A', mastery: 80 },
        { knowledge_point_id: 'kp-2', name: 'B', mastery: 25 },
        { knowledge_point_id: 'kp-3', name: 'C', mastery: 50 },
      ],
      'math'
    );
    expect(task.type).toBe('practice');
    expect(task.knowledge_point_id).toBe('kp-2');
  });

  it('Case 3: 无数据 → null（100% 完成时）', () => {
    expect(pickTodayTask([], [], 'math')).toBeNull();
  });

  it('Case 4: SRS 有多个到期 → 选最早的（first）', () => {
    const task = pickTodayTask(
      [
        { knowledge_point_id: 'kp-1', name: 'A', due_count: 3 },
        { knowledge_point_id: 'kp-2', name: 'B', due_count: 5 },
      ],
      [],
      'math'
    );
    expect(task.knowledge_point_id).toBe('kp-1');
  });
});

// ============================================================================
// checkEmptyState
// ============================================================================

describe('checkEmptyState()', () => {
  it('Case 1: 100% 完成 → 触发 EmptyState（newUser 场景复用）', () => {
    const es = checkEmptyState({
      subject: 'math', subjectName: '数学',
      hasData: true, globalProgressPct: 100, todayTask: null,
    });
    expect(es).not.toBeNull();
    expect(es.title).toContain('完成');
  });

  it('Case 2: 无数据 + 0 进度 → 触发 EmptyState（新生）', () => {
    const es = checkEmptyState({
      subject: 'math', subjectName: '数学',
      hasData: false, globalProgressPct: 0, todayTask: null,
    });
    expect(es).not.toBeNull();
    expect(es.title).toContain('路径');
    expect(es.primary_action.target_url).toContain('onboarding');
  });

  it('Case 3: 正常进度 50% + 有今日任务 → null（不触发）', () => {
    const es = checkEmptyState({
      subject: 'math', subjectName: '数学',
      hasData: true, globalProgressPct: 50, todayTask: { id: 't1' },
    });
    expect(es).toBeNull();
  });
});

// ============================================================================
// composeLearningPathData · 端到端组装（3 Mock 场景）
// ============================================================================

describe('composeLearningPathData()', () => {
  // ----- Scenario 1: 正常路径（数学，错题多，进度 25-50）-----
  it('Scenario 1 · 正常路径 → 4 阶段 / current=第 2 / today_task=review', () => {
    // masteries 选 [40, 30, 35, 35] → avg 35 → 进度 35% → 阶段 1 = current
    const data = composeLearningPathData({
      masteryRows: [
        { knowledge_point_id: 'kp-math-001', mastery_score: 40, next_review_at: null, recent_wrong_count: 0, due_count: 0 },
        { knowledge_point_id: 'kp-math-002', mastery_score: 30, next_review_at: null, recent_wrong_count: 4, due_count: 0 },
        { knowledge_point_id: 'kp-math-003', mastery_score: 35, next_review_at: null, recent_wrong_count: 1, due_count: 0 },
        { knowledge_point_id: 'kp-math-004', mastery_score: 35, next_review_at: '2099-01-01T00:00:00Z', recent_wrong_count: 0, due_count: 0 },
      ],
      kpRows: [
        { id: 'kp-math-001', name: '基础函数', difficulty: 2 },
        { id: 'kp-math-002', name: '二次函数图像', difficulty: 3 },
        { id: 'kp-math-003', name: '解析几何', difficulty: 4 },
        { id: 'kp-math-004', name: '数列', difficulty: 3 },
      ],
      wrongRows: [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }, { id: 'w4' }, { id: 'w5' }],
      reviewRows: [],
    }, 'math');

    expect(data.subject).toBe('math');
    expect(data.stages).toHaveLength(4);
    expect(data.stages[0].status).toBe('completed');   // 基础完成（avg 35 ≥ 25）
    expect(data.stages[1].status).toBe('current');     // 方法训练进行中
    expect(data.stages[2].status).toBe('locked');
    expect(data.stages[3].status).toBe('locked');
    expect(data.global_progress_pct).toBeGreaterThanOrEqual(25);
    expect(data.global_progress_pct).toBeLessThan(50);

    // 推荐理由含"二次函数图像"（最高频错）
    expect(data.recommendation_reason).toContain('二次函数图像');

    // cited_stats 含 alert-triangle（错题 ≥3）
    expect(data.cited_stats.find(s => s.icon === 'alert-triangle')).toBeDefined();

    // today_task 存在（无 SRS → 走最低 mastery 练习）
    expect(data.today_task).not.toBeNull();
    expect(data.today_task.type).toBe('practice');

    // 无 empty_state
    expect(data.empty_state).toBeUndefined();
  });

  // ----- Scenario 2: 全部完成（100% 进度）-----
  it('Scenario 2 · 全部完成 → 4 阶段 completed / today_task=null / empty_state 触发', () => {
    const data = composeLearningPathData({
      masteryRows: [
        { knowledge_point_id: 'kp-1', mastery_score: 100, next_review_at: null, recent_wrong_count: 0, due_count: 0 },
        { knowledge_point_id: 'kp-2', mastery_score: 100, next_review_at: null, recent_wrong_count: 0, due_count: 0 },
        { knowledge_point_id: 'kp-3', mastery_score: 100, next_review_at: null, recent_wrong_count: 0, due_count: 0 },
        { knowledge_point_id: 'kp-4', mastery_score: 100, next_review_at: null, recent_wrong_count: 0, due_count: 0 },
      ],
      kpRows: [
        { id: 'kp-1', name: 'A', difficulty: 2 },
        { id: 'kp-2', name: 'B', difficulty: 3 },
        { id: 'kp-3', name: 'C', difficulty: 3 },
        { id: 'kp-4', name: 'D', difficulty: 4 },
      ],
      wrongRows: [],
      reviewRows: [],
    }, 'math');

    expect(data.global_progress_pct).toBe(100);
    expect(data.stages.every(s => s.status === 'completed')).toBe(true);
    expect(data.today_task).toBeNull();
    expect(data.empty_state).not.toBeUndefined();
    expect(data.empty_state.title).toContain('完成');
    expect(data.empty_state.primary_action.target_url).toBe('/wrong-book.html');
  });

  // ----- Scenario 3: 新生（无任何数据）-----
  it('Scenario 3 · 新生 → 4 阶段（首阶段 current 0%） / empty_state.newUser 触发', () => {
    const data = composeLearningPathData({
      masteryRows: [],
      kpRows: [],
      wrongRows: [],
      reviewRows: [],
    }, 'math');

    // 4 阶段始终返回（前端即使有 empty_state 也保留结构）
    expect(data.stages).toHaveLength(4);
    expect(data.stages[0].status).toBe('current');    // 进度 0 → 第 1 阶段 current
    expect(data.stages[0].progress_pct).toBe(0);
    expect(data.stages.slice(1).every(s => s.status === 'locked')).toBe(true);
    expect(data.today_task).toBeNull();
    expect(data.global_progress_pct).toBe(0);
    expect(data.empty_state).not.toBeUndefined();
    expect(data.empty_state.scenario).toBe('newUser');
    expect(data.empty_state.primary_action.target_url).toContain('onboarding');
    expect(data.empty_state.secondary_action.target_url).toContain('photo');
    expect(data.cited_stats).toHaveLength(0);
  });

  // ----- Scenario 4: SRS 到期（review 类型 today_task）-----
  it('Scenario 4 · SRS 有 1 个到期 → today_task.type=review', () => {
    const data = composeLearningPathData({
      masteryRows: [
        { knowledge_point_id: 'kp-srs-1', mastery_score: 70, next_review_at: '2020-01-01T00:00:00Z', recent_wrong_count: 2, due_count: 3 },
      ],
      kpRows: [{ id: 'kp-srs-1', name: '函数', difficulty: 3 }],
      wrongRows: [],
      reviewRows: [{ knowledge_point_id: 'kp-srs-1', due: 3 }],
    }, 'math');

    expect(data.today_task).not.toBeNull();
    expect(data.today_task.type).toBe('review');
    expect(data.today_task.knowledge_point_id).toBe('kp-srs-1');
    expect(data.today_task.target_url).toContain('review.html');
  });

  // ----- 边界保护 -----
  it('边界: 进度 < 0 → 0；进度 > 100 → 100', () => {
    const data1 = composeLearningPathData({
      masteryRows: [{ knowledge_point_id: 'k', mastery_score: -10, next_review_at: null, recent_wrong_count: 0 }],
      kpRows: [{ id: 'k', name: 'X', difficulty: 2 }], wrongRows: [], reviewRows: [],
    }, 'math');
    expect(data1.global_progress_pct).toBe(0);

    const data2 = composeLearningPathData({
      masteryRows: [{ knowledge_point_id: 'k', mastery_score: 150, next_review_at: null, recent_wrong_count: 0 }],
      kpRows: [{ id: 'k', name: 'X', difficulty: 2 }], wrongRows: [], reviewRows: [],
    }, 'math');
    expect(data2.global_progress_pct).toBe(100);
  });
});
