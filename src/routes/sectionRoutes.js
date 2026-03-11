const express = require('express');
const sectionController = require('../controllers/sectionController');
const authController = require('../controllers/authController');
const lessonRouter = require('./lessonRoutes');

const router = express.Router({ mergeParams: true });

// ==========================================
// NESTED ROUTES
// ==========================================
// Passes requests like /courses/:courseId/sections/:sectionId/lessons to lessonRouter
router.use('/:sectionId/lessons', lessonRouter);

// ==========================================
// PUBLIC / STUDENT ROUTES (Read-Only)
// ==========================================
router.get('/', sectionController.setCourseId, sectionController.getAllSections);
router.get('/:id', sectionController.getSection);

// ==========================================
// PROTECTED INSTRUCTOR/ADMIN ROUTES
// ==========================================
const authMiddleWare= require('../middlewares/authMiddleware');
router.use(authMiddleWare.protect);

router.use(authController.restrictTo('instructor', 'admin'));

// Enforce courseId mapping for all nested creates/updates
router.use(sectionController.setCourseId);

// Core CRUD & Reordering
router.post('/', sectionController.createSection);
router.patch('/reorder', sectionController.reorderSections); // Note: Removed /:courseId since mergeParams already provides it

router
  .route('/:id')
  .patch(sectionController.updateSection)
  .delete(sectionController.deleteSection);

// Advanced State Management & Utilities
router.patch('/:id/publish', sectionController.publishSection);
router.patch('/:id/unpublish', sectionController.unpublishSection);
router.post('/:id/clone', sectionController.cloneSection);

module.exports = router;
