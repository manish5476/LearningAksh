const express = require('express');
const discussionController = require('../controllers/discussionController');
const authController = require('../controllers/authController');

const router = express.Router({ mergeParams: true });

// Protect all routes
router.use(authController.protect);

// Discussion routes
router.get('/', discussionController.getCourseDiscussions);
router.post('/', discussionController.createDiscussion);

// Reply routes
router.post('/:discussionId/replies', discussionController.replyToDiscussion);

// Interaction routes
router.post('/:type/:id/like', discussionController.toggleLike);
router.patch('/:id/pin', discussionController.pinDiscussion);
router.patch('/:id/resolve', discussionController.markResolved);

// CRUD operations
router.route('/:id')
  .get(discussionController.getDiscussion)
  .patch(discussionController.updateDiscussion)
  .delete(discussionController.deleteDiscussion);

// Admin only
router.use(authController.restrictTo('admin'));
router.route('/')
  .get(discussionController.getAllDiscussions);

module.exports = router;