const express = require('express');
const courseController = require('../controllers/courseController');
const authController = require('../controllers/authController');
const sectionRouter = require('./sectionRoutes');

const router = express.Router();

// Nested routes
router.use('/:courseId/sections', sectionRouter);

// Public routes
router.get('/search', courseController.getAllCourses);
router.get('/slug/:slug', courseController.getCourseWithContent);
router.get('/', courseController.getAllCourses);
router.get('/:id', courseController.getCourse);

// Protect all routes after this middleware
router.use(authController.protect);

// Instructor routes
router.get('/instructor/my-courses', courseController.getMyCourses);
router.post('/', courseController.createCourse);

router
  .route('/:id')
  .patch(courseController.updateCourse)
  .delete(courseController.deleteCourse);

router.patch('/:id/publish', courseController.publishCourse);

// Admin only routes
router.use(authController.restrictTo('admin'));
router.patch('/:id/approve', courseController.approveCourse);

module.exports = router;