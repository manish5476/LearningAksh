// config/constants.js
module.exports = {
    PAGINATION: {
      DEFAULT_LIMIT: 10,
      MAX_LIMIT: 100
    },
    
    UPLOAD: {
      MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
      ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
      ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm'],
      ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword']
    },
    
    CACHE: {
      TTL: {
        SHORT: 300, // 5 minutes
        MEDIUM: 1800, // 30 minutes
        LONG: 3600, // 1 hour
        DAY: 86400 // 24 hours
      }
    },
    
    RATE_LIMIT: {
      AUTH: { window: 15 * 60 * 1000, max: 5 }, // 15 minutes, 5 attempts
      API: { window: 60 * 60 * 1000, max: 100 }, // 1 hour, 100 requests
      UPLOAD: { window: 60 * 60 * 1000, max: 20 } // 1 hour, 20 uploads
    }
  };