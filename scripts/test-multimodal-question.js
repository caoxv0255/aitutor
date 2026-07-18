#!/usr/bin/env node
/**
 * 多模态题库测试脚本
 */
import { 
  saveQuestion, 
  loadQuestion, 
  generateQuestionUID,
  buildQuestionMD,
  buildMetadataJSON,
  generateQuestionDir
} from './lib/multimodal-question.js';
import { generateEmbeddingForVectorDB } from './lib/embedding-generator.js';

async function run() {
  console.log('🚀 多模态题库系统测试');
  console.log('='.repeat(80));

  const testQuestion = {
    question_id: 'math_2023_beijing_01',
    subject: 'math',
    year: 2023,
    region: 'beijing',
    question_no: 1,
    question_type: 'solve',
    difficulty: 4,
    score: 12,
    knowledge_points: ['函数', '导数', '单调性'],
    content: `已知函数 $f(x) = x^3 - 3x + a$，其中 $a$ 为常数。

(1) 求 $f(x)$ 的单调区间；

(2) 若 $f(x)$ 在区间 $[-2, 2]$ 上的最大值为 2，求 $a$ 的值。

(3) 在(2)的条件下，证明：对于任意的 $x_1, x_2 \\in [-1, 1]$，有 $|f(x_1) - f(x_2)| \\leq 4$。`,
    images: [],
    image_descriptions: [],
    answer: `(1) $f'(x) = 3x^2 - 3 = 3(x+1)(x-1)$

令 $f'(x) > 0$，得 $x < -1$ 或 $x > 1$；
令 $f'(x) < 0$，得 $-1 < x < 1$。

所以 $f(x)$ 的单调递增区间为 $(-\\infty, -1)$ 和 $(1, +\\infty)$，单调递减区间为 $(-1, 1)$。

(2) 由(1)知，$f(x)$ 在 $x = -1$ 处取得极大值，在 $x = 1$ 处取得极小值。

$f(-1) = -1 + 3 + a = a + 2$
$f(1) = 1 - 3 + a = a - 2$
$f(-2) = -8 + 6 + a = a - 2$
$f(2) = 8 - 6 + a = a + 2$

所以最大值为 $a + 2 = 2$，解得 $a = 0$。

(3) 当 $a = 0$ 时，$f(x) = x^3 - 3x$。

由(1)知，$f(x)$ 在 $[-1, 1]$ 上单调递减，
所以 $f(x)_{\\text{max}} = f(-1) = 2$，$f(x)_{\\text{min}} = f(1) = -2$。

因此 $|f(x_1) - f(x_2)| \\leq |2 - (-2)| = 4$。`,
    analysis: `本题考查利用导数研究函数的单调性、极值与最值。

(1) 通过求导，令导数大于零和小于零，分别求出单调递增和递减区间。

(2) 求出区间端点和极值点的函数值，比较后确定最大值，从而求解 $a$。

(3) 利用函数在区间上的单调性求出最大值和最小值，进而证明不等式。`,
    common_mistakes: `1. 求导时符号错误，特别是常数项的导数；
2. 忽略区间端点的函数值，只比较极值；
3. 证明不等式时，没有正确利用函数的单调性；
4. 计算错误，特别是代入求值时。`,
    related_knowledge: `1. 导数的定义与几何意义
2. 利用导数研究函数的单调性
3. 函数的极值与最值
4. 不等式的证明方法`,
    has_image: false,
    has_formula: true,
    source_info: {
      paper_name: '2023年北京高考数学试卷',
      source_type: 'gaokao',
      collection_date: '2023-06-10'
    },
    solving_methods: ['导数法', '综合法', '分析法'],
    concepts: ['导数定义', '导数公式', '函数性质', '极值', '最值'],
    typical_category: '函数与导数',
    key_features: '包含三次函数、导数应用、不等式证明'
  };

  console.log('\n📝 1. 生成题目UID');
  const uid = generateQuestionUID('math', 2023, 'beijing', 1);
  console.log(`   UID: ${uid}`);

  console.log('\n📄 2. 生成question.md内容');
  const mdContent = buildQuestionMD(testQuestion);
  console.log(mdContent.substring(0, 300) + '...');

  console.log('\n📋 3. 生成metadata.json内容');
  const metadataContent = buildMetadataJSON(testQuestion);
  console.log(metadataContent);

  console.log('\n🔍 4. 生成embedding.txt内容');
  const embeddingText = generateEmbeddingForVectorDB(testQuestion);
  console.log(embeddingText);

  console.log('\n💾 5. 保存题目到文件系统');
  const saveResult = await saveQuestion(testQuestion);
  console.log(`   保存目录: ${saveResult.question_dir}`);
  console.log(`   创建文件: ${saveResult.files_created.join(', ')}`);
  console.log(`   文件总数: ${saveResult.total_files}`);

  console.log('\n📂 6. 从文件系统加载题目');
  const loadedQuestion = loadQuestion('math', 2023, 'beijing', 1);
  if (loadedQuestion) {
    console.log(`   ✅ 成功加载题目`);
    console.log(`   - question.md: ${loadedQuestion.md_content ? '存在' : '不存在'}`);
    console.log(`   - metadata.json: ${loadedQuestion.metadata ? '存在' : '不存在'}`);
    console.log(`   - embedding.txt: ${loadedQuestion.embedding_text ? '存在' : '不存在'}`);
  } else {
    console.log('   ❌ 加载失败');
  }

  console.log('\n✅ 测试完成！');
}

run().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
