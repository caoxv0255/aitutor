const SUBJECT_MAP = {
  'chinese': '语文',
  'math': '数学',
  'english': '英语',
  'physics': '物理',
  'chemistry': '化学',
  'biology': '生物',
  'politics': '政治',
  'history': '历史',
  'geography': '地理',
  'science': '理综',
  'liberal_arts': '文综',
  'comprehensive': '综合'
};

class ProvincePage {
  constructor() {
    this.code = null;
    this.allPapers = [];
    this.filters = { yearRange: 'all', subject: '' };
    this.trendFilters = { subject: '', startYear: '', endYear: '' };
    this.typeView = { subject: '', year: '' };
    this.diffView = { subject: '', year: '' };
    this.trendData = null;
    this.init();
  }

  init() {
    try {
      if (!window.SecurityUtils) {
        this.showError('系统加载中，请稍候...');
        return;
      }
      this.code = window.SecurityUtils.getUrlParam('province') || window.SecurityUtils.getUrlParam('code');
      if (!this.code) {
        this.showError('请先选择省份');
        return;
      }
      this.renderSkeleton();
      this.loadProvinceData();
    } catch (e) {
      console.error('ProvincePage init error:', e);
      this.showError('页面初始化失败: ' + (e.message || ''));
    }
  }

  renderSkeleton() {
    window.skeleton.render('skeleton-container');
    document.getElementById('skeleton-container').style.display = 'block';
    document.getElementById('stats-container').style.display = 'none';
  }

  hideSkeleton() {
    window.skeleton.hide('skeleton-container');
    document.getElementById('skeleton-container').style.display = 'none';
    document.getElementById('loading').style.display = 'none';
  }

  async loadProvinceData() {
    try {
      const response = await fetch('/api/provinces/' + this.code);
      
      if (!response.ok) {
        throw new Error('省份不存在');
      }
      
      const result = await response.json();
      this.renderProvince(result.data);
      this.hideSkeleton();
      
      document.getElementById('stats-container').style.display = 'block';
      
      this.initTrendSelectors();
      this.loadTrends(this.code).catch(() => {});
      this.loadPapers(this.code).catch(() => {});
    } catch (error) {
      this.hideSkeleton();
      this.showError(error.message || '加载失败');
    }
  }

  renderProvince(province) {
    document.getElementById('province-header').style.display = 'block';
    document.getElementById('province-name').textContent = province.name;
    
    const examTypeIcon = province.exam_type === 'gaokao' ? '🎓' : '📚';
    document.getElementById('province-exam-type').innerHTML = 
      `${examTypeIcon} ${province.exam_type === 'gaokao' ? '高考' : '中考'}`;
    
    document.getElementById('province-paper-type').textContent = 
      this.getPaperTypeName(province.paper_type);
    
    document.getElementById('province-region').textContent = 
      this.getRegionName(province.region);
    
    document.title = `${province.name}高考详情 - AI Tutor`;
    
    const stats = province.stats || {};
    document.getElementById('stats-grid').innerHTML = this.renderStats(stats);
    
    document.getElementById('province-desc').innerHTML = 
      `<p>${window.SecurityUtils.escapeHTML(province.description || '暂无描述')}</p>`;
  }

  renderStats(stats) {
    const minYear = parseInt(stats.min_year) || 0;
    const maxYear = parseInt(stats.max_year) || 0;
    const yearRange = minYear && maxYear 
      ? `${minYear}~${maxYear}` 
      : '-';
    
    const statItems = [
      { value: stats.year_count || 0, label: '覆盖年份', isNumber: true },
      { value: stats.subject_count || 0, label: '覆盖学科', isNumber: true },
      { value: stats.paper_count || 0, label: '试卷数量', isNumber: true },
      { value: yearRange, label: '年份范围', isNumber: false }
    ];
    
    return statItems.map(item => `
      <div class="stat-box">
        <div class="num">${item.isNumber ? window.SecurityUtils.formatNumber(item.value) : window.SecurityUtils.escapeHTML(item.value)}</div>
        <div class="label">${window.SecurityUtils.escapeHTML(item.label)}</div>
      </div>
    `).join('');
  }

