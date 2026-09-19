-- 026_is_listening.sql
-- 目的: 标记「英语听力题」, 供题库与统计口径排除。用户指令 2026-09-18「跳过英语听力题」。
--
-- 为什么不是「从统计里排除」:
--   实测该子集答案率 83.03%, **高于**全库 79.60% —— 从分母里拿掉它会让指标变差 0.24pp。
--   合理的用法是「从题库剔除」: 没有音频的听力题在文本题库里不可作答。
--
-- 判据 (可验证): 学科=english 且 题号<=20 且 options 恰好含 A/B/C 三项 (无 D)。
--   依据: 高考英语听力固定 第一节5题+第二节15题=题号1-20, 且明确「从 A、B、C 三个选项中选出」;
--         其余题型均为四选 —— 所以「无 D 键」就是"听力"的可判定特征。
--   ⚠️ 踩过的坑: 最初用「冒号计数 >= 2」当判据, 结果标记了 2387 道 (四选项 JSON 也有 >=2 个冒号),
--      与 JSON 侧独立测量 (1526) 对不上才发现。**统计口径必须用独立测量对账。**
--
-- 只标记不删除 (与库里「归档而非删除」约定一致)。

ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS is_listening boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN exam_questions.is_listening IS
  '英语听力题标记 (题号<=20 且 options 恰为 A/B/C 三项)。文本题库无法作答, 供统计与读端口径排除。';

CREATE INDEX IF NOT EXISTS idx_exam_questions_is_listening
  ON exam_questions (is_listening) WHERE is_listening;

UPDATE exam_questions q
   SET is_listening = true, updated_at = now()
  FROM exam_papers p
 WHERE p.id = q.paper_id
   AND p.subject = 'english'
   AND q.question_number <= 20
   AND q.archive_state = 'active'
   AND q.options LIKE '%"A":%' AND q.options LIKE '%"B":%' AND q.options LIKE '%"C":%'
   AND q.options NOT LIKE '%"D":%';
