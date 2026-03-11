const mongoose = require('mongoose');

// REPLACES THE MASSIVE ARRAY. Millions of rows here is fine, Mongo loves flat, narrow documents.
const lessonProgressSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
  
  isCompleted: { type: Boolean, default: false },
  watchTime: { type: Number, default: 0 }, // in seconds
  lastPosition: { type: Number, default: 0 } // For resuming videos
}, { timestamps: true });

lessonProgressSchema.index({ student: 1, course: 1, lesson: 1 }, { unique: true });

module.exports = mongoose.model('LessonProgress', lessonProgressSchema);