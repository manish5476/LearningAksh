const express = require('express');
const studentNoteController = require('../controllers/studentNoteController');
const authController = require('../controllers/authController');
const { checkValidId } = require('../middlewares/validateId'); // Added

const router = express.Router({ mergeParams: true });

// Apply Parameter Shield
router.param('id', checkValidId);
router.param('courseId', checkValidId);
router.param('lessonId', checkValidId);
router.param('studentId', checkValidId);

// Protect all routes
router.use(authController.protect);

// Note routes
router.get('/search', studentNoteController.searchNotes);
router.get('/', studentNoteController.getMyNotes);
router.post('/course/:courseId/lesson/:lessonId', studentNoteController.createNote);
router.get('/export/course/:courseId', studentNoteController.exportNotes);

router.route('/:id')
  .get(studentNoteController.getNote)
  .patch(studentNoteController.updateNote)
  .delete(studentNoteController.deleteNote);

// Admin only
router.use(authController.restrictTo('admin'));
router.get('/student/:studentId', studentNoteController.getStudentNotes);

module.exports = router;
// const express = require('express');
// const studentNoteController = require('../controllers/studentNoteController');
// const authController = require('../controllers/authController');

// const router = express.Router({ mergeParams: true });

// // Protect all routes
// router.use(authController.protect);

// // Note routes
// router.get('/search', studentNoteController.searchNotes);
// router.get('/', studentNoteController.getMyNotes);
// router.post('/course/:courseId/lesson/:lessonId', studentNoteController.createNote);
// router.get('/export/course/:courseId', studentNoteController.exportNotes);

// router.route('/:id')
//   .get(studentNoteController.getNote)
//   .patch(studentNoteController.updateNote)
//   .delete(studentNoteController.deleteNote);

// // Admin only
// router.use(authController.restrictTo('admin'));
// router.get('/student/:studentId', studentNoteController.getStudentNotes);

// module.exports = router;