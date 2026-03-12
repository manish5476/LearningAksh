const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const authController = require('../controllers/authController');

// 1. IMPORT THE MIDDLEWARE
const { checkValidId } = require('../middlewares/validateId'); 

const router = express.Router();

/* =========================================================
PARAMETER VALIDATION SHIELD
========================================================= */
// 2. PROTECT THE PARAMS
// This automatically validates any route using :instructorId or :studentId
router.param('instructorId', checkValidId);
router.param('studentId', checkValidId);


// Protect all routes
router.use(authController.protect);

// Instructor routes
router.get('/instructor', analyticsController.getInstructorAnalytics);
router.get('/instructor/:instructorId', analyticsController.getInstructorAnalytics); // Protected!

// Student routes
router.get('/student', analyticsController.getStudentAnalytics);
router.get('/student/:studentId', analyticsController.getStudentAnalytics); // Protected!

// Admin only routes
router.use(authController.restrictTo('admin'));
router.get('/platform', analyticsController.getPlatformStats);
router.get('/revenue', analyticsController.getRevenueAnalytics);
router.get('/engagement', analyticsController.getEngagementAnalytics);

module.exports = router;

// const express = require('express');
// const analyticsController = require('../controllers/analyticsController');
// const authController = require('../controllers/authController');

// const router = express.Router();

// // Protect all routes
// router.use(authController.protect);

// // Instructor routes
// router.get('/instructor', analyticsController.getInstructorAnalytics);
// router.get('/instructor/:instructorId', analyticsController.getInstructorAnalytics);

// // Student routes
// router.get('/student', analyticsController.getStudentAnalytics);
// router.get('/student/:studentId', analyticsController.getStudentAnalytics);

// // Admin only routes
// router.use(authController.restrictTo('admin'));
// router.get('/platform', analyticsController.getPlatformStats);
// router.get('/revenue', analyticsController.getRevenueAnalytics);
// router.get('/engagement', analyticsController.getEngagementAnalytics);

// module.exports = router;