const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
  title: { type: String, required: true },
  timeLimit: { type: Number, default: 30 }, // in minutes
  passingScore: { type: Number, default: 70 },
  
  // Totals updated by Service Layer when questions are added/removed
  totalQuestions: { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

quizSchema.index({ course: 1, isDeleted: 1 });

module.exports = mongoose.model('Quiz', quizSchema)
