-- 027_answer_status_llm_proposed.sql
-- 目的: 把「联网大模型兜底补的答案」纳入 answer_status 词表。
--
-- 背景 (用户指令: 兜底方案用大模型联网搜索补全)
--   源语料确实缺答案的那部分题, 用户明确要求用联网大模型兜底补全。
--   但盲测实测(2026-09-18, 拿近 5 年**源里已有答案**的真题喂模型):
--
--     模型              单次准确率    均token/题   均耗时/题
--     kimi-k3 + 联网     96.0% (24/25)      675      16.3s   ← 采用的配置
--     deepseek-v3.2      83.3%              160       0.7s
--     qwen-plus          80.0%              182       0.3s
--
--   **准确率不是 100%** → 这类答案必须能与「源提取并独立核验过」的答案区分开,
--   否则会把全库 99.2% 的核验口径拖低, 且下游无法知道哪些能直接用于判分。
--
-- 因此:
--   · answer_source = 'llm_websearch'   —— 与源提取路径分开, 可一键整类回滚
--   · answer_status = 'LLM_PROPOSED'    —— 本 migration 加入词表
--
-- 注意: 这是**新增取值**, 不改变既有取值语义; 存量数据不受影响。

ALTER TABLE public.exam_questions
  DROP CONSTRAINT IF EXISTS ck_exam_questions_answer_status;

ALTER TABLE public.exam_questions
  ADD CONSTRAINT ck_exam_questions_answer_status
  CHECK (answer_status IN (
    'PRESENT',          -- 源里取到答案
    'MISSING_SOURCE',   -- 源里确实没有答案
    'CONFLICT',         -- 两条路径给出的答案互相矛盾 → 待裁决
    'REVIEW_REQUIRED',  -- 需要人工复核
    'LLM_PROPOSED',     -- 联网大模型兜底补的 (实测约 96%, **未独立核验**)
    'UNKNOWN'
  ));

COMMENT ON COLUMN public.exam_questions.answer_status IS
  '答案状态。LLM_PROPOSED = 联网大模型兜底补的, 实测约 96% 准确率, **未独立核验**; '
  '统计「经核验可判率」时必须排除此状态。';

-- 便于按状态快速过滤
CREATE INDEX IF NOT EXISTS idx_exam_questions_answer_status
  ON public.exam_questions (answer_status);
