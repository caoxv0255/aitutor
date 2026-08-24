/**
 * 省份选择公共组件
 * 用于各页面复用省份选择逻辑
 */

const ProvinceSelector = {
  /**
   * 初始化省份选择器
   * @param {string} containerId - 容器ID
   * @param {Object} options - 配置选项
   */
  init(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const {
      showExamLevel = true,
      showSubject = false,
      onSelect = null,
      defaultExamLevel = 'gaokao'
    } = options;

    container.innerHTML = `
      <div class="province-selector-container">
        ${showExamLevel ? `
        <div class="selector-row">
          <label>考试类型</label>
          <select id="ps-exam-level">
            <option value="gaokao">高考</option>
            <option value="zhongkao">中考</option>
          </select>
        </div>` : ''}
        <div class="selector-row">
          <label>考试地区</label>
          <select id="ps-province-code">
            <option value="">请选择省份</option>
          </select>
        </div>
        ${showSubject ? `
        <div class="selector-row">
          <label>主要学科</label>
          <select id="ps-subject">
            <option value="">选择学科（可选）</option>
            <option value="math">数学</option>
            <option value="chinese">语文</option>
            <option value="english">英语</option>
            <option value="physics">物理</option>
            <option value="chemistry">化学</option>
            <option value="biology">生物</option>
            <option value="politics">政治</option>
            <option value="history">历史</option>
            <option value="geography">地理</option>
          </select>
        </div>` : ''}
      </div>
      <style>
        .province-selector-container{max-width:400px}
        .province-selector-container .selector-row{margin-bottom:12px}
        .province-selector-container .selector-row label{display:block;font-size:.82rem;font-weight:600;color:var(--text-muted);margin-bottom:4px}
        .province-selector-container select{width:100%;padding:10px 12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-secondary);color:var(--text);font-size:.88rem;font-family:var(--font)}
        .province-selector-container select:focus{outline:none;border-color:var(--accent)}
      </style>
    `;

    this._loadProvinces(defaultExamLevel);

    if (showExamLevel) {
      document.getElementById('ps-exam-level').addEventListener('change', () => {
        this._loadProvinces(document.getElementById('ps-exam-level').value);
      });
    }

    if (onSelect) {
      document.getElementById('ps-province-code').addEventListener('change', (e) => {
        const selected = e.target.options[e.target.selectedIndex];
        onSelect({
          code: e.target.value,
          name: selected.textContent,
          examLevel: showExamLevel ? document.getElementById('ps-exam-level').value : defaultExamLevel
        });
      });
    }
  },

  /**
   * 加载省份列表
   */
  async _loadProvinces(examLevel) {
    try {
      const res = await fetch(`/api/provinces?exam_level=${examLevel}`);
      const { data } = await res.json();
      const select = document.getElementById('ps-province-code');
      select.innerHTML = '<option value="">请选择省份</option>';
      data.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.code;
        opt.textContent = p.name;
        select.appendChild(opt);
      });
    } catch (err) {
      console.error('加载省份失败:', err);
    }
  },

  /**
   * 获取当前选中的省份
   */
  getSelected() {
    const code = document.getElementById('ps-province-code')?.value;
    const examLevel = document.getElementById('ps-exam-level')?.value || 'gaokao';
    const subject = document.getElementById('ps-subject')?.value;
    if (!code) return null;
    return { code, examLevel, subject };
  },

  /**
   * 获取用户省份偏好
   */
  async getUserProvince() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const res = await fetch('/api/user-province', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const { data } = await res.json();
      return data && data.length > 0 ? data[0] : null;
    } catch (err) {
      console.error('获取省份偏好失败:', err);
      return null;
    }
  }
};

// 导出到全局
window.ProvinceSelector = ProvinceSelector;
