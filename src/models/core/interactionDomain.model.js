const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: String,
  comment: { type: String, required: true },
  pros: [String],
  cons: [String],
  isVerified: { type: Boolean, default: false },
  helpfulCount: { type: Number, default: 0 },
  replyFromInstructor: { comment: String, repliedAt: Date },
  isApproved: { type: Boolean, default: true }
}, { timestamps: true });

// Statics function to calculate average
reviewSchema.statics.calcAverageRatings = async function(courseId) {
  const stats = await this.aggregate([
    { $match: { course: courseId } },
    { $group: { _id: '$course', rating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } }
  ]);

  // Dynamically call Course model to prevent Circular Dependency crashes
  const Course = mongoose.model('Course');

  if (stats.length > 0) {
    await Course.findByIdAndUpdate(courseId, { 
      rating: Math.round(stats[0].rating * 10) / 10, // Round to 1 decimal place
      totalReviews: stats[0].totalReviews 
    });
  } else {
    await Course.findByIdAndUpdate(courseId, { rating: 0, totalReviews: 0 });
  }
};

// Hook for Creation / Updating
reviewSchema.post('save', function() {
  this.constructor.calcAverageRatings(this.course);
});

// Hook for Deletion (Catches findByIdAndDelete, findOneAndDelete)
reviewSchema.post(/^findOneAnd/, async function(doc) {
  // 'doc' is the deleted document. If it exists, recalculate for its course.
  if (doc) {
    await doc.constructor.calcAverageRatings(doc.course);
  }
});

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
}, { timestamps: true });

const discussionReplySchema = new mongoose.Schema({
  discussion: { type: mongoose.Schema.Types.ObjectId, ref: 'Discussion', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  isEdited: { type: Boolean, default: false },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

reviewSchema.index({ course: 1, user: 1 }, { unique: true });
discussionSchema.index({ course: 1, lesson: 1 });
discussionReplySchema.index({ discussion: 1, createdAt: 1 });

// Serverless / Hot-Reload Safe Exports
module.exports = {
  Review: mongoose.models.Review || mongoose.model('Review', reviewSchema),
  Discussion: mongoose.models.Discussion || mongoose.model('Discussion', discussionSchema),
  DiscussionReply: mongoose.models.DiscussionReply || mongoose.model('DiscussionReply', discussionReplySchema)
};