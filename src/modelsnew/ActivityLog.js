const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue', required: true }, // 'login', 'enrollment'
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
  ip: String,
  userAgent: String
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);