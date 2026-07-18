import { logger } from '../api/core/logger.js';

class MemoryCache {
  constructor() {
    this.store = new Map();
    this.ttlStore = new Map();
  }

  async get(key) {
    const ttl = this.ttlStore.get(key);
    if (ttl && Date.now() > ttl) {
      this.store.delete(key);
      this.ttlStore.delete(key);
      return null;
    }
    return this.store.get(key) || null;
  }

  async set(key, value, ttlSeconds = 300) {
    this.store.set(key, value);
    if (ttlSeconds > 0) {
      this.ttlStore.set(key, Date.now() + ttlSeconds * 1000);
    }
    return true;
  }

  async delete(key) {
    this.store.delete(key);
    this.ttlStore.delete(key);
    return true;
  }

  async exists(key) {
    const ttl = this.ttlStore.get(key);
    if (ttl && Date.now() > ttl) {
      this.store.delete(key);
      this.ttlStore.delete(key);
      return false;
    }
    return this.store.has(key);
  }

  async keys(pattern) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.store.keys()).filter(k => regex.test(k));
  }

  async clear() {
    this.store.clear();
    this.ttlStore.clear();
    return true;
  }

  async getStats() {
    return {
      type: 'memory',
      keys: this.store.size,
    };
  }
}

class RedisCache {
  constructor(url) {
    this.url = url;
    this.client = null;
    this.connected = false;
  }

  async connect() {
    if (this.connected) return;
    
    try {
      const { createClient } = await import('redis');
      this.client = createClient({ url: this.url });
      
      this.client.on('error', (err) => {
        logger.error('Redis connection error', { error: err });
        this.connected = false;
      });
      
      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.connected = true;
      });
      
      await this.client.connect();
      this.connected = true;
    } catch (err) {
      logger.error('Failed to connect to Redis', { error: err });
      throw err;
    }
  }

  async get(key) {
    if (!this.connected) await this.connect().catch(() => {});
    if (!this.client) return null;
    
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch {
      return null;
    }
  }

  async set(key, value, ttlSeconds = 300) {
    if (!this.connected) await this.connect().catch(() => {});
    if (!this.client) return false;
    
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.client.setEx(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch {
      return false;
    }
  }

  async delete(key) {
    if (!this.connected) await this.connect().catch(() => {});
    if (!this.client) return false;
    
    try {
      await this.client.del(key);
      return true;
    } catch {
      return false;
    }
  }

  async exists(key) {
    if (!this.connected) await this.connect().catch(() => {});
    if (!this.client) return false;
    
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  async keys(pattern) {
    if (!this.connected) await this.connect().catch(() => {});
    if (!this.client) return [];
    
    try {
      return await this.client.keys(pattern);
    } catch {
      return [];
    }
  }

  async clear() {
    if (!this.connected) await this.connect().catch(() => {});
    if (!this.client) return false;
    
    try {
      await this.client.flushDb();
      return true;
    } catch {
      return false;
    }
  }

  async getStats() {
    if (!this.connected) await this.connect().catch(() => {});
    if (!this.client) {
      return { type: 'redis', status: 'disconnected' };
    }
    
    try {
      const info = await this.client.info('stats');
      const lines = info.split('\n').filter(l => l.includes('='));
      const stats = {};
      lines.forEach(line => {
        const [key, value] = line.split('=');
        stats[key] = value;
      });
      return { type: 'redis', status: 'connected', ...stats };
    } catch {
      return { type: 'redis', status: 'error' };
    }
  }
}

class CacheService {
  constructor() {
    this.adapter = null;
    this.init();
  }

  async init() {
    const redisUrl = process.env.REDIS_URL;
    
    if (redisUrl) {
      try {
        this.adapter = new RedisCache(redisUrl);
        await this.adapter.connect();
        logger.info('Cache initialized with Redis adapter');
      } catch (err) {
        logger.warn('Redis connection failed, falling back to memory cache', { error: err });
        this.adapter = new MemoryCache();
      }
    } else {
      this.adapter = new MemoryCache();
      logger.info('Cache initialized with Memory adapter (no REDIS_URL)');
    }
  }

  async get(key) {
    return this.adapter.get(key);
  }

  async set(key, value, ttlSeconds = 300) {
    return this.adapter.set(key, value, ttlSeconds);
  }

  async delete(key) {
    return this.adapter.delete(key);
  }

  async exists(key) {
    return this.adapter.exists(key);
  }

  async keys(pattern) {
    return this.adapter.keys(pattern);
  }

  async clear() {
    return this.adapter.clear();
  }

  async getStats() {
    return this.adapter.getStats();
  }

  async getWithFallback(key, fallbackFn, ttlSeconds = 300) {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }
    
    const result = await fallbackFn();
    if (result !== null && result !== undefined) {
      await this.set(key, result, ttlSeconds);
    }
    
    return result;
  }
}

export const cache = new CacheService();
