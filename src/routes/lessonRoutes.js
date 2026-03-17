// routes/lessonRoutes.js (Updated with Publish/Unpublish)
const express = require('express');
const lessonController = require('../controllers/lessonController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

const router = express.Router({ mergeParams: true });

// ==================== PUBLIC ROUTES ====================
router.get('/section/:sectionId', lessonController.getSectionLessons);
router.get('/course/:courseId/free', lessonController.getFreeLessons);
router.get('/instructor/:instructorId', lessonController.getLessonsByInstructor);
router.get('/:id', lessonController.getLesson);
router.get('/', lessonController.getAllLessons);

// ==================== PROTECTED ROUTES ====================
router.use(protect);

// Create lesson
router.post('/',
  restrictTo('instructor', 'admin'),
  lessonController.setSectionCourseIds,
  lessonController.validateAndSetCourse,
  lessonController.validateLessonData,
  lessonController.getMaxOrder,
  lessonController.setCreatorInfo,
  lessonController.createLesson
);

// Update lesson
router.patch('/:id',
  restrictTo('instructor', 'admin'),
  lessonController.checkLessonPermission,
  lessonController.validateLessonData,
  lessonController.setCreatorInfo,
  lessonController.updateLesson
);

// ==================== PUBLISH/UNPUBLISH ROUTES ====================
router.patch('/:id/publish',
  restrictTo('instructor', 'admin'),
  lessonController.checkPublishPermission,
  lessonController.publishLesson
);

router.patch('/:id/unpublish',
  restrictTo('instructor', 'admin'),
  lessonController.checkPublishPermission,
  lessonController.unpublishLesson
);

router.patch('/:id/toggle-publish',
  restrictTo('instructor', 'admin'),
  lessonController.checkPublishPermission,
  lessonController.togglePublishStatus
);

// ==================== BULK PUBLISH/UNPUBLISH ====================
router.post('/bulk/publish',
  restrictTo('instructor', 'admin'),
  lessonController.bulkPublishLessons
);

router.post('/bulk/unpublish',
  restrictTo('instructor', 'admin'),
  lessonController.bulkUnpublishLessons
);

// ==================== LESSON MANAGEMENT ====================
router.patch('/reorder/:sectionId',
  restrictTo('instructor', 'admin'),
  lessonController.reorderLessons
);

router.post('/:id/duplicate',
  restrictTo('instructor', 'admin'),
  lessonController.checkLessonPermission,
  lessonController.duplicateLesson
);

router.patch('/bulk/update-durations/:sectionId',
  restrictTo('instructor', 'admin'),
  lessonController.bulkUpdateDurations
);

// ==================== DELETE/RESTORE ====================
router.delete('/:id',
  restrictTo('instructor', 'admin'),
  lessonController.checkLessonPermission,
  lessonController.deleteLesson
);

router.patch('/:id/restore',
  restrictTo('admin'),
  lessonController.restoreLesson
);

// ==================== BULK OPERATIONS ====================
router.post('/bulk/create',
  restrictTo('admin'),
  lessonController.bulkCreateLessons
);

router.patch('/bulk/update',
  restrictTo('admin'),
  lessonController.bulkUpdateLessons
);

router.delete('/bulk/delete',
  restrictTo('admin'),
  lessonController.bulkDeleteLessons
);

router.get('/count/total', lessonController.countLessons);

module.exports = router;










// const express = require('express');
// const lessonController = require('../controllers/lessonController');
// const authController = require('../controllers/authController');
// const { checkValidId } = require('../middlewares/validateId'); // Added

// const router = express.Router({ mergeParams: true });

// // Apply Parameter Shield 
// // (Catches :id, and catches :courseId/:sectionId if passed down from parent routers)
// router.param('id', checkValidId);
// router.param('courseId', checkValidId);
// router.param('sectionId', checkValidId);

// // ==========================================
// // PUBLIC / STUDENT ROUTES
// // ==========================================
// router.get('/:id/access', authController.protect, lessonController.getLessonWithDetails);
// router.post('/:id/complete', authController.protect, lessonController.markAsCompleted);
// router.get('/:id/progress', authController.protect, lessonController.getLessonProgress);

// // ==========================================
// // PROTECTED INSTRUCTOR/ADMIN ROUTES
// // ==========================================
// router.use(authController.protect);
// router.use(authController.restrictTo('instructor', 'admin'));

// router.route('/')
//   .post(lessonController.setSectionCourseIds, lessonController.createLesson)
//   .get(lessonController.setSectionCourseIds, lessonController.getAllLessons); 

// router.patch('/reorder', lessonController.reorderLessons); 

// router.route('/:id')
//   .get(lessonController.getLesson)
//   .patch(lessonController.updateLesson)
//   .delete(lessonController.deleteLesson);

// // State Management & Uploads
// router.patch('/:id/publish', lessonController.publishLesson);
// router.patch('/:id/unpublish', lessonController.unpublishLesson);

// router.post('/:id/upload-video', lessonController.uploadVideo);
// router.post('/:id/upload-attachment', lessonController.uploadAttachment);

// module.exports = router;
