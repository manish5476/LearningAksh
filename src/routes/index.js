const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const courseRoutes = require('./courseRoutes');
const sectionRoutes = require('./sectionRoutes');
const lessonRoutes = require('./lessonRoutes');
const categoryRoutes = require('./categoryRoutes');
const enrollmentRoutes = require('./enrollmentRoutes');
const reviewRoutes = require('./reviewRoutes');
const quizRoutes = require('./quizRoutes');
const assignmentRoutes = require('./assignmentRoutes');
const codingExerciseRoutes = require('./codingExerciseRoutes');
const mockTestRoutes = require('./mockTestRoutes');
const progressRoutes = require('./progressRoutes');
const certificateRoutes = require('./certificateRoutes');
const notificationRoutes = require('./notificationRoutes');
const paymentRoutes = require('./paymentRoutes');
const discussionRoutes = require('./discussionRoutes');

// NEW ROUTES
const couponRoutes = require('./couponRoutes');
const announcementRoutes = require('./announcementRoutes');
const cohortRoutes = require('./cohortRoutes');
const badgeRoutes = require('./badgeRoutes');
const learningPathRoutes = require('./learningPathRoutes');
const liveSessionRoutes = require('./liveSessionRoutes');
const studentNoteRoutes = require('./studentNoteRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const reportRoutes = require('./reportRoutes');
const importExportRoutes = require('./importExportRoutes');

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'EdTech Platform API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0'
  });
});

