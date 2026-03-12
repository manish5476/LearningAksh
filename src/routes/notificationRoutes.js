


const express = require('express');
const notificationController = require('../controllers/notificationController');
const authController = require('../controllers/authController');
const { checkValidId } = require('../middlewares/validateId'); // Added

const router = express.Router();

// Apply Parameter Shield
router.param('id', checkValidId);

// Protect all routes
router.use(authController.protect);

// User notification routes
router.get('/my-notifications', notificationController.getMyNotifications);
router.post('/mark-read', notificationController.markAsRead);
router.patch('/:id/important', notificationController.markAsImportant);
router.delete('/:id', notificationController.deleteNotification);

// Admin only routes
router.use(authController.restrictTo('admin'));
router.post('/bulk', notificationController.createBulkNotifications);
router.route('/').get(notificationController.getAllNotifications);

router.route('/:id').get(notificationController.getNotification);

module.exports = router;


// const express = require('express');
// const notificationController = require('../controllers/notificationController');
// const authController = require('../controllers/authController');

// const router = express.Router();

// // Protect all routes
// router.use(authController.protect);

// // User notification routes
// router.get('/my-notifications', notificationController.getMyNotifications);
// router.post('/mark-read', notificationController.markAsRead);
// router.patch('/:id/important', notificationController.markAsImportant);
// router.delete('/:id', notificationController.deleteNotification);

// // Admin only routes (for broadcasting)
// router.use(authController.restrictTo('admin'));
// router.post('/bulk', notificationController.createBulkNotifications);
// router.route('/')
//   .get(notificationController.getAllNotifications);

// router.route('/:id')
//   .get(notificationController.getNotification);

// module.exports = router;