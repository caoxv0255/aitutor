/**
 * mastery-graph.js — 知识图谱可视化引擎
 *
 * 前端"零计算"渲染器：仅消费后端 JSON 数据，将 mastery_score 映射为视觉颜色。
 * 不做任何图谱遍历、掌握度计算或 AI 推理。
 *
 * 依赖: Cytoscape.js (CDN), 全局 window.cytoscape
 */

// ─────────────────────────────────────────────────────────────────────────────
// 认证辅助
// ─────────────────────────────────────────────────────────────────────────────

function getAuthToken() {
  return localStorage.getItem('authToken');
}

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(url) {
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 401) {
    window.location.href = '/index.html';
    throw new Error('未登录');
  }
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'API 错误');
  return json.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// 视觉映射（纯编码，非业务逻辑）
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  green: '#34c759',
  orange: '#ff9500',
  red: '#ff3b30',
  gray: '#aeaeb2',
  blue: '#007aff',
  edgeDefault: 'rgba(120,120,128,0.25)',
  edgeHighlight: '#007aff',
};

/** 将 mastery_score 映射为节点颜色（纯视觉编码） */
function masteryToColor(score) {
  if (score === null || score === undefined) return COLORS.gray;
  if (score >= 0.7) return COLORS.green;
  if (score >= 0.4) return COLORS.orange;
  return COLORS.red;
}