// API version and info
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      name: 'EdTech Platform API',
      version: '2.0.0',
      documentation: '/api/v1/docs',
      endpoints: {
        auth: '/api/v1/auth',
        users: '/api/v1/users',
        courses: '/api/v1/courses',
        categories: '/api/v1/categories',
        enrollments: '/api/v1/enrollments',
        reviews: '/api/v1/reviews',
        quizzes: '/api/v1/quizzes',
        assignments: '/api/v1/assignments',
        coding: '/api/v1/coding-exercises',
        mocktests: '/api/v1/mock-tests',
        progress: '/api/v1/progress',
        certificates: '/api/v1/certificates',
        notifications: '/api/v1/notifications',
        payments: '/api/v1/payments',
        discussions: '/api/v1/discussions',
        coupons: '/api/v1/coupons',
        announcements: '/api/v1/announcements',
        cohorts: '/api/v1/cohorts',
        badges: '/api/v1/badges',
        learningPaths: '/api/v1/learning-paths',
        liveSessions: '/api/v1/live-sessions',
        notes: '/api/v1/notes',
        analytics: '/api/v1/analytics',
        reports: '/api/v1/reports',
        importExport: '/api/v1/import-export'
      }
    }
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/courses', courseRoutes);
router.use('/sections', sectionRoutes);
router.use('/lessons', lessonRoutes);
router.use('/categories', categoryRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/reviews', reviewRoutes);
router.use('/quizzes', quizRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/coding-exercises', codingExerciseRoutes);
router.use('/mock-tests', mockTestRoutes);
router.use('/progress', progressRoutes);
router.use('/certificates', certificateRoutes);
router.use('/notifications', notificationRoutes);
router.use('/payments', paymentRoutes);
router.use('/discussions', discussionRoutes);

// NEW ROUTES
router.use('/coupons', couponRoutes);
router.use('/announcements', announcementRoutes);
router.use('/cohorts', cohortRoutes);
router.use('/badges', badgeRoutes);
router.use('/learning-paths', learningPathRoutes);
router.use('/live-sessions', liveSessionRoutes);
router.use('/notes', studentNoteRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/reports', reportRoutes);
router.use('/import-export', importExportRoutes);

module.exports = router;



// const express = require('express');
// const router = express.Router();

// // Import all route modules
// const authRoutes = require('./authRoutes');
// const userRoutes = require('./userRoutes');
// const courseRoutes = require('./courseRoutes');
// const sectionRoutes = require('./sectionRoutes');
// const lessonRoutes = require('./lessonRoutes');
// const categoryRoutes = require('./categoryRoutes');
// const enrollmentRoutes = require('./enrollmentRoutes');
// const reviewRoutes = require('./reviewRoutes');
// const quizRoutes = require('./quizRoutes');
// const assignmentRoutes = require('./assignmentRoutes');
// const codingExerciseRoutes = require('./codingExerciseRoutes');
// const mockTestRoutes = require('./mockTestRoutes');
// const progressRoutes = require('./progressRoutes');
// const certificateRoutes = require('./certificateRoutes');
// const notificationRoutes = require('./notificationRoutes');
// const paymentRoutes = require('./paymentRoutes');
// const discussionRoutes = require('./discussionRoutes');

// // Health check endpoint
// router.get('/health', (req, res) => {
//   res.status(200).json({
//     status: 'success',
//     message: 'EdTech Platform API is running',
//     timestamp: new Date().toISOString(),
//     environment: process.env.NODE_ENV || 'development'
//   });
// });

// // API version and info
// router.get('/', (req, res) => {
//   res.status(200).json({
//     status: 'success',
//     data: {
//       name: 'EdTech Platform API',
//       version: '1.0.0',
//       documentation: '/api/v1/docs',
//       endpoints: {
//         auth: '/api/v1/auth',
//         users: '/api/v1/users',
//         courses: '/api/v1/courses',
//         categories: '/api/v1/categories',
//         enrollments: '/api/v1/enrollments',
//         reviews: '/api/v1/reviews',
//         quizzes: '/api/v1/quizzes',
//         assignments: '/api/v1/assignments',
//         coding: '/api/v1/coding-exercises',
//         mocktests: '/api/v1/mock-tests',
//         progress: '/api/v1/progress',
//         certificates: '/api/v1/certificates',
//         notifications: '/api/v1/notifications',
//         payments: '/api/v1/payments',
//         discussions: '/api/v1/discussions'
//       }
//     }
//   });
// });

// // Mount routes
// router.use('/auth', authRoutes);
// router.use('/users', userRoutes);
// router.use('/courses', courseRoutes);
// router.use('/sections', sectionRoutes);
// router.use('/lessons', lessonRoutes);
// router.use('/categories', categoryRoutes);
// router.use('/enrollments', enrollmentRoutes);
// router.use('/reviews', reviewRoutes);
// router.use('/quizzes', quizRoutes);
// router.use('/assignments', assignmentRoutes);
// router.use('/coding-exercises', codingExerciseRoutes);
// router.use('/mock-tests', mockTestRoutes);
// router.use('/progress', progressRoutes);
// router.use('/certificates', certificateRoutes);
// router.use('/notifications', notificationRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/discussions', discussionRoutes);

// module.exports = router;
// // const express = require('express');
// // const router = express.Router();

// // // Import route modules
// // const userRoutes = require('./userRoutes');
// // const authRoutes = require('./authRoutes');
// // const courseRoutes = require('./courseRoutes');
// // const sectionRoutes = require('./sectionRoutes');
// // const lessonRoutes = require('./lessonRoutes');
// // const categoryRoutes = require('./categoryRoutes');
// // const enrollmentRoutes = require('./enrollmentRoutes');
// // const reviewRoutes = require('./reviewRoutes');
// // const quizRoutes = require('./quizRoutes');
// // const assignmentRoutes = require('./assignmentRoutes');

// // // Health check endpoint
// // router.get('/health', (req, res) => {
// //   res.status(200).json({
// //     status: 'success',
// //     message: 'Server is running',
// //     timestamp: new Date().toISOString()
// //   });
// // });

// // // Mount routes
// // router.use('/auth', authRoutes);
// // router.use('/users', userRoutes);
// // router.use('/courses', courseRoutes);
// // router.use('/sections', sectionRoutes);
// // router.use('/lessons', lessonRoutes);
// // router.use('/categories', categoryRoutes);
// // router.use('/enrollments', enrollmentRoutes);
// // router.use('/reviews', reviewRoutes);
// // router.use('/quizzes', quizRoutes);
// // router.use('/assignments', assignmentRoutes);

// // module.exports = router;