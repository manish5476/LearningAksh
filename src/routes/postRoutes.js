const express = require('express');
const postController = require('../controllers/postController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

const router = express.Router();

// ==========================================
// 1. PUBLIC ROUTES (Readers & Students)
// ==========================================
// Fetch all published posts
router.get('/', postController.getPublishedPosts);

// Get all unique tags
router.get('/tags/all', postController.getAllTags);

// Get posts by author
router.get('/author/:authorId', postController.getPostsByAuthor);

// ==========================================
// 2. ADMIN & INSTRUCTOR ROUTES (Part 1 - Specific Paths)
// ==========================================
// We place /admin/all before /:identifier so it doesn't get treated as a slug
router.get(
  '/admin/all',
  protect,
  restrictTo('admin', 'instructor'),
  postController.getAllPostsAdmin
);

// ==========================================
// 3. PUBLIC SINGLE POST (By Slug or ID)
// ==========================================
router.get('/:identifier', postController.getPostSmart);

// ==========================================
// 4. AUTHENTICATED STUDENT ROUTES
// ==========================================
// Users must be logged in past this point.
router.use(protect);

// Allow logged-in students to like a post (spam-proof)
router.patch('/:id/like', postController.likePost);

// ==========================================
// 5. ADMIN & INSTRUCTOR CRUD ROUTES
// ==========================================
// Restrict all routes below to only admins and instructors.
router.use(restrictTo('admin', 'instructor'));

router.post('/', postController.setAuthor, postController.createPost);

router.patch('/:id/publish', postController.publishPost);
router.patch('/:id/unpublish', postController.unpublishPost);
router.patch('/:id/feature', postController.toggleFeature);
router.get('/admin/:id', postController.getPostAdmin);
router.route('/:id').patch(postController.updatePost).delete(postController.deletePost);

module.exports = router;