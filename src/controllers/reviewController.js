'use strict';
const catchAsync = require('../utils/catchAsync');
const ReviewService = require('../services/ReviewService');
const ReviewRepository = require('../repositories/ReviewRepository');

exports.createReview = catchAsync(async (req, res, next) => {
  const review = await ReviewService.createReview(req.user.id, req.user.role, req.body);
  res.status(201).json({ status: 'success', data: { review } });
});

exports.replyToReview = catchAsync(async (req, res, next) => {
  const review = await ReviewService.replyToReview(req.user.id, req.user.role, req.params.id, req.body.comment);
  res.status(200).json({ status: 'success', data: { review } });
});

exports.markHelpful = catchAsync(async (req, res, next) => {
  const review = await ReviewService.toggleHelpful(req.params.id);
  res.status(200).json({ status: 'success', data: { helpfulCount: review.helpfulCount } });
});

exports.getCourseReviews = catchAsync(async (req, res, next) => {
  const data = await ReviewService.getCourseReviewsWithStats(req.params.courseId);
  res.status(200).json({ status: 'success', results: data.reviews.length, data });
});

// Admin/Standard CRUD
exports.getAllReviews = catchAsync(async (req, res, next) => {
  const result = await ReviewRepository.findMany(req.query);
  res.status(200).json({ status: 'success', results: result.results, data: { reviews: result.data } });
});

exports.deleteReview = catchAsync(async (req, res, next) => {
  await ReviewRepository.deleteById(req.params.id);
  res.status(204).json({ status: 'success', data: null });
});


// const { Review, Course } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');

// exports.setCourseUserIds = (req, res, next) => {
//   if (!req.body.course) req.body.course = req.params.courseId;
//   if (!req.body.user) req.body.user = req.user.id;
//   next();
// };

// exports.createReview = catchAsync(async (req, res, next) => {
//   // Check if user has taken the course
//   const { Enrollment } = require('../models');
//   const enrollment = await Enrollment.findOne({
//     student: req.user.id,
//     course: req.body.course,
//     isActive: true
//   });
  
//   if (!enrollment && req.user.role !== 'admin') {
//     return next(new AppError('You can only review courses you are enrolled in', 403));
//   }
  
//   // Check if already reviewed
//   const existingReview = await Review.findOne({
//     user: req.user.id,
//     course: req.body.course
//   });
  
//   if (existingReview) {
//     return next(new AppError('You have already reviewed this course', 400));
//   }
  
//   // Set verified status
//   req.body.isVerified = !!enrollment;
  
//   const review = await Review.create(req.body);
  
//   res.status(201).json({
//     status: 'success',
//     data: { review }
//   });
// });

// exports.replyToReview = catchAsync(async (req, res, next) => {
//   const { comment } = req.body;
  
//   if (!comment) {
//     return next(new AppError('Reply comment is required', 400));
//   }
  
//   const review = await Review.findById(req.params.id).populate('course');
  
//   if (!review) {
//     return next(new AppError('No review found with that ID', 404));
//   }
  
//   // Check if user is instructor of the course
//   if (review.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
//     return next(new AppError('Only the course instructor can reply to reviews', 403));
//   }
  
//   review.replyFromInstructor = {
//     comment,
//     repliedAt: Date.now()
//   };
  
//   await review.save();
  
//   res.status(200).json({
//     status: 'success',
//     data: { review }
//   });
// });

// exports.markHelpful = catchAsync(async (req, res, next) => {
//   const review = await Review.findById(req.params.id);
  
//   if (!review) {
//     return next(new AppError('No review found with that ID', 404));
//   }
  
//   // Increment helpful count
//   review.helpfulCount += 1;
//   await review.save();
  
//   res.status(200).json({
//     status: 'success',
//     data: { helpfulCount: review.helpfulCount }
//   });
// });

// exports.getCourseReviews = catchAsync(async (req, res, next) => {
//   const reviews = await Review.find({ 
//     course: req.params.courseId,
//     isApproved: true
//   })
//   .populate('user', 'firstName lastName profilePicture')
//   .sort('-createdAt');
  
//   // Calculate statistics
//   const stats = await Review.aggregate([
//     { $match: { course: review[0]?.course } },
//     { $group: {
//       _id: null,
//       averageRating: { $avg: '$rating' },
//       totalReviews: { $sum: 1 },
//       ratingCounts: {
//         $push: {
//           rating: '$rating',
//           count: 1
//         }
//       }
//     }}
//   ]);
  
//   res.status(200).json({
//     status: 'success',
//     results: reviews.length,
//     data: {
//       reviews,
//       stats: stats[0] || { averageRating: 0, totalReviews: 0 }
//     }
//   });
// });

// // CRUD operations
// exports.getAllReviews = factory.getAll(Review);
// exports.getReview = factory.getOne(Review);
// exports.updateReview = factory.updateOne(Review);
// exports.deleteReview = factory.deleteOne(Review);