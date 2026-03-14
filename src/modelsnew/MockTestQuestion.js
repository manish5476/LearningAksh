const mongoose = require('mongoose');

const mockTestQuestionSchema = new mongoose.Schema({
  mockTest: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest', required: true },
  sectionName: { type: String, required: true },
  question: { type: String, required: true },
  options: [{ text: String, isCorrect: Boolean }],
  marks: { type: Number, default: 1 },
  negativeMarks: { type: Number, default: 0 },
  explanation: String,
  order: Number
}, { timestamps: true });

module.exports = mongoose.model('MockTestQuestion', mockTestQuestionSchema);