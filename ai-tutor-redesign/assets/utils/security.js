export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function sanitizeHtml(html, options = {}) {
  const defaultOptions = {
    allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'h3', 'h4', 'span', 'sub', 'sup', 'table', 'tr', 'td', 'th'],
    allowedAttrs: ['class', 'style'],
    allowedDataAttr: false
  };
  
  const opts = { ...defaultOptions, ...options };
  
  let result = html;
  
  result = result.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  result = result.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
  result = result.replace(/on\w+="[^"]*"/gi, '');
  result = result.replace(/javascript:/gi, '');
  
  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/gi;
  result = result.replace(tagPattern, (match, closing, tagName, attrs) => {
    if (!opts.allowedTags.includes(tagName.toLowerCase())) {
      return '';
    }
    
    const attrPattern = /([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*["']([^"']*)["']/gi;
    let cleanAttrs = '';
    let attrMatch;
    
    while ((attrMatch = attrPattern.exec(attrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2];
      
      if (opts.allowedAttrs.includes(attrName)) {
        if (attrName === 'style') {
          const safeStyle = attrValue.replace(/javascript:/gi, '');
          cleanAttrs += ` ${attrName}="${safeStyle}"`;
        } else {
          cleanAttrs += ` ${attrName}="${attrValue}"`;
        }
      }
    }
    
    return `<${closing}${tagName}${cleanAttrs}>`;
  });
  
  return result;
}

export function encodeURIComponentSafe(str) {
  try {
    return encodeURIComponent(str);
  } catch (e) {
    return str;
  }
}

export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePhone(phone) {
  const re = /^1[3-9]\d{9}$/;
  return re.test(phone);
}

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}