// Phase-H3-fix (2026-08-24): 游客数据 IndexedDB 持久化存储
const DB_NAME = 'aitutor_guest_v1';
const STORES = ['wrong_questions', 'practice_records', 'reports', 'user_prefs', 'meta'];

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB not available'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: name === 'meta' ? 'key' : 'id', autoIncrement: name !== 'meta' && name !== 'user_prefs' });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch(err => {
    _dbPromise = null;
    throw err;
  });
  return _dbPromise;
}

function tx(store, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then(r => { result = r; }).catch(reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const idbStorage = {
  async save(store, data) {
    try { return await tx(store, 'readwrite', s => new Promise((resolve, reject) => {
      const req = s.put(data);
      req.onsuccess = () => resolve(data.id || data.key);
      req.onerror = () => reject(req.error);
    })); } catch (e) { console.warn('[idb] save failed', e); return null; }
  },
  async getAll(store) {
    try { return await tx(store, 'readonly', s => new Promise((resolve, reject) => {
      const req = s.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    })); } catch (e) { return []; }
  },
  async count(store) {
    try { return await tx(store, 'readonly', s => new Promise((resolve, reject) => {
      const req = s.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    })); } catch (e) { return 0; }
  },
  async clear(store) {
    try { return await tx(store, 'readwrite', s => new Promise((resolve, reject) => {
      const req = s.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    })); } catch (e) { return false; }
  },
  // 合并到后端（注册成功后调用）
  async mergeToBackend(token) {
    const wrongs = await this.getAll('wrong_questions');
    let merged = 0;
    for (const w of wrongs) {
      try {
        const res = await fetch('/api/user/wrong-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(w.data || w)
        });
        if (res.ok) merged++;
      } catch (e) { console.warn('[idb] merge failed for', w.id); }
    }
    if (merged > 0) await this.clear('wrong_questions');
    return merged;
  },
};
