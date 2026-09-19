-- 036_question_media_refs.sql
-- P4 多模态读端可达 (路线图 P2b): 把题面里的 ⟦IMG:rId⟧ / ⟦F:rId⟧ 占位符
-- 确定性映射到 out/media 资产 (以及 VLM 的 latex)。
--
-- 为什么需要:
--   qbx 抽题时把图片/公式替换成 ⟦IMG:rIdN⟧ / ⟦F:rIdN⟧ (rId = docx 关系 id),
--   但**从未持久化 rId → 资产** 的映射: 05-ingest 写 question_images/raw_image_path
--   是「按题目顺序的列表」, 既没有 rId, 也没有与 token 的一一对应。
--   实测 11021 题的 stem 里带着裸 ⟦IMG:rId…⟧ / ⟦F:rId…⟧ 直接进读端。
--
-- 值形态 (键 = token 的 kind:arg, 即 ⟦IMG:rId4⟧ → "IMG:rId4"):
--   {"IMG:rId4": {"kind":"figure","sha256":"ab8e…","ext":".png",
--                 "rel_path":"history/2021/ab/ab8e….png"},
--    "F:rId5":   {"kind":"formula","sha256":"…","ext":".wmf",
--                 "rel_path":"…","latex":"\\frac{12}{25}"}}
--   资产实际位于 database/preflight/qb-extract/out/media/<rel_path>;
--   latex 来自 database/preflight/qb-extract/out/vlm/<sha256>.json。
--   ⟦OMML:txt⟧ 不需要资产 (text 就在 token 里), 不入本表。
--
-- **幂等**: ADD COLUMN IF NOT EXISTS。回滚: DROP COLUMN media_refs。

BEGIN;

ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS media_refs JSONB;

COMMENT ON COLUMN public.exam_questions.media_refs IS
  '⟦IMG:rId⟧ / ⟦F:rId⟧ → out/media 资产 的映射 (键 = "kind:rId")。'
  '值 {"kind","sha256","ext","rel_path","latex"?}。资产在 '
  'database/preflight/qb-extract/out/media/<rel_path>; latex 来自 out/vlm/<sha256>.json。'
  '由 30-backfill-media-refs.py 生成。为什么不在现有 raw_image_path 上算: 那是按题顺序的'
  '列表, 没有 rId, 无法对齐到 token。';

CREATE INDEX IF NOT EXISTS idx_exam_questions_media_refs
  ON public.exam_questions USING gin (media_refs)
  WHERE media_refs IS NOT NULL;

COMMIT;
