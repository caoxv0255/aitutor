-- =============================================================================
-- 007_derivative_knowledge_points.sql
-- 目标: 为数学补全导数相关的细粒度知识点, 提升 RAG 召回率.
-- 触发问题: 之前 knowledge_points 表中含"导数"的只有 MATH-001 "函数与导数"
--          这一个上层聚合标签, 解析 LLM 几乎从不选它, 导致导数题 knowledge_points
--          字段漏标, 进而 k_text/k_embedding 都与"导数"查询距离过远, 搜不到.
-- 修复策略: 在数学学科下补全 6 个细粒度导数标签, 并保证 "函数与导数" 排在前列.
-- 兼容: 幂等 UPSERT, 可重复执行.
-- =============================================================================

BEGIN;

-- 1. 提升原 MATH-001 "函数与导数" 优先级, 让 LLM 优先看到
UPDATE knowledge_points
   SET frequency = 'high',
       difficulty = 5,
       description = COALESCE(NULLIF(description, ''), '函数的性质分析、导数的几何意义与应用、含参函数讨论、不等式证明'),
       updated_at = NOW()
 WHERE id = 'MATH-001'
   AND subject = 'math';

-- 2. 补全细粒度导数标签 (UPSERT)
INSERT INTO knowledge_points
  (id, subject, name, subtopics, difficulty, frequency, description, level,
   module, textbook, volume, volume_code, content, source, tags)
VALUES
  ('MATH-D01', 'math', '导数的概念与几何意义',
   '["导数定义","导数的几何意义","切线方程","瞬时变化率"]',
   3, 'high', '理解导数的定义、几何意义，会求曲线在某点处的切线方程',
   'gaokao', '导数及其应用', '人教版', '选修2-2', '2-2',
   '导数是函数的瞬时变化率；曲线 y=f(x) 在 x0 处的切线斜率等于 f''(x0)；切线方程 y - f(x0) = f''(x0)(x - x0)',
   '人教A版选修2-2 第一章', '["导数","切线"]'),
  ('MATH-D02', 'math', '导数的运算',
   '["基本求导公式","和差积商求导法则","复合函数求导","隐函数求导","参数方程求导"]',
   3, 'high', '掌握常见函数求导公式、复合函数求导、隐函数求导',
   'gaokao', '导数及其应用', '人教版', '选修2-2', '2-2',
   '熟记基本求导表，掌握链式法则 (f(g(x)))''=f''(g(x))·g''(x)，能处理隐函数与参数方程求导',
   '人教A版选修2-2 第一章', '["导数","求导"]'),
  ('MATH-D03', 'math', '导数与单调性',
   '["单调性判定","单调区间","极值点"]',
   3, 'high', '用导数判定函数单调性、求单调区间、判断极值点',
   'gaokao', '导数及其应用', '人教版', '选修2-2', '2-2',
   'f''(x)>0 ⇔ f(x) 单调递增；f''(x)<0 ⇔ f(x) 单调递减；极值点是 f''(x)=0 且左右变号的点',
   '人教A版选修2-2 第一章', '["导数","单调性"]'),
  ('MATH-D04', 'math', '导数与极值最值',
   '["极值","最值","闭区间最值"]',
   4, 'high', '求函数的极大值、极小值；在闭区间上求函数最值',
   'gaokao', '导数及其应用', '人教版', '选修2-2', '2-2',
   '极值是局部概念、最值是全局概念；闭区间 [a,b] 上最值需要比较端点函数值与极值点函数值',
   '人教A版选修2-2 第一章', '["导数","极值","最值"]'),
  ('MATH-D05', 'math', '导数与不等式证明',
   '["构造函数","切线法","放缩","含参不等式"]',
   5, 'high', '利用导数证明不等式：构造函数法、切线法、放缩法',
   'gaokao', '导数及其应用', '人教版', '选修2-2', '2-2',
   '构造 F(x)=f(x)-g(x)，证 F''(x) 符号从而判 F(x) 单调；切线法利用 f(x) ≥ f(x0)+f''(x0)(x-x0)',
   '人教A版选修2-2 第一章', '["导数","不等式"]'),
  ('MATH-D06', 'math', '导数与函数零点',
   '["零点个数","含参零点讨论","零点存在定理"]',
   5, 'high', '利用导数研究函数零点个数，含参分类讨论',
   'gaokao', '导数及其应用', '人教版', '选修2-2', '2-2',
   '数形结合：分析 f(x) 的单调性与极值，画图后数 y=0 与 y=f(x) 图像交点个数',
   '人教A版选修2-2 第一章', '["导数","零点"]')
ON CONFLICT (id) DO UPDATE SET
  subject     = EXCLUDED.subject,
  name        = EXCLUDED.name,
  subtopics   = EXCLUDED.subtopics,
  difficulty  = EXCLUDED.difficulty,
  frequency   = EXCLUDED.frequency,
  description = EXCLUDED.description,
  level       = EXCLUDED.level,
  module      = EXCLUDED.module,
  textbook    = EXCLUDED.textbook,
  volume      = EXCLUDED.volume,
  volume_code = EXCLUDED.volume_code,
  content     = EXCLUDED.content,
  source      = EXCLUDED.source,
  tags        = EXCLUDED.tags,
  updated_at  = NOW();

-- 3. 把这些标签挂到 "函数与导数" 这棵树下：通过 tags 字段做关联，便于前端聚合
UPDATE knowledge_points
   SET tags = tags || '["parent:MATH-001"]'::jsonb
 WHERE id IN ('MATH-D01','MATH-D02','MATH-D03','MATH-D04','MATH-D05','MATH-D06')
   AND NOT (tags @> '["parent:MATH-001"]'::jsonb);

COMMIT;

-- 验证查询
-- SELECT id, name, frequency FROM knowledge_points WHERE id LIKE 'MATH-D%' ORDER BY id;