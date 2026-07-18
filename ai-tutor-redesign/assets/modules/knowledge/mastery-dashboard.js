export class MasteryDashboard {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      masteryData: [],
      viewMode: 'radar',
      ...options
    };
    
    this.state = {
      activeTab: this.options.viewMode
    };
    
    this._init();
  }

  _init() {
    this._render();
    this._setupEvents();
  }

  _render() {
    const tabs = [
      { id: 'radar', label: '雷达图', icon: 'radar' },
      { id: 'heatmap', label: '热力图', icon: 'grid' },
      { id: 'graph', label: '知识图谱', icon: 'network' }
    ];

    this.container.innerHTML = `
      <div class="mastery-dashboard">
        <div class="mastery-dashboard__header">
          <h3 class="mastery-dashboard__title">掌握度仪表盘</h3>
          <div class="mastery-dashboard__tabs">
            ${tabs.map(tab => `
              <button 
                class="mastery-dashboard__tab ${this.state.activeTab === tab.id ? 'mastery-dashboard__tab--active' : ''}"
                data-tab="${tab.id}"
              >
                ${this._getTabIcon(tab.icon)}
                <span>${tab.label}</span>
              </button>
            `).join('')}
          </div>
        </div>
        
        <div class="mastery-dashboard__content">
          ${this._renderActiveView()}
        </div>
      </div>
    `;
  }

  _getTabIcon(icon) {
    const icons = {
      radar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polygon points="2 17 12 22 22 17"/><polygon points="2 12 12 17 22 12"/></svg>',
      grid: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
      network: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/></svg>'
    };
    return icons[icon] || icons.grid;
  }

  _renderActiveView() {
    switch (this.state.activeTab) {
      case 'radar':
        return this._renderRadar();
      case 'heatmap':
        return this._renderHeatmap();
      case 'graph':
        return this._renderGraph();
      default:
        return this._renderRadar();
    }
  }

  _renderRadar() {
    if (!this.options.masteryData || this.options.masteryData.length === 0) {
      return this._renderEmptyState('暂无掌握度数据');
    }

    const subjectColors = {
      math: '#2d6a4f',
      chinese: '#c44536',
      english: '#3d5a80',
      physics: '#e8b04b',
      chemistry: '#7c3aed',
      politics: '#0891b2'
    };

    const dataBySubject = {};
    this.options.masteryData.forEach(item => {
      if (!dataBySubject[item.subject]) {
        dataBySubject[item.subject] = [];
      }
      dataBySubject[item.subject].push(item);
    });

    const subjects = Object.keys(dataBySubject);
    const maxPoints = Math.max(...subjects.map(s => dataBySubject[s].length));
    
    let html = '<div class="mastery-radar">';
    
    subjects.forEach((subject, idx) => {
      const data = dataBySubject[subject];
      const avgMastery = data.reduce((sum, item) => sum + item.mastery, 0) / data.length;
      const color = subjectColors[subject] || '#2d6a4f';
      const size = 120 + idx * 60;
      
      html += `
        <div class="mastery-radar__item">
          <div class="mastery-radar__chart" style="width: ${size}px; height: ${size}px;">
            <svg viewBox="0 0 200 200" class="mastery-radar__svg">
              ${this._renderRadarGrid()}
              ${this._renderRadarData(data, color)}
            </svg>
          </div>
          <div class="mastery-radar__label">${this._getSubjectName(subject)}</div>
          <div class="mastery-radar__avg" style="color: ${color}">${(avgMastery * 100).toFixed(0)}%</div>
        </div>
      `;
    });
    
    html += '</div>';
    return html;
  }

  _renderRadarGrid() {
    const levels = 5;
    let html = '';
    for (let i = levels; i >= 1; i--) {
      const r = (i / levels) * 80;
      html += `<polygon class="mastery-radar__grid" points="${this._getPolygonPoints(r)}"/>`;
    }
    return html;
  }

  _getPolygonPoints(r) {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 - 90) * Math.PI / 180;
      const x = 100 + r * Math.cos(angle);
      const y = 100 + r * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  }

  _renderRadarData(data, color) {
    const points = [];
    const maxItems = 6;
    for (let i = 0; i < maxItems; i++) {
      const item = data[i];
      const mastery = item ? item.mastery : 0;
      const angle = (i * 60 - 90) * Math.PI / 180;
      const r = mastery * 80;
      const x = 100 + r * Math.cos(angle);
      const y = 100 + r * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return `
      <polygon class="mastery-radar__area" points="${points.join(' ')}" style="fill: ${color}20; stroke: ${color};"/>
      ${points.map((p, i) => {
        const [x, y] = p.split(',');
        return `<circle cx="${x}" cy="${y}" r="4" fill="${color}"/>`;
      }).join('')}
    `;
  }

  _renderHeatmap() {
    if (!this.options.masteryData || this.options.masteryData.length === 0) {
      return this._renderEmptyState('暂无掌握度数据');
    }

    const weeks = 8;
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const subjects = ['math', 'chinese', 'english', 'physics', 'chemistry', 'politics'];
    
    const heatmapData = {};
    this.options.masteryData.forEach(item => {
      const weekIdx = Math.floor(Math.random() * weeks);
      const dayIdx = Math.floor(Math.random() * 7);
      const key = `${weekIdx}-${dayIdx}-${item.subject}`;
      heatmapData[key] = item.mastery;
    });

    let html = `
      <div class="mastery-heatmap">
        <div class="mastery-heatmap__legend">
          <span class="mastery-heatmap__legend-label">低</span>
          <div class="mastery-heatmap__legend-colors">
            <span class="mastery-heatmap__legend-color" style="background: #fce4e4"></span>
            <span class="mastery-heatmap__legend-color" style="background: #fdf6f5"></span>
            <span class="mastery-heatmap__legend-color" style="background: #fff3e0"></span>
            <span class="mastery-heatmap__legend-color" style="background: #eef7f2"></span>
            <span class="mastery-heatmap__legend-color" style="background: #c7f5d8"></span>
          </div>
          <span class="mastery-heatmap__legend-label">高</span>
        </div>
        <div class="mastery-heatmap__container">
          <div class="mastery-heatmap__days">
            ${days.map(day => `<div class="mastery-heatmap__day">${day}</div>`).join('')}
          </div>
          <div class="mastery-heatmap__weeks">
    `;

    subjects.forEach(subject => {
      html += `
        <div class="mastery-heatmap__subject-row">
          <div class="mastery-heatmap__subject-label">${this._getSubjectName(subject)}</div>
          <div class="mastery-heatmap__cells">
            ${Array.from({ length: weeks * 7 }).map((_, idx) => {
              const weekIdx = Math.floor(idx / 7);
              const dayIdx = idx % 7;
              const key = `${weekIdx}-${dayIdx}-${subject}`;
              const mastery = heatmapData[key] || Math.random() * 0.3;
              const color = this._getHeatmapColor(mastery);
              return `<div class="mastery-heatmap__cell" style="background: ${color}" title="${(mastery * 100).toFixed(0)}%"></div>`;
            }).join('')}
          </div>
        </div>
      `;
    });

    html += `
          </div>
        </div>
      </div>
    `;
    return html;
  }

  _getHeatmapColor(mastery) {
    if (mastery >= 0.7) return '#c7f5d8';
    if (mastery >= 0.5) return '#eef7f2';
    if (mastery >= 0.3) return '#fff3e0';
    if (mastery >= 0.1) return '#fdf6f5';
    return '#fce4e4';
  }

  _renderGraph() {
    if (!this.options.masteryData || this.options.masteryData.length === 0) {
      return this._renderEmptyState('暂无掌握度数据');
    }

    const nodes = this.options.masteryData.map(item => ({
      id: item.id,
      name: item.name,
      mastery: item.mastery,
      subject: item.subject
    }));

    const edges = [];
    nodes.forEach((node, idx) => {
      if (idx < nodes.length - 1) {
        edges.push({
          source: node.id,
          target: nodes[idx + 1].id,
          type: 'default'
        });
      }
    });

    return `
      <div class="mastery-graph" id="mastery-graph-container">
        <div class="knowledge-graph">
          <div class="knowledge-graph__header">
            <h3 class="knowledge-graph__title">知识图谱</h3>
            <div class="knowledge-graph__legend">
              <span class="knowledge-graph__legend-item">
                <span class="knowledge-graph__legend-dot knowledge-graph__legend-dot--strong"></span>
                <span>掌握良好</span>
              </span>
              <span class="knowledge-graph__legend-item">
                <span class="knowledge-graph__legend-dot knowledge-graph__legend-dot--medium"></span>
                <span>一般</span>
              </span>
              <span class="knowledge-graph__legend-item">
                <span class="knowledge-graph__legend-dot knowledge-graph__legend-dot--weak"></span>
                <span>薄弱</span>
              </span>
            </div>
          </div>
          <div class="knowledge-graph__canvas" style="height: 400px;">
            ${this._renderGraphSVG(nodes, edges)}
          </div>
        </div>
      </div>
    `;
  }

  _renderGraphSVG(nodes, edges) {
    const width = 800;
    const height = 400;
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const padding = 60;
    const cellWidth = (width - padding * 2) / cols;
    const cellHeight = (height - padding * 2) / Math.ceil(nodes.length / cols);

    const positions = {};
    nodes.forEach((node, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      positions[node.id] = {
        x: padding + col * cellWidth + cellWidth / 2,
        y: padding + row * cellHeight + cellHeight / 2
      };
    });

    let html = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="knowledge-graph__svg">`;

    edges.forEach(edge => {
      const source = positions[edge.source];
      const target = positions[edge.target];
      if (source && target) {
        html += `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" class="knowledge-graph__edge"/>`;
      }
    });

    nodes.forEach(node => {
      const pos = positions[node.id];
      const masteryClass = node.mastery >= 0.7 ? 'knowledge-graph__node-circle--strong' :
                           node.mastery >= 0.4 ? 'knowledge-graph__node-circle--medium' :
                           'knowledge-graph__node-circle--weak';
      
      html += `
        <g class="knowledge-graph__node" data-node-id="${node.id}" style="cursor: pointer;">
          <circle cx="${pos.x}" cy="${pos.y}" r="24" class="knowledge-graph__node-circle ${masteryClass}"/>
          <text x="${pos.x}" y="${pos.y + 38}" text-anchor="middle" class="knowledge-graph__node-label">${node.name}</text>
        </g>
      `;
    });

    html += '</svg>';
    return html;
  }

  _renderEmptyState(msg) {
    return `
      <div class="mastery-dashboard__empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2a10 10 0 1 0 10 10 10 10 0 0 0-10-10zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
          <path d="M9.05 7.65l5.65 5.65a.5.5 0 0 1 0 .7l-1.4 1.4a.5.5 0 0 1-.7 0L8.35 8.35a.5.5 0 0 1 0-.7z"/>
        </svg>
        <p>${msg}</p>
      </div>
    `;
  }

  _getSubjectName(code) {
    const names = {
      math: '数学',
      chinese: '语文',
      english: '英语',
      physics: '物理',
      chemistry: '化学',
      politics: '政治'
    };
    return names[code] || code;
  }

  _setupEvents() {
    const tabs = this.container.querySelectorAll('.mastery-dashboard__tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.state.activeTab = tab.dataset.tab;
        this._render();
        this._setupEvents();
      });
    });
  }

  updateData(data) {
    this.options.masteryData = data;
    this._render();
    this._setupEvents();
  }

  setViewMode(mode) {
    this.state.activeTab = mode;
    this._render();
    this._setupEvents();
  }
}