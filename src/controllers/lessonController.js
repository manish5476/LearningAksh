const { Lesson, Section, Course } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

exports.setSectionCourseIds = (req, res, next) => {
  if (!req.body.section) req.body.section = req.params.sectionId;
  
  // We'll get course from section
  next();
};

exports.createLesson = catchAsync(async (req, res, next) => {
  // Get section to verify course
  const section = await Section.findById(req.body.section).populate('course');
  if (!section) {
    return next(new AppError('No section found with that ID', 404));
  }

  // Check authorization
  if (section.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('You are not authorized to add lessons to this course', 403));
  }

  // Set course from section
  req.body.course = section.course._id;

  // Get max order for this section
  const lastLesson = await Lesson.findOne({ section: req.body.section })
    .sort('-order');
  
  req.body.order = lastLesson ? lastLesson.order + 1 : 1;

  const lesson = await Lesson.create(req.body);

  // Update section totals
  await Section.findByIdAndUpdate(req.body.section, {
    $inc: { totalLessons: 1, totalDuration: lesson.duration || 0 }
  });

  // Update course totals
  await Course.findByIdAndUpdate(section.course._id, {
    $inc: { totalLessons: 1, totalDuration: lesson.duration || 0 }
  });

  res.status(201).json({
    status: 'success',
    data: { lesson }
  });
});

exports.getLessonWithDetails = catchAsync(async (req, res, next) => {
  const lesson = await Lesson.findById(req.params.id)
    .populate('section', 'title course')
    .populate('content.quiz')
    .populate('content.assignment')
    .populate('content.codingExercise');

  if (!lesson) {
    return next(new AppError('No lesson found with that ID', 404));
  }

  // Check if user has access (enrolled or lesson is free or user is instructor)
  let hasAccess = false;
  if (req.user) {
    if (lesson.isFree) {
      hasAccess = true;
    } else if (lesson.course) {
      const Enrollment = require('../models').Enrollment;
      const enrollment = await Enrollment.findOne({
        student: req.user.id,
        course: lesson.course,
        isActive: true
      });
      hasAccess = !!enrollment;
    }

    // Instructors and admins always have access
    if (req.user.role === 'admin' || 
        (lesson.course && req.user.id === (await Course.findById(lesson.course).select('instructor')).instructor.toString())) {
      hasAccess = true;
    }
  }

  if (!hasAccess) {
    return next(new AppError('You do not have access to this lesson', 403));
  }

  res.status(200).json({
    status: 'success',
    data: { lesson }
  });
});

exports.reorderLessons = catchAsync(async (req, res, next) => {
  const { lessons } = req.body; // Array of { id, order }

  if (!Array.isArray(lessons)) {
    return next(new AppError('Lessons array is required', 400));
  }

  const section = await Section.findById(req.params.sectionId).populate('course');
  if (!section) {
    return next(new AppError('No section found with that ID', 404));
  }

  if (section.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('You are not authorized to reorder lessons', 403));
  }

  // Update each lesson's order
  await Promise.all(
    lessons.map(async ({ id, order }) => {
      await Lesson.findByIdAndUpdate(id, { order });
    })
  );

  res.status(200).json({
    status: 'success',
    message: 'Lessons reordered successfully'
  });
});

exports.getAllLessons = factory.getAll(Lesson);
exports.getLesson = factory.getOne(Lesson);
exports.updateLesson = factory.updateOne(Lesson);
exports.deleteLesson = factory.deleteOne(Lesson);