const redis = require('redis');

class CacheService {
  constructor() {
    this.isEnabled = process.env.REDIS_ENABLED !== 'false';
    this.client = null;

    if (!this.isEnabled) {
      console.log('🟡 CacheService: Redis is disabled. Operations will be skipped.');
      return;
    }

    this.client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      // Ensure it doesn't keep retrying forever in dev if it's accidentally enabled
      socket: {
        reconnectStrategy: (retries) => (retries > 2 ? new Error('Redis connection failed') : 1000)
      }
    });

    this.client.on('error', (err) => console.log('🟡 Redis Client (Service) Error: Check if Redis is running.'));
    this.client.on('connect', () => console.log('✅ Redis connected (Service)'));

    this.client.connect().catch(() => {
      console.log('🟡 Redis connect failed. Continuing with cache disabled.');
      this.isEnabled = false;
    });
  }

  async get(key) {
    if (!this.isEnabled || !this.client?.isOpen) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }

  async set(key, data, ttl = 300) {
    if (!this.isEnabled || !this.client?.isOpen) return true;
    try {
      await this.client.setEx(key, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      return false;
    }
  }

  async del(key) {
    if (!this.isEnabled || !this.client?.isOpen) return true;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  async remember(key, ttl, callback) {
    const cached = await this.get(key);
    if (cached) return cached;

    const fresh = await callback();
    await this.set(key, fresh, ttl);
    return fresh;
  }

  async flush() {
    if (!this.isEnabled || !this.client?.isOpen) return true;
    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new CacheService();

// const redis = require('redis');
// const { promisify } = require('util');

// class CacheService {
//   constructor() {
//     this.client = redis.createClient({
//       url: process.env.REDIS_URL || 'redis://localhost:6379'
//     });

//     this.client.on('error', (err) => console.error('Redis Client Error', err));
//     this.client.on('connect', () => console.log('Redis connected'));

//     this.client.connect();

//     // Promisify methods
//     this.getAsync = promisify(this.client.get).bind(this.client);
//     this.setAsync = promisify(this.client.setEx).bind(this.client);
//     this.delAsync = promisify(this.client.del).bind(this.client);
//     this.keysAsync = promisify(this.client.keys).bind(this.client);
//   }

//   async get(key) {
//     try {
//       const data = await this.getAsync(key);
//       return data ? JSON.parse(data) : null;
//     } catch (error) {
//       console.error('Cache get error:', error);
//       return null;
//     }
//   }

//   async set(key, data, ttl = 300) {
//     try {
//       await this.setAsync(key, ttl, JSON.stringify(data));
//       return true;
//     } catch (error) {
//       console.error('Cache set error:', error);
//       return false;
//     }
//   }

//   async del(key) {
//     try {
//       await this.delAsync(key);
//       return true;
//     } catch (error) {
//       console.error('Cache delete error:', error);
//       return false;
//     }
//   }

//   async delPattern(pattern) {
//     try {
//       const keys = await this.keysAsync(pattern);
//       if (keys.length > 0) {
//         await this.delAsync(keys);
//       }
//       return keys.length;
//     } catch (error) {
//       console.error('Cache pattern delete error:', error);
//       return 0;
//     }
//   }

//   async remember(key, ttl, callback) {
//     const cached = await this.get(key);
//     if (cached) return cached;

//     const fresh = await callback();
//     await this.set(key, fresh, ttl);
//     return fresh;
//   }

//   async rememberForever(key, callback) {
//     return this.remember(key, 86400 * 365, callback); // 1 year
//   }

//   async flush() {
//     try {
//       await this.client.flushAll();
//       return true;
//     } catch (error) {
//       console.error('Cache flush error:', error);
//       return false;
//     }
//   }

//   generateKey(parts) {
//     return `cache:${parts.filter(Boolean).join(':')}`;
//   }

//   // Tag-based caching
//   async tagSet(tags, key, data, ttl = 300) {
//     await this.set(key, data, ttl);
    
//     // Store key in tag sets
//     for (const tag of tags) {
//       const tagKey = `tag:${tag}`;
//       const tagSet = await this.get(tagKey) || [];
//       if (!tagSet.includes(key)) {
//         tagSet.push(key);
//         await this.set(tagKey, tagSet, ttl * 2);
//       }
//     }
//   }

//   async tagFlush(tags) {
//     for (const tag of tags) {
//       const tagKey = `tag:${tag}`;
//       const keys = await this.get(tagKey) || [];
//       if (keys.length > 0) {
//         await this.delAsync(keys);
//         await this.delAsync(tagKey);
//       }
//     }
//   }
// }

// module.exports = new CacheService();