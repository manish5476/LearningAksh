const express = require('express');
const reviewController = require('../controllers/reviewController');
const authController = require('../controllers/authController');

const router = express.Router({ mergeParams: true });

// Public routes
router.get('/course/:courseId', reviewController.getCourseReviews);

// Protect all routes after this middleware
router.use(authController.protect);

// Review operations
router.post('/course/:courseId', 
  reviewController.setCourseUserIds, 
  reviewController.createReview
);

router.post('/:id/reply', reviewController.replyToReview);
router.post('/:id/helpful', reviewController.markHelpful);

// CRUD operations with ownership checks
router.route('/:id')
  .get(reviewController.getReview)
  .patch(reviewController.updateReview)
  .delete(reviewController.deleteReview);

// Admin only
router.use(authController.restrictTo('admin'));
router.route('/')
  .get(reviewController.getAllReviews);

module.exports = router;