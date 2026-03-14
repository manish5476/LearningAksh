const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: String,
  resource: String,
  method: String,
  statusCode: Number,
  ip: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now },
  requestBody: mongoose.Schema.Types.Mixed,
  requestParams: mongoose.Schema.Types.Mixed,
  requestQuery: mongoose.Schema.Types.Mixed,
  responseBody: mongoose.Schema.Types.Mixed,
  duration: Number
}, { timestamps: true });

auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);