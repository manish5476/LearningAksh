const express = require('express');
const mockTestController = require('../controllers/mockTestController');
const authController = require('../controllers/authController');

const router = express.Router();

// ==========================================
// 1. SPECIFIC ROUTES FIRST
// (We apply the protect middleware inline so it stays secure above the public routes)
// ==========================================
router.get('/my-attempts', authController.protect, mockTestController.getMyAttempts);

// ==========================================
// 2. PUBLIC ROUTES
// ==========================================
router.get('/', mockTestController.getAllMockTests);

// Added Regex to strictly match valid MongoDB ObjectIds. 
// This prevents strings like "my-attempts" from ever triggering this route.
router.get('/:id([0-9a-fA-F]{24})', mockTestController.getMockTest);


// ==========================================
// 3. PROTECTED ROUTES
// Protect all routes after this middleware
// ==========================================
router.use(authController.protect);

// Student routes
router.post('/:mockTestId/start', mockTestController.startAttempt);
router.post('/attempts/:attemptId/submit', mockTestController.submitAttempt);
router.get('/attempts/:id([0-9a-fA-F]{24})', mockTestController.getAttemptDetails);

// Instructor routes
router.post('/', mockTestController.createMockTest);
router.post('/:mockTestId/questions', mockTestController.addQuestions);

// CRUD operations with ownership checks
router.route('/:id([0-9a-fA-F]{24})')
  .patch(mockTestController.updateMockTest)
  .delete(mockTestController.deleteMockTest);

module.exports = router;
