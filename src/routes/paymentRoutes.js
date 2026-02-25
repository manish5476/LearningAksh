const express = require('express');
const paymentController = require('../controllers/paymentController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Payment routes
router.get('/my-payments', paymentController.getMyPayments);
router.post('/create-intent', paymentController.createPaymentIntent);
router.post('/confirm', paymentController.confirmPayment);

// Admin/Instructor routes
router.use(authController.restrictTo('admin'));
router.post('/:id/refund', paymentController.refundPayment);
router.route('/')
  .get(paymentController.getAllPayments);

router.route('/:id')
  .get(paymentController.getPayment);

module.exports = router;