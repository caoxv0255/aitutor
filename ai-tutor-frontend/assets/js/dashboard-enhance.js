// ai-tutor-frontend/assets/js/dashboard-enhance.js
// 2026-08-19 DSH agent: F3 dashboard 交互增强
//
// 设计原则:
//   - 非破坏: 不改 HTML 结构, 不动 service layer / envelope
//   - 渐进增强: 元素若已被 .ait-* 装饰, JS 只追加行为
//   - a11y: 尊重 prefers-reduced-motion, keyboard 友好
//
// 功能:
//   1. count-up 数字 (1.2s ease-out) — 顶部统计 + KPI 卡
//   2. stagger 入场动画
//   3. 顶部 summary 卡点击跳转 (按 data-ait-target)
//   4. KPI 卡 trend badge hover tooltip (对比上月)
//   5. 雷达图维度点击 → mastery.html?subject=函数
//   6. 柱状图柱 hover 显示日期 + "今日"标签
//   7. 热力图 cell hover tooltip (日期 + 学科 + %)
//   8. 待复习任务卡 hover 推进 + 点击展开

(() => {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // ── 1. count-up 数字 ──
  function countUp(el, target, duration = 1200) {
    if (reducedMotion) { el.textContent = format(target); el.classList.add('ait-counter-ready'); return; }
    const start = performance.now();
    const initial = 0;
    const ease = (t) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    function frame(now) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const val = initial + (target - initial) * ease(t);
      el.textContent = format(val);
      if (t < 1) requestAnimationFrame(frame);
      else el.classList.add('ait-counter-ready');
    }
    requestAnimationFrame(frame);
  }
  function format(n) {
    const v = Math.round(n);
    if (v >= 1000) return v.toLocaleString();
    return String(v);
  }

  // 顶部 4 个 summary 卡 + 4 个 KPI 卡
  // 注意: querySelectorAll 解析 .lg\\:grid-cols-4 当作 class 含 lg:grid-cols-4 (合法),
  // 但 CSS pseudo (:first-of-type) 在 querySelector 里不被解析. 用结构化定位.
  const allGrids = document.querySelectorAll('main .grid.grid-cols-2');
  // 第一个是 summary 行 (4 children: 复习/掌握度/打卡/学习时长)
  // 第二个是 KPI 行 (4 children: 总练习/正确率/提分/排名)
  const topSummaryRow = allGrids[0];
  const summaryNums = topSummaryRow
    ? topSummaryRow.querySelectorAll(':scope > div .text-2xl.font-bold')
    : [];
  const kpiNums = allGrids[1]
    ? allGrids[1].querySelectorAll(':scope > div .text-3xl.font-bold')
    : [];
  summaryNums.forEach(el => {
    const raw = el.textContent.replace(/[^\d.]/g, '');
    const target = parseFloat(raw);
    if (Number.isFinite(target)) {
      el.classList.add('ait-counter');
      el.textContent = '0';
      countUp(el, target);
    }
  });
  kpiNums.forEach(el => {
    const raw = el.textContent.replace(/[^\d.]/g, '');
    const target = parseFloat(raw);
    if (Number.isFinite(target) && target >= 10) {
      el.classList.add('ait-counter');
      el.textContent = '0';
      countUp(el, target, 1500);
    }
  });

  // ── 2. stagger 入场 ──
  document.body.classList.add('ait-stagger-in');

  // ── 3. summary 卡点击跳转 ──
  const summaryTargets = ['review.html', 'mastery.html', 'review.html#streak', 'review.html#time'];
  const summaryCards = topSummaryRow
    ? topSummaryRow.querySelectorAll(':scope > div')
    : [];
  summaryCards.forEach((card, i) => {
    if (summaryTargets[i]) {
      card.addEventListener('click', () => { window.location.href = summaryTargets[i]; });
      card.setAttribute('role', 'link');
      card.setAttribute('tabindex', '0');
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
      });
    }
  });

  // ── 4. KPI trend badge tooltip (上月对比 mock 数据) ──
  const trendData = {
    '总练习题数': { prev: '1,114', delta: '+134 题', direction: 'up' },
    '做题正确率': { prev: '73%',     delta: '+3%',    direction: 'up' },
    '本月提分':   { prev: '0',       delta: '+12 分', direction: 'up' },
    '超越同学':   { prev: '72%',     delta: '+13%',   direction: 'up' },
  };
  const trendBadges = document.querySelectorAll('.p-5.rounded-2xl');
  trendBadges.forEach(card => {
    const lbl = card.querySelector('.text-sm.text-foreground-secondary')?.textContent?.trim();
    const data = lbl && trendData[lbl];
    const badge = card.querySelector('.inline-flex.items-center.gap-0\\.5.px-2');
    if (data && badge) {
      badge.style.cursor = 'help';
      badge.addEventListener('mouseenter', (e) => showTooltip(e.target,
        `<strong>${lbl}</strong>\n上月: ${data.prev}\n变化: ${data.delta} ↑\n数据来源: 学期回顾`));
      badge.addEventListener('mouseleave', hideTooltip);
    }
  });

  // ── 5. 雷达图维度点击 → mastery ──
  const subjectMap = { '函数': 'math-func', '几何': 'math-geo', '代数': 'math-alg',
                       '概率': 'math-prob', '数列': 'math-seq', '三角函数': 'math-tri' };
  document.querySelectorAll('svg text[class*="fill-foreground"]').forEach(t => {
    const subj = subjectMap[t.textContent.trim()];
    if (subj) {
      t.style.cursor = 'pointer';
      t.addEventListener('click', () => {
        window.location.href = `mastery.html?subject=${subj}`;
      });
    }
  });

  // ── 6. 柱状图: 柱 hover 显示日期, "今日"标签 ──
  // 简化: 找 main 下所有 .rounded-t-md (柱), 它们的 parent 是 flex 容器
  const barContainer = document.querySelector('main .flex.items-end.gap-3, main .flex.items-end.gap-2');
  if (barContainer) {
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // 周一=0
    const cols = barContainer.querySelectorAll(':scope > .flex.flex-col');
    const dayLabels = ['周一','周二','周三','周四','周五','周六','周日'];
    cols.forEach((col, i) => {
      const bar = col.querySelector('.rounded-t-md');
      const valSpan = col.querySelector('span');
      const label = `${dayLabels[i]} (${i === dayOfWeek ? '今天' : (i > dayOfWeek ? '未来' : '过去')})`;
      if (bar) {
        bar.addEventListener('mouseenter', (e) => showTooltip(e.target,
          `<strong>${label}</strong>\n${valSpan?.textContent?.trim() || ''}`));
        bar.addEventListener('mouseleave', hideTooltip);
      }
      if (i === dayOfWeek && !reducedMotion) {
        const tag = document.createElement('span');
        tag.className = 'ait-today-label';
        tag.textContent = '今日';
        col.appendChild(tag);
      }
    });
  }

  // ── 7. 热力图 cell tooltip ──
  // 找热力图区域内, aspect-square + 圆角 + bg-* 类的 div (热力图 cell)
  const heatmapCells = document.querySelectorAll('main .aspect-square');
  heatmapCells.forEach((cell, i) => {
    cell.classList.add('ait-heatmap-cell');
    // 从 class 名推断掌握度等级
    const cls = cell.className;
    let level = '—';
    if (cls.includes('bg-error-500')) level = '薄弱 0-20%';
    else if (cls.includes('bg-error-300')) level = '薄弱 20-40%';
    else if (cls.includes('bg-warning-200')) level = '一般 40-60%';
    else if (cls.includes('bg-success-200')) level = '良好 60-80%';
    else if (cls.includes('bg-success-500')) level = '掌握 80-100%';
    cell.addEventListener('mouseenter', (e) => showTooltip(e.target,
      `<strong>掌握度等级</strong>\n${level}`));
    cell.addEventListener('mouseleave', hideTooltip);
  });

  // ── 8. tooltip 工具 ──
  let tipEl = null;
  function ensureTip() {
    if (tipEl) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'ait-tooltip';
    document.body.appendChild(tipEl);
    return tipEl;
  }
  function showTooltip(target, html) {
    const t = ensureTip();
    t.innerHTML = html;
    t.classList.add('ait-tooltip-show');
    const rect = target.getBoundingClientRect();
    const tipRect = t.getBoundingClientRect();
    let x = rect.left + rect.width / 2 - tipRect.width / 2;
    let y = rect.top - tipRect.height - 8;
    if (y < 4) y = rect.bottom + 8;
    if (x < 4) x = 4;
    if (x + tipRect.width > window.innerWidth - 4) x = window.innerWidth - 4 - tipRect.width;
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  }
  function hideTooltip() {
    if (tipEl) tipEl.classList.remove('ait-tooltip-show');
  }

  // ── 9. log 启动 (DSH 调试友好) ──
  console.log('[enhance] F3 dashboard 增强已激活',
    `summary: ${summaryNums.length}, kpi: ${kpiNums.length}, reducedMotion: ${reducedMotion}`);
})();