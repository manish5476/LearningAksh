const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const authController = require('../controllers/authController');
const authMiddleWare= require('../middlewares/authMiddleware');

const router = express.Router();

// Protect all routes
router.use(authMiddleWare.protect);

// Instructor routes
router.get('/instructor', analyticsController.getInstructorAnalytics);
router.get('/instructor/:instructorId', analyticsController.getInstructorAnalytics);

// Student routes
router.get('/student', analyticsController.getStudentAnalytics);
router.get('/student/:studentId', analyticsController.getStudentAnalytics);

// Admin only routes
router.use(authController.restrictTo('admin'));
router.get('/platform', analyticsController.getPlatformStats);
router.get('/revenue', analyticsController.getRevenueAnalytics);
router.get('/engagement', analyticsController.getEngagementAnalytics);

module.exports = router;