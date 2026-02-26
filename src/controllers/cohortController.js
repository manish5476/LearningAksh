const { Cohort, Course, User, Enrollment } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');

exports.createCohort = catchAsync(async (req, res, next) => {
  const { course: courseId } = req.body;

  // Verify course exists
  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError('Course not found', 404));
  }

  // Check authorization (course instructor or admin)
  if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('You can only create cohorts for your own courses', 403));
  }

  // Set default instructors if not provided
  if (!req.body.instructors || req.body.instructors.length === 0) {
    req.body.instructors = [course.instructor];
  }

  const cohort = await Cohort.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { cohort }
  });
});

exports.enrollInCohort = catchAsync(async (req, res, next) => {
  const { cohortId } = req.params;

  const cohort = await Cohort.findById(cohortId).populate('course');
  if (!cohort) {
    return next(new AppError('Cohort not found', 404));
  }

  // Check if cohort is active
  if (!cohort.isActive) {
    return next(new AppError('This cohort is no longer active', 400));
  }

  // Check if start date hasn't passed
  if (new Date() > cohort.startDate) {
    return next(new AppError('This cohort has already started', 400));
  }

  // Check if cohort has space
  if (cohort.maxStudents && cohort.enrolledStudents.length >= cohort.maxStudents) {
    return next(new AppError('Cohort is full', 400));
  }

  // Check if already enrolled
  if (cohort.enrolledStudents.includes(req.user.id)) {
    return next(new AppError('You are already enrolled in this cohort', 400));
  }

  // Add student to cohort
  cohort.enrolledStudents.push(req.user.id);
  await cohort.save();

  // Also create regular enrollment for the course
  await Enrollment.create({
    student: req.user.id,
    course: cohort.course._id,
    enrolledAt: Date.now(),
    isActive: true,
    metadata: {
      cohort: cohort._id,
      cohortName: cohort.name
    }
  });

  res.status(200).json({
    status: 'success',
    data: { cohort }
  });
});

exports.getMyCohorts = catchAsync(async (req, res, next) => {
  const cohorts = await Cohort.find({ 
    enrolledStudents: req.user.id,
    isActive: true
  })
  .populate('course', 'title slug thumbnail')
  .populate('instructors', 'firstName lastName profilePicture')
  .sort('startDate');

  res.status(200).json({
    status: 'success',
    results: cohorts.length,
    data: { cohorts }
  });
});

exports.getInstructorCohorts = catchAsync(async (req, res, next) => {
  const cohorts = await Cohort.find({ 
    instructors: req.user.id,
    isActive: true
  })
  .populate('course', 'title slug')
  .populate('enrolledStudents', 'firstName lastName email')
  .sort('startDate');

  res.status(200).json({
    status: 'success',
    results: cohorts.length,
    data: { cohorts }
  });
});

exports.getCohortDetails = catchAsync(async (req, res, next) => {
  const cohort = await Cohort.findById(req.params.id)
    .populate('course')
    .populate('instructors', 'firstName lastName profilePicture email')
    .populate('enrolledStudents', 'firstName lastName email profilePicture');

  if (!cohort) {
    return next(new AppError('Cohort not found', 404));
  }

  // Check access (enrolled student, instructor, or admin)
  const isEnrolled = cohort.enrolledStudents.some(s => s._id.toString() === req.user.id);
  const isInstructor = cohort.instructors.some(i => i._id.toString() === req.user.id);
  
  if (!isEnrolled && !isInstructor && req.user.role !== 'admin') {
    return next(new AppError('You do not have access to this cohort', 403));
  }

  res.status(200).json({
    status: 'success',
    data: { cohort }
  });
});

exports.updateCohort = catchAsync(async (req, res, next) => {
  const cohort = await Cohort.findOneAndUpdate(
    {
      _id: req.params.id,
      instructors: req.user.id
    },
    req.body,
    { new: true, runValidators: true }
  );

  if (!cohort) {
    return next(new AppError('Cohort not found or unauthorized', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { cohort }
  });
});

exports.getCohortProgress = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const cohort = await Cohort.findById(id)
    .populate('course')
    .populate('enrolledStudents');

  if (!cohort) {
    return next(new AppError('Cohort not found', 404));
  }

  // Get progress for all students in cohort
  const { ProgressTracking } = require('../models');
  const progressData = await ProgressTracking.find({
    student: { $in: cohort.enrolledStudents.map(s => s._id) },
    course: cohort.course._id
  });

  // Calculate statistics
  const stats = {
    totalStudents: cohort.enrolledStudents.length,
    studentsCompleted: progressData.filter(p => p.isCompleted).length,
    averageProgress: progressData.reduce((acc, p) => acc + p.courseProgressPercentage, 0) / progressData.length || 0,
    averageTimeSpent: progressData.reduce((acc, p) => acc + p.totalTimeSpent, 0) / progressData.length || 0,
    studentProgress: progressData.map(p => ({
      student: cohort.enrolledStudents.find(s => s._id.toString() === p.student.toString()),
      progress: p.courseProgressPercentage,
      completed: p.isCompleted,
      lastActivity: p.lastActivity
    }))
  };

  res.status(200).json({
    status: 'success',
    data: { stats }
  });
});

// CRUD operations
exports.getAllCohorts = factory.getAll(Cohort);
exports.deleteCohort = factory.deleteOne(Cohort);