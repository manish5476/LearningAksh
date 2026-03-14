const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  sendEmailNotification: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

announcementSchema.index({ course: 1, createdAt: -1 });
module.exports = mongoose.model('Announcement', announcementSchema);