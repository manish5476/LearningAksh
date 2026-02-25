const express = require('express');
const lessonController = require('../controllers/lessonController');
const authController = require('../controllers/authController');

const router = express.Router({ mergeParams: true });

// Public route for accessing lesson content (with access control)
router.get('/:id/access', authController.protect, lessonController.getLessonWithDetails);

// Protect all routes
router.use(authController.protect);

router
  .route('/')
  .post(lessonController.setSectionCourseIds, lessonController.createLesson)
  .get(lessonController.getAllLessons);

router.post('/reorder/:sectionId', lessonController.reorderLessons);

router
  .route('/:id')
  .get(lessonController.getLesson)
  .patch(lessonController.updateLesson)
  .delete(lessonController.deleteLesson);

module.exports = router;