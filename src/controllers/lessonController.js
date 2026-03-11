const { Lesson, Section, Course, Enrollment, ProgressTracking } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');

// ==========================================
// HELPERS
// ==========================================

exports.setSectionCourseIds = (req, res, next) => {
  if (!req.body.section) req.body.section = req.params.sectionId;
  if (!req.filter) req.filter = {};
  if (req.params.sectionId) req.filter.section = req.params.sectionId;
  next();
};

/**
 * Strictly verifies if the user owns the parent course of this lesson.
 */
const verifyLessonOwnership = async (sectionId, userId, role, next) => {
  const section = await Section.findById(sectionId).populate('course', 'instructor');
  if (!section || !section.course) return next(new AppError('Parent section or course not found', 404));
  
  if (section.course.instructor.toString() !== userId && role !== 'admin') {
    return next(new AppError('You are not authorized to modify lessons in this course', 403));
  }
  return section;
};

/**
 * PRO FEATURE: Recalculates total duration and lesson count dynamically
 * This fixes the "Ghost Duration" bug caused by updates and deletes.
 */
const recalculateTotals = async (courseId, sectionId) => {
  // 1. Calculate Section Totals
  const sectionStats = await Lesson.aggregate([
    { $match: { section: sectionId, isDeleted: false } },
    { $group: { _id: '$section', totalDuration: { $sum: '$duration' }, totalLessons: { $sum: 1 } } }
  ]);

  if (sectionStats.length > 0) {
    await Section.findByIdAndUpdate(sectionId, {
      totalDuration: sectionStats[0].totalDuration,
      totalLessons: sectionStats[0].totalLessons
    });
  } else {
    await Section.findByIdAndUpdate(sectionId, { totalDuration: 0, totalLessons: 0 });
  }

  // 2. Calculate Course Totals
  const courseStats = await Section.aggregate([
    { $match: { course: courseId, isDeleted: false } },
    { $group: { _id: '$course', totalDuration: { $sum: '$totalDuration' }, totalLessons: { $sum: '$totalLessons' } } }
  ]);

  if (courseStats.length > 0) {
    await Course.findByIdAndUpdate(courseId, {
      totalDuration: courseStats[0].totalDuration,
      totalLessons: courseStats[0].totalLessons
    });
  } else {
    await Course.findByIdAndUpdate(courseId, { totalDuration: 0, totalLessons: 0 });
  }
};

// ==========================================
// CORE CRUD & DURATIONS
// ==========================================

exports.createLesson = catchAsync(async (req, res, next) => {
  const section = await verifyLessonOwnership(req.body.section, req.user.id, req.user.role, next);
  
  req.body.course = section.course._id;

  const lastLesson = await Lesson.findOne({ section: req.body.section, isDeleted: false }).sort('-order');
  req.body.order = lastLesson ? lastLesson.order + 1 : 1;

  const lesson = await Lesson.create(req.body);

  // Sync totals
  await recalculateTotals(section.course._id, section._id);

  res.status(201).json({ status: 'success', data: { lesson } });
});

exports.updateLesson = catchAsync(async (req, res, next) => {
  const lessonToUpdate = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
  if (!lessonToUpdate) return next(new AppError('Lesson not found', 404));

  const section = await verifyLessonOwnership(lessonToUpdate.section, req.user.id, req.user.role, next);

  const updatedLesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

  // Sync totals if duration changed
  if (req.body.duration !== undefined) {
    await recalculateTotals(section.course._id, section._id);
  }

  res.status(200).json({ status: 'success', data: { lesson: updatedLesson } });
});

exports.deleteLesson = catchAsync(async (req, res, next) => {
  const lessonToDelete = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
  if (!lessonToDelete) return next(new AppError('Lesson not found', 404));

  const section = await verifyLessonOwnership(lessonToDelete.section, req.user.id, req.user.role, next);

  await Lesson.findByIdAndUpdate(req.params.id, { isDeleted: true, isPublished: false });

  // Sync totals
  await recalculateTotals(section.course._id, section._id);

  res.status(200).json({ status: 'success', data: null });
});

// ==========================================
// BULK REORDER
// ==========================================
exports.reorderLessons = catchAsync(async (req, res, next) => {
  const { lessons } = req.body;
  if (!Array.isArray(lessons)) return next(new AppError('Lessons array is required', 400));

  await verifyLessonOwnership(req.params.sectionId, req.user.id, req.user.role, next);

  const bulkOperations = lessons.map(les => ({
    updateOne: {
      filter: { _id: les.id, section: req.params.sectionId },
      update: { $set: { order: les.order } }
    }
  }));

  if (bulkOperations.length > 0) {
    await Lesson.bulkWrite(bulkOperations);
  }

  res.status(200).json({ status: 'success', message: 'Lessons reordered successfully' });
});

