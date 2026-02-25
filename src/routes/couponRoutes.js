const express = require('express');
const couponController = require('../controllers/couponController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Public routes (for validation)
router.post('/validate', couponController.validateCoupon);
router.post('/apply', couponController.applyCoupon);

// Instructor routes
router.get('/my-coupons', couponController.getInstructorCoupons);

// CRUD operations
router.route('/')
  .post(authController.restrictTo('instructor', 'admin'), couponController.createCoupon)
  .get(authController.restrictTo('admin'), couponController.getAllCoupons);

router.route('/:id')
  .get(couponController.getCoupon)
  .patch(couponController.updateCoupon)
  .delete(couponController.deleteCoupon);

router.patch('/:id/deactivate', couponController.deactivateCoupon);

module.exports = router;