const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const { checkValidId } = require('../middlewares/validateId'); // Added

const router = express.Router();

// Apply Parameter Shield
// CRITICAL: We DO NOT validate :token because it is not a Mongo ObjectId!
router.param('id', checkValidId);

// Public routes
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

// Protect all routes after this middleware
router.use(authController.protect);

// User profile routes
router.get('/me', userController.getMe, userController.getUser);
router.patch('/updateMe', userController.updateMe);
router.delete('/deleteMe', userController.deleteMe);
router.get('/profile', userController.getUserProfile);

// Restrict all routes after this to admin only
router.use(authController.restrictTo('admin'));

router
  .route('/')
  .get(userController.getAllUsers);

router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;


// const express = require('express');
// const userController = require('../controllers/userController');
// const authController = require('../controllers/authController');

// const router = express.Router();

// // Public routes
// router.post('/forgotPassword', authController.forgotPassword);
// router.patch('/resetPassword/:token', authController.resetPassword);

// // Protect all routes after this middleware
// router.use(authController.protect);

// // User profile routes
// router.get('/me', userController.getMe, userController.getUser);
// router.patch('/updateMe', userController.updateMe);
// router.delete('/deleteMe', userController.deleteMe);
// router.get('/profile', userController.getUserProfile);

// // Restrict all routes after this to admin only
// router.use(authController.restrictTo('admin'));

// router
//   .route('/')
//   .get(userController.getAllUsers);

// router
//   .route('/:id')
//   .get(userController.getUser)
//   .patch(userController.updateUser)
//   .delete(userController.deleteUser);

// module.exports = router;