export class KnowledgeGraph {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      nodes: [],
      edges: [],
      layout: 'cose',
      onNodeClick: null,
      ...options
    };
    
    this._init();
  }

  _init() {
    this._render();
    this._renderGraph();
  }

  _render() {
    this.container.innerHTML = `
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
        <div class="knowledge-graph__canvas" id="kg-canvas"></div>
      </div>
    `;
    
    this.canvas = this.container.querySelector('#kg-canvas');
  }

  _renderGraph() {
    const width = this.canvas.offsetWidth;
    const height = this.canvas.offsetHeight || 500;
    
    let html = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="knowledge-graph__svg">`;
    
    const positions = this._calculatePositions(width, height);
    
    this.options.edges.forEach(edge => {
      const source = positions[edge.source];
      const target = positions[edge.target];
      if (source && target) {
        html += `
          <line 
            x1="${source.x}" y1="${source.y}" 
            x2="${target.x}" y2="${target.y}" 
            class="knowledge-graph__edge knowledge-graph__edge--${edge.type || 'default'}"
          />
        `;
      }
    });
    
    this.options.nodes.forEach(node => {
      const pos = positions[node.id] || { x: width / 2, y: height / 2 };
      const mastery = node.mastery !== undefined ? node.mastery : 0.5;
      const colorClass = this._getMasteryClass(mastery);
      const size = this._getNodeSize(node);
      
      html += `
        <g class="knowledge-graph__node" data-node-id="${node.id}" style="cursor: pointer;">
          <circle 
            cx="${pos.x}" cy="${pos.y}" r="${size}" 
            class="knowledge-graph__node-circle ${colorClass}"
          />
          <text 
            x="${pos.x}" y="${pos.y + size + 14}" 
            text-anchor="middle" 
            class="knowledge-graph__node-label"
          >${node.name}</text>
          <title>${node.name} - 掌握度: ${(mastery * 100).toFixed(0)}%</title>
        </g>
      `;
    });
    
    html += '</svg>';
    this.canvas.innerHTML = html;
    
    this._setupNodeEvents();
  }

  _calculatePositions(width, height) {
    const positions = {};
    const nodes = this.options.nodes;
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);
    const padding = 60;
    const cellWidth = (width - padding * 2) / cols;
    const cellHeight = (height - padding * 2) / rows;
    
    nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      positions[node.id] = {
        x: padding + col * cellWidth + cellWidth / 2,
        y: padding + row * cellHeight + cellHeight / 2
      };
    });
    
    return positions;
  }

  _getMasteryClass(mastery) {
    if (mastery >= 0.7) return 'knowledge-graph__node-circle--strong';
    if (mastery >= 0.4) return 'knowledge-graph__node-circle--medium';
    return 'knowledge-graph__node-circle--weak';
  }

  _getNodeSize(node) {
    const baseSize = 20;
    const connections = this.options.edges.filter(
      e => e.source === node.id || e.target === node.id
    ).length;
    return baseSize + connections * 3;
  }

  _setupNodeEvents() {
    const nodes = this.canvas.querySelectorAll('.knowledge-graph__node');
    nodes.forEach(node => {
      node.addEventListener('click', () => {
        const nodeId = node.dataset.nodeId;
        const nodeData = this.options.nodes.find(n => n.id === nodeId);
        
        if (this.options.onNodeClick) {
          this.options.onNodeClick(nodeData);
        }
        
        this._highlightNode(nodeId);
      });
    });
  }

  _highlightNode(nodeId) {
    const nodes = this.canvas.querySelectorAll('.knowledge-graph__node');
    const edges = this.canvas.querySelectorAll('.knowledge-graph__edge');
    
    nodes.forEach(node => {
      const id = node.dataset.nodeId;
      const isTarget = id === nodeId;
      const isNeighbor = this.options.edges.some(
        e => e.source === id && e.target === nodeId ||
             e.target === id && e.source === nodeId
      );
      
      if (isTarget) {
        node.classList.add('knowledge-graph__node--highlight');
        node.classList.remove('knowledge-graph__node--dim');
      } else if (isNeighbor) {
        node.classList.add('knowledge-graph__node--highlight');
        node.classList.remove('knowledge-graph__node--dim');
      } else {
        node.classList.remove('knowledge-graph__node--highlight');
        node.classList.add('knowledge-graph__node--dim');
      }
    });
    
    edges.forEach(edge => {
      const path = edge.getAttribute('d') || '';
      const isConnected = this.options.edges.some(
        e => (e.source === nodeId || e.target === nodeId) &&
             path.includes(e.source) && path.includes(e.target)
      );
      
      if (isConnected) {
        edge.classList.add('knowledge-graph__edge--highlight');
        edge.classList.remove('knowledge-graph__edge--dim');
      } else {
        edge.classList.remove('knowledge-graph__edge--highlight');
        edge.classList.add('knowledge-graph__edge--dim');
      }
    });
  }

  updateData(nodes, edges) {
    this.options.nodes = nodes;
    this.options.edges = edges;
    this._renderGraph();
  }

  addNode(node) {
    this.options.nodes.push(node);
    this._renderGraph();
  }

  removeNode(nodeId) {
    this.options.nodes = this.options.nodes.filter(n => n.id !== nodeId);
    this.options.edges = this.options.edges.filter(
      e => e.source !== nodeId && e.target !== nodeId
    );
    this._renderGraph();
  }
}