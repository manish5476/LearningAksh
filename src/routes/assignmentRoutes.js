const express = require('express');
const assignmentController = require('../controllers/assignmentController');
const authController = require('../controllers/authController');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

// 1. IMPORT MIDDLEWARE
const { checkValidId } = require('../middlewares/validateId');

const router = express.Router();

// 2. APPLY PARAMETER SHIELD
router.param('id', checkValidId);
router.param('assignmentId', checkValidId);


router.use(authController.protect);

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
// const uploadMiddleware = require('../middlewares/uploadMiddleware');

// const router = express.Router();

// router.use(authController.protect);

// // Student Routes
// router.post('/:assignmentId/submit', 
//   uploadMiddleware.uploadAssignmentFile, 
//   assignmentController.submitAssignment
// );
// router.get('/:id', assignmentController.getAssignment);

// // Instructor Routes
// router.use(authController.restrictTo('instructor', 'admin'));

// router.post('/', assignmentController.createAssignment);
// router.get('/:assignmentId/submissions', assignmentController.getAssignmentSubmissions);
// router.patch('/submissions/:id/grade', assignmentController.gradeSubmission);

// module.exports = router;