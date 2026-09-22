-- 038_essay_reports_align.sql
-- G11 修复：essay_reports 线上表与代码 schema 对齐（schema drift 第三例）
--
-- 背景：api/handlers/essay/essayStorage.js 的 INSERT 需要
--   report_id / essay_title / exam_level / grade / transcript / annotations / meta / error_message
-- 而线上表是 F3 时代的旧 schema（id / data jsonb / images jsonb / title / score / confidence）。
-- 双方从未对齐：INSERT 必然「column does not exist」→ 持久化失败 → 作文批改永远出不了报告。
-- （线上有 155 行旧数据 —— 旧管线曾真实工作过）
--
-- 本迁移：
--   1. 补齐代码需要的列
--   2. 从旧列回填（title → essay_title；data->transcript/annotations/meta）
--   3. 为 report_id 建唯一索引（代码按它查询）
--   旧列（data/images/score/confidence）保留不删 —— 历史数据兜底，清理另做决策。
--
-- 幂等：ADD COLUMN IF NOT EXISTS + WHERE report_id IS NULL。

BEGIN;

ALTER TABLE essay_reports
  -- 旧 schema 的强制列（data/images NOT NULL）转为可空：
  -- 新管线按新列写入，旧列保留历史数据但不再强制
  ALTER COLUMN data DROP NOT NULL,
  ALTER COLUMN images DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS report_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS essay_title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS exam_level VARCHAR(10),
  ADD COLUMN IF NOT EXISTS grade VARCHAR(50),
  ADD COLUMN IF NOT EXISTS transcript JSONB,
  ADD COLUMN IF NOT EXISTS annotations JSONB,
  ADD COLUMN IF NOT EXISTS meta JSONB,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

UPDATE essay_reports
   SET report_id = 'legacy-' || id,
       essay_title = COALESCE(essay_title, title),
       transcript = COALESCE(data -> 'transcript', '{"paragraphs": []}'::jsonb),
       annotations = COALESCE(data -> 'annotations', '[]'::jsonb),
       meta = COALESCE(data -> 'meta', '{}'::jsonb)
 WHERE report_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_essay_reports_report_id
  ON essay_reports(report_id);

COMMIT;

-- 验证:
--   SELECT COUNT(*) FROM essay_reports WHERE report_id IS NULL;  -- 期望 0
--   SELECT report_id, essay_title, status FROM essay_reports ORDER BY created_at DESC LIMIT 3;
