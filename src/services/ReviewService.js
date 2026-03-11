'use strict';
const AppError = require('../utils/appError');
const ReviewRepository = require('../repositories/ReviewRepository');
const CourseRepository = require('../repositories/CourseRepository');
const EnrollmentRepository = require('../repositories/EnrollmentRepository');

class ReviewService {

  async createReview(userId, userRole, data) {
    // 1. Verify Enrollment
    const enrollment = await EnrollmentRepository.findOne({
      student: userId,
      course: data.course,
      isActive: true
    });
    
    if (!enrollment && userRole !== 'admin') {
      throw new AppError('You can only review courses you are enrolled in', 403);
    }

    // 2. Prevent Duplicate Reviews
    const existing = await ReviewRepository.findOne({ user: userId, course: data.course });
    if (existing) throw new AppError('You have already reviewed this course', 400);

    data.user = userId;
    data.isVerified = !!enrollment;

    const review = await ReviewRepository.create(data);

    // Note: The static method on the Review model (which we'll define) 
    // should handle updating the Course's averageRating automatically.
    return review;
  }

  async replyToReview(instructorId, userRole, reviewId, comment) {
    if (!comment) throw new AppError('Reply comment is required', 400);

    const review = await ReviewRepository.findById(reviewId, ['course']);
    if (!review) throw new AppError('No review found', 404);

    // Security Check
    const course = await CourseRepository.findById(review.course);
    if (course.instructor.toString() !== instructorId.toString() && userRole !== 'admin') {
      throw new AppError('Only the course instructor can reply to reviews', 403);
    }

    return await ReviewRepository.updateById(reviewId, {
      replyFromInstructor: { comment, repliedAt: Date.now() }
    });
  }

  async toggleHelpful(reviewId) {
    // Use atomic increment to prevent race conditions
    return await ReviewRepository.model.findByIdAndUpdate(
      reviewId,
      { $inc: { helpfulCount: 1 } },
      { new: true }
    );
  }

  async getCourseReviewsWithStats(courseId) {
    const reviews = await ReviewRepository.model.find({ course: courseId, isApproved: true })
      .populate('user', 'firstName lastName profilePicture')
      .sort('-createdAt')
      .lean();

    // Instead of aggregating here, we normally pull from Course document.
    // But for this service call, we'll provide a clean summary.
    const course = await CourseRepository.findById(courseId);
    
    return {
      reviews,
      stats: {
        averageRating: course.averageRating || 0,
        totalReviews: course.totalReviews || 0
      }
    };
  }
}

module.exports = new ReviewService();

// 'use strict';
// const AppError = require('../utils/appError');
// const ReviewRepository = require('../repositories/ReviewRepository');
// const EnrollmentRepository = require('../repositories/EnrollmentRepository');
// const CourseRepository = require('../repositories/CourseRepository');

// class ReviewService {
  
//   async addReview(studentId, courseId, reviewData) {
//     // 1. Business Rule: Must be actively enrolled to review
//     const enrollment = await EnrollmentRepository.findOne({ student: studentId, course: courseId });
//     if (!enrollment || !enrollment.isActive) {
//       throw new AppError('You must be enrolled in this course to leave a review.', 403);
//     }

//     // 2. Business Rule: One review per user per course (Handled by DB index, but good to check)
//     const existingReview = await ReviewRepository.findOne({ user: studentId, course: courseId });
//     if (existingReview) {
//       throw new AppError('You have already reviewed this course. You can update your existing review instead.', 400);
//     }

//     // 3. Create Review
//     const review = await ReviewRepository.create({
//       user: studentId,
//       course: courseId,
//       rating: reviewData.rating,
//       comment: reviewData.comment
//     });

//     // 4. Update Course Aggregates asynchronously (Do not block the response)
//     this.updateCourseRating(courseId).catch(err => console.error('Rating Update Failed:', err));

//     return review;
//   }

//   async updateCourseRating(courseId) {
//     const stats = await ReviewRepository.calculateAverageRating(courseId);
    
//     // Round to 1 decimal place (e.g., 4.5)
//     const roundedRating = Math.round(stats.rating * 10) / 10;
    
//     await CourseRepository.updateById(courseId, {
//       rating: roundedRating,
//       totalReviews: stats.totalReviews
//     });
//   }
// }

// module.exports = new ReviewService();