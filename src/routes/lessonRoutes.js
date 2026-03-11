const express = require('express');
const lessonController = require('../controllers/lessonController');
const authMiddleWare= require('../middlewares/authMiddleware');

// mergeParams: true allows access to /courses/:courseId/sections/:sectionId/lessons
const router = express.Router({ mergeParams: true });

// ==========================================
// PUBLIC / STUDENT ROUTES (With Access Control)
// ==========================================
// Students need to be logged in to access lesson details, but we handle the paywall logic inside the controller
router.get('/:id/access', authMiddleWare.protect, lessonController.getLessonWithDetails);

// Student progress endpoints
router.post('/:id/complete', authMiddleWare.protect, lessonController.markAsCompleted);
router.get('/:id/progress', authMiddleWare.protect, lessonController.getLessonProgress);

// ==========================================
// PROTECTED INSTRUCTOR/ADMIN ROUTES
// ==========================================
router.use(authMiddleWare.protect);

router.use(authMiddleWare.restrictTo('instructor', 'admin'));

router
  .route('/')
  .post( lessonController.createLesson)//lessonController.setSectionCourseIds,  // lessonController.setSectionCourseIds,
  .get( lessonController.getAllLessons); // Enforces fetching lessons only for the specific section

// Reordering uses PATCH now (matching our bulkWrite standard)
router.patch('/reorder', lessonController.reorderLessons); 

router
  .route('/:id')
  .get(lessonController.getLesson)
  .patch(lessonController.updateLesson)
  .delete(lessonController.deleteLesson);

// State Management & Uploads
router.patch('/:id/publish', lessonController.publishLesson);
router.patch('/:id/unpublish', lessonController.unpublishLesson);

// Placeholder routes for handling actual file uploads (Requires Multer middleware setup later)
router.post('/:id/upload-video', lessonController.uploadVideo);
router.post('/:id/upload-attachment', lessonController.uploadAttachment);

module.exports = router;
