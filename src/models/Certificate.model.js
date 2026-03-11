const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  
  certificateNumber: { type: String, required: true, unique: true },
  issueDate: { type: Date, default: Date.now },
  
  certificateUrl: String, // Link to S3 PDF
  verificationUrl: String // Link to public validation page
}, { timestamps: true });

certificateSchema.index({ student: 1, course: 1 }, { unique: true });
certificateSchema.index({ certificateNumber: 1 });

module.exports = mongoose.model('Certificate', certificateSchema);