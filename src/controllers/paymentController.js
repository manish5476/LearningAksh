const { Payment, User, Course, MockTest, Enrollment, ProgressTracking } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Razorpay = require('razorpay');

// ==========================================
// CONFIGURATION
// ==========================================
// Set to TRUE for local development to bypass real credit card processing
const USE_DUMMY_PAYMENTS = true; 

// Initialize Razorpay if configured
let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

// ==========================================
// CORE PAYMENT FLOW
// ==========================================

exports.createPaymentIntent = catchAsync(async (req, res, next) => {
  const { itemId, itemType } = req.body; // itemId can be courseId or mockTestId
  
  let item, amount, currency = 'USD'; // Default to USD, but can dynamically pull from item
  
  // 1. Validate the Item
  if (itemType === 'course') {
    item = await Course.findById(itemId);
    if (!item) return next(new AppError('No course found with that ID', 404));
    amount = item.discountPrice || item.price;
    currency = item.currency || 'USD';
  } else if (itemType === 'mockTest') {
    item = await MockTest.findById(itemId);
    if (!item) return next(new AppError('No mock test found with that ID', 404));
    amount = item.price;
    // Assume USD or add currency to mockTest schema later
  } else {
    return next(new AppError('Invalid item type', 400));
  }
  
  if (item.isFree || amount === 0) {
    return next(new AppError('This item is free. Please use the direct enrollment route.', 400));
  }
  
  // 2. Create Pending Payment Record
  const payment = await Payment.create({
    user: req.user.id,
    [itemType]: itemId,
    amount,
    currency,
    status: 'pending',
    transactionId: `TEMP-${Date.now()}` // Temporary, updated after intent creation
  });
  
  // ==========================================
  // DUMMY MODE (Local Testing)
  // ==========================================
  if (USE_DUMMY_PAYMENTS) {
    return res.status(200).json({
      status: 'success',
      message: 'DUMMY MODE ACTIVE',
      data: {
        clientSecret: `dummy_secret_${payment._id}`,
        paymentId: payment._id,
        amount,
        currency,
        isDummy: true
      }
    });
  }

  // ==========================================
  // PRODUCTION STRIPE MODE
  // ==========================================
  if (process.env.PAYMENT_GATEWAY === 'stripe') {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: { paymentId: payment._id.toString(), userId: req.user.id, itemType, itemId }
    });
    
    payment.transactionId = paymentIntent.id;
    await payment.save();
    
    res.status(200).json({ status: 'success', data: { clientSecret: paymentIntent.client_secret, paymentId: payment._id } });
  } 
  
  // ==========================================
  // PRODUCTION RAZORPAY MODE
  // ==========================================
  else if (process.env.PAYMENT_GATEWAY === 'razorpay' && razorpay) {
    const options = {
      amount: Math.round(amount * 100), // in paise
      currency: currency.toUpperCase(),
      receipt: payment._id.toString()
    };
    
    const order = await razorpay.orders.create(options);
    payment.transactionId = order.id;
    await payment.save();
    
    res.status(200).json({ status: 'success', data: { orderId: order.id, amount: order.amount, currency: order.currency, paymentId: payment._id } });
  } else {
    return next(new AppError('Payment gateway not configured properly', 500));
  }
});

exports.confirmPayment = catchAsync(async (req, res, next) => {
  const { paymentId, transactionId, status } = req.body; // status is only used in dummy mode
  
  const payment = await Payment.findById(paymentId);
  if (!payment) return next(new AppError('No payment found with that ID', 404));
  
  if (payment.status === 'success') {
    return next(new AppError('Payment has already been processed', 400));
  }

  // ==========================================
  // DUMMY MODE VERIFICATION
  // ==========================================
  if (USE_DUMMY_PAYMENTS) {
    payment.status = status || 'success';
    payment.transactionId = transactionId || `DUMMY_TXN_${Date.now()}`;
  } 
  // ==========================================
  // PRODUCTION VERIFICATION (Stripe)
  // ==========================================
  else if (process.env.PAYMENT_GATEWAY === 'stripe') {
    const paymentIntent = await stripe.paymentIntents.retrieve(transactionId);
    if (paymentIntent.status !== 'succeeded') {
      payment.status = 'failed';
      await payment.save();
      return next(new AppError('Payment verification failed', 402));
    }
    payment.status = 'success';
    payment.transactionId = transactionId;
  }
  // (Razorpay verification logic would go here using crypto.createHmac)

  await payment.save();

  // ==========================================
  // AUTO-ENROLLMENT UPON SUCCESS
  // ==========================================
  if (payment.status === 'success') {
    if (payment.course) {
      const existingEnrollment = await Enrollment.findOne({ student: payment.user, course: payment.course });
      
      if (!existingEnrollment) {
        await Enrollment.create({
          student: payment.user,
          course: payment.course,
          payment: payment._id,
          enrolledAt: Date.now(),
          isActive: true
        });
        
        // Update Course Count
        await Course.findByIdAndUpdate(payment.course, { $inc: { totalEnrollments: 1 } });
        
        // Init Progress
        await ProgressTracking.create({ student: payment.user, course: payment.course, courseProgressPercentage: 0 });
      }
    } else if (payment.mockTest) {
      // Logic for unlocking a mock test (e.g., creating a MockTestPurchase record if you make one later)
      // For now, the successful payment record acts as the proof of purchase!
    }
  }
  
  res.status(200).json({ status: 'success', data: { payment } });
});

