const express = require('express');
const discussionController = require('../controllers/discussionController');
const authController = require('../controllers/authController');

const router = express.Router(); // mergeParams is no longer needed

// Protect all routes
const authMiddleWare= require('../middlewares/authMiddleware');
router.use(authMiddleWare.protect);


// ----------------------------------------------------
// Base Discussion routes (/api/v1/discussions)
// ----------------------------------------------------
router.route('/')
  .get(discussionController.getCourseDiscussions) // Uses req.query.courseId
  .post(discussionController.createDiscussion);   // Uses req.body.course

// ----------------------------------------------------
// Reply routes
// ----------------------------------------------------
router.post('/:discussionId/replies', discussionController.replyToDiscussion);

// ----------------------------------------------------
// Interaction routes
// ----------------------------------------------------
router.post('/:type/:id/like', discussionController.toggleLike);
router.patch('/:id/pin', discussionController.pinDiscussion);
router.patch('/:id/resolve', discussionController.markResolved);

// ----------------------------------------------------
// Standard CRUD operations
// ----------------------------------------------------
router.route('/:id')
  .get(discussionController.getDiscussion)
  .patch(discussionController.updateDiscussion)
  .delete(discussionController.deleteDiscussion);

// ----------------------------------------------------
// Admin only
// ----------------------------------------------------
router.use(authController.restrictTo('admin'));
router.get('/all', discussionController.getAllDiscussions);

module.exports = router;


// const express = require('express');
// const discussionController = require('../controllers/discussionController');
// const authController = require('../controllers/authController');

// const router = express.Router({ mergeParams: true });

// // Protect all routes
// const authMiddleWare= require('../middlewares/authMiddleware');
router.use(authMiddleWare.protect);


// // Discussion routes
// router.get('/', discussionController.getCourseDiscussions);
// router.post('/', discussionController.createDiscussion);

// // Reply routes
// router.post('/:discussionId/replies', discussionController.replyToDiscussion);

// // Interaction routes
// router.post('/:type/:id/like', discussionController.toggleLike);
// router.patch('/:id/pin', discussionController.pinDiscussion);
// router.patch('/:id/resolve', discussionController.markResolved);

// // CRUD operations
// router.route('/:id')
//   .get(discussionController.getDiscussion)
//   .patch(discussionController.updateDiscussion)
//   .delete(discussionController.deleteDiscussion);

// // Admin only
// router.use(authController.restrictTo('admin'));
// router.route('/')
//   .get(discussionController.getAllDiscussions);

// module.exports = router;