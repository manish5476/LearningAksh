const mongoose = require('mongoose');

const cohortSchema = new mongoose.Schema({
  name: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  instructors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  maxStudents: { type: Number },
  enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  scheduleInfo: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

cohortSchema.index({ course: 1, startDate: 1 });
module.exports = mongoose.model('Cohort', cohortSchema);