// ==========================================
// REFUNDS & MANAGEMENT
// ==========================================

exports.refundPayment = catchAsync(async (req, res, next) => {
  const { amount, reason } = req.body;
  const paymentId = req.params.id;
  
  const payment = await Payment.findById(paymentId);
  if (!payment) return next(new AppError('No payment found with that ID', 404));
  if (payment.status !== 'success') return next(new AppError('Only successful payments can be refunded', 400));
  
  // ==========================================
  // DUMMY MODE REFUND
  // ==========================================
  if (USE_DUMMY_PAYMENTS) {
    payment.status = 'refunded';
    payment.refundAmount = amount || payment.amount;
    payment.refundReason = reason || 'Dummy refund requested';
    payment.refundedAt = Date.now();
  } 
  // ==========================================
  // PRODUCTION STRIPE REFUND
  // ==========================================
  else if (process.env.PAYMENT_GATEWAY === 'stripe') {
    await stripe.refunds.create({
      payment_intent: payment.transactionId,
      amount: amount ? Math.round(amount * 100) : undefined // undefined refunds the full amount
    });
    
    payment.status = 'refunded';
    payment.refundAmount = amount || payment.amount;
    payment.refundReason = reason;
    payment.refundedAt = Date.now();
  } else {
    return next(new AppError('Refunds not configured for this gateway', 400));
  }

  await payment.save();
  
  // ==========================================
  // REVOKE ENROLLMENT ACCESS
  // ==========================================
  if (payment.course) {
    // Check if the refund was for the full amount. If partial, you might not want to revoke.
    // Assuming a full refund means revoking access:
    const enrollment = await Enrollment.findOneAndUpdate(
      { payment: payment._id },
      { isActive: false, isRevoked: true },
      { new: true }
    );
    
    if (enrollment) {
      await Course.findByIdAndUpdate(payment.course, { $inc: { totalEnrollments: -1 } });
    }
  }
  
  res.status(200).json({ status: 'success', data: { payment } });
});

// ==========================================
// READ OPERATIONS
// ==========================================

exports.getMyPayments = catchAsync(async (req, res, next) => {
  const payments = await Payment.find({ user: req.user.id })
    .populate('course', 'title price thumbnail')
    .populate('mockTest', 'title price')
    .sort('-createdAt');
  
  res.status(200).json({ status: 'success', results: payments.length, data: { payments } });
});

// Admin Factory Operations
exports.getAllPayments = factory.getAll(Payment, {
  populate: [
    { path: 'user', select: 'firstName lastName email' },
    { path: 'course', select: 'title' }
  ]
});
exports.getPayment = factory.getOne(Payment);





// const { Payment, Course, MockTest, Enrollment, ProgressTracking } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// // const Razorpay = require('razorpay'); // Uncomment when ready for Razorpay

// // TOGGLE THIS FOR LOCAL TESTING
// const USE_DUMMY_PAYMENTS = true; 

// exports.createPaymentIntent = catchAsync(async (req, res, next) => {
//   const { itemId, itemType } = req.body;
//   let item, amount, currency = 'USD';

//   if (itemType === 'course') {
//     item = await Course.findById(itemId);
//   } else if (itemType === 'mockTest') {
//     item = await MockTest.findById(itemId);
//   }

//   if (!item) return next(new AppError('Item not found', 404));

//   amount = item.discountPrice || item.price;

//   if (item.isFree || amount === 0) {
//     return next(new AppError('This item is free. Use the direct enrollment route.', 400));
//   }

//   // 1. Create a "Pending" Payment Record
//   const payment = await Payment.create({
//     user: req.user.id,
//     [itemType]: itemId,
//     amount,
//     currency,
//     status: 'pending',
//     transactionId: `TEMP-${Date.now()}`
//   });

//   // ==========================================
//   // DUMMY FLOW (For frontend testing)
//   // ==========================================
//   if (USE_DUMMY_PAYMENTS) {
//     return res.status(200).json({
//       status: 'success',
//       message: 'DUMMY MODE ACTIVE',
//       data: {
//         clientSecret: `dummy_secret_${payment._id}`,
//         paymentId: payment._id,
//         amount,
//         isDummy: true
//       }
//     });
//   }

