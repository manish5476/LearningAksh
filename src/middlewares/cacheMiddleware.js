'use strict';

const CacheService = require('../services/cacheService');

/*
=====================================================
CACHE MIDDLEWARE
Caches GET responses automatically
=====================================================
*/

exports.cache = (ttl = 300) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }
    const key = `cache:${req.baseUrl}${req.path}:${JSON.stringify(req.query)}`;
    try {
      const cached = await CacheService.get(key);
      if (cached) {
        return res.status(200).json(cached);
      }
      const originalJson = res.json.bind(res);
      res.json = async (data) => {
        if (res.statusCode === 200) {
          await CacheService.set(key, data, ttl);
        }
        return originalJson(data);
      };
      next();
    } catch (err) {
      next();
    }
  };
};

/*
=====================================================
CACHE INVALIDATION MIDDLEWARE
=====================================================
*/

exports.clearCache = (pattern) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = async (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          if (pattern) {
            await CacheService.delByPattern(pattern);
          }
        } catch (err) {
          console.error('Cache invalidation error:', err.message);
        }
      }
      return originalJson(data);
    };
    next();
  };
};

// const redis = require('redis');
// let redisClient = null;
// const isEnabled = process.env.REDIS_ENABLED !== 'false';

// if (isEnabled) {
//   redisClient = redis.createClient({
//     url: process.env.REDIS_URL || 'redis://localhost:6379'
//   });

//   redisClient.on('error', (err) => console.log('🟡 Redis Client (Middleware) Error skipped.'));
//   redisClient.connect().catch(() => { /* Silence connection errors */ });
// }

// exports.cache = (duration = 300) => {
//   return async (req, res, next) => {
//     // 1. Check if caching is possible
//     if (!isEnabled || !redisClient?.isOpen || req.method !== 'GET') {
//       return next();
//     }

//     const key = `cache:${req.originalUrl}`;

//     try {
//       const cachedResponse = await redisClient.get(key);

//       if (cachedResponse) {
//         console.log(`✅ Cache Hit: ${key}`);
//         return res.status(200).json(JSON.parse(cachedResponse));
//       }

//       // Intercept the response
//       const originalJson = res.json;
//       res.json = function(data) {
//         if (res.statusCode === 200) {
//           redisClient.setEx(key, duration, JSON.stringify(data))
//             .catch(err => console.error('Cache set error:', err.message));
//         }
//         originalJson.call(this, data);
//       };

//       next();
//     } catch (error) {
//       next();
//     }
//   };
// };

// exports.clearCache = (pattern) => {
//   return async (req, res, next) => {
//     if (!isEnabled || !redisClient?.isOpen) return next();

//     const originalJson = res.json;
//     res.json = async function(data) {
//       try {
//         if (res.statusCode >= 200 && res.statusCode < 300) {
//           const searchPattern = pattern || `cache:${req.originalUrl.split('?')[0]}*`;
//           const keys = await redisClient.keys(searchPattern);
//           if (keys.length > 0) {
//             await redisClient.del(keys);
//           }
//         }
//       } catch (error) {
//         console.error('Cache clear error:', error.message);
//       }
//       originalJson.call(this, data);
//     };
//     next();
//   };
// };
