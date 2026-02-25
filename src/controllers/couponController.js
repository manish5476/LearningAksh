const { Coupon, Course } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

exports.createCoupon = catchAsync(async (req, res, next) => {
  // Auto-generate code if not provided
  if (!req.body.code) {
    req.body.code = generateCouponCode();
  } else {
    req.body.code = req.body.code.toUpperCase();
  }

  // Set creator (instructor or admin)
  if (req.user.role === 'instructor') {
    req.body.instructor = req.user.id;
  }

  const coupon = await Coupon.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { coupon }
  });
});

exports.validateCoupon = catchAsync(async (req, res, next) => {
  const { code, courseId } = req.body;

  const coupon = await Coupon.findOne({ 
    code: code.toUpperCase(),
    isActive: true,
    startDate: { $lte: new Date() },
    expiryDate: { $gte: new Date() }
  });

  if (!coupon) {
    return next(new AppError('Invalid or expired coupon code', 400));
  }

  // Check usage limit
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return next(new AppError('Coupon usage limit has been reached', 400));
  }

  // Check if coupon is valid for specific courses
  if (coupon.validForCourses && coupon.validForCourses.length > 0) {
    if (!coupon.validForCourses.includes(courseId)) {
      return next(new AppError('This coupon is not valid for the selected course', 400));
    }
  }

  // Calculate discount
  let discountAmount = 0;
  let finalPrice = 0;

  if (courseId) {
    const course = await Course.findById(courseId);
    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    const originalPrice = course.discountPrice || course.price;

    if (coupon.discountType === 'percentage') {
      discountAmount = (originalPrice * coupon.discountValue) / 100;
      finalPrice = originalPrice - discountAmount;
    } else if (coupon.discountType === 'fixed_amount') {
      discountAmount = Math.min(coupon.discountValue, originalPrice);
      finalPrice = originalPrice - discountAmount;
    } else if (coupon.discountType === 'free') {
      discountAmount = originalPrice;
      finalPrice = 0;
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      coupon: {
        id: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        description: coupon.description
      },
      discountAmount,
      finalPrice
    }
  });
});

exports.applyCoupon = catchAsync(async (req, res, next) => {
  const { code, courseId, paymentId } = req.body;

  const coupon = await Coupon.findOneAndUpdate(
    { 
      code: code.toUpperCase(),
      isActive: true,
      $expr: { $lt: ['$usedCount', '$usageLimit'] }
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  );

  if (!coupon) {
    return next(new AppError('Coupon could not be applied', 400));
  }

  // Update payment with coupon info
  const { Payment } = require('../models');
  await Payment.findByIdAndUpdate(paymentId, {
    coupon: coupon._id,
    discountAmount: req.body.discountAmount
  });

  res.status(200).json({
    status: 'success',
    message: 'Coupon applied successfully'
  });
});

exports.getInstructorCoupons = catchAsync(async (req, res, next) => {
  const coupons = await Coupon.find({ 
    instructor: req.user.id,
    $or: [
      { expiryDate: { $gt: new Date() } },
      { expiryDate: null }
    ]
  }).sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: coupons.length,
    data: { coupons }
  });
});

exports.deactivateCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findOneAndUpdate(
    { 
      _id: req.params.id,
      $or: [
        { instructor: req.user.id },
        { instructor: { $exists: false } }
      ]
    },
    { isActive: false },
    { new: true }
  );

  if (!coupon) {
    return next(new AppError('No coupon found or unauthorized', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { coupon }
  });
});

// Helper function
const generateCouponCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// CRUD operations
exports.getAllCoupons = factory.getAll(Coupon);
exports.getCoupon = factory.getOne(Coupon);
exports.updateCoupon = factory.updateOne(Coupon);
exports.deleteCoupon = factory.deleteOne(Coupon);