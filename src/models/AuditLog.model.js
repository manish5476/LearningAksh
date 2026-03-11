    const mongoose = require('mongoose');

// TTL Index: Automatically delete logs older than 90 days to save DB space
const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: String,
  resource: String,
  ip: String,
  requestBody: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, expires: '90d' } // Auto-delete
});

module.exports = mongoose.model('AuditLog', auditLogSchema);