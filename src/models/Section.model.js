const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true },
  order: { type: Number, required: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

sectionSchema.index({ course: 1, order: 1, isDeleted: 1 });

module.exports = mongoose.model('Section', sectionSchema);