/**
 * exam_questions.options 容错解析 — 三个消费方的共享实现 (2026-09-24)。
 *
 * 背景: `exam_questions.options` 并非总是合法 JSON 数组。实测全表形态:
 *   - 空 (null / '')
 *   - 纯文本 (如 "A. ①\tB. ②\tC. ③\tD. ④")  → JSON.parse 直接抛错
 *   - 合法但非数组 (对象 {"A":...} / 数字 / 布尔)
 *   - 合法数组
 * 各消费方对「解析失败」的处理策略不同, 且不能统一 (统一会改变现网行为):
 *
 *   - 语义 A「要数组」(parseOptionsAsArray): 结果会被前端 `forEach` 消费,
 *     必须最终是数组; 解析失败 / 非数组 → [] (按「无选项」处理),
 *     绝不降级为原始字符串 (字符串有 length, 会骗过前端 length>0 守卫再 forEach 抛 TypeError)。
 *     消费方: PaperGenerator.assemblePaper、exam-pdf.generateFromDatabase。
 *
 *   - 语义 B「透传」(parseOptionsPassthrough): 解析失败时保留原始字符串,
 *     保留信息、绝不回退随机; 只保证「不崩」。
 *     消费方: VisionSearchService.findSimilarQuestions。
 *
 * 本模块只负责「解析 + 判定」, **不写日志、不持计数**; 解析失败时回调
 * `onFailure(reason, raw)`, 由各调用点自行 warn / 累计计数 (保留各自的前缀、
 * 文案与静态计数字段, 便于可观测性不降级)。
 *
 * @param {'invalid-json'|'not-array'} reason
 */

function isEmpty(raw) {
  return raw === null || raw === undefined || String(raw).trim() === '';
}

function tryParse(raw) {
  try {
    return { ok: true, parsed: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

/**
 * 语义 A: 保证返回数组。
 *   - 空 / null / 纯空白 → []
 *   - 已是数组 (调用方已预解析) → 原样返回
 *   - 合法 JSON 数组 → 原数组
 *   - 合法 JSON 但非数组 (对象/数字/布尔/字符串) → [] + onFailure('not-array')
 *   - 非法 JSON (纯文本等) → [] + onFailure('invalid-json')
 */
export function parseOptionsAsArray(raw, onFailure) {
  if (isEmpty(raw)) return [];
  if (Array.isArray(raw)) return raw;
  const { ok, parsed } = tryParse(raw);
  if (!ok) {
    if (onFailure) onFailure('invalid-json', raw);
    return [];
  }
  if (Array.isArray(parsed)) return parsed;
  if (onFailure) onFailure('not-array', raw);
  return [];
}

/**
 * 语义 B: 解析失败保留原始字符串。
 *   - 空 / null / 纯空白 → []
 *   - 任意合法 JSON (数组/对象/数字/布尔/字符串) → 原样返回解析结果
 *   - 非法 JSON → String(raw) + onFailure('invalid-json')
 */
export function parseOptionsPassthrough(raw, onFailure) {
  if (isEmpty(raw)) return [];
  const { ok, parsed } = tryParse(raw);
  if (ok) return parsed;
  if (onFailure) onFailure('invalid-json', raw);
  return String(raw);
}
