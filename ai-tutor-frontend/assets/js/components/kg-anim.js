// 简化版知识图谱动画（纯 SVG），用于"错题入库后"提示
export function mountKgAnim({ container, relatedKp = ['MATH-001'] }) {
  if (!container) return;
  const kpNodes = relatedKp.slice(0, 6).map((kp, i) => {
    const angle = (i / Math.max(relatedKp.length, 1)) * Math.PI * 2;
    const cx = 100 + Math.cos(angle) * 70;
    const cy = 80 + Math.sin(angle) * 50;
    return `<g class="kg-node" data-kp="${kp}">
      <circle cx="${cx}" cy="${cy}" r="18" fill="url(#node-grad)" stroke="#d71920" stroke-width="2">
        <animate attributeName="r" values="18;22;18" dur="2s" repeatCount="indefinite"/>
      </circle>
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="10" fill="white" font-weight="bold">${kp.slice(-3)}</text>
    </g>`;
  }).join('');

  // 中心节点
  const center = `<circle cx="100" cy="80" r="28" fill="#3b82f6" stroke="#1e40af" stroke-width="2"/>
    <text x="100" y="84" text-anchor="middle" font-size="11" fill="white" font-weight="bold">你</text>`;

  const lines = relatedKp.slice(0, 6).map((_, i) => {
    const angle = (i / Math.max(relatedKp.length, 1)) * Math.PI * 2;
    const x2 = 100 + Math.cos(angle) * 70;
    const y2 = 80 + Math.sin(angle) * 50;
    return `<line x1="100" y1="80" x2="${x2}" y2="${y2}" stroke="#3b82f6" stroke-width="1.5" opacity="0.4"/>`;
  }).join('');

  const svg = `
    <svg width="200" height="160" viewBox="0 0 200 160" class="kg-anim-svg">
      <defs>
        <radialGradient id="node-grad">
          <stop offset="0%" stop-color="#fca5a5"/>
          <stop offset="100%" stop-color="#dc2626"/>
        </radialGradient>
      </defs>
      ${lines}
      ${center}
      ${kpNodes}
    </svg>`;

  const wrapper = document.createElement('div');
  wrapper.className = 'kg-anim-wrapper flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg mt-3';
  wrapper.innerHTML = `
    ${svg}
    <div class="text-sm">
      <div class="font-semibold text-blue-900">📊 知识图谱已更新</div>
      <div class="text-xs text-blue-700 mt-1">${relatedKp.length} 个关联知识点影响分析</div>
    </div>`;
  container.appendChild(wrapper);

  // 3 秒后自动消失
  setTimeout(() => wrapper.remove(), 5000);
}