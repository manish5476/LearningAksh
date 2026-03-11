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
  maxFileSize: { type: Number, default: 10 }, // in MB
  
  isPublished: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Compound index to quickly fetch active assignments for a specific course/lesson
assignmentSchema.index({ course: 1, lesson: 1, isDeleted: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);