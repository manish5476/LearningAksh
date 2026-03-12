const express = require('express');
const assessmentController = require('../controllers/assessmentController');
const authController = require('../controllers/authController');

// 1. IMPORT MIDDLEWARE
const { checkValidId } = require('../middlewares/validateId');

const router = express.Router();

// 2. APPLY PARAMETER SHIELD 
// Notice we DO NOT validate 'type' here because it is a string ('quiz' or 'mock-test')
router.param('id', checkValidId);
router.param('attemptId', checkValidId);


router.use(authController.protect);

// --- QUIZZES ---
router.get('/quiz/:id', assessmentController.getQuiz);
router.post('/quiz/:id/submit', assessmentController.submitQuiz);

// --- MOCK TESTS ---
router.get('/mock-test', assessmentController.getAllMockTests);
router.get('/mock-test/:id', assessmentController.getMockTest);
router.get('/mock-test/:id/analytics', authController.restrictTo('instructor', 'admin'), assessmentController.getMockTestAnalytics);

// ATTEMPT LIFECYCLE
router.post('/mock-test/:id/start', assessmentController.startMockTestAttempt);
router.patch('/mock-test/attempt/:attemptId/heartbeat', assessmentController.trackAttemptActivity);
router.patch('/mock-test/attempt/:attemptId/submit', assessmentController.submitMockTestAttempt);

// --- INSTRUCTOR MANAGEMENT ---
router.use(authController.restrictTo('instructor', 'admin'));
router.post('/quiz', assessmentController.createQuiz);
router.post('/mock-test', assessmentController.createMockTest);
router.post('/:type/:id/questions', assessmentController.addQuestions); // Handles both quiz and mocktest bulk add

module.exports = router;

// const express = require('express');
// const assessmentController = require('../controllers/assessmentController');
// const authController = require('../controllers/authController');

// const router = express.Router();

// router.use(authController.protect);

// // --- QUIZZES ---
// router.get('/quiz/:id', assessmentController.getQuiz);
// router.post('/quiz/:id/submit', assessmentController.submitQuiz);

// // --- MOCK TESTS ---
// router.get('/mock-test', assessmentController.getAllMockTests);
// router.get('/mock-test/:id', assessmentController.getMockTest);
// router.get('/mock-test/:id/analytics', authController.restrictTo('instructor', 'admin'), assessmentController.getMockTestAnalytics);

// // ATTEMPT LIFECYCLE
// router.post('/mock-test/:id/start', assessmentController.startMockTestAttempt);
// router.patch('/mock-test/attempt/:attemptId/heartbeat', assessmentController.trackAttemptActivity);
// router.patch('/mock-test/attempt/:attemptId/submit', assessmentController.submitMockTestAttempt);

// // --- INSTRUCTOR MANAGEMENT ---
// router.use(authController.restrictTo('instructor', 'admin'));
// router.post('/quiz', assessmentController.createQuiz);
// router.post('/mock-test', assessmentController.createMockTest);
// router.post('/:type/:id/questions', assessmentController.addQuestions); // Handles both quiz and mocktest bulk add

// module.exports = router;