  initTrendSelectors() {
    const startSelect = document.getElementById('trend-year-start');
    const endSelect = document.getElementById('trend-year-end');
    const currentYear = new Date().getFullYear();
    
    for (let year = 2008; year <= currentYear; year++) {
      const opt1 = document.createElement('option');
      opt1.value = year;
      opt1.textContent = year;
      startSelect.appendChild(opt1);
      
      const opt2 = document.createElement('option');
      opt2.value = year;
      opt2.textContent = year;
      endSelect.appendChild(opt2);
    }
    
    startSelect.value = 2008;
    endSelect.value = currentYear;
    
    const subjectBtns = document.querySelectorAll('.trend-subject-btn');
    subjectBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        subjectBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.trendFilters.subject = btn.dataset.subject;
      });
    });
    
    startSelect.addEventListener('change', () => {
      this.trendFilters.startYear = startSelect.value;
    });
    
    endSelect.addEventListener('change', () => {
      this.trendFilters.endYear = endSelect.value;
    });
  }
  
  refreshTrends() {
    this.trendFilters.startYear = document.getElementById('trend-year-start').value;
    this.trendFilters.endYear = document.getElementById('trend-year-end').value;
    this.trendFilters.subject = document.querySelector('.trend-subject-btn.active')?.dataset.subject || '';
    this.loadTrends(this.code).catch(() => {});
  }

  initTypeSelectors(data) {
    const typeByYear = data.question_types_by_year || {};
    const years = Object.keys(typeByYear).sort((a, b) => b - a);
    
    const subjectSelect = document.getElementById('type-subject-select');
    const yearSelect = document.getElementById('type-year-select');
    
    if (!subjectSelect || !yearSelect) return;
    
    const allSubjects = new Set();
    for (const year of years) {
      for (const subject of Object.keys(typeByYear[year] || {})) {
        allSubjects.add(subject);
      }
    }
    
    subjectSelect.innerHTML = '<option value="">选择学科</option>';
    allSubjects.forEach(subject => {
      const opt = document.createElement('option');
      opt.value = subject;
      opt.textContent = SUBJECT_MAP[subject] || subject;
      subjectSelect.appendChild(opt);
    });
    
    yearSelect.innerHTML = '<option value="">选择年份</option>';
    years.forEach(year => {
      const opt = document.createElement('option');
      opt.value = year;
      opt.textContent = year;
      yearSelect.appendChild(opt);
    });
    
    if (allSubjects.size > 0 && years.length > 0) {
      const firstSubject = Array.from(allSubjects)[0];
      const firstYear = years[0];
      subjectSelect.value = firstSubject;
      yearSelect.value = firstYear;
      this.typeView = { subject: firstSubject, year: firstYear };
      this.renderSingleTypeView(firstSubject, firstYear, typeByYear);
    } else {
      document.getElementById('type-section').style.display = 'none';
    }
    
    subjectSelect.addEventListener('change', () => {
      this.typeView.subject = subjectSelect.value;
      this.typeView.year = yearSelect.value;
      if (this.typeView.subject && this.typeView.year) {
        this.renderSingleTypeView(this.typeView.subject, this.typeView.year, typeByYear);
      }
    });
    
    yearSelect.addEventListener('change', () => {
      this.typeView.subject = subjectSelect.value;
      this.typeView.year = yearSelect.value;
      if (this.typeView.subject && this.typeView.year) {
        this.renderSingleTypeView(this.typeView.subject, this.typeView.year, typeByYear);
      }
    });
  }

  renderSingleTypeView(subject, year, typeByYear) {
    const yearData = typeByYear[year];
    if (!yearData || !yearData[subject]) {
      document.getElementById('type-chart').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">暂无该年份该学科的数据</p>';
      document.getElementById('type-tbody').innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">暂无数据</td></tr>';
      return;
    }
    
    const types = yearData[subject];
    this.renderTypeChart(types);
    this.renderTypeTable(types);
  }

  initDiffSelectors(data) {
    const diffByYear = data.difficulty_distribution_by_year || {};
    const years = Object.keys(diffByYear).sort((a, b) => b - a);
    
    const subjectSelect = document.getElementById('diff-subject-select');
    const yearSelect = document.getElementById('diff-year-select');
    
    if (!subjectSelect || !yearSelect) return;
    
    const allSubjects = new Set();
    for (const year of years) {
      for (const subject of Object.keys(diffByYear[year] || {})) {
        allSubjects.add(subject);
      }
    }
    
    subjectSelect.innerHTML = '<option value="">选择学科</option>';
    allSubjects.forEach(subject => {
      const opt = document.createElement('option');
      opt.value = subject;
      opt.textContent = SUBJECT_MAP[subject] || subject;
      subjectSelect.appendChild(opt);
    });
    
    yearSelect.innerHTML = '<option value="">选择年份</option>';
    years.forEach(year => {
      const opt = document.createElement('option');
      opt.value = year;
      opt.textContent = year;
      yearSelect.appendChild(opt);
    });
    
    if (allSubjects.size > 0 && years.length > 0) {
      const firstSubject = Array.from(allSubjects)[0];
      const firstYear = years[0];
      subjectSelect.value = firstSubject;
      yearSelect.value = firstYear;
      this.diffView = { subject: firstSubject, year: firstYear };
      this.renderSingleDiffView(firstSubject, firstYear, diffByYear);
    } else {
      document.getElementById('difficulty-section').style.display = 'none';
    }
    
    subjectSelect.addEventListener('change', () => {
      this.diffView.subject = subjectSelect.value;
      this.diffView.year = yearSelect.value;
      if (this.diffView.subject && this.diffView.year) {
        this.renderSingleDiffView(this.diffView.subject, this.diffView.year, diffByYear);
      }
    });
    
    yearSelect.addEventListener('change', () => {
      this.diffView.subject = subjectSelect.value;
      this.diffView.year = yearSelect.value;
      if (this.diffView.subject && this.diffView.year) {
        this.renderSingleDiffView(this.diffView.subject, this.diffView.year, diffByYear);
      }
    });
  }

  renderSingleDiffView(subject, year, diffByYear) {
    const yearData = diffByYear[year];
    if (!yearData || !yearData[subject]) {
      document.getElementById('difficulty-chart').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">暂无该年份该学科的数据</p>';
      document.getElementById('difficulty-tbody').innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">暂无数据</td></tr>';
      return;
    }
    
    const diffs = yearData[subject];
    this.renderDifficultyChart(diffs);
    this.renderDifficultyTable(diffs);
  }

  async loadTrends(provinceCode) {
    try {
      let url = `/api/province-trends/${provinceCode}`;
      const params = [];
      if (this.trendFilters.subject) {
        params.push(`subject=${encodeURIComponent(this.trendFilters.subject)}`);
      }
      if (this.trendFilters.startYear) {
        params.push(`start_year=${this.trendFilters.startYear}`);
      }
      if (this.trendFilters.endYear) {
        params.push(`end_year=${this.trendFilters.endYear}`);
      }
      if (params.length > 0) {
        url += '?' + params.join('&');
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('趋势数据加载失败');
      }
      
      const result = await response.json();
      const data = result.data;
      this.trendData = data;
      
      if (!data) {
        this.hideTrendSections();
        return;
      }
      
      if (data.knowledge_points && Object.keys(data.knowledge_points).length > 0) {
        this.renderKnowledgeChart(data.knowledge_points);
        this.renderKnowledgeTable(data.knowledge_points);
      } else {
        document.getElementById('knowledge-section').style.display = 'none';
      }
      
      this.initTypeSelectors(data);
      this.initDiffSelectors(data);
      
      if (data.top_knowledge_points && data.top_knowledge_points.length > 0) {
        this.renderTopKnowledgeChart(data.top_knowledge_points);
        this.renderTopKnowledgeTable(data.top_knowledge_points);
      } else {
        document.getElementById('top-knowledge-section').style.display = 'none';
      }
      
      this.renderYearTrendTable(data);
      
      if (data.summary) {
        this.renderTrendSummary(data.summary);
      } else {
        document.getElementById('trend-summary').innerHTML = 
          '<p style="color:var(--text-muted)">暂无趋势分析数据</p>';
      }
    } catch {
      this.hideTrendSections();
      document.getElementById('trend-summary').innerHTML = 
        '<p style="color:var(--text-muted)">暂无趋势分析数据</p>';
      document.getElementById('year-trend-tbody').innerHTML = 
        '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">暂无趋势数据</td></tr>';
    }
  }

  async loadPapers(provinceCode) {
    try {
      const response = await fetch(`/api/exam-papers?province=${provinceCode}&limit=500`);
      
      if (!response.ok) {
        throw new Error('试卷数据加载失败');
      }
      
      const result = await response.json();
      this.allPapers = result.data || [];
      
      if (this.allPapers.length === 0) {
        document.getElementById('papers-section').style.display = 'none';
        return;
      }

      this.bindFilterEvents();
      this.applyFilters();
    } catch {
      document.getElementById('papers-section').style.display = 'none';
    }
  }

  bindFilterEvents() {
    const yearBtns = document.querySelectorAll('.filter-btn[data-year-range]');
    yearBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        yearBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filters.yearRange = btn.dataset.yearRange;
        this.applyFilters();
      });
    });

    const subjectSelect = document.getElementById('subject-filter');
    if (subjectSelect) {
      subjectSelect.addEventListener('change', () => {
        this.filters.subject = subjectSelect.value;
        this.applyFilters();
      });
    }
  }

  applyFilters() {
    let filtered = [...this.allPapers];

    // Year range filter
    if (this.filters.yearRange === 'recent3') {
      const currentYear = new Date().getFullYear();
      const recentYears = [currentYear, currentYear - 1, currentYear - 2];
      filtered = filtered.filter(p => recentYears.includes(p.year));
    }

    // Subject filter
    if (this.filters.subject) {
      filtered = filtered.filter(p => p.subject === this.filters.subject);
    }

    const countEl = document.getElementById('paper-filter-count');
    if (countEl) {
      countEl.textContent = `共 ${filtered.length} 份试卷`;
    }

    document.getElementById('papers-list').innerHTML = this.renderPapers(filtered);
  }

  renderPapers(papers) {
    const PAPER_TYPE_LABELS = {
      'independent': '自主命题',
      'new_gaokao_i': '新高考I卷',
      'new_gaokao_ii': '新高考II卷',
      'national_a': '全国甲卷',
      'national_b': '全国乙卷',
      'national_i': '全国I卷',
      'national_ii': '全国II卷',
      'national_iii': '全国III卷'
    };

    return papers.map(paper => {
      const subjectName = SUBJECT_MAP[paper.subject] || paper.subject || '';
      const mathType = paper.math_type === 'arts' ? '文科' : paper.math_type === 'science' ? '理科' : '';
      const paperTypeLabel = PAPER_TYPE_LABELS[paper.paper_type] || '';
      const title = paper.title || paper.name
        ? window.SecurityUtils.escapeHTML(paper.title || paper.name)
        : `${paper.year}年${subjectName}${mathType ? '(' + mathType + ')' : ''}试卷`;
      return `
      <div class="paper-card">
        <div class="year">${paper.year || '-'}</div>
        <div class="title">${title}</div>
        <div class="info">
          ${subjectName}${mathType ? ' · ' + mathType : ''} · ${paper.exam_level || ''}
          ${paperTypeLabel ? ' · <span class="paper-type-tag">' + window.SecurityUtils.escapeHTML(paperTypeLabel) + '</span>' : ''}
        </div>
        <div class="question-count">PDF版</div>
        <div class="btn-group">
          <button class="btn" onclick="viewPaper('${paper.id}')">查看详情</button>
        </div>
      </div>
    `;
    }).join('');
  }

  hideTrendSections() {
    ['knowledge-section', 'type-section', 'difficulty-section', 'top-knowledge-section'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  renderKnowledgeChart(data) {
    const container = document.getElementById('knowledge-chart');
    if (!container) return;
    
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const maxValue = Math.max(...entries.map(e => e[1]), 1);
    const barHeight = 28;
    const gap = 10;
    
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:${gap}px;width:100%;padding:8px 0">
        ${entries.slice(0, 10).map(([label, value]) => {
          const barWidth = Math.max(4, Math.round((value / maxValue) * 100));
          return `
            <div style="display:flex;align-items:center;gap:12px;width:100%">
              <div style="width:100px;font-size:12px;font-weight:500;color:var(--text);text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${window.SecurityUtils.escapeHTML(label)}">${window.SecurityUtils.escapeHTML(label)}</div>
              <div style="flex:1;height:${barHeight}px;background:var(--bg-secondary);border-radius:6px;overflow:hidden;position:relative">
                <div style="height:100%;width:${barWidth}%;background:#d71920;border-radius:6px;transition:width 0.3s ease"></div>
                <div style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:var(--text)">${value}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderKnowledgeTable(data) {
    const tbody = document.getElementById('knowledge-tbody');
    if (!tbody) return;
    
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
    
    tbody.innerHTML = sorted.map(([name, count]) => `
      <tr>
        <td>${window.SecurityUtils.escapeHTML(name)}</td>
        <td class="freq">${count}</td>
        <td class="diff"><span class="diff-dot diff-3"></span> 中等</td>
        <td>${count * 5}</td>
      </tr>
    `).join('');
  }

  renderTypeChart(data) {
    const container = document.getElementById('type-chart');
    if (!container) return;
    
    const TYPE_LABELS = { choice: '选择题', multi_choice: '多选题', fill: '填空题', solve: '解答题' };
    const TYPE_COLORS = { choice: '#3b82f6', multi_choice: '#8b5cf6', fill: '#f59e0b', solve: '#10b981' };
    
    const maxValue = Math.max(...data.map(d => parseInt(d.count) || 0), 1);
    const barHeight = 36;
    const gap = 16;
    
    const sortedData = [...data].sort((a, b) => (parseInt(b.count) || 0) - (parseInt(a.count) || 0));
    
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:${gap}px;width:100%;padding:8px 0">
        ${sortedData.map(item => {
          const count = parseInt(item.count) || 0;
          const barWidth = Math.max(4, Math.round((count / maxValue) * 100));
          const label = TYPE_LABELS[item.question_type] || item.question_type || '';
          const color = TYPE_COLORS[item.question_type] || '#7c3aed';
          return `
            <div style="display:flex;align-items:center;gap:16px;width:100%">
              <div style="width:80px;font-size:13px;font-weight:600;color:var(--text);text-align:right;flex-shrink:0">${window.SecurityUtils.escapeHTML(label)}</div>
              <div style="flex:1;height:${barHeight}px;background:var(--bg-secondary);border-radius:8px;overflow:hidden;position:relative">
                <div style="height:100%;width:${barWidth}%;background:${color};border-radius:8px;box-shadow:0 2px 8px ${color}40;transition:width 0.3s ease"></div>
                <div style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:13px;font-weight:700;color:var(--text)">${count}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderTypeByYearChart(data) {
    const container = document.getElementById('type-chart');
    if (!container) return;
    
    const TYPE_LABELS = { choice: '选择题', multi_choice: '多选题', fill: '填空题', solve: '解答题' };
    const SUBJECT_COLORS = {
      math: '#3b82f6', chinese: '#ef4444', english: '#10b981',
      physics: '#8b5cf6', chemistry: '#f59e0b', biology: '#ec4899',
      history: '#84cc16', geography: '#06b6d4', politics: '#6366f1'
    };
    const SUBJECT_LABELS = {
      math: '数学', chinese: '语文', english: '英语',
      physics: '物理', chemistry: '化学', biology: '生物',
      history: '历史', geography: '地理', politics: '政治'
    };
    
    const allSubjects = new Set();
    for (const year of Object.keys(data)) {
      for (const subject of Object.keys(data[year])) {
        allSubjects.add(subject);
      }
    }
    const subjectList = Array.from(allSubjects);
    
    let legendHtml = `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">`;
    subjectList.forEach(subject => {
      const color = SUBJECT_COLORS[subject] || '#666';
      const label = SUBJECT_LABELS[subject] || subject;
      legendHtml += `
        <button class="subject-filter-btn" data-subject="${subject}" style="display:flex;align-items:center;gap:6px;padding:6px 12px;border:none;border-radius:20px;background:#f5f5f5;color:#666;font-size:12px;cursor:pointer;transition:all 0.2s" onclick="window.ProvincePage.toggleSubjectFilter('${subject}', this)">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color}"></span>
          ${label}
        </button>
      `;
    });
    legendHtml += `</div>`;
    
    const years = Object.keys(data).sort((a, b) => b - a);
    let allItems = [];
    for (const year of years) {
      for (const subject of Object.keys(data[year])) {
        data[year][subject].forEach(item => {
          allItems.push({ ...item, year, subject });
        });
      }
    }
    
    const maxValue = Math.max(...allItems.map(d => parseInt(d.count) || 0), 1);
    const chartHeight = 180;
    
    let yearHtml = `<div style="display:flex;flex-wrap:wrap;gap:20px;">`;
    for (const year of years) {
      const subjects = Object.keys(data[year]);
      yearHtml += `<div class="year-card" style="flex:1;min-width:280px;max-width:360px;background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.04)">`;
      yearHtml += `<h4 style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f0f0f0">${year}年</h4>`;
      
      for (const subject of subjects) {
        const subjectData = data[year][subject];
        const subjectColor = SUBJECT_COLORS[subject] || '#666';
        const subjectLabel = SUBJECT_LABELS[subject] || subject;
        
        yearHtml += `<div class="subject-row" data-subject="${subject}" style="margin-bottom:12px">`;
        yearHtml += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">`;
        yearHtml += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${subjectColor}"></span>`;
        yearHtml += `<span style="font-size:12px;font-weight:600;color:#333">${subjectLabel}</span>`;
        yearHtml += `</div>`;
        
        yearHtml += `<div style="display:flex;justify-content:flex-start;gap:8px;padding-left:14px">`;
        subjectData.forEach(item => {
          const count = parseInt(item.count) || 0;
          const barHeight = Math.max(4, Math.round((count / maxValue) * chartHeight));
          const label = TYPE_LABELS[item.question_type] || item.question_type || '';
          
          yearHtml += `
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:50px">
              <div style="font-size:11px;font-weight:700;color:${subjectColor}">${count}</div>
              <div style="height:${barHeight}px;width:35px;background:${subjectColor};border-radius:4px 4px 0 0;"></div>
              <span style="font-size:10px;color:#999;text-align:center">${window.SecurityUtils.escapeHTML(label)}</span>
            </div>
          `;
        });
        yearHtml += `</div></div>`;
      }
      yearHtml += `</div>`;
    }
    yearHtml += `</div>`;
    
    container.innerHTML = legendHtml + (yearHtml || '<p style="color:#999;text-align:center;padding:20px">暂无数据</p>');
  }

  toggleSubjectFilter(subject, btn) {
    btn.classList.toggle('active');
    if (btn.classList.contains('active')) {
      btn.style.background = '#e8f0fe';
      btn.style.color = '#1a73e8';
    } else {
      btn.style.background = '#f5f5f5';
      btn.style.color = '#666';
    }
    
    const activeSubjects = Array.from(document.querySelectorAll('.subject-filter-btn.active')).map(b => b.dataset.subject);
    
    document.querySelectorAll('.subject-row').forEach(row => {
      if (activeSubjects.length === 0 || activeSubjects.includes(row.dataset.subject)) {
        row.style.display = 'block';
      } else {
        row.style.display = 'none';
      }
    });
  }

  renderTypeTable(data) {
    const tbody = document.getElementById('type-tbody');
    if (!tbody) return;
    
    const TYPE_LABELS = { choice: '选择题', multi_choice: '多选题', fill: '填空题', solve: '解答题' };
    
    tbody.innerHTML = data.map(item => {
      const label = TYPE_LABELS[item.question_type] || item.question_type || '';
      const avgDiff = parseFloat(item.avg_difficulty) || 0;
      const diffLevel = avgDiff < 2 ? '简单' : avgDiff < 3.5 ? '中等' : '较难';
      const diffClass = avgDiff < 2 ? 'diff-1' : avgDiff < 3.5 ? 'diff-3' : 'diff-4';
      return `
      <tr>
        <td>${window.SecurityUtils.escapeHTML(label)}</td>
        <td>${item.count || 0}</td>
        <td class="diff"><span class="diff-dot ${diffClass}"></span> ${diffLevel}</td>
        <td>${item.avg_score ? parseFloat(item.avg_score).toFixed(1) : '-'}</td>
      </tr>
    `;
    }).join('');
  }

  renderDifficultyChart(data) {
    const container = document.getElementById('difficulty-chart');
    if (!container) return;
    
    const DIFF_LABELS = { 1: '简单', 2: '较易', 3: '中等', 4: '较难', 5: '困难' };
    const DIFF_COLORS = { 1: '#10b981', 2: '#34d399', 3: '#f59e0b', 4: '#f97316', 5: '#ef4444' };
    const maxValue = Math.max(...data.map(d => parseInt(d.count) || 0), 1);
    const barHeight = 36;
    const gap = 16;
    
    const sortedData = [...data].sort((a, b) => (parseInt(a.difficulty) || 0) - (parseInt(b.difficulty) || 0));
    
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:${gap}px;width:100%;padding:8px 0">
        ${sortedData.map(item => {
          const count = parseInt(item.count) || 0;
          const level = parseInt(item.difficulty) || 3;
          const barWidth = Math.max(4, Math.round((count / maxValue) * 100));
          const color = DIFF_COLORS[level] || DIFF_COLORS[3];
          const label = DIFF_LABELS[level] || `难度${level}`;
          
          return `
            <div style="display:flex;align-items:center;gap:16px;width:100%">
              <div style="width:80px;font-size:13px;font-weight:600;color:var(--text);text-align:right;flex-shrink:0">${label}</div>
              <div style="flex:1;height:${barHeight}px;background:var(--bg-secondary);border-radius:8px;overflow:hidden;position:relative">
                <div style="height:100%;width:${barWidth}%;background:${color};border-radius:8px;box-shadow:0 2px 8px ${color}40;transition:width 0.3s ease"></div>
                <div style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:13px;font-weight:700;color:var(--text)">${count}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderDifficultyByYearChart(data) {
    const container = document.getElementById('difficulty-chart');
    if (!container) return;
    
    const DIFF_LABELS = { 1: '简单', 2: '较易', 3: '中等', 4: '较难', 5: '困难' };
    const DIFF_COLORS = { 1: '#10b981', 2: '#34d399', 3: '#f59e0b', 4: '#f97316', 5: '#ef4444' };
    const SUBJECT_LABELS = {
      math: '数学', chinese: '语文', english: '英语',
      physics: '物理', chemistry: '化学', biology: '生物',
      history: '历史', geography: '地理', politics: '政治'
    };
    
    const years = Object.keys(data).sort((a, b) => b - a);
    let allItems = [];
    for (const year of years) {
      for (const subject of Object.keys(data[year])) {
        data[year][subject].forEach(item => {
          allItems.push({ ...item, year, subject });
        });
      }
    }
    
    const maxValue = Math.max(...allItems.map(d => parseInt(d.count) || 0), 1);
    const chartHeight = 200;
    
    let html = '';
    for (const year of years) {
      const subjects = Object.keys(data[year]);
      let yearHtml = `<div style="margin-bottom:24px">`;
      yearHtml += `<h4 style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #f0f0f0">${year}年</h4>`;
      
      for (const subject of subjects) {
        const subjectData = data[year][subject];
        const subjectLabel = SUBJECT_LABELS[subject] || subject;
        
        yearHtml += `<div style="margin-bottom:16px">`;
        yearHtml += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">`;
        yearHtml += `<span style="font-size:13px;font-weight:600;color:#333">${subjectLabel}</span>`;
        yearHtml += `</div>`;
        
        yearHtml += `<div style="display:flex;justify-content:flex-start;gap:12px;padding-left:20px">`;
        for (let i = 1; i <= 5; i++) {
          const item = subjectData.find(d => parseInt(d.difficulty) === i);
          const count = item ? parseInt(item.count) : 0;
          const barHeight = Math.max(4, Math.round((count / maxValue) * chartHeight));
          const color = DIFF_COLORS[i] || DIFF_COLORS[3];
          const label = DIFF_LABELS[i] || `难度${i}`;
          
          yearHtml += `
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px;min-width:55px">
              <div style="font-size:12px;font-weight:700;color:${color}">${count}</div>
              <div style="height:${barHeight}px;width:45px;background:${color};border-radius:4px 4px 0 0;box-shadow:0 2px 6px rgba(0,0,0,0.1)"></div>
              <span style="font-size:11px;color:#666;text-align:center">${label}</span>
            </div>
          `;
        }
        yearHtml += `</div></div>`;
      }
      yearHtml += `</div>`;
      html += yearHtml;
    }
    
    container.innerHTML = html || '<p style="color:#999;text-align:center;padding:20px">暂无数据</p>';
  }

  renderDifficultyTable(data) {
    const tbody = document.getElementById('difficulty-tbody');
    if (!tbody) return;
    
    const levelNames = ['', '简单', '较易', '中等', '较难', '困难'];
    
    tbody.innerHTML = data.map(item => `
      <tr>
        <td>${levelNames[item.level] || '未知'}</td>
        <td>${item.count || 0}</td>
        <td>${((item.count || 0) / (data.reduce((sum, d) => sum + (d.count || 0), 0) || 1) * 100).toFixed(1)}%</td>
        <td>${item.avg_score || '-'}</td>
      </tr>
    `).join('');
  }

  renderTopKnowledgeChart(data) {
    const container = document.getElementById('top-knowledge-chart');
    if (!container) return;
    
    const sortedData = [...data].sort((a, b) => (b.frequency || 0) - (a.frequency || 0));
    const maxValue = Math.max(...sortedData.map(d => d.frequency || 0), 1);
    const barHeight = 28;
    const gap = 10;
    
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:${gap}px;width:100%;padding:8px 0">
        ${sortedData.slice(0, 10).map(item => {
          const freq = item.frequency || 0;
          const barWidth = Math.max(4, Math.round((freq / maxValue) * 100));
          const name = item.name || '';
          return `
            <div style="display:flex;align-items:center;gap:12px;width:100%">
              <div style="width:120px;font-size:12px;font-weight:500;color:var(--text);text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${window.SecurityUtils.escapeHTML(name)}">${window.SecurityUtils.escapeHTML(name)}</div>
              <div style="flex:1;height:${barHeight}px;background:var(--bg-secondary);border-radius:6px;overflow:hidden;position:relative">
                <div style="height:100%;width:${barWidth}%;background:#ffc107;border-radius:6px;transition:width 0.3s ease"></div>
                <div style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:var(--text)">${freq}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderTopKnowledgeTable(data) {
    const tbody = document.getElementById('top-knowledge-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = data.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${window.SecurityUtils.escapeHTML(item.name || '')}</td>
        <td class="freq">${item.frequency || 0}</td>
        <td class="diff"><span class="diff-dot diff-${item.difficulty || 3}"></span> ${this.getDifficultyName(item.difficulty)}</td>
      </tr>
    `).join('');
  }

  renderTrendSummary(summary) {
    const container = document.getElementById('trend-summary');
    if (!container) return;
    
    if (typeof summary === 'object') {
      let html = '';
      if (summary.title) {
        html += `<h4 style="margin-bottom:12px;color:var(--accent);font-size:1rem">${window.SecurityUtils.escapeHTML(summary.title)}</h4>`;
      }
      if (summary.highlights && summary.highlights.length > 0) {
        html += `<div style="margin-bottom:12px">
          <h5 style="font-size:.85rem;color:var(--text-muted);margin-bottom:8px">✨ 重点趋势</h5>
          <ul style="padding-left:20px;margin:0">${summary.highlights.map(h => `<li style="font-size:.88rem;margin-bottom:4px">${window.SecurityUtils.escapeHTML(h)}</li>`).join('')}</ul>
        </div>`;
      }
      if (summary.recommendations && summary.recommendations.length > 0) {
        html += `<div>
          <h5 style="font-size:.85rem;color:var(--text-muted);margin-bottom:8px">💡 备考建议</h5>
          <ul style="padding-left:20px;margin:0">${summary.recommendations.map(r => `<li style="font-size:.88rem;margin-bottom:4px">${window.SecurityUtils.escapeHTML(r)}</li>`).join('')}</ul>
        </div>`;
      }
      if (!summary.title && (!summary.highlights || summary.highlights.length === 0) && (!summary.recommendations || summary.recommendations.length === 0)) {
        html = '<p style="color:var(--text-muted)">暂无趋势分析数据</p>';
      }
      container.innerHTML = html;
    } else {
      container.innerHTML = `<p>${window.SecurityUtils.escapeHTML(summary)}</p>`;
    }
  }

  getPaperTypeName(type) {
    const map = {
      'independent': '自主命题',
      'new_gaokao_i': '新高考I卷',
      'new_gaokao_ii': '新高考II卷',
      'national_a': '全国甲卷',
      'national_b': '全国乙卷',
      'national-i': '全国一卷',
      'national-ii': '全国二卷',
      'national-iii': '全国三卷',
      'autonomous': '自主命题',
      'new-curriculum': '新高考'
    };
    return map[type] || type || '未知';
  }

  getRegionName(region) {
    const map = {
      'north': '华北地区',
      'south': '华南地区',
      'east': '华东地区',
      'west': '西部地区',
      'central': '华中地区',
      'northeast': '东北地区'
    };
    return map[region] || region || '未知地区';
  }

  getDifficultyName(level) {
    const map = { 1: '简单', 2: '较易', 3: '中等', 4: '较难', 5: '困难' };
    return map[level] || '未知';
  }

  renderYearTrendTable(data) {
    const tbody = document.getElementById('year-trend-tbody');
    if (!tbody) return;

    const TYPE_LABELS = { choice: '选择题', multi_choice: '多选题', fill: '填空题', solve: '解答题' };
    const TYPE_CLASSES = { choice: 'type-choice', multi_choice: 'type-multi', fill: 'type-fill', solve: 'type-solve' };

    const papers = data.papers || [];
    const typeByYear = data.question_types_by_year || {};
    const diffByYear = data.difficulty_distribution_by_year || {};

    const yearData = {};
    papers.forEach(p => {
      const year = p.year;
      if (!yearData[year]) {
        yearData[year] = {};
      }
      yearData[year][p.subject] = {
        questionCount: p.question_count || 0,
        totalScore: p.total_score || 0,
        avgDifficulty: p.difficulty_avg || 0,
        paperCount: p.paper_count || 0
      };
    });

    for (const year of Object.keys(typeByYear)) {
      if (!yearData[year]) yearData[year] = {};
      for (const subject of Object.keys(typeByYear[year])) {
        if (!yearData[year][subject]) yearData[year][subject] = {};
        yearData[year][subject].types = typeByYear[year][subject];
      }
    }

    for (const year of Object.keys(diffByYear)) {
      if (!yearData[year]) yearData[year] = {};
      for (const subject of Object.keys(diffByYear[year])) {
        if (!yearData[year][subject]) yearData[year][subject] = {};
        yearData[year][subject].difficulties = diffByYear[year][subject];
      }
    }

    const years = Object.keys(yearData).sort((a, b) => b - a);
    
    if (years.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">暂无趋势数据</td></tr>';
      return;
    }

    let html = '';
    years.forEach(year => {
      const subjects = Object.keys(yearData[year]);
      subjects.forEach((subject, idx) => {
        const d = yearData[year][subject];
        const subjectName = SUBJECT_MAP[subject] || subject;

        let typesHtml = '';
        if (d.types && d.types.length > 0) {
          typesHtml = '<div class="type-cell">';
          d.types.forEach(t => {
            const label = TYPE_LABELS[t.question_type] || t.question_type;
            const cls = TYPE_CLASSES[t.question_type] || 'type-choice';
            typesHtml += `<span class="type-badge ${cls}">${label}(${t.count})</span>`;
          });
          typesHtml += '</div>';
        }

        let diffHtml = '-';
        if (d.avgDifficulty) {
          const avgDiff = parseFloat(d.avgDifficulty);
          const diffClass = avgDiff < 2.5 ? 'diff-easy' : avgDiff < 3.5 ? 'diff-medium' : 'diff-hard';
          const percentage = (avgDiff / 5) * 100;
          diffHtml = `<div class="diff-bar"><div class="diff-fill ${diffClass}" style="width:${percentage}%"></div></div><div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${avgDiff.toFixed(1)}/5</div>`;
        }

        html += `
          <tr>
            ${idx === 0 ? `<td class="year-cell" rowspan="${subjects.length}">${year}</td>` : ''}
            <td>${subjectName}</td>
            <td>${typesHtml || '-'}</td>
            <td>${diffHtml}</td>
            <td>${d.questionCount || '-'}</td>
            <td>${d.totalScore || '-'}</td>
          </tr>
        `;
      });
    });

    tbody.innerHTML = html;
  }

  showError(message) {
    const errorEl = document.getElementById('error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
    window.toast.error(message);
  }
}

function getProvinceFromUrl() {
  return window.SecurityUtils.getUrlParam('province') || window.SecurityUtils.getUrlParam('code') || '';
}

window.viewPaper = function(paperId) {
  window.open(`/api/exam-pdf/${paperId}`, '_blank');
};

let _provincePageInstance = null;

window.ProvincePage = {
  toggleSubjectFilter: function(subject, btn) {
    if (_provincePageInstance) {
      _provincePageInstance.toggleSubjectFilter(subject, btn);
    }
  },
  refreshTrends: function() {
    if (_provincePageInstance) {
      _provincePageInstance.refreshTrends();
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { _provincePageInstance = new ProvincePage(); });
} else {
  _provincePageInstance = new ProvincePage();
}
