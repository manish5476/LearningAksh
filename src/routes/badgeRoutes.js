const express = require('express');
const badgeController = require('../controllers/badgeController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// User routes
router.get('/my-badges', badgeController.getUserBadges);
router.get('/leaderboard', badgeController.getLeaderboard);

// Public routes
router.get('/student/:studentId', badgeController.getStudentBadges);

// Admin/Instructor routes
router.use(authController.restrictTo('admin', 'instructor'));
router.post('/award', badgeController.awardBadge);
router.post('/check', badgeController.checkAndAwardBadges);
router.delete('/:studentId/:badgeId', badgeController.removeBadge);

// Admin only CRUD
router.use(authController.restrictTo('admin'));
router.route('/')
  .post(badgeController.createBadge)
  .get(badgeController.getAllBadges);

router.route('/:id')
  .get(badgeController.getBadge)
  .patch(badgeController.updateBadge)
  .delete(badgeController.deleteBadge);

module.exports = router;