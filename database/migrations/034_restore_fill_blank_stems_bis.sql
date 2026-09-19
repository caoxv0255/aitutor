-- 034_restore_fill_blank_stems_bis.sql
-- 补 033 遗漏的 3 道: 首轮分层处理把**答题必需的表内数据**随表格换成 ⟦TABLE:n⟧,
--   题不可答 (非「填空题」类型, G6 不覆盖, 故 033 未含). 值取自
--   logs/p4c-stem-backup-20260919-121241.json 的 stem_before.
-- 幂等: 每句带 stem LIKE %⟦TABLE:% 守卫.
BEGIN;

UPDATE public.exam_questions SET stem = $Q111204$（12分）（2010•湖南）为了对某课题进行研究，用分层抽样方法从三所高校A，B，C的相关人员中，抽取若干人组成研究小组、有关数据见下表（单位：人）高校相关人数抽取人数A18xB362C54y（1）求x，y；（2）若从高校B、C抽取的人中选2人作专题发言，求这二人都来自高校C的概率．$Q111204$, updated_at = now() WHERE id = 111204 AND stem LIKE '%⟦TABLE:%';

UPDATE public.exam_questions SET stem = $Q112515$（14分）$Q112515$, updated_at = now() WHERE id = 112515 AND stem LIKE '%⟦TABLE:%';

UPDATE public.exam_questions SET stem = $Q113227$2019年，我国施行个人所得税专项附加扣除办法，涉及子女教育、继续教育、大病医疗、住房贷款利息或者住房租金、赡养老人等六项专项附加扣除.某单位老、中、青员工分别有⟦F:rId693⟧人，现采用分层抽样的方法，从该单位上述员工中抽取⟦F:rId695⟧人调查专项附加扣除的享受情况.（Ⅰ）应从老、中、青员工中分别抽取多少人？（Ⅱ）抽取的25人中，享受至少两项专项附加扣除的员工有6人，分别记为⟦F:rId697⟧.享受情况如右表，其中“⟦F:rId699⟧”表示享受，“×”表示不享受.现从这6人中随机抽取2人接受采访.员工项目ABCDEF子女教育○○×○×○继续教育××○×○○大病医疗×××○××住房贷款利息○○××○○住房租金××○×××赡养老人○○×××○（i）试用所给字母列举出所有可能的抽取结果；（ii）设⟦F:rId701⟧为事件“抽取的2人享受的专项附加扣除至少有一项相同”，求事件⟦F:rId703⟧发生的概率.$Q113227$, updated_at = now() WHERE id = 113227 AND stem LIKE '%⟦TABLE:%';

COMMIT;
