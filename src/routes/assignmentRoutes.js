const express = require('express');
const assignmentController = require('../controllers/assignmentController');
const authController = require('../controllers/authController');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

const router = express.Router();

const authMiddleWare= require('../middlewares/authMiddleware');
router.use(authMiddleWare.protect);


// Student Routes
router.post('/:assignmentId/submit', 
  uploadMiddleware.uploadAssignmentFile, 
  assignmentController.submitAssignment
);
router.get('/:id', assignmentController.getAssignment);

// Instructor Routes
router.use(authController.restrictTo('instructor', 'admin'));

router.post('/', assignmentController.createAssignment);
router.get('/:assignmentId/submissions', assignmentController.getAssignmentSubmissions);
router.patch('/submissions/:id/grade', assignmentController.gradeSubmission);

module.exports = router;
// const express = require('express');
// const assignmentController = require('../controllers/assignmentController');
// const authController = require('../controllers/authController');

// const router = express.Router();

// // Protect all routes
// const authMiddleWare= require('../middlewares/authMiddleware');
router.use(authMiddleWare.protect);


// // Student routes
// router.get('/my-submissions', assignmentController.getStudentSubmissions);
// router.post('/:assignmentId/submit', assignmentController.submitAssignment);

// // Instructor routes
// router.post('/', assignmentController.createAssignment);
// router.get('/:assignmentId/submissions', assignmentController.getAssignmentSubmissions);
// router.post('/submissions/:submissionId/grade', assignmentController.gradeAssignment);

// // CRUD operations with ownership checks
// router.route('/:id')
//   .get(assignmentController.getAssignment)
//   .patch(assignmentController.updateAssignment)
//   .delete(assignmentController.deleteAssignment);

// // Admin only
// router.use(authController.restrictTo('admin'));
// router.route('/')
//   .get(assignmentController.getAllAssignments);

// module.exports = router;