// routes/sectionRoutes.js (Updated with Publish/Unpublish)
const express = require('express');
const sectionController = require('../controllers/sectionController');
const lessonRouter = require('./lessonRoutes');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

const router = express.Router({ mergeParams: true });

// ==================== NESTED ROUTES ====================
router.use('/:sectionId/lessons', lessonRouter);

// ==================== PUBLIC ROUTES ====================
router.get('/course/:courseId', sectionController.getCourseSections);
router.get('/:id/with-lessons', sectionController.getSectionWithLessons);
router.get('/:id', sectionController.getSection);
router.get('/', sectionController.getAllSections);

// ==================== PROTECTED ROUTES ====================
router.use(protect);

// Create section
router.post('/',
  restrictTo('instructor', 'admin'),
  sectionController.setCourseUserIds,
  sectionController.validateSectionData,
  sectionController.getMaxOrder,
  sectionController.createSection
);

// Update section
router.patch('/:id',
  restrictTo('instructor', 'admin'),
  sectionController.checkSectionPermission,
  sectionController.validateSectionData,
  sectionController.updateSection
);

// ==================== PUBLISH/UNPUBLISH ROUTES ====================
router.patch('/:id/publish',
  restrictTo('instructor', 'admin'),
  sectionController.checkPublishPermission,
  sectionController.publishSection
);

router.patch('/:id/unpublish',
  restrictTo('instructor', 'admin'),
  sectionController.checkPublishPermission,
  sectionController.unpublishSection
);

router.patch('/:id/toggle-publish',
  restrictTo('instructor', 'admin'),
  sectionController.checkPublishPermission,
  sectionController.togglePublishStatus
);

// ==================== BULK PUBLISH/UNPUBLISH ====================
router.post('/bulk/publish',
  restrictTo('instructor', 'admin'),
  sectionController.bulkPublishSections
);

router.post('/bulk/unpublish',
  restrictTo('instructor', 'admin'),
  sectionController.bulkUnpublishSections
);

// ==================== SECTION MANAGEMENT ====================
router.patch('/reorder/:courseId',
  restrictTo('instructor', 'admin'),
  sectionController.reorderSections
);

router.post('/:id/duplicate',
  restrictTo('instructor', 'admin'),
  sectionController.checkSectionPermission,
  sectionController.duplicateSection
);

// ==================== DELETE/RESTORE ====================
router.delete('/:id',
  restrictTo('instructor', 'admin'),
  sectionController.checkSectionPermission,
  sectionController.deleteSection
);

router.patch('/:id/restore',
  restrictTo('admin'),
  sectionController.restoreSection
);

// ==================== BULK OPERATIONS ====================
router.post('/bulk/create',
  restrictTo('admin'),
  sectionController.bulkCreateSections
);

router.patch('/bulk/update',
  restrictTo('admin'),
  sectionController.bulkUpdateSections
);

router.delete('/bulk/delete',
  restrictTo('admin'),
  sectionController.bulkDeleteSections
);

router.get('/count/total', sectionController.countSections);

module.exports = router;


// const express = require('express');
// const sectionController = require('../controllers/sectionController');
// const authController = require('../controllers/authController');
// const lessonRouter = require('./lessonRoutes');
// const { checkValidId } = require('../middlewares/validateId'); // Added

// const router = express.Router({ mergeParams: true });

// // Apply Parameter Shield
// router.param('id', checkValidId);
// router.param('sectionId', checkValidId);
// router.param('courseId', checkValidId); // Good to include since mergeParams brings it in

// // ==========================================
// // NESTED ROUTES
// // ==========================================
// // Passes requests like /courses/:courseId/sections/:sectionId/lessons to lessonRouter
// router.use('/:sectionId/lessons', lessonRouter);

// // ==========================================
// // PUBLIC / STUDENT ROUTES (Read-Only)
// // ==========================================
// router.get('/', sectionController.setCourseId, sectionController.getAllSections);
// router.get('/:id', sectionController.getSection);

// // ==========================================
// // PROTECTED INSTRUCTOR/ADMIN ROUTES
// // ==========================================
// router.use(authController.protect);
// router.use(authController.restrictTo('instructor', 'admin'));

// // Enforce courseId mapping for all nested creates/updates
// router.use(sectionController.setCourseId);

// // Core CRUD & Reordering
// router.post('/', sectionController.createSection);
// router.patch('/reorder', sectionController.reorderSections);

// router
//   .route('/:id')
//   .patch(sectionController.updateSection)
//   .delete(sectionController.deleteSection);

// // Advanced State Management & Utilities
// router.patch('/:id/publish', sectionController.publishSection);
// router.patch('/:id/unpublish', sectionController.unpublishSection);
// router.post('/:id/clone', sectionController.cloneSection);

// module.exports = router;


// // const express = require('express');
// // const sectionController = require('../controllers/sectionController');
// // const authController = require('../controllers/authController');
// // const lessonRouter = require('./lessonRoutes');
// // const router = express.Router({ mergeParams: true });

// // // ==========================================
// // // NESTED ROUTES
// // // ==========================================
// // // Passes requests like /courses/:courseId/sections/:sectionId/lessons to lessonRouter
// // router.use('/:sectionId/lessons', lessonRouter);

// // // ==========================================
// // // PUBLIC / STUDENT ROUTES (Read-Only)
// // // ==========================================
// // router.get('/', sectionController.setCourseId, sectionController.getAllSections);
// // router.get('/:id', sectionController.getSection);

// // // ==========================================
// // // PROTECTED INSTRUCTOR/ADMIN ROUTES
// // // ==========================================
// // router.use(authController.protect);
// // router.use(authController.restrictTo('instructor', 'admin'));

// // // Enforce courseId mapping for all nested creates/updates
// // router.use(sectionController.setCourseId);

// // // Core CRUD & Reordering
// // router.post('/', sectionController.createSection);
// // router.patch('/reorder', sectionController.reorderSections); // Note: Removed /:courseId since mergeParams already provides it

// // router
// //   .route('/:id')
// //   .patch(sectionController.updateSection)
// //   .delete(sectionController.deleteSection);

// // // Advanced State Management & Utilities
// // router.patch('/:id/publish', sectionController.publishSection);
// // router.patch('/:id/unpublish', sectionController.unpublishSection);
// // router.post('/:id/clone', sectionController.cloneSection);

// // module.exports = router;
