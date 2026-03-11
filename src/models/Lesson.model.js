const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  
  title: { type: String, required: true },
  type: { type: String, enum: ['video', 'article', 'quiz', 'assignment'], required: true },
  order: { type: Number, required: true },
  
  // Content blocks based on type
  videoUrl: String,
  videoDuration: Number,
  articleBody: String,
  
  isFreePreview: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

lessonSchema.index({ course: 1, section: 1, order: 1, isDeleted: 1 });

module.exports = mongoose.model('Lesson', lessonSchema);