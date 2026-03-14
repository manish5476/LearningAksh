const mongoose = require('mongoose');

const studentNoteSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
  content: { type: String, required: true },
  videoTimestamp: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

studentNoteSchema.index({ student: 1, lesson: 1 });
module.exports = mongoose.model('StudentNote', studentNoteSchema);