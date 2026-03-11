const mongoose = require('mongoose');

const discussionSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }, // Optional: link to specific video
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  title: { type: String, required: true },
  content: { type: String, required: true },
  
  isResolved: { type: Boolean, default: false },
  totalReplies: { type: Number, default: 0 }
}, { timestamps: true });

const discussionReplySchema = new mongoose.Schema({
  discussion: { type: mongoose.Schema.Types.ObjectId, ref: 'Discussion', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true }
}, { timestamps: true });

discussionSchema.index({ course: 1, lesson: 1 });
discussionReplySchema.index({ discussion: 1, createdAt: 1 });

module.exports = {
  Discussion: mongoose.model('Discussion', discussionSchema),
  DiscussionReply: mongoose.model('DiscussionReply', discussionReplySchema)
};