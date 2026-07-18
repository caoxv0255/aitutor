export class Context {
  constructor() {
    this.store = {};
    this.listeners = new Map();
    this._loadFromStorage();
  }

  _loadFromStorage() {
    try {
      const saved = localStorage.getItem('aitutor_context');
      if (saved) {
        this.store = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load context from storage:', e);
    }
  }

  _saveToStorage() {
    try {
      localStorage.setItem('aitutor_context', JSON.stringify(this.store));
    } catch (e) {
      console.warn('Failed to save context to storage:', e);
    }
  }

  get(key, defaultValue = null) {
    return this.store[key] !== undefined ? this.store[key] : defaultValue;
  }

  set(key, value) {
    const oldValue = this.store[key];
    this.store[key] = value;
    this._saveToStorage();
    this._notify(key, value, oldValue);
  }

  delete(key) {
    const oldValue = this.store[key];
    delete this.store[key];
    this._saveToStorage();
    this._notify(key, undefined, oldValue);
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(callback);
    return () => {
      const callbacks = this.listeners.get(key);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  _notify(key, newValue, oldValue) {
    const callbacks = this.listeners.get(key) || [];
    callbacks.forEach(callback => {
      try {
        callback(newValue, oldValue);
      } catch (e) {
        console.error('Context callback error:', e);
      }
    });
  }

  clear() {
    const keys = Object.keys(this.store);
    this.store = {};
    this._saveToStorage();
    keys.forEach(key => this._notify(key, undefined, null));
  }
}

export const appContext = new Context();

export const authContext = {
  getUser() {
    try {
      const loginData = localStorage.getItem('aitutor_login');
      if (loginData) {
        const parsed = JSON.parse(loginData);
        if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  },

  setUser(user) {
    localStorage.setItem('aitutor_login', JSON.stringify({
      ...user,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    }));
    appContext.set('user', user);
  },

  logout() {
    localStorage.removeItem('aitutor_login');
    localStorage.removeItem('aitutor_remember');
    appContext.set('user', null);
  },

  isAuthenticated() {
    return !!this.getUser();
  },

  getRole() {
    const user = this.getUser();
    return user ? user.role : null;
  },

  isGuest() {
    const user = this.getUser();
    return user ? user.isGuest === true : false;
  }
};