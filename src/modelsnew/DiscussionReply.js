const mongoose = require('mongoose');

const discussionReplySchema = new mongoose.Schema({
  discussion: { type: mongoose.Schema.Types.ObjectId, ref: 'Discussion', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  isEdited: { type: Boolean, default: false },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

discussionReplySchema.index({ discussion: 1, createdAt: 1 });
module.exports = mongoose.model('DiscussionReply', discussionReplySchema);