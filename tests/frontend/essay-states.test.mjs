// 作文批改验收：六态 + 两步链路（上传→批改）+ 相对URL转绝对 + 长耗时防重复
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/essay.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/essay.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*essay\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/essay.html',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
window.URL.createObjectURL = () => 'blob:stub';
window.FileReader = class {
  readAsDataURL() { this.result = 'data:image/png;base64,AAAA'; this.onload && this.onload(); }
};
window.localStorage.setItem('authToken', 'stub-token');
await new Promise((res) => window.addEventListener('load', res));

const E = window.Essay;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const visible = () => doc.querySelectorAll('.state.is-on').length;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const GRADE = {
  data: {
    scores: { 内容: 18, 结构: 16, 语言: 17 },
    summary: '立意清晰，论据可再充实。',
    annotations: [
      { dimension: '语言', quote: '第一段原句', comment: '用词可更准确' },
      { type: '结构', note: '第二段过渡生硬' },
    ],
    meta: { report_id: 'r-1' },
  },
  reportId: 'r-1',
};

window.AIAPI.listEssays = () => Promise.resolve({ reports: [{ essay_title: '我的母亲', created_at: '2026-09-20T00:00:00Z', total_score: 51 }] });
window.AIAPI.uploadImage = () => Promise.resolve({ url: '/uploads/essay/2026/09/a.jpg', purpose: 'essay' });
window.AIAPI.gradeEssay = () => Promise.resolve(GRADE);

