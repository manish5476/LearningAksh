const express = require('express');
const progressController = require('../controllers/progressController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
const authMiddleWare= require('../middlewares/authMiddleware');
router.use(authMiddleWare.protect);


router.get('/my-progress', progressController.getMyProgress);
router.get('/course/:courseId', progressController.getCourseProgress);
router.post('/course/:courseId/lesson-complete', progressController.markLessonComplete);

// Instructor/Admin routes
router.use(authController.restrictTo('instructor', 'admin'));
router.get('/student/:studentId/course/:courseId', progressController.getStudentProgress);

module.exports = router;