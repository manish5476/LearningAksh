// routes/courseRoutes.js (Updated with Publish/Unpublish)
const express = require('express');
const courseController = require('../controllers/courseController');
const sectionRouter = require('./sectionRoutes');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
router.get('/slug/:id', courseController.getCourseSmart);
router.get('/published', courseController.getPublishedCourses);
router.get('/master-data', courseController.getCourseMasterData);
router.get('/:id/structure', courseController.getCourseStructure);
router.get('/:id', courseController.getCourseSmart);
router.get('/', courseController.getAllCourses);

// ==================== NESTED ROUTES ====================
router.use('/:courseId/sections', sectionRouter);

// ==================== PROTECTED ROUTES ====================
router.use(protect);

// Instructor's courses
router.get('/instructor/my-courses', courseController.getMyInstructorCourses);

// Course CRUD
router.post('/', 
  restrictTo('instructor', 'admin'),
  courseController.setPrimaryInstructor,
  courseController.initializeInstructors,
  courseController.validateMasterFields,
  courseController.createCourse
);

router.patch('/:id', 
  restrictTo('instructor', 'admin'),
  courseController.checkCoursePermission,
  courseController.validateMasterFields,
  courseController.updateCourse
);

// ==================== PUBLISH/UNPUBLISH ROUTES ====================
router.patch('/:id/publish', 
  restrictTo('instructor', 'admin'),
  courseController.checkPublishPermission,
  courseController.publishCourse
);

router.patch('/:id/unpublish', 
  restrictTo('instructor', 'admin'),
  courseController.checkPublishPermission,
  courseController.unpublishCourse
);

router.patch('/:id/toggle-publish', 
  restrictTo('instructor', 'admin'),
  courseController.checkPublishPermission,
  courseController.togglePublishStatus
);

// ==================== BULK PUBLISH/UNPUBLISH ROUTES ====================
router.post('/bulk/publish', 
  restrictTo('admin'),
  courseController.bulkPublishCourses
);

router.post('/bulk/unpublish', 
  restrictTo('admin'),
  courseController.bulkUnpublishCourses
);

// ==================== APPROVAL ROUTES ====================
router.patch('/:id/approve', 
  restrictTo('admin'),
  courseController.approveCourse
);

router.patch('/:id/reject', 
  restrictTo('admin'),
  courseController.rejectCourse
);

// ==================== INSTRUCTOR MANAGEMENT ROUTES ====================
router.post('/:id/instructors',
  restrictTo('instructor', 'admin'),
  courseController.checkCoursePermission,
  courseController.addInstructor
);

router.patch('/:id/instructors/:instructorId/permissions',
  restrictTo('instructor', 'admin'),
  courseController.checkCoursePermission,
  courseController.updateInstructorPermissions
);

router.delete('/:id/instructors/:instructorId',
  restrictTo('instructor', 'admin'),
  courseController.checkCoursePermission,
  courseController.removeInstructor
);

router.get('/:id/instructors',
  courseController.getCourseInstructors
);

// ==================== INVITATION ROUTES ====================
router.post('/:id/invitations',
  restrictTo('instructor', 'admin'),
  courseController.checkCoursePermission,
  courseController.createInvitation
);

router.get('/:id/invitations',
  restrictTo('instructor', 'admin'),
  courseController.checkCoursePermission,
  courseController.getCourseInvitations
);

router.post('/invitations/accept',
  protect,
  courseController.acceptInvitation
);

router.patch('/invitations/:invitationId/revoke',
  restrictTo('instructor', 'admin'),
  courseController.revokeInvitation
);

// ==================== ANALYTICS ====================
router.get('/:id/analytics',
  restrictTo('instructor', 'admin'),
  courseController.checkCoursePermission,
  courseController.getCourseAnalytics
);

// ==================== DELETE/RESTORE ====================
router.delete('/:id', 
  restrictTo('instructor', 'admin'),
  courseController.checkCoursePermission,
  courseController.deleteCourse
);

router.patch('/:id/restore', 
  restrictTo('admin'),
  courseController.restoreCourse
);

// ==================== BULK OPERATIONS ====================
router.post('/bulk/create', 
  restrictTo('admin'),
  courseController.bulkCreateCourses
);

router.patch('/bulk/update', 
  restrictTo('admin'),
  courseController.bulkUpdateCourses
);

router.delete('/bulk/delete', 
  restrictTo('admin'),
  courseController.bulkDeleteCourses
);

router.get('/count/total', courseController.countCourses);

module.exports = router;





// const express = require('express');

// const courseController = require('../controllers/courseController');
// const authController = require('../controllers/authController');
// // 1. IMPORT YOUR MIDDLEWARE HERE
// const { checkValidId } = require('../middlewares/validateId'); 

// const sectionRouter = require('./sectionRoutes');

// const router = express.Router();

// /* =========================================================
// PARAMETER VALIDATION SHIELD
// ========================================================= */
// // 2. APPLY IT GLOBALLY TO THESE PARAMETERS
// // Express will now automatically run checkValidId for ANY route containing :id or :courseId
// router.param('id', checkValidId);
// router.param('courseId', checkValidId);


// /* =========================================================
// NESTED ROUTES
// ========================================================= */
// // The courseId here is now protected!
// router.use('/:courseId/sections', sectionRouter);


// /* =========================================================
// PUBLIC ROUTES
// ========================================================= */
// router.get('/top-rated',  courseController.getTopRatedCourses);

// // Protected by router.param('id')
// router.get('/:id/related',  courseController.getRelatedCourses); 

// router.get('/',  courseController.getAllCourses);

// router.get('/slug/:slug',  courseController.getCourseWithContent);

// // Protected by router.param('id')
// router.get('/:id',  courseController.getCourse); 


// /* =========================================================
// PROTECTED ROUTES
// ========================================================= */
// router.use(authController.protect);


// /* =========================================================
// INSTRUCTOR ROUTES
// ========================================================= */
// router.use(authController.restrictTo('instructor', 'admin'));

// router.get('/instructor/my-courses', courseController.getMyCourses);

// // Protected by router.param('id')
// router.get('/instructor/:id/students', courseController.getCourseStudents);

// // Protected by router.param('id')
// router.get('/instructor/courses/:id', courseController.getInstructorCourse);

// // Protected by router.param('id')
// router.post('/instructor/:id/clone', courseController.cloneCourse);

// router.post('/',  courseController.createCourse);

// // Protected by router.param('id')
// router.patch('/:id',  courseController.updateCourse);

// // Protected by router.param('id')
// router.delete('/:id',  courseController.deleteCourse);

// // Protected by router.param('id')
// router.patch('/:id/publish', courseController.publishCourse);

// // Protected by router.param('id')
// router.patch('/:id/unpublish', courseController.unpublishCourse);


// /* =========================================================
// ADMIN ROUTES
// ========================================================= */
// router.use(authController.restrictTo('admin'));
// router.patch('/:id/approve', courseController.approveCourse);
// router.get('/analytics/:identifier', courseController.getCourseAnalytics);

// module.exports = router;
