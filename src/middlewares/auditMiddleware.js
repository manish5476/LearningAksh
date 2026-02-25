const { AuditLog } = require('../models');

exports.auditLog = (action) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    const originalSend = res.send;

    let responseBody;

    res.json = function(body) {
      responseBody = body;
      originalJson.call(this, body);
    };

    res.send = function(body) {
      responseBody = body;
      originalSend.call(this, body);
    };

    res.on('finish', async () => {
      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const logData = {
            user: req.user?.id,
            action,
            resource: req.baseUrl + req.path,
            method: req.method,
            statusCode: res.statusCode,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            timestamp: new Date(),
            requestBody: sanitizeData(req.body),
            requestParams: req.params,
            requestQuery: req.query,
            responseBody: sanitizeData(responseBody)
          };

          // Store in database
          await AuditLog.create(logData);

          // Also log to file for compliance
          console.log(JSON.stringify({
            ...logData,
            timestamp: logData.timestamp.toISOString()
          }));
        } catch (error) {
          console.error('Audit log error:', error);
        }
      }
    });

    next();
  };
};

const sanitizeData = (data) => {
  if (!data) return data;
  
  const sanitized = { ...data };
  const sensitiveFields = ['password', 'token', 'creditCard', 'cvv', 'ssn'];
  
  const sanitize = (obj) => {
    Object.keys(obj).forEach(key => {
      if (sensitiveFields.includes(key.toLowerCase())) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    });
  };
  
  sanitize(sanitized);
  return sanitized;
};

// Model for audit logs
const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: String,
  resource: String,
  method: String,
  statusCode: Number,
  ip: String,
  userAgent: String,
  timestamp: Date,
  requestBody: mongoose.Schema.Types.Mixed,
  requestParams: mongoose.Schema.Types.Mixed,
  requestQuery: mongoose.Schema.Types.Mixed,
  responseBody: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports.AuditLog = AuditLog;