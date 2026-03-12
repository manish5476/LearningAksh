const express = require('express');

const courseController = require('../controllers/courseController');
const authController = require('../controllers/authController');
const cache = require('../middlewares/cacheMiddleware');
// 1. IMPORT YOUR MIDDLEWARE HERE
const { checkValidId } = require('../middlewares/validateId'); 

const sectionRouter = require('./sectionRoutes');

const router = express.Router();

/* =========================================================
PARAMETER VALIDATION SHIELD
========================================================= */
// 2. APPLY IT GLOBALLY TO THESE PARAMETERS
// Express will now automatically run checkValidId for ANY route containing :id or :courseId
router.param('id', checkValidId);
router.param('courseId', checkValidId);


/* =========================================================
NESTED ROUTES
========================================================= */
// The courseId here is now protected!
router.use('/:courseId/sections', sectionRouter);


/* =========================================================
PUBLIC ROUTES
========================================================= */
router.get('/top-rated', cache.cache(300), courseController.getTopRatedCourses);

// Protected by router.param('id')
router.get('/:id/related', cache.cache(300), courseController.getRelatedCourses); 

router.get('/', cache.cache(300), courseController.getAllCourses);

router.get('/slug/:slug', cache.cache(600), courseController.getCourseWithContent);

// Protected by router.param('id')
router.get('/:id', cache.cache(600), courseController.getCourse); 


/* =========================================================
PROTECTED ROUTES
========================================================= */
router.use(authController.protect);


/* =========================================================
INSTRUCTOR ROUTES
========================================================= */
router.use(authController.restrictTo('instructor', 'admin'));

router.get('/instructor/my-courses', courseController.getMyCourses);

// Protected by router.param('id')
router.get('/instructor/:id/students', courseController.getCourseStudents);

// Protected by router.param('id')
router.get('/instructor/courses/:id', courseController.getInstructorCourse);

// Protected by router.param('id')
router.post('/instructor/:id/clone', courseController.cloneCourse);

router.post('/', cache.clearCache('courses:*'), courseController.createCourse);

// Protected by router.param('id')
router.patch('/:id', cache.clearCache('courses:*'), courseController.updateCourse);

// Protected by router.param('id')
router.delete('/:id', cache.clearCache('courses:*'), courseController.deleteCourse);

// Protected by router.param('id')
router.patch('/:id/publish', courseController.publishCourse);

// Protected by router.param('id')
router.patch('/:id/unpublish', courseController.unpublishCourse);


/* =========================================================
ADMIN ROUTES
========================================================= */
router.use(authController.restrictTo('admin'));

// Protected by router.param('id')
router.patch('/:id/approve', courseController.approveCourse);

module.exports = router;



// const express = require('express');

// const courseController = require('../controllers/courseController');
// const authController = require('../controllers/authController');
// const cache = require('../middlewares/cacheMiddleware');

// const sectionRouter = require('./sectionRoutes');

// const router = express.Router();



// /* =========================================================
// NESTED ROUTES
// ========================================================= */

// router.use('/:courseId/sections', sectionRouter);



// /* =========================================================
// PUBLIC ROUTES
// ========================================================= */

// router.get('/top-rated', cache.cache(300), courseController.getTopRatedCourses);

// router.get('/:id/related', cache.cache(300), courseController.getRelatedCourses);

// router.get('/', cache.cache(300), courseController.getAllCourses);

// router.get('/slug/:slug', cache.cache(600), courseController.getCourseWithContent);

// router.get('/:id', cache.cache(600), courseController.getCourse);



// /* =========================================================
// PROTECTED ROUTES
// ========================================================= */

// router.use(authController.protect);



// /* =========================================================
// INSTRUCTOR ROUTES
// ========================================================= */

// router.use(authController.restrictTo('instructor', 'admin'));

// router.get('/instructor/my-courses', courseController.getMyCourses);

// router.get('/instructor/:id/students', courseController.getCourseStudents);

// router.get('/instructor/courses/:id', courseController.getInstructorCourse);

// router.post('/instructor/:id/clone', courseController.cloneCourse);

// router.post('/', cache.clearCache('courses:*'), courseController.createCourse);

// router.patch('/:id', cache.clearCache('courses:*'), courseController.updateCourse);

// router.delete('/:id', cache.clearCache('courses:*'), courseController.deleteCourse);

// router.patch('/:id/publish', courseController.publishCourse);

// router.patch('/:id/unpublish', courseController.unpublishCourse);



// /* =========================================================
// ADMIN ROUTES
// ========================================================= */

// router.use(authController.restrictTo('admin'));

// router.patch('/:id/approve', courseController.approveCourse);



// module.exports = router;


// // const express = require('express');
// // const courseController = require('../controllers/courseController');
// // const authController = require('../controllers/authController');
// // const sectionRouter = require('./sectionRoutes');

// // const router = express.Router();

// // // ==========================================
// // // NESTED ROUTES
// // // ==========================================
// // router.use('/:courseId/sections', sectionRouter);

// // // ==========================================
// // // PUBLIC ROUTES (Storefront & Discovery)
// // // ==========================================
// // router.get('/top-rated', courseController.getTopRatedCourses);
// // router.get('/:id/related', courseController.getRelatedCourses);
// // router.get('/', courseController.getAllCourses);
// // router.get('/slug/:slug', courseController.getCourseWithContent); 
// // router.get('/:id', courseController.getCourse);

// // // ==========================================
// // // PROTECTED ROUTES
// // // ==========================================
// // router.use(authController.protect);

// // // ==========================================
// // // INSTRUCTOR ROUTES (Course Management)
// // // ==========================================
// // router.use(authController.restrictTo('instructor', 'admin'));

// // router.get('/instructor/my-courses', courseController.getMyCourses);
// // router.get('/instructor/:id/students', courseController.getCourseStudents);
// // // router.get('/instructor/:id/stats', courseController.getInstructorCourseStats);
// // router.get('/instructor/courses/:id', courseController.getInstructorCourse);
// // // Deep Clone Feature
// // router.post('/instructor/:id/clone', courseController.cloneCourse);

// // router.post('/', courseController.createCourse);

// // router
// //   .route('/:id')
// //   .patch(courseController.updateCourse)
// //   .delete(courseController.deleteCourse);

// // router.patch('/:id/publish', courseController.publishCourse);
// // router.patch('/:id/unpublish', courseController.unpublishCourse);

// // // ==========================================
// // // ADMIN ROUTES
// // // ==========================================
// // router.use(authController.restrictTo('admin'));
// // router.patch('/:id/approve', courseController.approveCourse);

// // module.exports = router;
