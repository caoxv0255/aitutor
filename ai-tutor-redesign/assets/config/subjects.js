export const SUBJECTS = [
  { code: 'math', name: '数学', icon: 'sigma', color: '#2d6a4f', order: 1 },
  { code: 'chinese', name: '语文', icon: 'book-open', color: '#c44536', order: 2 },
  { code: 'english', name: '英语', icon: 'globe', color: '#3d5a80', order: 3 },
  { code: 'physics', name: '物理', icon: 'atom', color: '#e8b04b', order: 4 },
  { code: 'chemistry', name: '化学', icon: 'flask-conical', color: '#7c3aed', order: 5 },
  { code: 'politics', name: '政治', icon: 'scale', color: '#0891b2', order: 6 }
];

export function getSubject(code) {
  return SUBJECTS.find(s => s.code === code);
}

export function getSubjectColor(code) {
  const subject = getSubject(code);
  return subject ? subject.color : '#2d6a4f';
}

export function getSubjectIcon(code) {
  const icons = {
    'sigma': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    'book-open': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    'globe': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    'atom': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.07" y2="7.07"/><line x1="16.93" y1="16.93" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="6.93" y1="17.07" x2="4.93" y2="19.07"/><line x1="19.07" y1="7.07" x2="16.93" y2="4.93"/></svg>',
    'flask-conical': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 21h7M10 21V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v16"/><path d="M8 21h.01M16 21h.01M10 7h4"/></svg>',
    'scale': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3H9a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/><path d="M9 12l3-3 3 3"/></svg>'
  };
  const subject = getSubject(code);
  return subject && icons[subject.icon] ? icons[subject.icon] : icons['book-open'];
}

export const QUESTION_TYPES = [
  { code: 'single', name: '单选题' },
  { code: 'multiple', name: '多选题' },
  { code: 'fill', name: '填空题' },
  { code: 'essay', name: '解答题' },
  { code: 'judge', name: '判断题' },
  { code: 'short', name: '简答题' }
];

export function getQuestionType(code) {
  return QUESTION_TYPES.find(t => t.code === code);
}