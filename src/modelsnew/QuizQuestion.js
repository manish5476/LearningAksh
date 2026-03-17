const mongoose = require('mongoose');

const quizQuestionSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  question: { type: String, required: true },
  type: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue', required: true }, // 'multiple-choice', etc.
  options: [{ text: String, isCorrect: Boolean }],
  correctAnswer: String,
  points: { type: Number, default: 1 },
  explanation: String,
  order: Number
}, { timestamps: true });

module.exports = mongoose.model('QuizQuestion', quizQuestionSchema);