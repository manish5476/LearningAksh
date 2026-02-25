const { Course, Category, Section, Lesson, Enrollment } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

exports.createCourse = catchAsync(async (req, res, next) => {
  // Add instructor from logged in user
  req.body.instructor = req.user.id;
  
  // Generate slug from title
  req.body.slug = req.body.title
    .toLowerCase()
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, '-');

  const course = await Course.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { course }
  });
});

exports.getMyCourses = catchAsync(async (req, res, next) => {
  const courses = await Course.find({ instructor: req.user.id, isDeleted: { $ne: true } });

  res.status(200).json({
    status: 'success',
    results: courses.length,
    data: { courses }
  });
});

exports.getCourseWithContent = catchAsync(async (req, res, next) => {
  const course = await Course.findOne({ 
    slug: req.params.slug,
    isDeleted: { $ne: true }
  }).populate('category', 'name slug');

  if (!course) {
    return next(new AppError('No course found with that slug', 404));
  }

  // Get sections with lessons
  const sections = await Section.find({ 
    course: course._id,
    isDeleted: { $ne: true }
  }).sort('order');

  const sectionsWithLessons = await Promise.all(
    sections.map(async (section) => {
      const lessons = await Lesson.find({ 
        section: section._id,
        isDeleted: { $ne: true }
      }).sort('order').select('-__v');
      
      return {
        ...section.toObject(),
        lessons
      };
    })
  );

  // Check if user is enrolled (if logged in)
  let isEnrolled = false;
  if (req.user) {
    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: course._id,
      isActive: true
    });
    isEnrolled = !!enrollment;
  }

  res.status(200).json({
    status: 'success',
    data: {
      course,
      sections: sectionsWithLessons,
      isEnrolled
    }
  });
});

exports.publishCourse = catchAsync(async (req, res, next) => {
  const course = await Course.findOneAndUpdate(
    { 
      _id: req.params.id,
      instructor: req.user.id,
      isDeleted: { $ne: true }
    },
    { 
      isPublished: true,
      publishedAt: Date.now()
    },
    { new: true, runValidators: true }
  );

  if (!course) {
    return next(new AppError('No course found or you are not authorized', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { course }
  });
});

exports.approveCourse = catchAsync(async (req, res, next) => {
  const course = await Course.findByIdAndUpdate(
    req.params.id,
    {
      isApproved: true,
      approvedBy: req.user.id,
      approvedAt: Date.now()
    },
    { new: true }
  );

  if (!course) {
    return next(new AppError('No course found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { course }
  });
});

// CRUD operations using factory
exports.getAllCourses = factory.getAll(Course, {
  searchFields: ['title', 'description', 'subtitle'],
  populate: [
    { path: 'category', select: 'name slug' },
    { path: 'instructor', select: 'firstName lastName email' }
  ]
});

exports.getCourse = factory.getOne(Course, {
  populate: [
    { path: 'category', select: 'name slug' },
    { path: 'instructor', select: 'firstName lastName email profilePicture' }
  ]
});

exports.updateCourse = factory.updateOne(Course);
exports.deleteCourse = factory.deleteOne(Course);