const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  
  replyFromInstructor: { comment: String, repliedAt: Date },
  isApproved: { type: Boolean, default: true }
}, { timestamps: true });

reviewSchema.statics.calcAverageRatings = async function(courseId) {
  const stats = await this.aggregate([
    { $match: { course: courseId } },
    { $group: { _id: '$course', nRating: { $sum: 1 }, avgRating: { $avg: '$rating' } } }
  ]);

  if (stats.length > 0) {
    await mongoose.model('Course').findByIdAndUpdate(courseId, {
      totalReviews: stats[0].nRating,
      averageRating: stats[0].avgRating
    });
  }
};

// Update stats after every save/delete
reviewSchema.post('save', function() {
  this.constructor.calcAverageRatings(this.course);
});
// A user can only leave one review per course
reviewSchema.index({ course: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);