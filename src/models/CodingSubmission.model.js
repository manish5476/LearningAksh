const mongoose = require('mongoose');

const codingSubmissionSchema = new mongoose.Schema({
  exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingExercise', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  code: { type: String, required: true },
  language: String,
  submittedAt: { type: Date, default: Date.now },
  
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
  testResults: [{ 
    testCase: String, 
    passed: Boolean, 
    output: String, 
    expectedOutput: String, 
    points: Number 
  }],
  
  totalPoints: Number,
  executionTime: Number,
  memoryUsed: Number,
  error: String
}, { timestamps: true });

codingSubmissionSchema.index({ exercise: 1, student: 1 });
codingSubmissionSchema.index({ status: 1 }); // Great for a background worker finding 'pending' jobs to execute

module.exports = mongoose.model('CodingSubmission', codingSubmissionSchema);