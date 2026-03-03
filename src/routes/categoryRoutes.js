const express = require('express');
const categoryController = require('../controllers/categoryController');
const authController = require('../controllers/authController');

const router = express.Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================
// 1. Static Routes (Must come before /:id)
router.get('/tree', categoryController.getCategoryTree);
router.get('/popular', categoryController.getPopularCategories);
router.get('/check-slug/:slug', categoryController.checkCategorySlug); // Added for Angular

// 2. Standard Get All
router.get('/', categoryController.getAllCategories);

// 3. Dynamic /:id Routes
router.get('/:id', categoryController.getCategory);
router.get('/:id/courses', categoryController.getCategoryWithCourses);
router.get('/:id/breadcrumbs', categoryController.getCategoryBreadcrumbs);

// ==========================================
// PROTECTED ADMIN ROUTES
// ==========================================
router.use(authController.protect);
router.use(authController.restrictTo('admin'));

// 1. Static Admin Routes
router.patch('/bulk-update', categoryController.bulkUpdateCategories); // Adjusted to PATCH to match REST standards

// 2. Dynamic /:id Admin Routes
router.post('/', categoryController.createCategory);
router.patch('/:id/restore', categoryController.restoreCategory);
router.patch('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;

// const express = require('express');
// const categoryController = require('../controllers/categoryController');
// const authController = require('../controllers/authController');

// const router = express.Router();

// // Public routes
// router.get('/tree', categoryController.getCategoryTree);
// router.get('/', categoryController.getAllCategories);
// router.get('/:id', categoryController.getCategory);
// router.get('/:id/courses', categoryController.getCategoryWithCourses);

// // Protect all routes after this middleware
// router.use(authController.protect);
// router.use(authController.restrictTo('admin'));

// router.post('/', categoryController.createCategory);
// router.patch('/:id', categoryController.updateCategory);
// router.delete('/:id', categoryController.deleteCategory);

// module.exports = router;