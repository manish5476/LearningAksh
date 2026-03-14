const mongoose = require('mongoose');

const masterGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, uppercase: true, trim: true }, // e.g., 'COURSE_LEVEL', 'ROLES'
  description: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('MasterGroup', masterGroupSchema);