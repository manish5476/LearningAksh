const express = require('express');
const paymentController = require('../controllers/paymentController');
const authController = require('../controllers/authController');
const { checkValidId } = require('../middlewares/validateId'); // Added

const router = express.Router();

// Apply Parameter Shield
router.param('id', checkValidId);

// ALL ROUTES REQUIRE AUTHENTICATION
router.use(authController.protect);

// STUDENT / USER ROUTES
router.get('/my-payments', paymentController.getMyPayments);
router.post('/create-intent', paymentController.createPaymentIntent);
router.post('/confirm', paymentController.confirmPayment); 

// ADMIN ROUTES
router.use(authController.restrictTo('admin'));

router.post('/:id/refund', paymentController.refundPayment);

router.route('/')
  .get(paymentController.getAllPayments);

router.route('/:id')
  .get(paymentController.getPayment);

module.exports = router;





// const express = require('express');
// const paymentController = require('../controllers/paymentController');
// const authController = require('../controllers/authController');

// const router = express.Router();

// // ==========================================
// // ALL ROUTES REQUIRE AUTHENTICATION
// // ==========================================
// router.use(authController.protect);

// // ==========================================
// // STUDENT / USER ROUTES
// // ==========================================
// router.get('/my-payments', paymentController.getMyPayments);

// // The 2-Step Checkout Process
// router.post('/create-intent', paymentController.createPaymentIntent);
// router.post('/confirm', paymentController.confirmPayment); // THIS is what actually triggers enrollment for paid courses

// // ==========================================
// // ADMIN ROUTES
// // ==========================================
// router.use(authController.restrictTo('admin'));

// // Refund Management
// router.post('/:id/refund', paymentController.refundPayment);

// // Standard Admin Factory Operations
// router.route('/')
//   .get(paymentController.getAllPayments);

// router.route('/:id')
//   .get(paymentController.getPayment);

// module.exports = router;


// // const express = require('express');
// // const paymentController = require('../controllers/paymentController');
// // const authController = require('../controllers/authController');

// // const router = express.Router();

// // router.use(authController.protect);

// // router.get('/my-payments', paymentController.getMyPayments);
// // router.post('/create-intent', paymentController.createPaymentIntent);
// // router.post('/confirm', paymentController.confirmPayment); // THIS is what actually triggers enrollment for paid courses

// // router.use(authController.restrictTo('admin'));
// // router.get('/', paymentController.getAllPayments);

// // module.exports = router;






// // // const express = require('express');
// // // const paymentController = require('../controllers/paymentController');
// // // const authController = require('../controllers/authController');

// // // const router = express.Router();

// // // // Protect all routes
// // // router.use(authController.protect);

// // // // Payment routes
// // // router.get('/my-payments', paymentController.getMyPayments);
// // // router.post('/create-intent', paymentController.createPaymentIntent);
// // // router.post('/confirm', paymentController.confirmPayment);

// // // // Admin/Instructor routes
// // // router.use(authController.restrictTo('admin'));
// // // router.post('/:id/refund', paymentController.refundPayment);
// // // router.route('/')
// // //   .get(paymentController.getAllPayments);

// // // router.route('/:id')
// // //   .get(paymentController.getPayment);

// // // module.exports = router;