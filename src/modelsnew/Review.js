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

reviewSchema.statics.calcAverageRatings = async function(courseId) {
  const stats = await this.aggregate([
    { $match: { course: courseId } },
    { $group: { _id: '$course', rating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } }
  ]);

  const Course = mongoose.model('Course');
  if (stats.length > 0) {
    await Course.findByIdAndUpdate(courseId, { 
      rating: Math.round(stats[0].rating * 10) / 10,
      totalReviews: stats[0].totalReviews 
    });
  } else {
    await Course.findByIdAndUpdate(courseId, { rating: 0, totalReviews: 0 });
  }
};

reviewSchema.post('save', function() {
  this.constructor.calcAverageRatings(this.course);
});

reviewSchema.post(/^findOneAnd/, async function(doc) {
  if (doc) {
    await doc.constructor.calcAverageRatings(doc.course);
  }
});

reviewSchema.index({ course: 1, user: 1 }, { unique: true });
module.exports = mongoose.model('Review', reviewSchema);