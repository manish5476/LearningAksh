const express = require('express');
const lessonController = require('../controllers/lessonController');
const authController = require('../controllers/authController');
const { checkValidId } = require('../middlewares/validateId'); // Added

const router = express.Router({ mergeParams: true });

// Apply Parameter Shield 
// (Catches :id, and catches :courseId/:sectionId if passed down from parent routers)
router.param('id', checkValidId);
router.param('courseId', checkValidId);
router.param('sectionId', checkValidId);

// ==========================================
// PUBLIC / STUDENT ROUTES
// ==========================================
router.get('/:id/access', authController.protect, lessonController.getLessonWithDetails);
router.post('/:id/complete', authController.protect, lessonController.markAsCompleted);
router.get('/:id/progress', authController.protect, lessonController.getLessonProgress);

// ==========================================
// PROTECTED INSTRUCTOR/ADMIN ROUTES
// ==========================================
router.use(authController.protect);
router.use(authController.restrictTo('instructor', 'admin'));

router.route('/')
  .post(lessonController.setSectionCourseIds, lessonController.createLesson)
  .get(lessonController.setSectionCourseIds, lessonController.getAllLessons); 

router.patch('/reorder', lessonController.reorderLessons); 

router.route('/:id')
  .get(lessonController.getLesson)
  .patch(lessonController.updateLesson)
  .delete(lessonController.deleteLesson);

// State Management & Uploads
router.patch('/:id/publish', lessonController.publishLesson);
router.patch('/:id/unpublish', lessonController.unpublishLesson);

router.post('/:id/upload-video', lessonController.uploadVideo);
router.post('/:id/upload-attachment', lessonController.uploadAttachment);

module.exports = router;


// const express = require('express');
// const lessonController = require('../controllers/lessonController');
// const authController = require('../controllers/authController');

// // mergeParams: true allows access to /courses/:courseId/sections/:sectionId/lessons
// const router = express.Router({ mergeParams: true });

// // ==========================================
// // PUBLIC / STUDENT ROUTES (With Access Control)
// // ==========================================
// // Students need to be logged in to access lesson details, but we handle the paywall logic inside the controller
// router.get('/:id/access', authController.protect, lessonController.getLessonWithDetails);

// // Student progress endpoints
// router.post('/:id/complete', authController.protect, lessonController.markAsCompleted);
// router.get('/:id/progress', authController.protect, lessonController.getLessonProgress);

// // ==========================================
// // PROTECTED INSTRUCTOR/ADMIN ROUTES
// // ==========================================
// router.use(authController.protect);
// router.use(authController.restrictTo('instructor', 'admin'));

// router
//   .route('/')
//   .post(lessonController.setSectionCourseIds, lessonController.createLesson)
//   .get(lessonController.setSectionCourseIds, lessonController.getAllLessons); // Enforces fetching lessons only for the specific section

// // Reordering uses PATCH now (matching our bulkWrite standard)
// router.patch('/reorder', lessonController.reorderLessons); 

// router
//   .route('/:id')
//   .get(lessonController.getLesson)
//   .patch(lessonController.updateLesson)
//   .delete(lessonController.deleteLesson);

// // State Management & Uploads
// router.patch('/:id/publish', lessonController.publishLesson);
// router.patch('/:id/unpublish', lessonController.unpublishLesson);

// // Placeholder routes for handling actual file uploads (Requires Multer middleware setup later)
// router.post('/:id/upload-video', lessonController.uploadVideo);
// router.post('/:id/upload-attachment', lessonController.uploadAttachment);

// module.exports = router;
