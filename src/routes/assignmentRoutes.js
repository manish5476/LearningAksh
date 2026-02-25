const express = require('express');
const assignmentController = require('../controllers/assignmentController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Student routes
router.get('/my-submissions', assignmentController.getStudentSubmissions);
router.post('/:assignmentId/submit', assignmentController.submitAssignment);

// Instructor routes
router.post('/', assignmentController.createAssignment);
router.get('/:assignmentId/submissions', assignmentController.getAssignmentSubmissions);
router.post('/submissions/:submissionId/grade', assignmentController.gradeAssignment);

// CRUD operations with ownership checks
router.route('/:id')
  .get(assignmentController.getAssignment)
  .patch(assignmentController.updateAssignment)
  .delete(assignmentController.deleteAssignment);

// Admin only
router.use(authController.restrictTo('admin'));
router.route('/')
  .get(assignmentController.getAllAssignments);

module.exports = router;