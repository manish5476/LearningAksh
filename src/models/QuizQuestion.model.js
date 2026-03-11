    const mongoose = require('mongoose');
 const quizQuestionSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  question: { type: String, required: true },
  type: { type: String, enum: ['multiple-choice', 'true-false', 'short-answer'], required: true },
  options: [{ text: String, isCorrect: Boolean }], // Array is fine here as options are limited (usually 4)
  points: { type: Number, default: 1 },
  explanation: String,
  order: Number
}, { timestamps: true });

quizQuestionSchema.index({ quiz: 1, order: 1 });
module.exports = mongoose.model('QuizQuestion', quizQuestionSchema)