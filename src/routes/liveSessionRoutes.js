const express = require('express');
const liveSessionController = require('../controllers/liveSessionController');
const authController = require('../controllers/authController');

const router = express.Router();

// Public routes
router.get('/upcoming', liveSessionController.getUpcomingSessions);

// Protect all routes after this
router.use(authController.protect);

// Student routes
router.get('/course/:courseId', liveSessionController.getCourseSessions);
router.post('/:id/join', liveSessionController.joinSession);
router.post('/:id/leave', liveSessionController.leaveSession);

// Instructor routes
router.use(authController.restrictTo('instructor', 'admin'));
router.post('/', liveSessionController.createLiveSession);
router.post('/:id/start', liveSessionController.startSession);
router.post('/:id/end', liveSessionController.endSession);
router.post('/:id/recording', liveSessionController.uploadRecording);

router.route('/:id')
  .get(liveSessionController.getSession)
  .patch(liveSessionController.updateSession)
  .delete(liveSessionController.deleteSession);

// Admin only
router.use(authController.restrictTo('admin'));
router.get('/', liveSessionController.getAllSessions);

module.exports = router;