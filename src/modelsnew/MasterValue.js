const mongoose = require('mongoose');

// This is what all your enums will now reference!
const masterValueSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterGroup', required: true },
  value: { type: String, required: true, trim: true }, // e.g., 'beginner', 'admin'
  label: { type: String, required: true, trim: true }, // e.g., 'Beginner', 'Administrator'
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('MasterValue', masterValueSchema);