const express = require('express');
const learningPathController = require('../controllers/learningPathController');
const authController = require('../controllers/authController');

const router = express.Router();

// Public routes
router.get('/', learningPathController.getAllLearningPaths);
router.get('/:id', learningPathController.getLearningPath);

// Protect all routes after this
router.use(authController.protect);

// Student routes
router.get('/recommended/me', learningPathController.getRecommendedPaths);
router.post('/:pathId/enroll', learningPathController.enrollInPath);
router.get('/:pathId/progress', learningPathController.getPathProgress);

// Admin/Instructor routes
router.use(authController.restrictTo('admin', 'instructor'));
router.post('/', learningPathController.createLearningPath);
router.get('/:pathId/analytics', learningPathController.getPathAnalytics);

router.route('/:id')
  .patch(learningPathController.updateLearningPath)
  .delete(learningPathController.deleteLearningPath);

module.exports = router;