//   // ==========================================
//   // ACTUAL PRODUCTION FLOW (Stripe)
//   // ==========================================
//   /*
//   const paymentIntent = await stripe.paymentIntents.create({
//     amount: Math.round(amount * 100), // Stripe expects cents
//     currency: currency.toLowerCase(),
//     metadata: { paymentId: payment._id.toString(), userId: req.user.id, itemType, itemId }
//   });

//   payment.transactionId = paymentIntent.id;
//   await payment.save();

//   res.status(200).json({
//     status: 'success',
//     data: { clientSecret: paymentIntent.client_secret, paymentId: payment._id }
//   });
//   */
// });

// exports.confirmPayment = catchAsync(async (req, res, next) => {
//   const { paymentId, transactionId } = req.body;
//   const payment = await Payment.findById(paymentId);

//   if (!payment || payment.status === 'success') {
//     return next(new AppError('Invalid payment or already processed', 400));
//   }

//   // ==========================================
//   // DUMMY FLOW (Auto-Approves)
//   // ==========================================
//   if (USE_DUMMY_PAYMENTS) {
//     payment.status = 'success';
//     payment.transactionId = `DUMMY_TXN_${Date.now()}`;
//   } 
//   // ==========================================
//   // ACTUAL PRODUCTION FLOW (Verify with Stripe)
//   // ==========================================
//   /*
//   else {
//     const paymentIntent = await stripe.paymentIntents.retrieve(transactionId);
//     if (paymentIntent.status !== 'succeeded') {
//       payment.status = 'failed';
//       await payment.save();
//       return next(new AppError('Payment verification failed', 402));
//     }
//     payment.status = 'success';
//     payment.transactionId = transactionId;
//   }
//   */

//   await payment.save();

//   // If successful, automatically generate the Enrollment
//   if (payment.status === 'success' && payment.course) {
//     const enrollmentExists = await Enrollment.findOne({ student: payment.user, course: payment.course });
    
//     if (!enrollmentExists) {
//       await Enrollment.create({
//         student: payment.user,
//         course: payment.course,
//         payment: payment._id,
//         isActive: true
//       });

//       // Initialize Progress Tracking
//       await ProgressTracking.create({ student: payment.user, course: payment.course, courseProgressPercentage: 0 });
//     }
//   }

//   res.status(200).json({ status: 'success', data: { payment } });
// });

// exports.getMyPayments = catchAsync(async (req, res, next) => {
//   const payments = await Payment.find({ user: req.user.id })
//     .populate('course', 'title price')
//     .sort('-createdAt');
//   res.status(200).json({ status: 'success', results: payments.length, data: { payments } });
// });

// // Standard Admin operations
// exports.getAllPayments = factory.getAll(Payment);
// exports.getPayment = factory.getOne(Payment);







// // const { Payment, User, Course, MockTest } = require('../models');
// // const AppError = require('../utils/appError');
// // const catchAsync = require('../utils/catchAsync');
// // const factory = require('../utils/handlerFactory');
// // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// // const Razorpay = require('razorpay');

// // // Initialize Razorpay if configured
// // let razorpay;
// // if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
// //   razorpay = new Razorpay({
// //     key_id: process.env.RAZORPAY_KEY_ID,
// //     key_secret: process.env.RAZORPAY_KEY_SECRET
// //   });
// // }

// // exports.createPaymentIntent = catchAsync(async (req, res, next) => {
// //   const { itemId, itemType } = req.body; // itemId can be courseId or mockTestId
  
// //   let item, amount, currency = 'USD';
  
// //   if (itemType === 'course') {
// //     item = await Course.findById(itemId);
// //     if (!item) {
// //       return next(new AppError('No course found with that ID', 404));
// //     }
// //     amount = item.discountPrice || item.price;
// //   } else if (itemType === 'mockTest') {
// //     item = await MockTest.findById(itemId);
// //     if (!item) {
// //       return next(new AppError('No mock test found with that ID', 404));
// //     }
// //     amount = item.price;
// //   } else {
// //     return next(new AppError('Invalid item type', 400));
// //   }
  
// //   if (item.isFree || amount === 0) {
// //     return next(new AppError('This item is free', 400));
// //   }
  
// //   // Create payment record
// //   const payment = await Payment.create({
// //     user: req.user.id,
// //     [itemType]: itemId,
// //     amount,
// //     currency,
// //     status: 'pending',
// //     transactionId: `TEMP-${Date.now()}` // Temporary, will be updated
// //   });
  
