const mongoose = require('mongoose');

const progressTrackingSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  completedLessons: [{
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    completedAt: Date,
    timeSpent: Number
  }],
  courseProgressPercentage: { type: Number, default: 0 },
  totalTimeSpent: { type: Number, default: 0 },
  isCompleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('ProgressTracking', progressTrackingSchema);