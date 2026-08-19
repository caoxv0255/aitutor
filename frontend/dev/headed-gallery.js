// frontend/dev/headed-gallery.js
// 纯前端, fetch 静态 JSON 渲染. 无后端依赖.
//
// 数据模型:
//   runs/index.json                          [{ runId, startedAt, ... }, ...]  倒序
//   runs/<runId>/manifest.json               { runId, startedAt, finishedAt, browser, shots: [...] }
//   runs/<runId>/<step>.png                  截图

const BASE = '';  // 同源

const els = {
  runSelect:  document.getElementById('run-select'),
  runSummary: document.getElementById('run-summary'),
  reloadBtn:  document.getElementById('reload-btn'),
  gallery:    document.getElementById('gallery-grid'),
  diffLeft:   document.getElementById('diff-left'),
  diffRight:  document.getElementById('diff-right'),
  diffStep:   document.getElementById('diff-step'),
  diffFrame:  document.getElementById('diff-frame'),
  logFrame:   document.getElementById('log-frame'),
  lightbox:   document.getElementById('lightbox'),
  lightboxImg: document.getElementById('lightbox-img'),
  lightboxMeta: document.getElementById('lightbox-meta'),
};

const state = { index: [], manifests: {} };

// ── fetch helpers ──
async function fetchJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

// ── 启动 ──
async function init() {
  try {
    state.index = await fetchJSON('./runs/index.json');
  } catch (e) {
    els.gallery.innerHTML = `<p class="hg-empty">未发现 run 数据. 请先跑一次: <code>node scripts/headed-tests/run.mjs</code></p>`;
    els.logFrame.innerHTML = `<span class="log-err">${e.message}</span>`;
    return;
  }

  populateRunSelects();
  if (state.index.length > 0) {
    const latest = state.index[0].runId;
    els.runSelect.value = latest;
    await loadRun(latest);
    if (state.index.length > 1) {
      els.diffLeft.value  = state.index[0].runId;
      els.diffRight.value = state.index[1].runId;
      renderDiff();
    }
  }

  els.runSelect.addEventListener('change', () => loadRun(els.runSelect.value));
  els.reloadBtn.addEventListener('click', () => location.reload());
  for (const id of ['diff-left', 'diff-right', 'diff-step']) {
    document.getElementById(id).addEventListener('change', renderDiff);
  }

  setupLightbox();
}

function populateRunSelects() {
  const opts = state.index.map(r =>
    `<option value="${r.runId}">${r.runId} · ${r.lastStep ?? '?'} · ${new Date(r.startedAt).toLocaleString()}</option>`
  ).join('');
  els.runSelect.innerHTML = opts || '<option value="">无数据</option>';
  els.diffLeft.innerHTML  = opts;
  els.diffRight.innerHTML = opts;
}

async function loadRun(runId) {
  const m = await fetchJSON(`./runs/${runId}/manifest.json`);
  state.manifests[runId] = m;
  els.runSummary.textContent =
    `${m.shots.length} 步 · ${m.browser} · ${(Date.parse(m.finishedAt) - Date.parse(m.startedAt)) / 1000}s`;
  renderGallery(m);
  renderLog(m);
  if (state.index.length >= 2) renderDiff();
}

// ── 区块 1: 画廊 ──
function renderGallery(m) {
  els.gallery.innerHTML = m.shots.map((s, i) => `
    <article class="hg-shot" data-shot="${i}">
      <div class="hg-shot-thumb">
        <img loading="lazy" src="./screenshots/${m.runId}/${s.file}" alt="${s.step}">
      </div>
      <div class="hg-shot-meta">
        <div class="hg-shot-name">${i + 1}. ${s.step}</div>
        <div class="hg-shot-url">${s.url}</div>
        <div class="hg-shot-badges">
          ${statusBadge(s.status)}
          ${(s.pageErrors && s.pageErrors.length) ? `<span class="hg-badge err">${s.pageErrors.length} err</span>` : ''}
          <span class="hg-badge">${s.width}×${s.height}</span>
          <span class="hg-badge">${new Date(s.at).toLocaleTimeString()}</span>
        </div>
      </div>
    </article>
  `).join('');

  els.gallery.querySelectorAll('.hg-shot').forEach(card => {
    card.addEventListener('click', () => openLightbox(parseInt(card.dataset.shot, 10), m));
  });
}

