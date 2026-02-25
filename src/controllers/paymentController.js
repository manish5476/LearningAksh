const { Payment, User, Course, MockTest } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Razorpay = require('razorpay');

// Initialize Razorpay if configured
let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

exports.createPaymentIntent = catchAsync(async (req, res, next) => {
  const { itemId, itemType } = req.body; // itemId can be courseId or mockTestId
  
  let item, amount, currency = 'USD';
  
  if (itemType === 'course') {
    item = await Course.findById(itemId);
    if (!item) {
      return next(new AppError('No course found with that ID', 404));
    }
    amount = item.discountPrice || item.price;
  } else if (itemType === 'mockTest') {
    item = await MockTest.findById(itemId);
    if (!item) {
      return next(new AppError('No mock test found with that ID', 404));
    }
    amount = item.price;
  } else {
    return next(new AppError('Invalid item type', 400));
  }
  
  if (item.isFree || amount === 0) {
    return next(new AppError('This item is free', 400));
  }
  
  // Create payment record
  const payment = await Payment.create({
    user: req.user.id,
    [itemType]: itemId,
    amount,
    currency,
    status: 'pending',
    transactionId: `TEMP-${Date.now()}` // Temporary, will be updated
  });
  
  // Create payment intent based on configured gateway
  if (process.env.PAYMENT_GATEWAY === 'stripe') {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: {
        paymentId: payment._id.toString(),
        userId: req.user.id,
        itemType,
        itemId
      }
    });
    
    payment.transactionId = paymentIntent.id;
    await payment.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentId: payment._id
      }
    });
  } else if (process.env.PAYMENT_GATEWAY === 'razorpay' && razorpay) {
    const options = {
      amount: amount * 100, // in paise
      currency: 'INR',
      receipt: payment._id.toString()
    };
    
    const order = await razorpay.orders.create(options);
    
    payment.transactionId = order.id;
    await payment.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        paymentId: payment._id
      }
    });
  } else {
    // Mock payment for development
    res.status(200).json({
      status: 'success',
      data: {
        paymentId: payment._id,
        amount,
        currency,
        mockPayment: true
      }
    });
  }
});

exports.confirmPayment = catchAsync(async (req, res, next) => {
  const { paymentId, transactionId, status } = req.body;
  
  const payment = await Payment.findById(paymentId);
  
  if (!payment) {
    return next(new AppError('No payment found with that ID', 404));
  }
  
  payment.status = status || 'success';
  if (transactionId) {
    payment.transactionId = transactionId;
  }
  
  await payment.save();
  
  // If payment successful, handle enrollment
  if (payment.status === 'success') {
    if (payment.course) {
      const { Enrollment } = require('../models');
      await Enrollment.create({
        student: payment.user,
        course: payment.course,
        payment: payment._id,
        enrolledAt: Date.now(),
        isActive: true
      });
      
      await Course.findByIdAndUpdate(payment.course, {
        $inc: { totalEnrollments: 1 }
      });
    } else if (payment.mockTest) {
      // Handle mock test purchase if needed
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: { payment }
  });
});

exports.getMyPayments = catchAsync(async (req, res, next) => {
  const payments = await Payment.find({ user: req.user.id })
    .populate('course', 'title price')
    .populate('mockTest', 'title price')
    .sort('-createdAt');
  
  res.status(200).json({
    status: 'success',
    results: payments.length,
    data: { payments }
  });
});

exports.refundPayment = catchAsync(async (req, res, next) => {
  const { amount, reason } = req.body;
  const paymentId = req.params.id;
  
  const payment = await Payment.findById(paymentId);
  
  if (!payment) {
    return next(new AppError('No payment found with that ID', 404));
  }
  
  if (payment.status !== 'success') {
    return next(new AppError('Only successful payments can be refunded', 400));
  }
  
  // Process refund based on gateway
  if (process.env.PAYMENT_GATEWAY === 'stripe') {
    const refund = await stripe.refunds.create({
      payment_intent: payment.transactionId,
      amount: amount ? Math.round(amount * 100) : undefined
    });
    
    payment.status = 'refunded';
    payment.refundAmount = amount || payment.amount;
    payment.refundReason = reason;
    payment.refundedAt = Date.now();
    await payment.save();
    
    // Revoke enrollment if course payment
    if (payment.course) {
      const { Enrollment } = require('../models');
      await Enrollment.findOneAndUpdate(
        { payment: payment._id },
        { isActive: false, isRevoked: true }
      );
      
      await Course.findByIdAndUpdate(payment.course, {
        $inc: { totalEnrollments: -1 }
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: { payment }
    });
  } else {
    return next(new AppError('Refund not available in current configuration', 400));
  }
});

// CRUD operations
exports.getAllPayments = factory.getAll(Payment);
exports.getPayment = factory.getOne(Payment);