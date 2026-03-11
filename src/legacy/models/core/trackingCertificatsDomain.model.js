const mongoose = require('mongoose');

// This is the SINGLE SOURCE OF TRUTH for progress. Removed from StudentProfile.
const progressTrackingSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  completedLessons: [{
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    completedAt: Date,
    timeSpent: Number, // in seconds
    attempts: Number
  }],
  completedQuizzes: [{
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
    score: Number,
    completedAt: Date,
    attempts: Number
  }],
  completedAssignments: [{
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    score: Number,
    completedAt: Date
  }],
  courseProgressPercentage: { type: Number, default: 0 },
  totalTimeSpent: { type: Number, default: 0 }, // in minutes
  lastActivity: Date,
  isCompleted: { type: Boolean, default: false },
  completedAt: Date
}, { timestamps: true });

const certificateSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  certificateNumber: { type: String, required: true, unique: true },
  studentName: String,
  courseName: String,
  issueDate: { type: Date, default: Date.now },
  expiryDate: Date,
  grade: String,
  percentage: Number,
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  instructorName: String,
  certificateUrl: String,
  verificationUrl: String,
  isValid: { type: Boolean, default: true }
}, { timestamps: true });

progressTrackingSchema.index({ student: 1, course: 1 }, { unique: true });
certificateSchema.index({ certificateNumber: 1 });

module.exports = {
  ProgressTracking: mongoose.model('ProgressTracking', progressTrackingSchema),
  Certificate: mongoose.model('Certificate', certificateSchema)
};