// 防跳跃教学横幅：当检测到薄弱前置 KP 时显示
export function mountAntiSkipBanner({ container, weakKps = [], subject = '' }) {
  if (!container) return;
  if (!weakKps || weakKps.length === 0) return;
  if (localStorage.getItem('aitutor.no_anti_skip') === 'true') return;

  const wrapper = document.createElement('div');
  wrapper.className = 'anti-skip-banner mt-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-warning-500 p-4 rounded-lg';

  const kpList = weakKps.slice(0, 3).map(kp =>
    `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-warning-100 text-warning-700 rounded text-xs mr-1">
      ${kp.name || kp.kp_id} (${kp.mastery_score ?? '?'}%)
    </span>`
  ).join('');

  wrapper.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="text-2xl">⚠️</span>
      <div class="flex-1">
        <h4 class="font-semibold text-foreground mb-1">防跳跃机制触发</h4>
        <p class="text-sm text-foreground-secondary mb-2">
          检测到你在 ${subject ? `<b>${subject}</b> 的` : ''}以下知识点很弱：
        </p>
        <div class="mb-3">${kpList}</div>
        <p class="text-xs text-foreground-muted">💡 建议先花 2 分钟复习，再继续解难题</p>
      </div>
      <div class="flex flex-col gap-1 shrink-0">
        <a href="/f3/pages/mastery.html" class="px-3 py-1.5 bg-primary-500 text-white text-xs rounded-md text-center">📚 去复习</a>
        <button class="px-3 py-1 text-xs text-foreground-muted hover:text-foreground" data-action="dismiss">知道了</button>
        <button class="px-3 py-1 text-xs text-foreground-muted hover:text-foreground" data-action="never">不再提醒</button>
      </div>
    </div>`;

  container.appendChild(wrapper);

  wrapper.querySelector('[data-action="dismiss"]').onclick = () => wrapper.remove();
  wrapper.querySelector('[data-action="never"]').onclick = () => {
    try { localStorage.setItem('aitutor.no_anti_skip', 'true'); } catch {}
    wrapper.remove();
  };
}