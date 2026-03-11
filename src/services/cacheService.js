

'use strict';

const redis = require('redis');

class CacheService {
  constructor() {
    this.isEnabled = process.env.REDIS_ENABLED !== 'false';
    this.client = null;
    if (!this.isEnabled) {
      console.log('🟡 Redis disabled. CacheService running in fallback mode.');
      return;
    }

    this.client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',

      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.log('🔴 Redis reconnect attempts exceeded.');
            return new Error('Redis reconnect failed');
          }
          return 1000;
        }
      }
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected');
    });

    this.client.on('error', () => {
      console.log('🟡 Redis error. Cache temporarily unavailable.');
    });

    this.client.connect().catch(() => {
      console.log('🟡 Redis connection failed. Cache disabled.');
      this.isEnabled = false;
    });

  }

  /* =========================================================
     SAFE JSON PARSER
  ========================================================= */

  parse(data) {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  stringify(data) {
    try {
      return JSON.stringify(data);
    } catch {
      return null;
    }
  }

  /* =========================================================
     BASIC GET
  ========================================================= */

  async get(key) {

    if (!this.isEnabled || !this.client?.isOpen) return null;

    try {

      const data = await this.client.get(key);

      return data ? this.parse(data) : null;

    } catch {
      return null;
    }
  }

  /* =========================================================
     BASIC SET
  ========================================================= */

  async set(key, data, ttl = 300) {

    if (!this.isEnabled || !this.client?.isOpen) return true;

    try {

      const value = this.stringify(data);

      if (!value) return false;

      await this.client.setEx(key, ttl, value);

      return true;

    } catch {
      return false;
    }
  }

  /* =========================================================
     DELETE KEY
  ========================================================= */

  async del(key) {

    if (!this.isEnabled || !this.client?.isOpen) return true;

    try {

      await this.client.del(key);

      return true;

    } catch {

      return false;
    }
  }

  /* =========================================================
     DELETE BY PATTERN (ENTERPRISE)
  ========================================================= */

  async delByPattern(pattern) {

    if (!this.isEnabled || !this.client?.isOpen) return true;

    try {

      const keys = await this.client.keys(pattern);

      if (keys.length === 0) return true;

      const pipeline = this.client.multi();

      keys.forEach(key => pipeline.del(key));

      await pipeline.exec();

      return true;

    } catch {

      return false;
    }
  }

  /* =========================================================
     CACHE WRAPPER
  ========================================================= */

  async remember(key, ttl, callback) {

    const cached = await this.get(key);

    if (cached) return cached;

    const fresh = await callback();

    await this.set(key, fresh, ttl);

    return fresh;
  }

  /* =========================================================
     MULTI SET
  ========================================================= */

  async mset(entries, ttl = 300) {

    if (!this.isEnabled || !this.client?.isOpen) return true;

    try {

      const pipeline = this.client.multi();

      for (const [key, value] of Object.entries(entries)) {

        pipeline.setEx(key, ttl, this.stringify(value));

      }

      await pipeline.exec();

      return true;

    } catch {

      return false;
    }
  }

  /* =========================================================
     CLEAR ALL CACHE
  ========================================================= */

  async flush() {

    if (!this.isEnabled || !this.client?.isOpen) return true;

    try {

      await this.client.flushAll();

      return true;

    } catch {

      return false;
    }
  }

}

module.exports = new CacheService();




// const redis = require('redis');

// class CacheService {
//   constructor() {
//     this.isEnabled = process.env.REDIS_ENABLED !== 'false';
//     this.client = null;

//     if (!this.isEnabled) {
//       console.log('🟡 CacheService: Redis is disabled. Operations will be skipped.');
//       return;
//     }

//     this.client = redis.createClient({
//       url: process.env.REDIS_URL || 'redis://localhost:6379',
//       // Ensure it doesn't keep retrying forever in dev if it's accidentally enabled
//       socket: {
//         reconnectStrategy: (retries) => (retries > 2 ? new Error('Redis connection failed') : 1000)
//       }
//     });

//     this.client.on('error', (err) => console.log('🟡 Redis Client (Service) Error: Check if Redis is running.'));
//     this.client.on('connect', () => console.log('✅ Redis connected (Service)'));

//     this.client.connect().catch(() => {
//       console.log('🟡 Redis connect failed. Continuing with cache disabled.');
//       this.isEnabled = false;
//     });
//   }

//   async get(key) {
//     if (!this.isEnabled || !this.client?.isOpen) return null;
//     try {
//       const data = await this.client.get(key);
//       return data ? JSON.parse(data) : null;
//     } catch (error) {
//       return null;
//     }
//   }

//   async set(key, data, ttl = 300) {
//     if (!this.isEnabled || !this.client?.isOpen) return true;
//     try {
//       await this.client.setEx(key, ttl, JSON.stringify(data));
//       return true;
//     } catch (error) {
//       return false;
//     }
//   }

//   async del(key) {
//     if (!this.isEnabled || !this.client?.isOpen) return true;
//     try {
//       await this.client.del(key);
//       return true;
//     } catch (error) {
//       return false;
//     }
//   }

//   async remember(key, ttl, callback) {
//     const cached = await this.get(key);
//     if (cached) return cached;

//     const fresh = await callback();
//     await this.set(key, fresh, ttl);
//     return fresh;
//   }

//   async flush() {
//     if (!this.isEnabled || !this.client?.isOpen) return true;
//     try {
//       await this.client.flushAll();
//       return true;
//     } catch (error) {
//       return false;
//     }
//   }
// }

// module.exports = new CacheService();
