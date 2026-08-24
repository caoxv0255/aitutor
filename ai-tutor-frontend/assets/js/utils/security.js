(function(factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    window.SecurityUtils = factory();
  }
})(function() {

const SecurityUtils = {
  escapeHTML(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  sanitizeHTML(html) {
    if (!html) return '';
    
    const allowedTags = [
      'b', 'strong', 'i', 'em', 'u', 's', 'span', 'div', 'p',
      'br', 'hr', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img'
    ];
    
    const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
    
    return html.replace(tagPattern, (match, closing, tag, attrs) => {
      if (!allowedTags.includes(tag.toLowerCase())) {
        return '';
      }
      
      const sanitizedAttrs = attrs.replace(/([a-zA-Z]+)\s*=\s*['"]([^'"]+)['"]/g, (attrMatch, attrName, attrValue) => {
        const lowerAttr = attrName.toLowerCase();
        if (lowerAttr === 'href' || lowerAttr === 'src') {
          if (attrValue.startsWith('http://') || attrValue.startsWith('https://')) {
            return `${attrName}="${this.escapeHTML(attrValue)}"`;
          }
          return '';
        }
        if (lowerAttr === 'class' || lowerAttr === 'style') {
          return `${attrName}="${this.escapeHTML(attrValue)}"`;
        }
        return '';
      });
      
      return `<${closing}${tag}${sanitizedAttrs.trim() ? ' ' + sanitizedAttrs.trim() : ''}>`;
    });
  },

  getUrlParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  },

  setUrlParam(name, value) {
    const url = new URL(window.location.href);
    url.searchParams.set(name, value);
    window.history.pushState({}, '', url);
  },

  removeUrlParam(name) {
    const url = new URL(window.location.href);
    url.searchParams.delete(name);
    window.history.pushState({}, '', url);
  },

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString();
  },

  validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  },

  validatePhone(phone) {
    const regex = /^1[3-9]\d{9}$/;
    return regex.test(phone);
  },

  validatePassword(password) {
    return password.length >= 6;
  },

  encrypt(text) {
    if (!text) return '';
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) + 1);
    }
    return btoa(result);
  },

  decrypt(text) {
    if (!text) return '';
    try {
      const decoded = atob(text);
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) - 1);
      }
      return result;
    } catch {
      return text;
    }
  },

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  safeParseJSON(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  },

  safeStringifyJSON(obj) {
    try {
      return JSON.stringify(obj);
    } catch {
      return '{}';
    }
  }
};

  return SecurityUtils;

});
