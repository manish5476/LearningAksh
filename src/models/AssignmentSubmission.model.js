const mongoose = require('mongoose');

const assignmentSubmissionSchema = new mongoose.Schema({
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  content: String,
  attachments: [String],
  submittedAt: { type: Date, default: Date.now },
  
  status: { type: String, enum: ['submitted', 'graded', 'late-submitted'], default: 'submitted' },
  grade: {
    points: Number,
    percentage: Number,
    feedback: String,
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gradedAt: Date
  },
  
  isLate: { type: Boolean, default: false }
}, { timestamps: true });

// Ensures a student can easily find their specific submission, and prevents duplicate active submissions
assignmentSubmissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
// Helps instructors quickly pull up all ungraded submissions
assignmentSubmissionSchema.index({ assignment: 1, status: 1 });

module.exports = mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);