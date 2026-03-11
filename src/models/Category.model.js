const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }, // Enables Sub-categories
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

categorySchema.index({ parentCategory: 1, isActive: 1 });

module.exports = mongoose.model('Category', categorySchema);