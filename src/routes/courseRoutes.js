// routes/courseRoutes.js
const express = require('express');
const courseController = require('../controllers/courseController');
const sectionRouter = require('./sectionRoutes');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
// 1. Static and highly specific routes go FIRST
router.get('/count/total', courseController.countCourses); // Moved up so /:id doesn't accidentally catch it
router.get('/published', courseController.getPublishedCourses);
router.get('/master-data', courseController.getCourseMasterData);

// 2. Your NEW route for fetching basic quiz details by course slug
router.get('/slug/:slug/quizzes', courseController.getCourseQuizzes);

// 3. Less specific dynamic routes go LAST in the public section
router.get('/slug/:id', courseController.getCourseSmart);
router.get('/:id/structure', courseController.getCourseStructure);
router.get('/:id', courseController.getCourseSmart);
router.get('/', courseController.getAllCourses);

// ==================== NESTED ROUTES ====================
router.use('/:courseId/sections', sectionRouter);

// ==================== PROTECTED ROUTES ====================
router.use(protect); // Everything below this line requires login

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
  protect, // Protect is already applied above, but keeping it here if it's your standard pattern
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

module.exports = router;


// // routes/courseRoutes.js (Updated with Publish/Unpublish)
// const express = require('express');
// const courseController = require('../controllers/courseController');
// const sectionRouter = require('./sectionRoutes');
// const { protect, restrictTo } = require('../middlewares/authMiddleware');

// const router = express.Router();

// // ==================== PUBLIC ROUTES ====================
// router.get('/slug/:id', courseController.getCourseSmart);
// router.get('/published', courseController.getPublishedCourses);
// router.get('/master-data', courseController.getCourseMasterData);
// router.get('/:id/structure', courseController.getCourseStructure);
// router.get('/:id', courseController.getCourseSmart);
// router.get('/', courseController.getAllCourses);

// // ==================== NESTED ROUTES ====================
// router.use('/:courseId/sections', sectionRouter);

// // ==================== PROTECTED ROUTES ====================
// router.use(protect);

// // Instructor's courses
// router.get('/instructor/my-courses', courseController.getMyInstructorCourses);

// // Course CRUD
// router.post('/', 
//   restrictTo('instructor', 'admin'),
//   courseController.setPrimaryInstructor,
//   courseController.initializeInstructors,
//   courseController.validateMasterFields,
//   courseController.createCourse
// );

// router.patch('/:id', 
//   restrictTo('instructor', 'admin'),
//   courseController.checkCoursePermission,
//   courseController.validateMasterFields,
//   courseController.updateCourse
// );

// // ==================== PUBLISH/UNPUBLISH ROUTES ====================
// router.patch('/:id/publish', 
//   restrictTo('instructor', 'admin'),
//   courseController.checkPublishPermission,
//   courseController.publishCourse
// );

// router.patch('/:id/unpublish', 
//   restrictTo('instructor', 'admin'),
//   courseController.checkPublishPermission,
//   courseController.unpublishCourse
// );

// router.patch('/:id/toggle-publish', 
//   restrictTo('instructor', 'admin'),
//   courseController.checkPublishPermission,
//   courseController.togglePublishStatus
// );

// // ==================== BULK PUBLISH/UNPUBLISH ROUTES ====================
// router.post('/bulk/publish', 
//   restrictTo('admin'),
//   courseController.bulkPublishCourses
// );

// router.post('/bulk/unpublish', 
//   restrictTo('admin'),
//   courseController.bulkUnpublishCourses
// );

// // ==================== APPROVAL ROUTES ====================
// router.patch('/:id/approve', 
//   restrictTo('admin'),
//   courseController.approveCourse
// );

// router.patch('/:id/reject', 
//   restrictTo('admin'),
//   courseController.rejectCourse
// );

// // ==================== INSTRUCTOR MANAGEMENT ROUTES ====================
// router.post('/:id/instructors',
//   restrictTo('instructor', 'admin'),
//   courseController.checkCoursePermission,
//   courseController.addInstructor
// );

// router.patch('/:id/instructors/:instructorId/permissions',
//   restrictTo('instructor', 'admin'),
//   courseController.checkCoursePermission,
//   courseController.updateInstructorPermissions
// );

// router.delete('/:id/instructors/:instructorId',
//   restrictTo('instructor', 'admin'),
//   courseController.checkCoursePermission,
//   courseController.removeInstructor
// );

// router.get('/:id/instructors',
//   courseController.getCourseInstructors
// );

// // ==================== INVITATION ROUTES ====================
// router.post('/:id/invitations',
//   restrictTo('instructor', 'admin'),
//   courseController.checkCoursePermission,
//   courseController.createInvitation
// );

// router.get('/:id/invitations',
//   restrictTo('instructor', 'admin'),
//   courseController.checkCoursePermission,
//   courseController.getCourseInvitations
// );

// router.post('/invitations/accept',
//   protect,
//   courseController.acceptInvitation
// );

// router.patch('/invitations/:invitationId/revoke',
//   restrictTo('instructor', 'admin'),
//   courseController.revokeInvitation
// );
// // router.get('/slug/:slug/quizzes', courseController.getCourseQuizzes);

// // ==================== ANALYTICS ====================
// router.get('/:id/analytics',
//   restrictTo('instructor', 'admin'),
//   courseController.checkCoursePermission,
//   courseController.getCourseAnalytics
// );

// // ==================== DELETE/RESTORE ====================
// router.delete('/:id', 
//   restrictTo('instructor', 'admin'),
//   courseController.checkCoursePermission,
//   courseController.deleteCourse
// );

// router.patch('/:id/restore', 
//   restrictTo('admin'),
//   courseController.restoreCourse
// );

// // ==================== BULK OPERATIONS ====================
// router.post('/bulk/create', 
//   restrictTo('admin'),
//   courseController.bulkCreateCourses  
// );
// router.patch('/bulk/update', 
//   restrictTo('admin'),
//   courseController.bulkUpdateCourses
// );

// router.delete('/bulk/delete', 
//   restrictTo('admin'),
//   courseController.bulkDeleteCourses
// );

// router.get('/count/total', courseController.countCourses);

// module.exports = router;
