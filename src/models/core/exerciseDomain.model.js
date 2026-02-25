const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
  dueDate: Date,
  totalPoints: { type: Number, default: 100 },
  passingPoints: { type: Number, default: 70 },
  attachments: [String],
  resources: [String],
  instructions: String,
  submissionType: { type: String, enum: ['file-upload', 'text-entry', 'both'], default: 'file-upload' },
  allowedFileTypes: [String],
  maxFileSize: { type: Number, default: 10 },
  isPublished: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

const assignmentSubmissionSchema = new mongoose.Schema({
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedAt: { type: Date, default: Date.now },
  content: String,
  attachments: [String],
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

const codingExerciseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
  language: { type: String, enum: ['javascript', 'python', 'java', 'cpp', 'csharp', 'ruby', 'php'], required: true },
  initialCode: String,
  solutionCode: String,
  testCases: [{ input: String, expectedOutput: String, isHidden: { type: Boolean, default: false }, points: { type: Number, default: 1 } }],
  constraints: [String],
  hints: [String],
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  totalPoints: { type: Number, default: 10 },
  timeLimit: Number,
  memoryLimit: Number,
  isPublished: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

const codingSubmissionSchema = new mongoose.Schema({
  exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingExercise', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code: { type: String, required: true },
  language: String,
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
  testResults: [{ testCase: String, passed: Boolean, output: String, expectedOutput: String, points: Number }],
  totalPoints: Number,
  executionTime: Number,
  memoryUsed: Number,
  error: String
}, { timestamps: true });

assignmentSubmissionSchema.index({ assignment: 1, student: 1 });
codingSubmissionSchema.index({ exercise: 1, student: 1 });

module.exports = {
  Assignment: mongoose.model('Assignment', assignmentSchema),
  AssignmentSubmission: mongoose.model('AssignmentSubmission', assignmentSubmissionSchema),
  CodingExercise: mongoose.model('CodingExercise', codingExerciseSchema),
  CodingSubmission: mongoose.model('CodingSubmission', codingSubmissionSchema)
};