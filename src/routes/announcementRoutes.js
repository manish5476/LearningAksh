const express = require('express');
const announcementController = require('../controllers/announcementController');
const authController = require('../controllers/authController');

const router = express.Router({ mergeParams: true });

// Protect all routes
router.use(authController.protect);

// Student routes
router.get('/course/:courseId', announcementController.getCourseAnnouncements);

// Instructor routes
router.post('/', announcementController.createAnnouncement);
router.get('/my-announcements', announcementController.getMyAnnouncements);

router.route('/:id')
  .get(announcementController.getAnnouncement)
  .patch(announcementController.updateAnnouncement)
  .delete(announcementController.deleteAnnouncement);

// Admin only
router.use(authController.restrictTo('admin'));
router.get('/', announcementController.getAllAnnouncements);

module.exports = router;