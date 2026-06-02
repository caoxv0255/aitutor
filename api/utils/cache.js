let redisClient = null;
let isConnected = false;
const memoryCache = new Map();

const CACHE_CONFIG = {
  DEFAULT_TTL: 3600,
  SHORT_TTL: 300,
  LONG_TTL: 86400
};

export async function getCacheClient() {
  if (redisClient && isConnected) {
    return redisClient;
  }

  try {
    const { createClient } = await import('redis');
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = createClient({ url: redisUrl });
    
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      isConnected = false;
    });
    
    redisClient.on('connect', () => {
      console.log('✅ Redis 连接成功');
      isConnected = true;
    });
    
    redisClient.on('ready', () => {
      isConnected = true;
    });
    
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.warn('Redis 不可用，将使用内存缓存:', error.message);
    return null;
  }
}

export async function getCache(key) {
  const client = await getCacheClient();
  
  if (client) {
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn('Redis 获取缓存失败，使用内存缓存:', error.message);
    }
  }
  
  const item = memoryCache.get(key);
  if (item && item.expireAt > Date.now()) {
    return item.data;
  }
  memoryCache.delete(key);
  return null;
}

export async function setCache(key, value, ttl = CACHE_CONFIG.DEFAULT_TTL) {
  const client = await getCacheClient();
  
  if (client) {
    try {
      await client.set(key, JSON.stringify(value), { EX: ttl });
      return true;
    } catch (error) {
      console.warn('Redis 设置缓存失败，使用内存缓存:', error.message);
    }
  }
  
  memoryCache.set(key, {
    data: value,
    expireAt: Date.now() + (ttl * 1000)
  });
  return true;
}

export async function deleteCache(key) {
  const client = await getCacheClient();
  
  if (client) {
    try {
      await client.del(key);
      return true;
    } catch (error) {
      console.warn('Redis 删除缓存失败:', error.message);
    }
  }
  
  memoryCache.delete(key);
  return true;
}

export async function clearCache(pattern) {
  const client = await getCacheClient();
  
  if (client) {
    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
      return true;
    } catch (error) {
      console.warn('Redis 清除缓存失败:', error.message);
    }
  }
  
  for (const key of memoryCache.keys()) {
    if (key.match(new RegExp(pattern.replace('*', '.*')))) {
      memoryCache.delete(key);
    }
  }
  return true;
}

export async function cacheWrapper(key, fetcher, ttl = CACHE_CONFIG.DEFAULT_TTL) {
  const cached = await getCache(key);
  if (cached !== null) {
    return { data: cached, cached: true };
  }
  
  const data = await fetcher();
  if (data !== null && data !== undefined) {
    await setCache(key, data, ttl);
  }
  
  return { data, cached: false };
}

export { CACHE_CONFIG };
