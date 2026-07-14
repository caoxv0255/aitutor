(function(factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    factory();
  }
})(function() {

class Skeleton {
  constructor() {
    this.animationClass = 'skeleton-loading';
    this.initStyles();
  }

  initStyles() {
    if (document.getElementById('skeleton-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'skeleton-styles';
    style.textContent = `
      .skeleton {
        background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--border) 50%, var(--bg-secondary) 75%);
        background-size: 200% 100%;
        animation: ${this.animationClass} 1.5s infinite;
        border-radius: 8px;
      }
      
      @keyframes ${this.animationClass} {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      
      .skeleton-text {
        height: 16px;
        margin-bottom: 8px;
      }
      
      .skeleton-text.large {
        height: 24px;
        width: 70%;
      }
      
      .skeleton-text.medium {
        height: 18px;
        width: 50%;
      }
      
      .skeleton-text.small {
        height: 14px;
        width: 30%;
      }
      
      .skeleton-line {
        height: 4px;
        width: 100%;
        border-radius: 2px;
        margin-bottom: 6px;
      }
      
      .skeleton-box {
        border-radius: var(--radius);
      }
    `;
    document.head.appendChild(style);
  }

  render(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="skeleton-placeholder">
        <div class="skeleton skeleton-text large"></div>
        <div class="skeleton skeleton-text medium"></div>
        <div class="skeleton skeleton-text small"></div>
        <div style="margin-top: 20px;">
          <div class="skeleton skeleton-text large"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line" style="width: 60%;"></div>
        </div>
        <div style="margin-top: 20px;">
          <div class="skeleton skeleton-text large"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line"></div>
        </div>
      </div>
    `;
  }

  hide(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }
  }

  renderPaperCard() {
    return `
      <div class="paper-card skeleton-card">
        <div class="skeleton skeleton-text small"></div>
        <div class="skeleton skeleton-text large"></div>
        <div class="skeleton skeleton-text medium"></div>
        <div style="margin-top: 12px;">
          <div class="skeleton" style="height: 32px; width: 100px; border-radius: var(--radius);"></div>
        </div>
      </div>
    `;
  }

  renderStatBox() {
    return `
      <div class="stat-box">
        <div class="skeleton" style="height: 32px; width: 60px; margin: 0 auto;"></div>
        <div class="skeleton skeleton-text small" style="margin-top: 8px;"></div>
      </div>
    `;
  }
}

const skeleton = new Skeleton();

window.skeleton = skeleton;
return skeleton;

});
