const express = require('express');
const enrollmentController = require('../controllers/enrollmentController');
const authController = require('../controllers/authController');
const { checkValidId } = require('../middlewares/validateId'); // Added

const router = express.Router();

// Apply Parameter Shield
router.param('id', checkValidId);
router.param('courseId', checkValidId);

// Protect all routes (User must be logged in)
router.use(authController.protect);

// ==========================================
// 1. STATIC ROUTES
// ==========================================
router.get('/recommendations', enrollmentController.getRecommendedCourses);
router.get('/timeline', enrollmentController.getStudentTimeline);
router.post('/bulk-enroll', enrollmentController.bulkEnroll);
router.get('/stats/instructor', authController.restrictTo('instructor', 'admin'), enrollmentController.getInstructorStats);
router.get('/stats/admin', authController.restrictTo('admin'), enrollmentController.getAdminStats);
router.get('/trends', authController.restrictTo('admin'), enrollmentController.getEnrollmentTrends);
router.get('/report', authController.restrictTo('admin'), enrollmentController.generateReport);
router.get('/export-all', authController.restrictTo('admin'), enrollmentController.exportAllEnrollments);

// ==========================================
// 2. DYNAMIC COURSE ROUTES (/:courseId)
// ==========================================
router.get('/check/:courseId', enrollmentController.checkEnrollment);
router.get('/progress/:courseId', enrollmentController.getEnrollmentProgress);
router.patch('/progress/:courseId', enrollmentController.updateLessonProgress);
router.post('/complete/:courseId', enrollmentController.completeCourse);
router.use('/course/:courseId/students', authController.restrictTo('instructor', 'admin'), enrollmentController.getCourseStudents);
router.get('/analytics/:courseId', authController.restrictTo('instructor', 'admin'), enrollmentController.getCourseAnalytics);
router.get('/completion-rate/:courseId', enrollmentController.getCompletionRate);
router.get('/count/:courseId?', enrollmentController.getActiveEnrollmentsCount); // Shield handles optional params too!
router.post('/remind/:courseId', authController.restrictTo('instructor', 'admin'), enrollmentController.sendReminder);
router.get('/export/course/:courseId', authController.restrictTo('instructor', 'admin'), enrollmentController.exportEnrollments);

router.post('/enroll', enrollmentController.enrollStudent);
router.get('/my-enrollments', authController.protect, enrollmentController.getMyEnrollments);
router.post('/:id/enroll', authController.protect, enrollmentController.enrollInCourse);

// ==========================================
// 3. DYNAMIC ENROLLMENT ID ROUTES (/:id)
// ==========================================
router.use(authController.restrictTo('admin'));

router.patch('/:id/cancel', enrollmentController.cancelEnrollment);
router.post('/:id/refund', enrollmentController.refundEnrollment);
router.post('/:id/transfer', enrollmentController.transferEnrollment);
router.get('/:id/invoices', enrollmentController.getEnrollmentInvoices);

router.route('/').get(enrollmentController.getAllEnrollments);

router.route('/:id')
  .get(enrollmentController.getEnrollment)
  .patch(enrollmentController.updateEnrollment)
  .delete(enrollmentController.deleteEnrollment);

module.exports = router;


// const express = require('express');
// const enrollmentController = require('../controllers/enrollmentController');
// const authController = require('../controllers/authController');
// // const { generateCertificate } = require('../controllers/certificateController'); 

// const router = express.Router();

// // Protect all routes (User must be logged in)
// router.use(authController.protect);

// // ==========================================
// // 1. STATIC ROUTES (Must go first to prevent Express parameter swallowing)
// // ==========================================

// // --- Student ---
// // router.get('/my-enrollments', enrollmentController.getMyEnrollments);
// router.get('/recommendations', enrollmentController.getRecommendedCourses);
// router.get('/timeline', enrollmentController.getStudentTimeline);
// // router.post('/enroll-free', enrollmentController.enrollInFreeCourse); // Updated to match secure controller
// router.post('/bulk-enroll', enrollmentController.bulkEnroll);

// // --- Instructor ---
// router.get('/stats/instructor', authController.restrictTo('instructor', 'admin'), enrollmentController.getInstructorStats);

// // --- Admin ---
// router.get('/stats/admin', authController.restrictTo('admin'), enrollmentController.getAdminStats);
// router.get('/trends', authController.restrictTo('admin'), enrollmentController.getEnrollmentTrends);
// router.get('/report', authController.restrictTo('admin'), enrollmentController.generateReport);
// router.get('/export-all', authController.restrictTo('admin'), enrollmentController.exportAllEnrollments);

// // ==========================================
// // 2. DYNAMIC COURSE ROUTES (/:courseId)
// // ==========================================

// // --- Student Progress & Access ---
// router.get('/check/:courseId', enrollmentController.checkEnrollment);
// router.get('/progress/:courseId', enrollmentController.getEnrollmentProgress);
// router.patch('/progress/:courseId', enrollmentController.updateLessonProgress);
// router.post('/complete/:courseId', enrollmentController.completeCourse);

// // --- Instructor Analytics ---
// router.use('/course/:courseId/students', authController.restrictTo('instructor', 'admin'), enrollmentController.getCourseStudents);
// router.get('/analytics/:courseId', authController.restrictTo('instructor', 'admin'), enrollmentController.getCourseAnalytics);
// router.get('/completion-rate/:courseId', enrollmentController.getCompletionRate);
// router.get('/count/:courseId?', enrollmentController.getActiveEnrollmentsCount);
// router.post('/remind/:courseId', authController.restrictTo('instructor', 'admin'), enrollmentController.sendReminder);
// router.get('/export/course/:courseId', authController.restrictTo('instructor', 'admin'), enrollmentController.exportEnrollments);

// router.post('/enroll', enrollmentController.enrollStudent);
// // Get all courses the current user is enrolled in
// router.get('/my-enrollments', authController.protect, enrollmentController.getMyEnrollments);
// // Enroll in a specific course
// router.post('/:id/enroll', authController.protect, enrollmentController.enrollInCourse);
// // ==========================================
// // 3. DYNAMIC ENROLLMENT ID ROUTES (/:id)
// // ==========================================

// // Certificate generation (Placeholder for now)
// // router.get('/:id/certificate', generateCertificate);

// // --- Admin Only Operations ---
// router.use(authController.restrictTo('admin'));

// // Management endpoints
// router.patch('/:id/cancel', enrollmentController.cancelEnrollment);
// router.post('/:id/refund', enrollmentController.refundEnrollment);
// router.post('/:id/transfer', enrollmentController.transferEnrollment);
// router.get('/:id/invoices', enrollmentController.getEnrollmentInvoices);

// // Standard Factory CRUD
// router.route('/').get(enrollmentController.getAllEnrollments);

// router.route('/:id')
//   .get(enrollmentController.getEnrollment)
//   .patch(enrollmentController.updateEnrollment)
//   .delete(enrollmentController.deleteEnrollment);

// module.exports = router;

