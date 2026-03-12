const express = require('express');
const categoryController = require('../controllers/categoryController');
const authController = require('../controllers/authController');
const { checkValidId } = require('../middlewares/validateId'); // Added

const router = express.Router();

// Apply Parameter Shield
// Note: If you ever uncomment the slug route, do NOT validate the slug here.
router.param('id', checkValidId);

// ==========================================
// PUBLIC ROUTES
// ==========================================
// IMPORTANT: Order matters (Most specific → Least specific)

// ----- Static Routes -----
router.get('/tree', categoryController.getCategoryTree);
router.get('/popular', categoryController.getPopularCategories);
// router.get('/check-slug/:slug', categoryController.checkCategorySlug);

// ----- Standard Get All -----
router.get('/', categoryController.getAllCategories);

// ----- Nested Dynamic Routes (MUST come before /:id) -----
router.get('/:id/courses', categoryController.getCategoryWithCourses);
router.get('/:id/breadcrumbs', categoryController.getCategoryBreadcrumbs);

// ----- Base Dynamic Route (ALWAYS LAST in public) -----
router.get('/:id', categoryController.getCategory);

// ==========================================
// PROTECTED ADMIN ROUTES
// ==========================================
router.use(authController.protect);
router.use(authController.restrictTo('admin'));

// ----- Static Admin Routes -----
// router.patch('/bulk-update', categoryController.bulkUpdateCategories);

// ----- Create -----
router.post('/', categoryController.createCategory);

// ----- Nested Admin Dynamic Routes -----
router.patch('/:id/restore', categoryController.restoreCategory);

// ----- Base Admin Dynamic Routes (ALWAYS LAST) -----
router.patch('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;





// const express = require('express');
// const categoryController = require('../controllers/categoryController');
// const authController = require('../controllers/authController');

// const router = express.Router();

// // ==========================================
// // PUBLIC ROUTES
// // ==========================================
// // IMPORTANT: Order matters (Most specific → Least specific)

// // ----- Static Routes -----
// router.get('/tree', categoryController.getCategoryTree);
// router.get('/popular', categoryController.getPopularCategories);
// // router.get('/check-slug/:slug', categoryController.checkCategorySlug);

// // ----- Standard Get All -----
// router.get('/', categoryController.getAllCategories);

// // ----- Nested Dynamic Routes (MUST come before /:id) -----
// router.get('/:id/courses', categoryController.getCategoryWithCourses);
// router.get('/:id/breadcrumbs', categoryController.getCategoryBreadcrumbs);

// // ----- Base Dynamic Route (ALWAYS LAST in public) -----
// router.get('/:id', categoryController.getCategory);

// // ==========================================
// // PROTECTED ADMIN ROUTES
// // ==========================================
// router.use(authController.protect);
// router.use(authController.restrictTo('admin'));

// // ----- Static Admin Routes -----
// // router.patch('/bulk-update', categoryController.bulkUpdateCategories);

// // ----- Create -----
// router.post('/', categoryController.createCategory);

// // ----- Nested Admin Dynamic Routes -----
// router.patch('/:id/restore', categoryController.restoreCategory);

// // ----- Base Admin Dynamic Routes (ALWAYS LAST) -----
// router.patch('/:id', categoryController.updateCategory);
// router.delete('/:id', categoryController.deleteCategory);

// module.exports = router;

