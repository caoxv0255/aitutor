export function formatDate(date, format = 'YYYY-MM-DD') {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes}分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}小时`;
  }
  return `${hours}小时${mins}分钟`;
}

export function formatScore(score) {
  if (score === null || score === undefined) {
    return '-';
  }
  return parseFloat(score).toFixed(2);
}

export function formatPercent(value) {
  if (value === null || value === undefined) {
    return '-';
  }
  return `${(value * 100).toFixed(1)}%`;
}

export function truncateText(text, maxLength = 100, suffix = '...') {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + suffix;
}

export function getSubjectName(code) {
  const names = {
    math: '数学',
    chinese: '语文',
    english: '英语',
    physics: '物理',
    chemistry: '化学',
    politics: '政治',
    biology: '生物',
    history: '历史',
    geography: '地理'
  };
  return names[code] || code;
}

export function getQuestionTypeName(type) {
  const names = {
    'single': '单选题',
    'multiple': '多选题',
    'fill': '填空题',
    'essay': '解答题',
    'judge': '判断题',
    'short': '简答题'
  };
  return names[type] || type;
}

export function getDifficultyLabel(difficulty) {
  if (difficulty >= 0.7) return { label: '困难', class: 'tag--danger' };
  if (difficulty >= 0.4) return { label: '中等', class: 'tag--warning' };
  return { label: '简单', class: 'tag--success' };
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}