const express = require('express');
const enrollmentController = require('../controllers/enrollmentController');
const authController = require('../controllers/authController');
const { generateCertificate } = require('../controllers/certificateController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// ==========================
// STUDENT ROUTES
// ==========================
router.get('/my-enrollments', enrollmentController.getMyEnrollments);
router.get('/check/:courseId', enrollmentController.checkEnrollment);
router.get('/progress/:courseId', enrollmentController.getEnrollmentProgress);
router.post('/enroll', enrollmentController.enrollStudent);
router.post('/bulk-enroll', enrollmentController.bulkEnroll);
router.patch('/progress/:courseId', enrollmentController.updateLessonProgress);
router.post('/complete/:courseId', enrollmentController.completeCourse);
router.get('/recommendations', enrollmentController.getRecommendedCourses);
router.get('/timeline', enrollmentController.getStudentTimeline);

// Certificate routes
router.get('/:enrollmentId/certificate', generateCertificate);

// ==========================
// INSTRUCTOR ROUTES
// ==========================
router.get('/stats/instructor', authController.restrictTo('instructor', 'admin'), enrollmentController.getInstructorStats);
router.get('/course/:courseId/students', authController.restrictTo('instructor', 'admin'), enrollmentController.getCourseStudents);
router.get('/analytics/:courseId', authController.restrictTo('instructor', 'admin'), enrollmentController.getCourseAnalytics);
router.get('/completion-rate/:courseId', enrollmentController.getCompletionRate);
router.get('/count/:courseId?', enrollmentController.getActiveEnrollmentsCount);
router.post('/remind/:courseId', authController.restrictTo('instructor', 'admin'), enrollmentController.sendReminder);
router.get('/export/course/:courseId', authController.restrictTo('instructor', 'admin'), enrollmentController.exportEnrollments);

// ==========================
// ADMIN ROUTES
// ==========================
router.use(authController.restrictTo('admin'));

// Stats & Analytics
router.get('/stats/admin', enrollmentController.getAdminStats);
router.get('/trends', enrollmentController.getEnrollmentTrends);
router.get('/report', enrollmentController.generateReport);
router.get('/export', enrollmentController.exportAllEnrollments);

// Enrollment management
router.patch('/:id/cancel', enrollmentController.cancelEnrollment);
router.post('/:id/refund', enrollmentController.refundEnrollment);
router.post('/:id/transfer', enrollmentController.transferEnrollment);
router.get('/:id/invoices', enrollmentController.getEnrollmentInvoices);

// CRUD operations
router.route('/')
  .get(enrollmentController.getAllEnrollments);

router.route('/:id')
  .get(enrollmentController.getEnrollment)
  .patch(enrollmentController.updateEnrollment)
  .delete(enrollmentController.deleteEnrollment);

module.exports = router;
// const express = require('express');
// const enrollmentController = require('../controllers/enrollmentController');
// const authController = require('../controllers/authController');

// const router = express.Router();

// // Protect all routes
// router.use(authController.protect);

// // Student routes
// router.get('/my-enrollments', enrollmentController.getMyEnrollments);
// router.post('/enroll', enrollmentController.enrollStudent);

// // Instructor/Admin routes
// router.get('/course/:courseId/students', enrollmentController.getCourseStudents);
// router.patch('/:id/revoke', enrollmentController.revokeEnrollment);

// // Admin only routes
// router.use(authController.restrictTo('admin'));
// router.route('/')
//   .get(enrollmentController.getAllEnrollments);

// router.route('/:id')
//   .get(enrollmentController.getEnrollment);

// module.exports = router;