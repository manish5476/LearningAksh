const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  timeLimit: { type: Number, default: 30 },
  passingScore: { type: Number, min: 0, max: 100, default: 70 },
  maxAttempts: { type: Number, default: 3 },
  totalQuestions: { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);