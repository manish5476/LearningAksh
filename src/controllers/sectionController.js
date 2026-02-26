const { Section, Lesson, Course } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');

exports.setCourseId = (req, res, next) => {
  if (!req.body.course) req.body.course = req.params.courseId;
  next();
};

exports.createSection = catchAsync(async (req, res, next) => {
  // Check if course exists and user is instructor
  const course = await Course.findById(req.body.course);
  if (!course) {
    return next(new AppError('No course found with that ID', 404));
  }

  if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('You are not authorized to add sections to this course', 403));
  }

  // Get max order for this course
  const lastSection = await Section.findOne({ course: req.body.course })
    .sort('-order');
  
  req.body.order = lastSection ? lastSection.order + 1 : 1;

  const section = await Section.create(req.body);

  // Update course total sections
  await Course.findByIdAndUpdate(req.body.course, {
    $inc: { totalSections: 1 }
  });

  res.status(201).json({
    status: 'success',
    data: { section }
  });
});

exports.reorderSections = catchAsync(async (req, res, next) => {
  const { sections } = req.body; // Array of { id, order }

  if (!Array.isArray(sections)) {
    return next(new AppError('Sections array is required', 400));
  }

  const course = await Course.findById(req.params.courseId);
  if (!course) {
    return next(new AppError('No course found with that ID', 404));
  }

  if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('You are not authorized to reorder sections', 403));
  }

  // Update each section's order
  await Promise.all(
    sections.map(async ({ id, order }) => {
      await Section.findByIdAndUpdate(id, { order });
    })
  );

  res.status(200).json({
    status: 'success',
    message: 'Sections reordered successfully'
  });
});

exports.getAllSections = factory.getAll(Section);
exports.getSection = factory.getOne(Section, {
  populate: {
    path: 'course',
    select: 'title slug'
  }
});
exports.updateSection = factory.updateOne(Section);
exports.deleteSection = factory.deleteOne(Section);