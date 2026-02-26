const redis = require('redis');
let redisClient = null;
const isEnabled = process.env.REDIS_ENABLED !== 'false';

if (isEnabled) {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  redisClient.on('error', (err) => console.log('🟡 Redis Client (Middleware) Error skipped.'));
  redisClient.connect().catch(() => { /* Silence connection errors */ });
}

exports.cache = (duration = 300) => {
  return async (req, res, next) => {
    // 1. Check if caching is possible
    if (!isEnabled || !redisClient?.isOpen || req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl}`;

    try {
      const cachedResponse = await redisClient.get(key);

      if (cachedResponse) {
        console.log(`✅ Cache Hit: ${key}`);
        return res.status(200).json(JSON.parse(cachedResponse));
      }

      // Intercept the response
      const originalJson = res.json;
      res.json = function(data) {
        if (res.statusCode === 200) {
          redisClient.setEx(key, duration, JSON.stringify(data))
            .catch(err => console.error('Cache set error:', err.message));
        }
        originalJson.call(this, data);
      };

      next();
    } catch (error) {
      next();
    }
  };
};

exports.clearCache = (pattern) => {
  return async (req, res, next) => {
    if (!isEnabled || !redisClient?.isOpen) return next();

    const originalJson = res.json;
    res.json = async function(data) {
      try {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const searchPattern = pattern || `cache:${req.originalUrl.split('?')[0]}*`;
          const keys = await redisClient.keys(searchPattern);
          if (keys.length > 0) {
            await redisClient.del(keys);
          }
        }
      } catch (error) {
        console.error('Cache clear error:', error.message);
      }
      originalJson.call(this, data);
    };
    next();
  };
};

// const redis = require('redis');
// const { promisify } = require('util');

// const redisClient = redis.createClient({
//   url: process.env.REDIS_URL || 'redis://localhost:6379'
// });

// redisClient.on('error', (err) => console.error('Redis Client Error', err));
// redisClient.connect();

// const getAsync = promisify(redisClient.get).bind(redisClient);
// const setAsync = promisify(redisClient.setEx).bind(redisClient);
// const delAsync = promisify(redisClient.del).bind(redisClient);

// exports.cache = (duration = 300) => {
//   return async (req, res, next) => {
//     // Skip caching for non-GET requests
//     if (req.method !== 'GET') {
//       return next();
//     }

//     const key = `cache:${req.originalUrl}`;

//     try {
//       const cachedResponse = await getAsync(key);

//       if (cachedResponse) {
//         const parsed = JSON.parse(cachedResponse);
//         return res.status(200).json(parsed);
//       }

//       // Store original send function
//       const originalJson = res.json;

//       res.json = function(data) {
//         // Cache the response
//         setAsync(key, duration, JSON.stringify(data));
        
//         // Call original json
//         originalJson.call(this, data);
//       };

//       next();
//     } catch (error) {
//       console.error('Cache error:', error);
//       next();
//     }
//   };
// };

// exports.clearCache = (pattern) => {
//   return async (req, res, next) => {
//     const originalJson = res.json;

//     res.json = async function(data) {
//       try {
//         // Clear cache after successful response
//         if (res.statusCode >= 200 && res.statusCode < 300) {
//           const keys = await redisClient.keys(pattern || `cache:${req.originalUrl.split('?')[0]}*`);
//           if (keys.length > 0) {
//             await delAsync(keys);
//           }
//         }
//       } catch (error) {
//         console.error('Cache clear error:', error);
//       }

//       originalJson.call(this, data);
//     };

//     next();
//   };
// };

// // Invalidate cache by tags
// exports.invalidateCache = async (tags) => {
//   try {
//     const patterns = tags.map(tag => `cache:*${tag}*`);
//     for (const pattern of patterns) {
//       const keys = await redisClient.keys(pattern);
//       if (keys.length > 0) {
//         await delAsync(keys);
//       }
//     }
//   } catch (error) {
//     console.error('Cache invalidation error:', error);
//   }
// };

// module.exports.redisClient = redisClient;