function statusBadge(status) {
  if (status == null) return '';
  if (status >= 200 && status < 400) return `<span class="hg-badge ok">${status}</span>`;
  if (status >= 400) return `<span class="hg-badge err">${status}</span>`;
  return `<span class="hg-badge warn">${status}</span>`;
}

// ── 区块 2: diff ──
function renderDiff() {
  const left  = els.diffLeft.value;
  const right = els.diffRight.value;
  const step  = els.diffStep.value;
  if (!left || !right || left === right) {
    els.diffFrame.innerHTML = `<p class="hg-empty">选择两个不同的 run 来对比.</p>`;
    return;
  }
  Promise.all([
    state.manifests[left]  || fetchJSON(`./runs/${left}/manifest.json`),
    state.manifests[right] || fetchJSON(`./runs/${right}/manifest.json`),
  ]).then(([mL, mR]) => {
    state.manifests[left]  = mL;
    state.manifests[right] = mR;
    const sL = mL.shots.find(s => s.file.startsWith(`${mL.shots.indexOf(s) + 1}-`) && s.step === step) || mL.shots.find(s => s.file.includes(step));
    const sR = mR.shots.find(s => s.file.includes(step));
    if (!sL || !sR) {
      els.diffFrame.innerHTML = `<p class="hg-empty">该 step 在其中一个 run 缺失.</p>`;
      return;
    }
    els.diffFrame.innerHTML = `
      <div class="hg-diff-side">
        <h4>${left} · ${sL.step}</h4>
        <img src="./screenshots/${left}/${sL.file}" alt="">
        <div class="meta">${sL.url} · ${new Date(sL.at).toLocaleString()}</div>
      </div>
      <div class="hg-diff-side">
        <h4>${right} · ${sR.step}</h4>
        <img src="./screenshots/${right}/${sR.file}" alt="">
        <div class="meta">${sR.url} · ${new Date(sR.at).toLocaleString()}</div>
      </div>
    `;
  }).catch(e => {
    els.diffFrame.innerHTML = `<p class="hg-empty">diff 加载失败: ${e.message}</p>`;
  });
}

// ── 区块 4: 日志 ──
function renderLog(m) {
  const lines = [];
  lines.push(`<span class="log-time">${new Date(m.startedAt).toLocaleString()}</span><span class="log-step">RUN</span> ${m.runId} 浏览器 ${m.browser} base ${m.base}`);
  for (const s of m.shots) {
    lines.push(`<span class="log-time">${new Date(s.at).toLocaleTimeString()}</span><span class="log-step">${s.step}</span> → ${s.url}${s.status ? ` · HTTP ${s.status}` : ''}`);
    if (s.pageErrors && s.pageErrors.length) {
      for (const e of s.pageErrors) lines.push(`<span class="log-err">  ✗ ${e}</span>`);
    }
  }
  lines.push(`<span class="log-time">${new Date(m.finishedAt).toLocaleTimeString()}</span><span class="log-step">DONE</span> 6 步完成`);
  els.logFrame.innerHTML = lines.join('\n');
}

// ── lightbox ──
function setupLightbox() {
  els.lightbox.querySelector('.hg-lightbox-bg').addEventListener('click', closeLightbox);
  els.lightbox.querySelector('.hg-lightbox-close').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
}
function openLightbox(idx, m) {
  const s = m.shots[idx];
  if (!s) return;
  els.lightboxImg.src = `./screenshots/${m.runId}/${s.file}`;
  els.lightboxImg.alt = s.step;
  els.lightboxMeta.innerHTML = `
    <strong>${m.runId} · ${s.step}</strong> · ${s.url}
    <br>${s.width}×${s.height} · ${new Date(s.at).toLocaleString()}
    ${s.status ? ` · HTTP ${s.status}` : ''}
  `;
  els.lightbox.hidden = false;
}
function closeLightbox() {
  els.lightbox.hidden = true;
  els.lightboxImg.src = '';
}

init();