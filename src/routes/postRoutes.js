const express = require('express');
const postController = require('../controllers/postController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

const router = express.Router();

// ==========================================
// 1. PUBLIC ROUTES (Readers & Students)
// ==========================================
// We use the '/public' prefix so the controller knows to apply smart filtering
// (e.g., only showing 'published' posts and hiding the HTML content from the list view)

router.get('/public', postController.getPublishedPosts);
router.get('/public/:slug', postController.getPostSmart);


// ==========================================
// 2. AUTHENTICATED STUDENT ROUTES
// ==========================================
// Users must be logged in past this point.
router.use(protect);

// Allow logged-in students to like a post
router.patch('/:id/like', postController.likePost);


// ==========================================
// 3. ADMIN & INSTRUCTOR ROUTES
// ==========================================
// Restrict all routes below to only admins and instructors.
// Standard students will get a 403 Forbidden error if they try to hit these.
router.use(restrictTo('admin', 'instructor'));

router.route('/')
  .get(postController.getAllPostsAdmin)
  .post(postController.setAuthor, postController.createPost);

router.route('/:id')
  .patch(postController.updatePost)
  .delete(postController.deletePost);

module.exports = router;