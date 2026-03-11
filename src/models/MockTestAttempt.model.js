const mongoose = require('mongoose');

const mockTestAttemptSchema = new mongoose.Schema({
  mockTest: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  status: { type: String, enum: ['started', 'completed', 'abandoned'], default: 'started' },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  timeTaken: Number,
    answers: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTestQuestion' },
    selectedOptionIndex: Number,
    isCorrect: Boolean,
    marksObtained: Number
  }],
  
  score: { type: Number, default: 0 },
  isPassed: Boolean
}, { timestamps: true });

mockTestAttemptSchema.index({ student: 1, mockTest: 1 });

module.exports =  mongoose.model('MockTestAttempt', mockTestAttemptSchema)
