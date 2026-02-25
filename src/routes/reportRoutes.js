const express = require('express');
const reportController = require('../controllers/reportController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);
router.use(authController.restrictTo('admin', 'instructor'));

// Report generation routes
router.get('/course/:courseId', reportController.generateCourseReport);
router.get('/instructor/:instructorId', reportController.generateInstructorReport);
router.get('/platform', reportController.generatePlatformReport);
router.post('/custom', reportController.generateCustomReport);

module.exports = router;