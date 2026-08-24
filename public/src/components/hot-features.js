// PWA 顶部"热门功能"卡片, 由 app.js 启动时挂载
// Phase-G2-fix (2026-08-24)
export function mountHotFeatures() {
  const container = document.getElementById('hot-features');
  if (!container) return;
  container.innerHTML = `
    <div class="hot-features-banner">
      <h3>🔥 热门功能</h3>
      <div class="hot-features-grid">
        <a href="#" data-route="photoPicker">📷 拍照搜题<br><small>AI 自动识别错题</small></a>
        <a href="#" data-route="wrongbook">📚 整卷识别<br><small>一键导入考试卷</small></a>
        <a href="#" data-route="reports">🎯 智能复习<br><small>间隔重复算法</small></a>
      </div>
    </div>`;
  container.querySelectorAll('a[data-route]').forEach(a => {
    a.onclick = (e) => {
      e.preventDefault();
      // 触发 app.js 路由切换
      if (window.app && typeof window.app.navigateTo === 'function') {
        window.app.navigateTo(a.dataset.route);
      } else if (window.app && typeof window.app.goTo === 'function') {
        window.app.goTo(a.dataset.route);
      }
    };
  });
}