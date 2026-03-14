const mongoose = require('mongoose');

const discussionSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isPinned: { type: Boolean, default: false },
  isResolved: { type: Boolean, default: false },
  totalReplies: { type: Number, default: 0 }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

discussionSchema.virtual('replies', {
  ref: 'DiscussionReply',
  foreignField: 'discussion',
  localField: '_id'
});

discussionSchema.index({ course: 1, lesson: 1 });
module.exports = mongoose.model('Discussion', discussionSchema);