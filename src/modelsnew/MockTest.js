const mongoose = require('mongoose');

const mockTestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Replaced static enum with dynamic Master reference
  level: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue', required: true },
  
  duration: { type: Number, required: true },
  totalQuestions: { type: Number, required: true, default: 0 },
  totalMarks: { type: Number, required: true, default: 0 },
  passingMarks: { type: Number, required: true },
  instructions: [String],
  tags: [String],
  isFree: { type: Boolean, default: false },
  price: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  attemptsCount: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

mockTestSchema.index({ title: 'text', description: 'text' });
module.exports = mongoose.model('MockTest', mockTestSchema);