#!/usr/bin/env node
/**
 * 导入2025年湖南卷物理真题到 exam_questions 和 province_knowledge_stats
 */
import { getDb } from '/home/flaskappuser/Desktop/NewDisk_2T/new_fastapi.git/aitutor/api/db.js';

const pool = await getDb();

const PAPER_ID = 19; // 2025 湖南物理
const PROVINCE_CODE = 'hunan';
const YEAR = 2025;
const SUBJECT = 'physics';

// 1. 确保光学知识点存在
await pool.query(`
  INSERT INTO knowledge_points (id, subject, name, subtopics, difficulty, frequency, description, level)
  VALUES ('PHYSICS-010', 'physics', '光学', '["几何光学","折射定律","全反射","光的干涉","光的衍射"]', 3, 'medium', '光的折射、反射、干涉、衍射等光学基本规律', 'gaokao')
  ON CONFLICT (id) DO NOTHING
`);
console.log('✅ PHYSICS-010 光学 knowledge point ensured');

// 2. 插入题目
const questions = [
  // 单选题 (单选用 question_type='choice', 每题4分)
  { qnum: 1, type: 'choice', stem: '关于原子核衰变，下列说法正确的是（ ）', options: ['A. 原子核衰变后生成新核并释放能量，新核总质量等于原核质量', 'B. 大量某放射性元素的原子核有半数发生衰变所需时间，为该元素的半衰期', 'C. 放射性元素的半衰期随环境温度升高而变长', 'D. 采用化学方法可以有效改变放射性元素的半衰期'], answer: 'B', kp: 'PHYSICS-004', difficulty: 2, score: 4 },
  { qnum: 2, type: 'choice', stem: '物块以某一初速度滑上足够长的固定光滑斜面，物块的水平位移、竖直位移、水平速度、竖直速度分别用x、y、v_x、v_y表示。物块向上运动过程中，下列图像可能正确的是（ ）', options: null, answer: 'C', kp: 'PHYSICS-001', difficulty: 2, score: 4 },
  { qnum: 3, type: 'choice', stem: '如图，ABC为半圆柱体透明介质的横截面，AC为直径，B为ABC的中点。真空中一束单色光从AC边射入介质，入射点为A点，折射光直接由B点出射。不考虑光的多次反射，下列说法正确的是（ ）', options: ['A. 入射角θ小于45°', 'B. 该介质折射率大于√2', 'C. 增大入射角，该单色光在BC上可能发生全反射', 'D. 减小入射角，该单色光在AB上可能发生全反射'], answer: 'D', kp: 'PHYSICS-010', difficulty: 3, score: 4 },
  { qnum: 4, type: 'choice', stem: '我国研制的"天问二号"探测器，任务是对伴地小行星及彗星交会等进行多目标探测。某同学提出探究方案，通过释放卫星绕小行星进行圆周运动，可测得小行星半径R和质量M。为探测某自转周期为T₀的小行星，卫星先在其同步轨道上运行，测得距离小行星表面高度为h，接下来变轨到小行星表面附近绕其做匀速圆周运动，测得周期为T₁。已知引力常量为G，下列选项正确的是（ ）', options: ['A. a为T₁,b为T₀,c为T₁', 'B. a为T₁,b为T₀,c为T₀', 'C. a为T₀,b为T₁,c为T₁', 'D. a为T₀,b为T₁,c为T₀'], answer: 'A', kp: 'PHYSICS-007', difficulty: 3, score: 4 },
  { qnum: 5, type: 'choice', stem: '如图，两带电小球的质量均为m，小球A用一端固定在墙上的绝缘轻绳连接，小球B用固定的绝缘轻杆连接。A球静止时，轻绳与竖直方向的夹角为60°，两球连线与轻绳的夹角为30°，整个系统在同一竖直平面内，重力加速度大小为g。下列说法正确的是（ ）', options: ['A. A球静止时，轻绳上拉力为2mg', 'B. A球静止时，A球与B球间的库仑力为2mg', 'C. 若将轻绳剪断，则剪断瞬间A球加速度大小为g', 'D. 若将轻绳剪断，则剪断瞬间轻杆对B球的作用力变小'], answer: 'C', kp: 'PHYSICS-002', difficulty: 3, score: 4 },
  { qnum: 6, type: 'choice', stem: '如图，某小组设计了灯泡亮度可调的电路，a、b、c为固定的三个触点，理想变压器原、副线圈匝数比为k，灯泡L和三个电阻的阻值均恒为R，交变电源输出电压的有效值恒为U。开关S与不同触点相连，下列说法正确的是（ ）', options: ['A. S与a相连，灯泡的电功率最大', 'B. S与a相连，灯泡两端的电压为kU/(k²+3)', 'C. S与b相连，流过灯泡的电流为U/((k²+2)R)', 'D. S与c相连，灯泡的电功率为U²/((k²+1)R)'], answer: 'B', kp: 'PHYSICS-009', difficulty: 3, score: 4 },

  // 多选题 (多选用 question_type='multi_choice', 每题5分)
  { qnum: 7, type: 'multi_choice', stem: '如图，A(0,0)、B(4,0)、C(0,3)在xy平面内，两波源分别置于A、B两点。t=0时，两波源从平衡位置起振，起振方向相同且垂直于xy平面。频率均为2.5Hz。两波源持续产生振幅相同的简谐横波，波分别沿AC、BC方向传播，波速均为10m/s。下列说法正确的是（ ）', options: ['A. 两横波的波长均为4m', 'B. t=0.4s时，C处质点加速度为0', 'C. t=0.4s时，C处质点速度不为0', 'D. t=0.6s时，C处质点速度为0'], answer: 'AD', kp: 'PHYSICS-005', difficulty: 3, score: 5 },
  { qnum: 8, type: 'multi_choice', stem: '一匀强电场的方向平行于xOy平面，平面内A点和B点的位置如图所示。电荷量为+q、-q和+2q的三个试探电荷先后分别置于O点、A点和B点时，电势能均为Ep(Ep>0)。下列说法正确的是（ ）', options: ['A. OA中点的电势为零', 'B. 电场的方向与x轴正方向成60°角', 'C. 电场强度的大小为2Ep/(qd)', 'D. 电场强度的大小为2√2Ep/(qd)'], answer: 'AD', kp: 'PHYSICS-002', difficulty: 4, score: 5 },
  { qnum: 9, type: 'multi_choice', stem: '如图，关于x轴对称的光滑导轨固定在水平面内，导轨形状为抛物线，顶点位于O点。一足够长的金属杆初始位置与y轴重合，金属杆的质量为m，单位长度的电阻为r₀。整个空间存在竖直向上的匀强磁场，磁感应强度为B。现给金属杆一沿x轴正方向的初速度v₀，金属杆运动过程中始终与y轴平行，且与电阻不计的导轨接触良好。下列说法正确的是（ ）', options: ['A. 金属杆沿x轴正方向运动过程中，金属杆中电流沿y轴负方向', 'B. 金属杆可以在沿x轴正方向的恒力作用下做匀速直线运动', 'C. 金属杆停止运动时，与导轨围成的面积为mv₀r₀/B²', 'D. 若金属杆的初速度减半，则金属杆停止运动时经过的距离小于原来的一半'], answer: 'AC', kp: 'PHYSICS-002', difficulty: 4, score: 5 },
  { qnum: 10, type: 'multi_choice', stem: '如图，某爆炸能量测量装置由装载台和滑轨等构成，C是可以在滑轨上运动的标准测量件。滑轨安装在高度为h的水平面上。测量时，将弹药放入装载台圆筒内，两端用物块A和B封装。引爆后，极短时间内B嵌入C中形成组合体D，D与滑轨间的动摩擦因数为μ。D在滑轨上运动S₁距离后抛出，落地点距抛出点水平距离为S₂，根据S₂可计算出弹药释放的能量。某次测量中，A、B、C质量分别为3m、m、5m，S₁=h/μ。则（ ）', options: ['A. D的初动能与爆炸后瞬间A的动能相等', 'B. D的初动能与其落地时的动能相等', 'C. 弹药释放的能量为36mgh(1+S₂²/(4h²))', 'D. 弹药释放的能量为48mgh(1+S₂²/(4h²))'], answer: 'BD', kp: 'PHYSICS-003', difficulty: 4, score: 5 },

  // 非选择题
  { qnum: 11, type: 'solve', stem: '某同学通过观察小球在黏性液体中的运动，探究其动力学规律。\n（1）用螺旋测微器测量小球直径D如图1所示，D=________mm。\n（2）在液面处由静止释放小球，同时使用频闪摄影仪记录小球下落过程中不同时刻的位置，频闪仪每隔0.5s闪光一次。装置及所拍照片示意图如图2所示。\n（3）根据照片分析，小球在A、E两点间近似做匀速运动，速度大小v=________m/s（保留2位有效数字）。\n（4）小球在液体中运动时受到液体的黏滞阻力f=kDv（k为与液体有关的常量），已知小球密度为ρ，液体密度为ρ₀，重力加速度大小为g，则k的表达式为k=________。\n（5）换成直径更小的同种材质小球，匀速运动时的速度将________（填"增大""减小"或"不变"）。', options: null, answer: '①2.207mm ②0.010m/s ③(ρ-ρ₀)gπD²/(6v) ④减小', kp: 'PHYSICS-001', difficulty: 3, score: 8 },
  { qnum: 12, type: 'solve', stem: '车辆运输中若存在超载现象，将带来安全隐患。由普通水泥和导电材料混合制成的导电水泥，可以用于监测道路超载问题。某小组对此进行探究。\n（1）选择一块均匀的长方体导电水泥块样品，用多用电表粗测其电阻，读数为________Ω。\n（2）使用伏安法测量水泥块电阻，在图2中完成余下导线的连接。\n（3）测量水泥块的长为a，宽为b，高为c。用伏安法测得水泥块电阻为R，则电阻率ρ=________。\n（5）设计压力报警系统，报警器应并联在________两端。\n（6）若电源E使用时间过长，电动势变小，则F₁________F₀（填"大于""小于"或"等于"）。', options: null, answer: '①8000Ω ②见解析 ③Rbc/a ④R₁ ⑤大于', kp: 'PHYSICS-008', difficulty: 3, score: 10 },
  { qnum: 13, type: 'solve', stem: '用热力学方法可测量重力加速度。如图所示，粗细均匀的细管开口向上竖直放置，管内用液柱封闭了一段长度为L₁的空气柱。液柱长为h，密度为ρ。缓慢旋转细管至水平，封闭空气柱长度为L₂，大气压强为p₀。\n（1）若整个过程中温度不变，求重力加速度g的大小；\n（2）某次实验测量数据：液柱长h=0.2000m，开口向上竖直放置时空气柱温度T₁=305.7K。水平放置时调控空气柱温度，当空气柱温度T₂=300.0K时，空气柱长度与竖直放置时相同。已知ρ=1.0×10³kg/m³, p₀=1.0×10⁵Pa，求重力加速度g的值。', options: null, answer: '(1)g=p₀(L₂-L₁)/(L₁ρh) (2)g=9.5m/s²', kp: 'PHYSICS-006', difficulty: 3, score: 10 },
  { qnum: 14, type: 'solve', stem: '直流电源的电动势为E₀，内阻为r₀，滑动变阻器R的最大阻值为2r₀，平行板电容器两极板水平放置，板间距离为d，板长为√3d，平行板电容器的右侧存在方向垂直纸面向里的匀强磁场。闭合开关S，当滑片处于滑动变阻器中点时，质量为m的带正电粒子以初速度v₀水平向右从电容器左侧中点a进入电容器，恰好从电容器下极板右侧边缘b点进入磁场，随后又从电容器上极板右侧边缘c点进入电容器，忽略粒子重力和空气阻力。\n（1）求粒子所带电荷量q；\n（2）求磁感应强度B的大小；\n（3）若粒子离开b点时，在平行板电容器的右侧再加一个方向水平向右的匀强电场，场强大小为4√3E₀/(3d)，求粒子相对于电容器右侧的最远水平距离xₘ。', options: null, answer: '(1)q=mv₀²/E₀ (2)B=2E₀/(dv₀) (3)xₘ=(2+√3)d/2', kp: 'PHYSICS-002', difficulty: 5, score: 13 },
  { qnum: 15, type: 'solve', stem: '某地为发展旅游经济，因地制宜利用山体举办了机器人杂技表演。表演中，需要将质量为m的机器人抛至悬崖上的A点。a、b为同一水平面上两条光滑平行轨道，轨道中有质量为M的滑杆。滑杆用长度为L的轻绳与机器人相连。初始时刻，轻绳绷紧且与轨道平行，机器人从B点以初速度v竖直向下运动，B点位于轨道平面上，且在A点正下方，AB=1.2L。滑杆始终与轨道垂直，机器人可视为质点且始终在同一竖直平面内运动，不计空气阻力，轻绳不可伸长，sin37°=0.6，重力加速度大小为g。\n（1）若滑杆固定，v=√(gL)，当机器人运动到滑杆正下方时，求轻绳拉力的大小；\n（2）若滑杆固定，当机器人运动到滑杆左上方且轻绳与水平方向夹角为37°时，机器人松开轻绳后被抛至A点，求v的大小；\n（3）若滑杆能沿轨道自由滑动，M=km且k≥1，当机器人运动到滑杆左上方且轻绳与水平方向夹角为37°时，机器人松开轻绳后被抛至A点，求v与k的关系式及v的最小值。', options: null, answer: '(1)F=4mg (2)v=√(37gl/10) (3)v=√(9kgl/(10(k+1))+14gl/5), v_min=√(13gl/4)', kp: 'PHYSICS-001', difficulty: 5, score: 15 },
];

