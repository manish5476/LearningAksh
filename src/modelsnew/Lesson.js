const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true },
  description: String,
  
  type: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue', required: true }, // 'video', 'article', 'quiz'
  
  content: {
    video: { 
      url: String, 
      duration: Number, 
      provider: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue' } // 'youtube', 'vimeo'
    },
    article: { body: String, attachments: [String] },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }
  },
  order: { type: Number, required: true },
  duration: { type: Number, default: 0 },
  isFree: { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },
  
  resources: [{ 
    title: String,
    type: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue' },
    url: String
  }],
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Lesson', lessonSchema);