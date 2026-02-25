const express = require('express');
const codingExerciseController = require('../controllers/codingExerciseController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Student routes
router.post('/:exerciseId/execute', codingExerciseController.executeCode);
router.post('/:exerciseId/submit', codingExerciseController.submitSolution);
router.get('/:exerciseId/my-submissions', codingExerciseController.getMySubmissions);

// Instructor routes
router.post('/', codingExerciseController.createCodingExercise);

// CRUD operations with ownership checks
router.route('/:id')
  .get(codingExerciseController.getExercise)
  .patch(codingExerciseController.updateExercise)
  .delete(codingExerciseController.deleteExercise);

// Admin only
router.use(authController.restrictTo('admin'));
router.route('/')
  .get(codingExerciseController.getAllExercises);

module.exports = router;