// //   // Create payment intent based on configured gateway
// //   if (process.env.PAYMENT_GATEWAY === 'stripe') {
// //     const paymentIntent = await stripe.paymentIntents.create({
// //       amount: Math.round(amount * 100), // Convert to cents
// //       currency: currency.toLowerCase(),
// //       metadata: {
// //         paymentId: payment._id.toString(),
// //         userId: req.user.id,
// //         itemType,
// //         itemId
// //       }
// //     });
    
// //     payment.transactionId = paymentIntent.id;
// //     await payment.save();
    
// //     res.status(200).json({
// //       status: 'success',
// //       data: {
// //         clientSecret: paymentIntent.client_secret,
// //         paymentId: payment._id
// //       }
// //     });
// //   } else if (process.env.PAYMENT_GATEWAY === 'razorpay' && razorpay) {
// //     const options = {
// //       amount: amount * 100, // in paise
// //       currency: 'INR',
// //       receipt: payment._id.toString()
// //     };
    
// //     const order = await razorpay.orders.create(options);
    
// //     payment.transactionId = order.id;
// //     await payment.save();
    
// //     res.status(200).json({
// //       status: 'success',
// //       data: {
// //         orderId: order.id,
// //         amount: order.amount,
// //         currency: order.currency,
// //         paymentId: payment._id
// //       }
// //     });
// //   } else {
// //     // Mock payment for development
// //     res.status(200).json({
// //       status: 'success',
// //       data: {
// //         paymentId: payment._id,
// //         amount,
// //         currency,
// //         mockPayment: true
// //       }
// //     });
// //   }
// // });

// // exports.confirmPayment = catchAsync(async (req, res, next) => {
// //   const { paymentId, transactionId, status } = req.body;
  
// //   const payment = await Payment.findById(paymentId);
  
// //   if (!payment) {
// //     return next(new AppError('No payment found with that ID', 404));
// //   }
  
// //   payment.status = status || 'success';
// //   if (transactionId) {
// //     payment.transactionId = transactionId;
// //   }
  
// //   await payment.save();
  
// //   // If payment successful, handle enrollment
// //   if (payment.status === 'success') {
// //     if (payment.course) {
// //       const { Enrollment } = require('../models');
// //       await Enrollment.create({
// //         student: payment.user,
// //         course: payment.course,
// //         payment: payment._id,
// //         enrolledAt: Date.now(),
// //         isActive: true
// //       });
      
// //       await Course.findByIdAndUpdate(payment.course, {
// //         $inc: { totalEnrollments: 1 }
// //       });
// //     } else if (payment.mockTest) {
// //       // Handle mock test purchase if needed
// //     }
// //   }
  
// //   res.status(200).json({
// //     status: 'success',
// //     data: { payment }
// //   });
// // });

// // exports.getMyPayments = catchAsync(async (req, res, next) => {
// //   const payments = await Payment.find({ user: req.user.id })
// //     .populate('course', 'title price')
// //     .populate('mockTest', 'title price')
// //     .sort('-createdAt');
  
// //   res.status(200).json({
// //     status: 'success',
// //     results: payments.length,
// //     data: { payments }
// //   });
// // });

// // exports.refundPayment = catchAsync(async (req, res, next) => {
// //   const { amount, reason } = req.body;
// //   const paymentId = req.params.id;
  
// //   const payment = await Payment.findById(paymentId);
  
// //   if (!payment) {
// //     return next(new AppError('No payment found with that ID', 404));
// //   }
  
// //   if (payment.status !== 'success') {
// //     return next(new AppError('Only successful payments can be refunded', 400));
// //   }
  
// //   // Process refund based on gateway
// //   if (process.env.PAYMENT_GATEWAY === 'stripe') {
// //     const refund = await stripe.refunds.create({
// //       payment_intent: payment.transactionId,
// //       amount: amount ? Math.round(amount * 100) : undefined
// //     });
    
// //     payment.status = 'refunded';
// //     payment.refundAmount = amount || payment.amount;
// //     payment.refundReason = reason;
// //     payment.refundedAt = Date.now();
// //     await payment.save();
    
// //     // Revoke enrollment if course payment
// //     if (payment.course) {
// //       const { Enrollment } = require('../models');
// //       await Enrollment.findOneAndUpdate(
// //         { payment: payment._id },
// //         { isActive: false, isRevoked: true }
// //       );
      
// //       await Course.findByIdAndUpdate(payment.course, {
// //         $inc: { totalEnrollments: -1 }
// //       });
// //     }
    
// //     res.status(200).json({
// //       status: 'success',
// //       data: { payment }
// //     });
// //   } else {
// //     return next(new AppError('Refund not available in current configuration', 400));
// //   }
// // });

// // // CRUD operations
// // exports.getAllPayments = factory.getAll(Payment);
// // exports.getPayment = factory.getOne(Payment);