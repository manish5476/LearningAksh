const mongoose = require('mongoose');

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

certificateSchema.index({ certificateNumber: 1 });
module.exports = mongoose.model('Certificate', certificateSchema);