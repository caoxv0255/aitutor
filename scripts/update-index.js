import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SUBJECT_MAP = {
  chinese: { name: '语文' },
  math: { name: '数学' },
  english: { name: '英语' },
  physics: { name: '物理' },
  chemistry: { name: '化学' },
  biology: { name: '生物' },
  history: { name: '历史' },
  geography: { name: '地理' },
  politics: { name: '政治' }
};

const BASE_DATA_DIR = path.join(ROOT, 'database', 'question-bank');

function getQuestionCount(subject, year) {
  const dir = path.join(BASE_DATA_DIR, subject, year.toString());
  if (!fs.existsSync(dir)) return 0;
  const questionDirs = fs.readdirSync(dir).filter(d => 
    fs.statSync(path.join(dir, d)).isDirectory() && /^\d{3}$/.test(d)
  );
  return questionDirs.length;
}

function getMetadata(subject, year) {
  const dir = path.join(BASE_DATA_DIR, subject, year.toString());
  if (!fs.existsSync(dir)) return null;
  
  const metaPath = path.join(dir, 'paper_metadata.json');
  let meta = {};
  if (fs.existsSync(metaPath)) {
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch {}
  }
  
  const questionDirs = fs.readdirSync(dir).filter(d => 
    fs.statSync(path.join(dir, d)).isDirectory() && /^\d{3}$/.test(d)
  );
  
  let answerCount = 0, analysisCount = 0;
  for (const qDir of questionDirs) {
    const contentPath = path.join(dir, qDir, 'content.md');
    if (fs.existsSync(contentPath)) {
      const content = fs.readFileSync(contentPath, 'utf-8');
      if (content.includes('## 参考答案') && content.match(/## 参考答案\n\n(.+?)(\n\n|\n---|\n##|$)/s)) {
        const answer = content.match(/## 参考答案\n\n(.+?)(\n\n|\n---|\n##|$)/s)[1];
        if (answer && answer.trim() && answer.trim() !== '暂无') answerCount++;
      }
      if (content.includes('## 解析') && content.match(/## 解析\n\n(.+?)(\n\n|\n---|\n##|$)/s)) {
        const analysis = content.match(/## 解析\n\n(.+?)(\n\n|\n---|\n##|$)/s)[1];
        if (analysis && analysis.trim() && analysis.trim() !== '暂无') analysisCount++;
      }
    }
  }
  
  const total = questionDirs.length;
  meta.quality_stats = meta.quality_stats || {};
  meta.quality_stats.answer_completeness = total > 0 ? ((answerCount / total) * 100).toFixed(1) : '0.0';
  meta.quality_stats.analysis_completeness = total > 0 ? ((analysisCount / total) * 100).toFixed(1) : '0.0';
  meta.question_count = total;
  
  return meta;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function generateIndexPage() {
  const indexDir = path.join(BASE_DATA_DIR, 'index');
  ensureDir(indexDir);
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>北京高考真题题库 - 2019-2023</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Microsoft YaHei', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { text-align: center; color: white; margin-bottom: 30px; font-size: 2.5em; }
        .filters { display: flex; justify-content: center; gap: 15px; margin-bottom: 30px; flex-wrap: wrap; }
        .filter-group label { color: white; font-weight: bold; }
        .filter-group select { padding: 8px 16px; border-radius: 8px; border: none; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.1); transition: transform 0.3s; }
        .card:hover { transform: translateY(-5px); }
        .card-header { padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .card-body { padding: 15px; }
        .stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .stat-label { color: #666; }
        .stat-value { font-weight: bold; color: #333; }
        .btn { display: inline-block; width: 100%; padding: 10px; text-align: center; background: #667eea; color: white; text-decoration: none; border-radius: 8px; margin-top: 10px; }
        .btn:hover { background: #5a6fd6; }
        .stats-summary { background: white; border-radius: 12px; padding: 20px; margin-bottom: 30px; display: flex; justify-content: space-around; flex-wrap: wrap; }
        .stat-box { text-align: center; }
        .stat-box .number { font-size: 2em; color: #667eea; font-weight: bold; }
        .stat-box .label { color: #666; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📚 北京高考真题题库</h1>
        <div class="stats-summary">
            <div class="stat-box"><div class="number">45</div><div class="label">试卷总数</div></div>
            <div class="stat-box"><div class="number">9</div><div class="label">学科数量</div></div>
            <div class="stat-box"><div class="number">5</div><div class="label">年份覆盖</div></div>
            <div class="stat-box"><div class="number">800+</div><div class="label">题目总数</div></div>
        </div>
        <div class="filters">
            <div class="filter-group"><label>学科:</label><select id="subject-filter" onchange="filterCards()"><option value="all">全部学科</option><option value="chinese">语文</option><option value="math">数学</option><option value="english">英语</option><option value="physics">物理</option><option value="chemistry">化学</option><option value="biology">生物</option><option value="history">历史</option><option value="geography">地理</option><option value="politics">政治</option></select></div>
            <div class="filter-group"><label>年份:</label><select id="year-filter" onchange="filterCards()"><option value="all">全部年份</option><option value="2025">2025年</option><option value="2024">2024年</option><option value="2023">2023年</option><option value="2022">2022年</option><option value="2021">2021年</option><option value="2020">2020年</option><option value="2019">2019年</option></select></div>
        </div>
        <div class="grid" id="card-grid">
            ${Object.keys(SUBJECT_MAP).map(subject => 
                [2025, 2024, 2023, 2022, 2021, 2020, 2019].map(year => {
                    const count = getQuestionCount(subject, year);
                    const meta = getMetadata(subject, year);
                    return `
            <div class="card" data-subject="${subject}" data-year="${year}">
                <div class="card-header"><h3>${SUBJECT_MAP[subject].name}</h3><span style="font-size:0.9em;opacity:0.9">${year}年</span></div>
                <div class="card-body">
                    <div class="stat-row"><span class="stat-label">题目数</span><span class="stat-value" id="${subject}-${year}-count">${count}</span></div>
                    <div class="stat-row"><span class="stat-label">答案完整率</span><span class="stat-value" id="${subject}-${year}-answer">${meta?.quality_stats?.answer_completeness || '-'}%</span></div>
                    <div class="stat-row"><span class="stat-label">解析完整率</span><span class="stat-value" id="${subject}-${year}-analysis">${meta?.quality_stats?.analysis_completeness || '-'}%</span></div>
                    <a class="btn" href="../${subject}/${year}/index.html">查看试卷</a>
                </div>
            </div>
                    `;
                }).join('')
            ).join('')}
        </div>
    </div>
    <script>
        function filterCards() {
            const subject = document.getElementById('subject-filter').value;
            const year = document.getElementById('year-filter').value;
            document.querySelectorAll('.card').forEach(card => {
                const s = card.dataset.subject;
                const y = card.dataset.year;
                card.style.display = (subject === 'all' || s === subject) && (year === 'all' || y === year) ? 'block' : 'none';
            });
        }
    </script>
</body>
</html>`;
  
  fs.writeFileSync(path.join(indexDir, 'index.html'), html, 'utf-8');
  console.log('主索引页面已更新');
}

function generatePaperIndex(subject, year) {
  const outputDir = path.join(BASE_DATA_DIR, subject, year.toString());
  if (!fs.existsSync(outputDir)) return;
  
  const metadataPath = path.join(outputDir, 'paper_metadata.json');
  let metadata = {};
  if (fs.existsSync(metadataPath)) {
    try { metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')); } catch {}
  }
  
  const questionDirs = fs.readdirSync(outputDir).filter(d => fs.statSync(path.join(outputDir, d)).isDirectory() && /^\d{3}$/.test(d));
  questionDirs.sort((a, b) => parseInt(a) - parseInt(b));
  
  const questions = [];
  for (const dir of questionDirs) {
    const metaPath = path.join(outputDir, dir, 'metadata.json');
    if (fs.existsSync(metaPath)) {
      try { questions.push(JSON.parse(fs.readFileSync(metaPath, 'utf-8'))); } catch {}
    }
  }
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.subject_name || subject} ${year}年 - 北京高考真题</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Microsoft YaHei', sans-serif; background: #f5f7fa; padding: 20px; }
        .container { max-width: 1000px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
        .header h1 { font-size: 2em; }
        .header .info { margin-top: 10px; opacity: 0.9; }
        .back-btn { display: inline-block; padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; text-decoration: none; border-radius: 6px; margin-bottom: 15px; }
        .question-list { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .question-item { padding: 15px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.3s; }
        .question-item:last-child { border-bottom: none; }
        .question-item:hover { background: #f8f9fa; }
        .q-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
        .q-number { font-weight: bold; color: #667eea; font-size: 1.2em; }
        .q-type { padding: 3px 8px; background: #e9ecef; border-radius: 4px; font-size: 0.85em; }
        .q-stem { color: #666; font-size: 0.95em; line-height: 1.5; }
        .q-meta { display: flex; gap: 15px; margin-top: 8px; font-size: 0.85em; color: #999; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: flex-start; padding: 40px; z-index: 1000; }
        .modal-content { background: white; border-radius: 12px; max-width: 800px; width: 100%; max-height: 80vh; overflow-y: auto; padding: 20px; position: relative; }
        .modal-close { position: absolute; top: 15px; right: 15px; font-size: 24px; cursor: pointer; color: #999; }
        .md-content { line-height: 1.8; }
        .md-content h1 { color: #667eea; margin-bottom: 15px; }
        .md-content h2 { color: #333; margin: 20px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #eee; }
        .md-content h3 { color: #555; margin: 15px 0 8px; }
        .md-content p { margin-bottom: 10px; }
        .md-content ul, .md-content ol { margin-left: 20px; margin-bottom: 10px; }
        .md-content blockquote { border-left: 4px solid #667eea; padding-left: 15px; margin: 15px 0; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <a href="../index/index.html" class="back-btn">← 返回题库首页</a>
            <h1>${metadata.subject_name || subject} ${year}年高考真题</h1>
            <div class="info">题目数: ${metadata.question_count || questions.length} | 页面数: ${metadata.page_count || '-'} | 图片数: ${metadata.image_count || '-'}</div>
        </div>
        <div class="question-list">
            ${questions.map(q => `
            <div class="question-item" onclick="showQuestion('${q.uid}')">
                <div class="q-header"><span class="q-number">第${q.question_number}题</span><span class="q-type">${q.question_type_name}</span></div>
                <div class="q-stem">${(q.stem || '').substring(0, 100)}${(q.stem || '').length > 100 ? '...' : ''}</div>
                <div class="q-meta">
                    <span>难度: ${'★'.repeat(q.difficulty)}${'☆'.repeat(5 - q.difficulty)}</span>
                    <span>分值: ${q.score}分</span>
                    <span>知识点: ${(q.knowledge_points || []).slice(0, 3).join('、')}${(q.knowledge_points || []).length > 3 ? '...' : ''}</span>
                </div>
            </div>
            `).join('')}
        </div>
    </div>
    <div class="modal" id="question-modal">
        <div class="modal-content">
            <span class="modal-close" onclick="closeModal()">&times;</span>
            <div class="md-content" id="question-content"></div>
        </div>
    </div>
    <script>
        async function showQuestion(uid) {
            const modal = document.getElementById('question-modal');
            const content = document.getElementById('question-content');
            try {
                const num = uid.split('_')[3];
                const res = await fetch(\`\${num}/content.md\`);
                const md = await res.text();
                content.innerHTML = mdToHtml(md);
            } catch(e) {
                content.innerHTML = '<p>加载失败</p>';
            }
            modal.style.display = 'flex';
        }
        function closeModal() {
            document.getElementById('question-modal').style.display = 'none';
        }
        function mdToHtml(md) {
            return md.replace(/^# (.+)$/gm, '<h1>$1</h1>')
                     .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                     .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                     .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                     .replace(/---/g, '<hr>')
                     .replace(/\n/g, '<br>');
        }
        document.getElementById('question-modal').addEventListener('click', (e) => {
            if(e.target.id === 'question-modal') closeModal();
        });
    </script>
</body>
</html>`;
  
  fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf-8');
}

function main() {
  console.log('更新索引页面...');
  generateIndexPage();
  
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const subjects = Object.keys(SUBJECT_MAP);
  
  for (const year of years) {
    for (const subject of subjects) {
      generatePaperIndex(subject, year);
    }
  }
  
  console.log('所有索引页面已更新完成');
}

main();