/** 掌握度 → 状态文本 */
function masteryLabel(score) {
  if (score === null || score === undefined) return '未评估';
  if (score >= 0.7) return '已掌握';
  if (score >= 0.4) return '学习中';
  return '薄弱';
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM 引用
// ─────────────────────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const cyContainer = $('#cy');
const loadingOverlay = $('#loadingOverlay');
const detailPanel = $('#detailPanel');
const panelTitle = $('#panelTitle');
const panelBody = $('#panelBody');
const closePanelBtn = $('#closePanel');
const subjectFilter = $('#subjectFilter');

// ─────────────────────────────────────────────────────────────────────────────
// 统计卡片更新
// ─────────────────────────────────────────────────────────────────────────────

function updateStats(stats, nodes) {
  $('#statTotal').textContent = stats.total_nodes;
  $('#statMastered').textContent = stats.mastered;
  $('#statWeak').textContent = stats.weak;
  $('#statEdges').textContent = stats.total_edges;

  const learning = stats.total_nodes - stats.mastered - stats.weak;
  $('#statLearning').textContent = Math.max(0, learning);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cytoscape 初始化
// ─────────────────────────────────────────────────────────────────────────────

let cy = null;
let graphData = null;

function initCytoscape(nodes, edges) {
  cy = cytoscape({
    container: cyContainer,
    elements: [...nodes, ...edges],
    style: [
      {
        selector: 'node',
        style: {
          label: 'data(name)',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '10px',
          'font-family': '-apple-system, PingFang SC, sans-serif',
          color: '#fff',
          'text-outline-width': 0,
          'text-max-width': '60px',
          'text-wrap': 'ellipsis',
          width: 36,
          height: 36,
          'background-color': 'data(color)',
          'border-width': 2,
          'border-color': '#fff',
          'border-opacity': 0.3,
        },
      },
      {
        selector: 'node:selected',
        style: {
          width: 48,
          height: 48,
          'font-size': '12px',
          'border-width': 3,
          'border-color': COLORS.blue,
          'border-opacity': 1,
          'z-index': 999,
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1.5,
          'line-color': COLORS.edgeDefault,
          'target-arrow-color': COLORS.edgeDefault,
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'arrow-scale': 0.8,
          opacity: 0.5,
        },
      },
      {
        selector: 'edge.highlighted',
        style: {
          'line-color': COLORS.edgeHighlight,
          'target-arrow-color': COLORS.edgeHighlight,
          width: 2.5,
          opacity: 1,
        },
      },
      {
        selector: 'node.faded',
        style: { opacity: 0.15 },
      },
      {
        selector: 'edge.faded',
        style: { opacity: 0.05 },
      },
    ],
    layout: {
      name: 'cose',
      animate: true,
      animationDuration: 800,
      nodeRepulsion: () => 8000,
      idealEdgeLength: () => 80,
      edgeElasticity: () => 50,
      gravity: 0.3,
      numIter: 1000,
      padding: 40,
      nodeDimensionsIncludeLabels: true,
    },
    minZoom: 0.3,
    maxZoom: 3,
    wheelSensitivity: 0.3,
    touchTapThreshold: 10,
  });

  // 节点点击事件
  cy.on('tap', 'node', (evt) => {
    const node = evt.target;
    selectNode(node);
  });

  // 空白区域点击 → 取消选中
  cy.on('tap', (evt) => {
    if (evt.target === cy) {
      clearSelection();
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 节点选中 & 详情面板
// ─────────────────────────────────────────────────────────────────────────────

let selectedNodeId = null;

function selectNode(node) {
  const data = node.data();
  selectedNodeId = data.id;

  // 高亮相关边
  cy.elements().removeClass('highlighted faded');
  const neighborhood = node.neighborhood();
  cy.elements().addClass('faded');
  node.removeClass('faded');
  neighborhood.removeClass('faded');
  node.connectedEdges().addClass('highlighted').removeClass('faded');

  // 选中节点
  cy.nodes().unselect();
  node.select();

  // 平滑缩放到选中节点
  cy.animate(
    {
      center: { eles: node },
      zoom: Math.max(cy.zoom(), 1.2),
    },
    { duration: 300, easing: 'ease-in-out-cubic' }
  );

  // 渲染基础信息（立即可见）
  renderBasicInfo(data);

  // 打开面板
  detailPanel.classList.add('open');

  // 异步加载详细诊断
  loadNodeDetail(data.id);
}

function clearSelection() {
  selectedNodeId = null;
  cy.elements().removeClass('highlighted faded');
  cy.nodes().unselect();
  detailPanel.classList.remove('open');
}

/** 渲染节点基础信息（来自图谱拓扑，无需额外 API 调用） */
function renderBasicInfo(data) {
  panelTitle.textContent = data.name;
  const score = data.mastery;
  const color = masteryToColor(score);
  const pct = score !== null ? Math.round(score * 100) : 0;

  panelBody.innerHTML = `
    <div class="info-card">
      <div class="card-label">掌握度</div>
      <div style="display:flex;align-items:baseline;gap:8px">
        <span class="mastery-score" style="color:${color}">${score !== null ? score.toFixed(2) : '—'}</span>
        <span class="tag" style="background:${color}22;color:${color}">${masteryLabel(score)}</span>
      </div>
      <div class="mastery-bar">
        <div class="fill" style="width:${pct}%;background:${color}"></div>
      </div>
    </div>
    <div class="info-card">
      <div class="card-label">基本信息</div>
      <div style="font-size:0.85rem;line-height:2">
        <div><strong>学科:</strong> ${data.subject}</div>
        <div><strong>模块:</strong> ${data.module}</div>
        <div><strong>难度:</strong> ${'★'.repeat(data.difficulty)}${'☆'.repeat(5 - data.difficulty)}</div>
        <div><strong>ID:</strong> <code style="font-size:0.75rem;color:var(--text-tertiary)">${data.id}</code></div>
      </div>
    </div>
    <div class="info-card" id="diagnosisCard">
      <div class="card-label">AI 诊断</div>
      <div style="text-align:center;padding:20px;color:var(--text-tertiary)">
        <div class="spinner" style="margin:0 auto;width:24px;height:24px;border-width:2px"></div>
        <div style="margin-top:8px;font-size:0.8rem">加载诊断数据...</div>
      </div>
    </div>
  `;
}

/** 异步加载节点详细诊断（调用 /api/tutor/mastery/:kpId） */
async function loadNodeDetail(kpId) {
  try {
    const data = await apiFetch(`/api/tutor/mastery/${encodeURIComponent(kpId)}`);
    renderDiagnosis(data);
  } catch (err) {
    const card = document.getElementById('diagnosisCard');
    if (card) {
      card.innerHTML = `
        <div class="card-label">AI 诊断</div>
        <div style="font-size:0.85rem;color:var(--text-tertiary);padding:12px 0">
          暂无诊断数据。完成更多练习后，AI 将为您生成个性化诊断。
        </div>
      `;
    }
  }
}

/** 渲染 AI 诊断卡片 */
function renderDiagnosis(data) {
  const card = document.getElementById('diagnosisCard');
  if (!card) return;

  const score = parseFloat(data.mastery_score);
  const attempts = data.attempt_count || 0;
  const correct = data.correct_count || 0;
  const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
  const lastPractice = data.last_practice_at ? new Date(data.last_practice_at).toLocaleDateString('zh-CN') : '从未练习';

  card.innerHTML = `
    <div class="card-label">AI 诊断</div>
    <div style="font-size:0.85rem;line-height:1.8">
      <div style="display:flex;gap:16px;margin-bottom:12px">
        <div><strong>正确率:</strong> ${accuracy}%</div>
        <div><strong>练习次数:</strong> ${attempts}</div>
      </div>
      <div style="display:flex;gap:16px;margin-bottom:12px">
        <div><strong>答对:</strong> <span style="color:var(--system-green)">${correct}</span></div>
        <div><strong>答错:</strong> <span style="color:var(--system-red)">${attempts - correct}</span></div>
      </div>
      <div><strong>最近练习:</strong> ${lastPractice}</div>
    </div>
    <button class="ask-btn" onclick="window.open('/index.html', '_self')">
      🧠 向 AI 导师请教这个知识点
    </button>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// 学科过滤
// ─────────────────────────────────────────────────────────────────────────────

function applySubjectFilter(subject) {
  if (!cy) return;

  if (!subject) {
    // 显示全部
    cy.elements().removeClass('faded');
    return;
  }

  // 前端仅做可见性过滤（不涉及图谱计算）
  cy.elements().removeClass('faded');
  cy.nodes().forEach((node) => {
    if (node.data('subject') !== subject) {
      node.addClass('faded');
      node.connectedEdges().addClass('faded');
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 初始化
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  // 检查登录状态
  if (!getAuthToken()) {
    window.location.href = '/index.html';
    return;
  }

  try {
    // 获取图谱拓扑数据（首屏唯一 API 调用）
    graphData = await apiFetch('/api/loop/graph');

    // 为节点注入颜色属性（纯视觉编码）
    const cyNodes = graphData.nodes.map((n) => ({
      data: {
        ...n.data,
        color: masteryToColor(n.data.mastery),
      },
    }));

    // 更新统计卡片
    updateStats(graphData.stats, graphData.nodes);

    // 初始化 Cytoscape
    initCytoscape(cyNodes, graphData.edges);

    // 隐藏加载遮罩
    loadingOverlay.classList.add('hidden');
  } catch (err) {
    console.error('图谱加载失败:', err);
    loadingOverlay.innerHTML = `
      <div style="text-align:center;padding:40px">
        <div style="font-size:2rem;margin-bottom:12px">⚠️</div>
        <div style="font-size:0.9rem;color:var(--text-secondary)">图谱加载失败</div>
        <div style="font-size:0.8rem;color:var(--text-tertiary);margin-top:4px">${err.message}</div>
        <button class="ask-btn" style="max-width:200px;margin:16px auto 0" onclick="location.reload()">重试</button>
      </div>
    `;
  }
}

// ── 事件绑定 ──
closePanelBtn.addEventListener('click', () => {
  detailPanel.classList.remove('open');
  clearSelection();
});

subjectFilter.addEventListener('change', (e) => {
  applySubjectFilter(e.target.value);
});

// 键盘 ESC 关闭面板
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && detailPanel.classList.contains('open')) {
    clearSelection();
  }
});

// ── 启动 ──
init();