// 1. 六态与互斥
const panels = [...doc.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('六态面板', panels.sort().join(','), E.STATES.slice().sort().join(','));
for (const s of E.STATES) {
  E.setState(s);
  check(`setState(${s})`, E.getState(), s);
  check(`setState(${s}) 互斥`, visible(), 1);
}

// 2. 相对 URL → 绝对（漏了这步模型抓不到图）
check('相对路径转绝对', E.resolveUploadUrl('/uploads/essay/a.jpg'), 'https://x.dev/uploads/essay/a.jpg');
check('已是绝对则不变', E.resolveUploadUrl('https://cdn.x/a.jpg'), 'https://cdn.x/a.jpg');
check('空值透传', E.resolveUploadUrl(''), '');

// 3. 无 token → auth；离线不发请求
window.localStorage.removeItem('authToken');
E.setFiles([{ size: 10 }]);
await E.grade();
check('无 token → auth', E.getState(), 'auth');
window.localStorage.setItem('authToken', 'stub-token');

Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
let uploadCalls = 0;
window.AIAPI.uploadImage = () => { uploadCalls += 1; return Promise.resolve({ url: '/u/a.jpg' }); };
await E.grade();
check('离线 → offline', E.getState(), 'offline');
check('离线不发请求', uploadCalls, 0);
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 4. 没选图 → empty
E.setFiles([]);
await E.grade();
check('未选图 → empty', E.getState(), 'empty');
check('空态文案', doc.getElementById('empty-copy').textContent, '先拍一张或多张作文照片，再点开始批改。');

// 5. 两步链路：先上传（带 dataURL + purpose），再把绝对 URL 交给批改
let uploadArgs = null;
let gradeArgs = null;
window.AIAPI.uploadImage = (dataUrl, purpose) => {
  uploadArgs = { dataUrl, purpose };
  return Promise.resolve({ url: '/uploads/essay/2026/09/a.jpg' });
};
window.AIAPI.gradeEssay = (payload) => {
  gradeArgs = payload;
  return Promise.resolve(GRADE);
};
E.setFiles([{ size: 100 }]);
doc.getElementById('essay-title').value = ' 我的母亲 ';
doc.getElementById('exam-level').value = 'zhongkao';
doc.getElementById('grade-select').value = '初三';
await E.grade();
await tick(20);

check('上传带 data: 前缀', uploadArgs && uploadArgs.dataUrl.startsWith('data:image/'), true);
check('上传 purpose=essay', uploadArgs && uploadArgs.purpose, 'essay');
check('批改 images 为绝对地址', gradeArgs && gradeArgs.images[0], 'https://x.dev/uploads/essay/2026/09/a.jpg');
check('批改标题已 trim', gradeArgs && gradeArgs.essay_title, '我的母亲');
check('批改 exam_level', gradeArgs && gradeArgs.exam_level, 'zhongkao');
check('批改 grade', gradeArgs && gradeArgs.grade, '初三');

// 6. 结果渲染
check('进入结果视图', doc.getElementById('view-result').hidden, false);
check('分项单元格 3 个', doc.querySelectorAll('#score-grid .score-cell').length, 3);
check('分项名与分数', doc.querySelector('#score-grid .score-cell').textContent, '18内容');
check('总评', doc.getElementById('summary').textContent, '立意清晰，论据可再充实。');
check('批注条数', doc.querySelectorAll('#note-list .note-item').length, 2);
check('批注含引文', /第一段原句/.test(doc.getElementById('note-list').textContent), true);
check('报告编号显示', /r-1/.test(doc.getElementById('result-sub').textContent), true);

// 6b. 批次2 新键 (revised_text/severity/knowledge_points/bbox) 存在时渲染不受影响
window.AIAPI.gradeEssay = () => Promise.resolve({
  data: {
    scores: { 内容: 18 },
    summary: '扩展字段兼容',
    annotations: [
      { type: 'highlight', quote: '扩展句', comment: '扩展点评', revised_text: '改写后', severity: 'minor', knowledge_points: ['修辞'], bbox: { x: 1, y: 2, w: 3, h: 4 } },
    ],
    meta: {},
  },
  reportId: 'r-ext',
});
E.setFiles([{ size: 100 }]);
await E.grade();
await tick(20);
check('新键不破坏批注条数', doc.querySelectorAll('#note-list .note-item').length, 1);
check('新键仍渲染 quote', /扩展句/.test(doc.getElementById('note-list').textContent), true);
check('新键仍渲染 comment', /扩展点评/.test(doc.getElementById('note-list').textContent), true);
check('新键仍渲染 type 标签', /highlight/.test(doc.getElementById('note-list').textContent), true);

// 7. 分项/批注缺失时不崩
window.AIAPI.gradeEssay = () => Promise.resolve({ data: {}, reportId: null });
await E.grade();
await tick(20);
check('无分项仍成功', E.getState(), 'success');
check('无分项提示', /未返回分项评分/.test(doc.getElementById('score-grid').textContent), true);
check('无批注提示', /未返回逐段批注/.test(doc.getElementById('note-list').textContent), true);
check('无总评占位', doc.getElementById('summary').textContent, '（无总评）');

// 8. 上传失败 → error（且不再继续批改）
let gradedAfterFail = false;
window.AIAPI.uploadImage = () => Promise.reject(window.AIAPI.ApiError('image 字段必填', { status: 400 }));
window.AIAPI.gradeEssay = () => { gradedAfterFail = true; return Promise.resolve(GRADE); };
await E.grade();
check('上传失败 → error', E.getState(), 'error');
check('上传失败不继续批改', gradedAfterFail, false);
check('错误文案透传', doc.getElementById('error-copy').textContent, 'image 字段必填');

// 9. 批改失败分类
window.AIAPI.uploadImage = () => Promise.resolve({ url: '/u/a.jpg' });
window.AIAPI.gradeEssay = () => Promise.reject(window.AIAPI.ApiError('LLM 调用失败：超时', { status: 500 }));
await E.grade();
check('批改 500 → error', E.getState(), 'error');
check('批改错误文案透传', doc.getElementById('error-copy').textContent, 'LLM 调用失败：超时');

window.AIAPI.gradeEssay = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await E.grade();
check('批改 401 → auth', E.getState(), 'auth');

window.AIAPI.gradeEssay = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await E.grade();
check('批改网络失败 → offline', E.getState(), 'offline');

// 10. 防重复批改（会重复调模型 + 写重复报告）
window.AIAPI.uploadImage = () => Promise.resolve({ url: '/u/a.jpg' });
let gradeCalls = 0;
let release;
window.AIAPI.gradeEssay = () => {
  gradeCalls += 1;
  return new Promise((res) => { release = res; });
};
E.setFiles([{ size: 100 }]);
const p1 = E.grade();
await tick(10);
const p2 = E.grade();
await tick(10);
check('并发批改只发一次', gradeCalls, 1);
check('批改中按钮禁用', doc.getElementById('grade-btn').disabled, true);
release(GRADE);
await Promise.all([p1, p2]);
await tick(20);

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(30)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`));
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
