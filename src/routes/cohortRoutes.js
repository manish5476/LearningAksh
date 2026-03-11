const express = require('express');
const cohortController = require('../controllers/cohortController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
const authMiddleWare= require('../middlewares/authMiddleware');
router.use(authMiddleWare.protect);


// Student routes
router.get('/my-cohorts', cohortController.getMyCohorts);
router.post('/:cohortId/enroll', cohortController.enrollInCohort);

// Instructor routes
router.get('/instructor-cohorts', cohortController.getInstructorCohorts);
router.post('/', authController.restrictTo('instructor', 'admin'), cohortController.createCohort);

router.route('/:id')
  .get(cohortController.getCohortDetails)
  .patch(cohortController.updateCohort)
  .delete(cohortController.deleteCohort);

router.get('/:id/progress', cohortController.getCohortProgress);

// Admin only
router.use(authController.restrictTo('admin'));
router.get('/', cohortController.getAllCohorts);

module.exports = router;