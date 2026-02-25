const express = require('express');
const sectionController = require('../controllers/sectionController');
const authController = require('../controllers/authController');
const lessonRouter = require('./lessonRoutes');

const router = express.Router({ mergeParams: true });

// Nested routes
router.use('/:sectionId/lessons', lessonRouter);

// Protect all routes
router.use(authController.protect);

router
  .route('/')
  .post(sectionController.setCourseId, sectionController.createSection)
  .get(sectionController.getAllSections);

router.post('/reorder/:courseId', sectionController.reorderSections);

router
  .route('/:id')
  .get(sectionController.getSection)
  .patch(sectionController.updateSection)
  .delete(sectionController.deleteSection);

module.exports = router;