// ==========================================
// ACCESS & PAYWALL
// ==========================================

exports.getLessonWithDetails = catchAsync(async (req, res, next) => {
  const lesson = await Lesson.findOne({ _id: req.params.id, isDeleted: false, isPublished: true })
    .populate('section', 'title course')
    .populate('content.quiz')
    .populate('content.assignment')
    .populate('content.codingExercise');

  if (!lesson) return next(new AppError('No published lesson found with that ID', 404));

  // Determine Access
  let hasAccess = false;
  if (lesson.isFree) {
    hasAccess = true;
  } else if (req.user.role === 'admin') {
    hasAccess = true;
  } else {
    const course = await Course.findById(lesson.course).select('instructor');
    if (course && course.instructor.toString() === req.user.id) {
      hasAccess = true; // Instructor owns it
    } else {
      const enrollment = await Enrollment.findOne({ student: req.user.id, course: lesson.course, isActive: true });
      hasAccess = !!enrollment; // Enrolled student
    }
  }

  if (!hasAccess) return next(new AppError('You do not have access to this premium lesson. Please enroll.', 403));

  res.status(200).json({ status: 'success', data: { lesson } });
});

// ==========================================
// STUDENT PROGRESS
// ==========================================

exports.markAsCompleted = catchAsync(async (req, res, next) => {
  const lesson = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
  if (!lesson) return next(new AppError('Lesson not found', 404));

  // Find or create progress tracking document
  let progress = await ProgressTracking.findOne({ student: req.user.id, course: lesson.course });
  
  if (!progress) {
    // Check if enrolled before creating progress
    const enrollment = await Enrollment.findOne({ student: req.user.id, course: lesson.course, isActive: true });
    if (!enrollment && !lesson.isFree) return next(new AppError('You are not enrolled in this course', 403));

    progress = await ProgressTracking.create({
      student: req.user.id,
      course: lesson.course,
      completedLessons: []
    });
  }

  // Check if already completed
  const isAlreadyCompleted = progress.completedLessons.some(cl => cl.lesson.toString() === lesson._id.toString());
  
  if (!isAlreadyCompleted) {
    progress.completedLessons.push({ lesson: lesson._id, completedAt: Date.now() });
    
    // Recalculate percentage
    const course = await Course.findById(lesson.course);
    if (course && course.totalLessons > 0) {
      progress.courseProgressPercentage = Math.min(100, Math.round((progress.completedLessons.length / course.totalLessons) * 100));
      
      if (progress.courseProgressPercentage === 100) {
        progress.isCompleted = true;
        progress.completedAt = Date.now();
      }
    }
    
    await progress.save();
  }

  res.status(200).json({
    status: 'success',
    data: { 
      lessonId: lesson._id, 
      completed: true, 
      courseProgressPercentage: progress.courseProgressPercentage 
    }
  });
});

exports.getLessonProgress = catchAsync(async (req, res, next) => {
  const lesson = await Lesson.findOne({ _id: req.params.id });
  if (!lesson) return next(new AppError('Lesson not found', 404));

  const progress = await ProgressTracking.findOne({ student: req.user.id, course: lesson.course });
  
  const isCompleted = progress ? progress.completedLessons.some(cl => cl.lesson.toString() === lesson._id.toString()) : false;

  res.status(200).json({ status: 'success', data: { lessonId: lesson._id, completed: isCompleted } });
});

// ==========================================
// STATE MANAGEMENT & UPLOADS
// ==========================================

exports.publishLesson = catchAsync(async (req, res, next) => {
  const lesson = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
  if (!lesson) return next(new AppError('Lesson not found', 404));
  
  await verifyLessonOwnership(lesson.section, req.user.id, req.user.role, next);

  lesson.isPublished = true;
  await lesson.save();

  res.status(200).json({ status: 'success', data: { lesson } });
});

exports.unpublishLesson = catchAsync(async (req, res, next) => {
  const lesson = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
  if (!lesson) return next(new AppError('Lesson not found', 404));
  
  await verifyLessonOwnership(lesson.section, req.user.id, req.user.role, next);

  lesson.isPublished = false;
  await lesson.save();

  res.status(200).json({ status: 'success', data: { lesson } });
});

// Placeholder controllers for file uploads
exports.uploadVideo = catchAsync(async (req, res, next) => {
  // Logic to handle AWS S3 / Cloudinary upload goes here
  res.status(200).json({ status: 'success', message: 'Video upload endpoint ready' });
});

exports.uploadAttachment = catchAsync(async (req, res, next) => {
  res.status(200).json({ status: 'success', message: 'Attachment upload endpoint ready' });
});

// Standard Factory Gets
exports.getAllLessons = factory.getAll(Lesson);
exports.getLesson = factory.getOne(Lesson);
