const express = require('express');
const quizController = require('../controllers/quizController');
const authController = require('../controllers/authController');
const { checkValidId } = require('../middlewares/validateId'); // Added

const router = express.Router();

// Apply Parameter Shield
router.param('id', checkValidId);
router.param('quizId', checkValidId);

// Protect all routes
router.use(authController.protect);

router.get('/course/:courseId', quizController.getQuizzesByCourse);

// Quiz taking routes
router.get('/:id/take', quizController.getQuizWithQuestions);
router.post('/:quizId/submit', quizController.submitQuiz);

// Instructor routes
router.post('/', quizController.createQuiz);
router.post('/:quizId/questions', quizController.addQuestions);
// Get quizzes by course
// CRUD operations
router.route('/:id')
  .get(quizController.getQuiz)
  .patch(quizController.updateQuiz)
  .delete(quizController.deleteQuiz);

// Admin only
router.use(authController.restrictTo('admin'));
router.route('/')
  .get(quizController.getAllQuizzes);

module.exports = router;