console.log(`\n导入 ${questions.length} 道题目...`);

let insertedCount = 0;
for (const q of questions) {
  try {
    await pool.query(`
      INSERT INTO exam_questions (paper_id, question_number, question_type, stem, options, answer, knowledge_points, difficulty, score)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [PAPER_ID, q.qnum, q.type, q.stem, q.options ? JSON.stringify(q.options) : null, q.answer, JSON.stringify([q.kp]), q.difficulty, q.score]);
    insertedCount++;
  } catch (err) {
    console.error(`  ❌ Q${q.qnum}: ${err.message}`);
  }
}
console.log(`✅ 导入 ${insertedCount}/${questions.length} 道题目`);

// 3. 更新试卷统计
const stats = await pool.query(`
  SELECT COUNT(*) as qcount, SUM(score) as total
  FROM exam_questions WHERE paper_id = $1
`, [PAPER_ID]);
const { qcount, total } = stats.rows[0];
const avgDiff = await pool.query(`
  SELECT AVG(difficulty) as avg_d FROM exam_questions WHERE paper_id = $1
`, [PAPER_ID]);

await pool.query(`
  UPDATE exam_papers
  SET question_count = $1, total_score = $2, difficulty_avg = $3
  WHERE id = $4
`, [qcount, total, parseFloat(avgDiff.rows[0].avg_d).toFixed(2), PAPER_ID]);
console.log(`✅ 试卷统计更新: ${qcount}题, ${total}分, 平均难度${parseFloat(avgDiff.rows[0].avg_d).toFixed(2)}`);

// 4. 更新 province_knowledge_stats
// 按知识点统计
const kpStats = await pool.query(`
  SELECT
    kp_id,
    COUNT(*) as count,
    AVG(difficulty) as avg_d,
    SUM(score) as total_s
  FROM (
    SELECT jsonb_array_elements_text(knowledge_points) as kp_id, difficulty, score
    FROM exam_questions WHERE paper_id = $1
  ) sub
  GROUP BY kp_id
`, [PAPER_ID]);

console.log('\n知识点统计:');
for (const row of kpStats.rows) {
  const kpName = await pool.query('SELECT name FROM knowledge_points WHERE id = $1', [row.kp_id]);
  const name = kpName.rows[0]?.name || row.kp_id;
  console.log(`  ${row.kp_id} (${name}): ${row.count}题, 平均难度${parseFloat(row.avg_d).toFixed(1)}, ${row.total_s}分`);

  await pool.query(`
    INSERT INTO province_knowledge_stats (province_code, year, subject, knowledge_point_id, frequency, avg_difficulty, total_score)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (province_code, year, subject, knowledge_point_id)
    DO UPDATE SET frequency = EXCLUDED.frequency, avg_difficulty = EXCLUDED.avg_difficulty, total_score = EXCLUDED.total_score
  `, [PROVINCE_CODE, YEAR, SUBJECT, row.kp_id, parseInt(row.count), parseFloat(row.avg_d).toFixed(2), parseInt(row.total_s)]);
}
console.log('✅ province_knowledge_stats 已更新');

// 5. 更新 provinces 表的 description 字段（如果没有）
await pool.query(`
  UPDATE provinces SET description = '使用新高考I卷，注重基础知识和能力并重'
  WHERE code = 'hunan' AND (description IS NULL OR description = '')
`);

console.log(`\n✅ 湖南卷数据全部导入完成!`);
process.exit(0);
