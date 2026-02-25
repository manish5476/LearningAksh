const express = require('express');
const enrollmentController = require('../controllers/enrollmentController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Student routes
router.get('/my-enrollments', enrollmentController.getMyEnrollments);
router.post('/enroll', enrollmentController.enrollStudent);

// Instructor/Admin routes
router.get('/course/:courseId/students', enrollmentController.getCourseStudents);
router.patch('/:id/revoke', enrollmentController.revokeEnrollment);

// Admin only routes
router.use(authController.restrictTo('admin'));
router.route('/')
  .get(enrollmentController.getAllEnrollments);

router.route('/:id')
  .get(enrollmentController.getEnrollment);

module.exports = router;