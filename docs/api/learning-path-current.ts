/* ============================================================================
 * GET /api/learning-path/current
 *
 * 用途：今日学习页面（frontend/learning-path.html）数据源
 * 鉴权：必须（JWT Bearer Token）
 * 频率限制：与 /api/ 一致（已登录 120/min）
 * 缓存：前端 5 分钟（localStorage sessionStorage）
 *
 * 设计原则：
 * - stages 顺序固定 4 段：基础巩固 → 方法训练 → 变式应用 → 综合提升
 * - today_task 可为 null（今日已完成 或 周末无任务）
 * - empty_state 触发条件：用户首次使用 / 错题数据不足
 * - 后端需保证：
 *   · recommendation_reason 至少引用一个 cited_stat
 *   · today_task.target_url 必须可访问
 *   · status 字段已计算好（前端不做状态推导）
 *
 * 前端消费契约：frontend/learning-path.html
 * ============================================================================ */

// ========== 标准 API 信封（D062 兼容）==========
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  requestId?: string;
}

export interface ResponseMeta {
  request_id: string;
  timestamp: string;          // ISO 8601
  api_version: string;        // "v1"
  cache_ttl_seconds: number;  // 建议前端缓存时长
  server_now: string;         // 服务端当前时间（前端校时）
}

// ========== 业务类型 ==========

/** 学科枚举（与前端 SUBJECTS 列表对齐）*/
export type Subject = 'math' | 'physics' | 'chemistry' | 'chinese' | 'english' | 'politics';

/** 阶段状态 */
export type StageStatus = 'completed' | 'current' | 'locked';

/** 今日任务类型 */
export type TodayTaskType = 'practice' | 'review';

/** 阶段信息 */
export interface LearningStage {
  id: string;                                  // 阶段唯一 id（如 "stage-basic-001"）
  name: string;                                 // "基础巩固" | "方法训练" | "变式应用" | "综合提升"
  status: StageStatus;
  progress_pct?: number;                        // 仅 current 阶段必填，0-100
  description?: string;                         // 一句话说明该阶段目标
  topics?: string[];                            // 关联知识点标签（3-6 个）
  estimated_days?: number;                      // 预计天数
}

/** 今日任务 */
export interface TodayTask {
  id: string;
  type: TodayTaskType;
  title: string;                                // "复习 5 道错题" | "完成 1 组基础练习"
  reason: string;                               // AI 推荐理由（解释为什么是这个任务）
  estimated_minutes: number;                   // 预计用时
  topic: string;                                // 关联知识点名
  target_url: string;                           // 跳转 URL
  // 可选扩展字段
  knowledge_point_id?: string;
  question_count?: number;
  difficulty?: 1 | 2 | 3 | 4 | 5;
}

/** 推荐理由引用依据（chip 形式展示）*/
export interface CitedStat {
  icon: string;            // Lucide icon 名（如 "alert-triangle", "check-circle-2"）
  label: string;           // "近 7 天 4 次错" / "掌握度 62%"
  href?: string;           // 可选，点击跳详情
}

/** EmptyState 触发配置（与 P5 EmptyState 5 场景对齐）*/
export interface EmptyState {
  scenario: 'pathFail' | 'newUser';             // pathFail=接口/数据失败 | newUser=新用户
  title: string;
  description: string;
  primary_action:   { label: string; target_url?: string };
  secondary_action: { label: string; target_url?: string };
}

// ========== 主响应类型 ==========

export interface LearningPathData {
  /** 学科 */
  subject: Subject;

  /** AI 推荐理由（1-2 句话，可解释性核心）*/
  recommendation_reason: string;

  /** 引用依据 chip（2-4 个）*/
  cited_stats: CitedStat[];

  /** 全局进度 0-100 */
  global_progress_pct: number;

  /** 4 阶段（顺序固定）*/
  stages: LearningStage[];

  /** 今日任务（null 表示今日无任务 / 已完成）*/
  today_task: TodayTask | null;

  /** EmptyState 触发（可选；有此字段时前端展示 EmptyState 而非内容）*/
  empty_state?: EmptyState;
}

export interface LearningPathResponse extends ApiEnvelope<LearningPathData> {
  meta: ResponseMeta;
}

// ========== 请求参数 ==========

export interface LearningPathRequest {
  /** Query: ?subject=math */
  subject: Subject;
}
