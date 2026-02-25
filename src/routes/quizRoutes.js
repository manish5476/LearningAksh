const express = require('express');
const quizController = require('../controllers/quizController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Quiz taking routes
router.get('/:id/take', quizController.getQuizWithQuestions);
router.post('/:quizId/submit', quizController.submitQuiz);

// Instructor routes
router.post('/', quizController.createQuiz);
router.post('/:quizId/questions', quizController.addQuestions);

// CRUD operations with ownership checks
router.route('/:id')
  .get(quizController.getQuiz)
  .patch(quizController.updateQuiz)
  .delete(quizController.deleteQuiz);

// Admin only
router.use(authController.restrictTo('admin'));
router.route('/')
  .get(quizController.getAllQuizzes);

module.exports = router;