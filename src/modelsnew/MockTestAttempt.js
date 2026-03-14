const mongoose = require('mongoose');

const mockTestAttemptSchema = new mongoose.Schema({
  mockTest: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  timeTaken: Number,
  answers: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTestQuestion' },
    selectedOptionIndex: Number,
    answerText: String,
    isCorrect: Boolean,
    marksObtained: Number
  }],
  score: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  rank: Number,
  totalStudents: Number,
  
  // Replaced static enum ['started', 'in-progress', 'completed', 'abandoned']
  status: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue' },
  
  isPassed: Boolean,
  feedback: String
}, { timestamps: true });

mockTestAttemptSchema.index({ mockTest: 1, student: 1 });
module.exports = mongoose.model('MockTestAttempt', mockTestAttemptSchema);