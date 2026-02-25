const express = require('express');
const mockTestController = require('../controllers/mockTestController');
const authController = require('../controllers/authController');

const router = express.Router();

// Public routes
router.get('/', mockTestController.getAllMockTests);
router.get('/:id', mockTestController.getMockTest);

// Protect all routes after this middleware
router.use(authController.protect);

// Student routes
router.get('/my-attempts', mockTestController.getMyAttempts);
router.post('/:mockTestId/start', mockTestController.startAttempt);
router.post('/attempts/:attemptId/submit', mockTestController.submitAttempt);
router.get('/attempts/:id', mockTestController.getAttemptDetails);

// Instructor routes
router.post('/', mockTestController.createMockTest);
router.post('/:mockTestId/questions', mockTestController.addQuestions);

// CRUD operations with ownership checks
router.route('/:id')
  .patch(mockTestController.updateMockTest)
  .delete(mockTestController.deleteMockTest);

module.exports = router;