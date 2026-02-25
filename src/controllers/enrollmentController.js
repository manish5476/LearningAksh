const { Enrollment, Course, User, Payment } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

exports.enrollStudent = catchAsync(async (req, res, next) => {
  const { courseId, paymentId } = req.body;
  
  // Check if course exists and is published
  const course = await Course.findOne({ 
    _id: courseId, 
    isPublished: true,
    isApproved: true,
    isDeleted: { $ne: true }
  });
  
  if (!course) {
    return next(new AppError('Course not available for enrollment', 404));
  }
  
  // Check if already enrolled
  const existingEnrollment = await Enrollment.findOne({
    student: req.user.id,
    course: courseId,
    isActive: true
  });
  
  if (existingEnrollment) {
    return next(new AppError('You are already enrolled in this course', 400));
  }
  
  // Verify payment if provided
  if (paymentId) {
    const payment = await Payment.findById(paymentId);
    if (!payment || payment.status !== 'success') {
      return next(new AppError('Valid payment required for enrollment', 400));
    }
  }
  
  // Create enrollment
  const enrollment = await Enrollment.create({
    student: req.user.id,
    course: courseId,
    payment: paymentId,
    enrolledAt: Date.now(),
    isActive: true
  });
  
  // Update course enrollment count
  await Course.findByIdAndUpdate(courseId, {
    $inc: { totalEnrollments: 1 }
  });
  
  // Create progress tracking record
  const { ProgressTracking } = require('../models');
  await ProgressTracking.create({
    student: req.user.id,
    course: courseId,
    courseProgressPercentage: 0,
    lastActivity: Date.now()
  });
  
  res.status(201).json({
    status: 'success',
    data: { enrollment }
  });
});

exports.getMyEnrollments = catchAsync(async (req, res, next) => {
  const enrollments = await Enrollment.find({ 
    student: req.user.id,
    isActive: true
  })
  .populate({
    path: 'course',
    match: { isDeleted: { $ne: true } },
    populate: {
      path: 'instructor',
      select: 'firstName lastName'
    }
  })
  .populate('payment');
  
  // Filter out courses that might have been deleted
  const validEnrollments = enrollments.filter(e => e.course !== null);
  
  // Get progress for each enrollment
  const { ProgressTracking } = require('../models');
  const enrollmentsWithProgress = await Promise.all(
    validEnrollments.map(async (enrollment) => {
      const progress = await ProgressTracking.findOne({
        student: req.user.id,
        course: enrollment.course._id
      });
      
      return {
        ...enrollment.toObject(),
        progress: progress || { courseProgressPercentage: 0 }
      };
    })
  );
  
  res.status(200).json({
    status: 'success',
    results: enrollmentsWithProgress.length,
    data: { enrollments: enrollmentsWithProgress }
  });
});

exports.revokeEnrollment = catchAsync(async (req, res, next) => {
  const enrollment = await Enrollment.findOneAndUpdate(
    {
      _id: req.params.id,
      $or: [
        { student: req.user.id },
        { instructor: req.user.id } // If instructor/admin
      ]
    },
    {
      isActive: false,
      isRevoked: true
    },
    { new: true }
  );
  
  if (!enrollment) {
    return next(new AppError('No enrollment found or unauthorized', 404));
  }
  
  // Decrease course enrollment count
  await Course.findByIdAndUpdate(enrollment.course, {
    $inc: { totalEnrollments: -1 }
  });
  
  res.status(200).json({
    status: 'success',
    data: { enrollment }
  });
});

exports.getCourseStudents = catchAsync(async (req, res, next) => {
  const course = await Course.findOne({
    _id: req.params.courseId,
    instructor: req.user.id
  });
  
  if (!course && req.user.role !== 'admin') {
    return next(new AppError('You do not have access to this course', 403));
  }
  
  const enrollments = await Enrollment.find({ 
    course: req.params.courseId,
    isActive: true
  })
  .populate('student', 'firstName lastName email profilePicture')
  .populate('payment');
  
  res.status(200).json({
    status: 'success',
    results: enrollments.length,
    data: { students: enrollments }
  });
});

exports.getAllEnrollments = factory.getAll(Enrollment);
exports.getEnrollment = factory.getOne(Enrollment);