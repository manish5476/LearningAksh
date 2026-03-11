const mongoose = require('mongoose');

const studentNoteSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
  
  content: { type: String, required: true },
  videoTimestamp: { type: Number, default: 0 }, // Timestamp in seconds
  
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Optimized for fetching all notes a student took for a specific course/lesson
studentNoteSchema.index({ student: 1, course: 1, isDeleted: 1 });
studentNoteSchema.index({ student: 1, lesson: 1, isDeleted: 1 });

module.exports = mongoose.model('StudentNote', studentNoteSchema);