const mongoose = require('mongoose');
const slugify = require('slugify');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const {Course,Category,Section,Lesson,Enrollment,ProgressTracking,Review,Payment} = require('../models');

const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');
const CacheService = require('../services/cacheService');
const ApiFeatures = require('../utils/ApiFeatures');


exports.getCourseAnalytics = catchAsync(async (req, res, next) => {
  const { identifier } = req.params;

  const query = identifier.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: identifier } 
      : { slug: identifier };

  const course = await Course.findOne(query);

  if (!course) {
      return next(new AppError('No course found with that ID or slug', 404));
  }

  const courseId = course._id;

  // 2. Fetch all related data in parallel for performance
  // UPGRADE: Added .populate() to get the student's actual details
  const [enrollments, payments, reviews, progressData] = await Promise.all([
      Enrollment.find({ course: courseId })
        .populate('student', 'firstName lastName email profilePicture') 
        .sort('-createdAt'), // Sort so newest students are first
      Payment.find({ course: courseId, status: 'success' }),
      Review.find({ course: courseId, isApproved: true }),
      ProgressTracking.find({ course: courseId })
  ]);

  // 3. Calculate Financial Metrics
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  
  // 4. Calculate Enrollment & Engagement Metrics
  const totalEnrollments = enrollments.length;
  const activeEnrollments = enrollments.filter(e => e.isActive).length;
  
  // 5. Calculate Completion Rates
  const completedCount = progressData.filter(p => p.isCompleted).length;
  const completionRate = totalEnrollments > 0 
      ? ((completedCount / totalEnrollments) * 100).toFixed(2) 
      : 0;

  // 6. Calculate Average Progress
  const avgProgress = progressData.length > 0
      ? (progressData.reduce((acc, p) => acc + (p.progressPercentage || 0), 0) / progressData.length).toFixed(2)
      : 0;

  // 7. Aggregate Ratings
  const avgRating = reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : course.rating; // Fallback to course model rating

  // 8. Format the Student List
  // UPGRADE: Map through enrollments to create a clean list of students
  const studentList = enrollments.map(enrollment => {
      // Safely access student properties in case a user was deleted from the DB
      const student = enrollment.student || {}; 
      
      // Find this specific student's progress if it exists
      const studentProgress = progressData.find(
          p => p.student?.toString() === student._id?.toString()
      );

      return {
          id: student._id,
          firstName: student.firstName || 'Unknown',
          lastName: student.lastName || 'User',
          email: student.email,
          profilePicture: student.profilePicture,
          enrolledAt: enrollment.createdAt,
          isActive: enrollment.isActive,
          progressPercentage: studentProgress ? studentProgress.progressPercentage : 0,
          isCompleted: studentProgress ? studentProgress.isCompleted : false
      };
  });

  // 9. Construct Response
  res.status(200).json({
      status: 'success',
      data: {
          courseInfo: {
              id: course._id,
              title: course.title,
              slug: course.slug,
              price: course.price
          },
          stats: {
              revenue: {
                  total: totalRevenue,
                  currency: 'USD',
                  transactionCount: payments.length
              },
              enrollment: {
                  total: totalEnrollments,
                  active: activeEnrollments,
                  inactive: totalEnrollments - activeEnrollments
              },
              engagement: {
                  averageRating: parseFloat(avgRating),
                  totalReviews: reviews.length,
                  completionRate: parseFloat(completionRate),
                  averageProgress: parseFloat(avgProgress)
              }
          },
          // UPGRADE: Add the beautifully formatted student list to the response payload!
          students: studentList 
      }
  });
});

// exports.getCourseAnalytics = catchAsync(async (req, res, next) => {
//   const { identifier } = req.params;

//   const query = identifier.match(/^[0-9a-fA-F]{24}$/) 
//       ? { _id: identifier } 
//       : { slug: identifier };

//   const course = await Course.findOne(query);

//   if (!course) {
//       return next(new AppError('No course found with that ID or slug', 404));
//   }

//   const courseId = course._id;

//   // 2. Fetch all related data in parallel for performance
//   const [enrollments, payments, reviews, progressData] = await Promise.all([
//       Enrollment.find({ course: courseId }),
//       Payment.find({ course: courseId, status: 'success' }),
//       Review.find({ course: courseId, isApproved: true }),
//       ProgressTracking.find({ course: courseId })
//   ]);

//   // 3. Calculate Financial Metrics
//   const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  
//   // 4. Calculate Enrollment & Engagement Metrics
//   const totalEnrollments = enrollments.length;
//   const activeEnrollments = enrollments.filter(e => e.isActive).length;
  
//   // 5. Calculate Completion Rates
//   const completedCount = progressData.filter(p => p.isCompleted).length;
//   const completionRate = totalEnrollments > 0 
//       ? ((completedCount / totalEnrollments) * 100).toFixed(2) 
//       : 0;

//   // 6. Calculate Average Progress
//   const avgProgress = progressData.length > 0
//       ? (progressData.reduce((acc, p) => acc + (p.progressPercentage || 0), 0) / progressData.length).toFixed(2)
//       : 0;

//   // 7. Aggregate Ratings
//   const avgRating = reviews.length > 0
//       ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
//       : course.rating; // Fallback to course model rating

//   // 8. Construct Response
//   res.status(200).json({
//       status: 'success',
//       data: {
//           courseInfo: {
//               id: course._id,
//               title: course.title,
//               slug: course.slug,
//               price: course.price
//           },
//           stats: {
//               revenue: {
//                   total: totalRevenue,
//                   currency: 'USD', // Adjust as needed
//                   transactionCount: payments.length
//               },
//               enrollment: {
//                   total: totalEnrollments,
//                   active: activeEnrollments,
//                   inactive: totalEnrollments - activeEnrollments
//               },
//               engagement: {
//                   averageRating: parseFloat(avgRating),
//                   totalReviews: reviews.length,
//                   completionRate: parseFloat(completionRate),
//                   averageProgress: parseFloat(avgProgress)
//               }
//           }
//       }
//   });
// });

/* =========================================================
CREATE COURSE
========================================================= */

exports.createCourse = catchAsync(async (req, res, next) => {

  req.body.instructor = req.user.id;

  if (req.body.title) {
    const baseSlug = slugify(req.body.title, { lower: true, strict: true });
    req.body.slug = `${baseSlug}-${Date.now().toString(36)}`;
  }

  const course = await Course.create(req.body);

  await CacheService.delByPattern('cache:/courses*');

  res.status(201).json({
    status: 'success',
    data: { course }
  });

});



/* =========================================================
TOP RATED COURSES
========================================================= */

exports.getTopRatedCourses = catchAsync(async (req, res, next) => {

  const limit = Number(req.query.limit) || 8;

  const cacheKey = `courses:top:${limit}`;

  const courses = await CacheService.remember(cacheKey, 300, async () => {

    return Course.find({
      isPublished: true,
      isApproved: true,
      isDeleted: false
    })
      .sort({ rating: -1, totalEnrollments: -1 })
      .limit(limit)
      .populate('instructor', 'firstName lastName profilePicture')
      .select('title slug thumbnail price discountPrice rating totalRatings totalEnrollments level')
      .lean();

  });

  res.status(200).json({
    status: 'success',
    results: courses.length,
    data: { courses }
  });

});



/* =========================================================
RELATED COURSES
========================================================= */

exports.getRelatedCourses = catchAsync(async (req, res, next) => {

  const cacheKey = `courses:related:${req.params.id}`;

  const relatedCourses = await CacheService.remember(cacheKey, 300, async () => {

    const course = await Course.findById(req.params.id).select('category');

    if (!course) throw new AppError('Course not found', 404);

    return Course.find({
      category: course.category,
      _id: { $ne: course._id },
      isPublished: true,
      isApproved: true,
      isDeleted: false
    })
      .sort({ rating: -1 })
      .limit(4)
      .select('title slug thumbnail price rating level instructor')
      .lean();

  });

  res.status(200).json({
    status: 'success',
    results: relatedCourses.length,
    data: { relatedCourses }
  });

});



/* =========================================================
CLONE COURSE (FAST BULK VERSION)
========================================================= */

exports.cloneCourse = catchAsync(async (req, res, next) => {

  const originalCourse = await Course.findOne({
    _id: req.params.id,
    instructor: req.user.id
  }).lean();

  if (!originalCourse)
    return next(new AppError('Course not found or unauthorized', 404));

  delete originalCourse._id;

  originalCourse.title += ' (Copy)';
  originalCourse.slug = `${originalCourse.slug}-copy-${Date.now()}`;
  originalCourse.isPublished = false;
  originalCourse.isApproved = false;
  originalCourse.totalEnrollments = 0;
  originalCourse.rating = 0;
  originalCourse.totalReviews = 0;

  const clonedCourse = await Course.create(originalCourse);

  const sections = await Section.find({ course: req.params.id }).lean();
  const lessons = await Lesson.find({ course: req.params.id }).lean();

  const sectionMap = {};

  const clonedSections = sections.map(section => {

    const newId = new mongoose.Types.ObjectId();
    sectionMap[section._id] = newId;

    return {
      ...section,
      _id: newId,
      course: clonedCourse._id
    };

  });

  await Section.insertMany(clonedSections);

  const clonedLessons = lessons.map(lesson => ({
    ...lesson,
    _id: new mongoose.Types.ObjectId(),
    course: clonedCourse._id,
    section: sectionMap[lesson.section]
  }));

  await Lesson.insertMany(clonedLessons);

  await CacheService.delByPattern('courses:*');

  res.status(201).json({
    status: 'success',
    data: { course: clonedCourse }
  });

});



/* =========================================================
GET COURSE (OPTIMIZED)
========================================================= */

exports.getCourse = catchAsync(async (req, res, next) => {

  const cacheKey = `course:${req.params.id}`;

  const cached = await CacheService.get(cacheKey);

  if (cached) {
    return res.status(200).json(cached);
  }

  const course = await Course.findOne({
    _id: req.params.id,
    isDeleted: false
  })
    .populate('category', 'name slug')
    .populate('instructor', 'firstName lastName email profilePicture bio')
    .lean();

  if (!course)
    return next(new AppError('Course not found', 404));

  const sections = await Section.find({
    course: course._id,
    isDeleted: false
  })
    .sort('order')
    .lean();

  const lessons = await Lesson.find({
    course: course._id,
    isDeleted: false
  })
    .sort('order')
    .lean();

  const lessonsMap = {};

  lessons.forEach(lesson => {

    if (!lessonsMap[lesson.section])
      lessonsMap[lesson.section] = [];

    lessonsMap[lesson.section].push(lesson);

  });

  const sectionsWithLessons = sections.map(section => ({
    ...section,
    lessons: lessonsMap[section._id] || []
  }));

  const response = {
    status: 'success',
    data: {
      course,
      sections: sectionsWithLessons
    }
  };

  await CacheService.set(cacheKey, response, 600);

  res.status(200).json(response);

});



/* =========================================================
GET COURSE WITH CONTENT (SALES PAGE)
========================================================= */

exports.getCourseWithContent = catchAsync(async (req, res, next) => {

  const cacheKey = `course:content:${req.params.slug}`;

  const cached = await CacheService.get(cacheKey);

  if (cached) {
    return res.status(200).json(cached);
  }

  const course = await Course.findOne({
    slug: req.params.slug,
    isDeleted: false
  })
    .populate('category', 'name slug')
    .populate('instructor', 'firstName lastName profilePicture bio totalStudents totalReviews')
    .lean();

  if (!course)
    return next(new AppError('Course not found', 404));

  const sections = await Section.find({
    course: course._id,
    isDeleted: false,
    isPublished: true
  })
    .sort('order')
    .lean();

  const lessons = await Lesson.find({
    course: course._id,
    isDeleted: false,
    isPublished: true
  })
    .sort('order')
    .lean();

  const lessonsMap = {};

  lessons.forEach(lesson => {

    if (!lessonsMap[lesson.section])
      lessonsMap[lesson.section] = [];

    lessonsMap[lesson.section].push(lesson);

  });

  const sectionsWithLessons = sections.map(section => ({
    ...section,
    lessons: lessonsMap[section._id] || []
  }));

  const reviews = await Review.find({
    course: course._id,
    isApproved: true
  })
    .sort('-helpfulCount -rating')
    .limit(3)
    .populate('user', 'firstName lastName profilePicture')
    .lean();

  const response = {
    status: 'success',
    data: {
      course,
      sections: sectionsWithLessons,
      recentReviews: reviews
    }
  };

  await CacheService.set(cacheKey, response, 600);

  res.status(200).json(response);

});



/* =========================================================
UPDATE COURSE
========================================================= */

exports.updateCourse = catchAsync(async (req, res, next) => {

  delete req.body.slug;

  const updatedDoc = await Course.findOneAndUpdate(
    { _id: req.params.id, instructor: req.user.id, isDeleted: false },
    req.body,
    { new: true, runValidators: true }
  );

  if (!updatedDoc)
    return next(new AppError('Course not found or unauthorized', 404));

  await CacheService.delByPattern(`course:*${req.params.id}*`);

  res.status(200).json({
    status: 'success',
    data: { course: updatedDoc }
  });

});

exports.getAllCourses = catchAsync(async (req, res, next) => {

  // 1. Define base filter for public, approved, and non-deleted courses
  const baseFilter = {
    isPublished: true,
    isApproved: true,
    isDeleted: { $ne: true }
  };

  const options = {
    searchFields: ['title', 'description', 'subtitle', 'tags'],
    populate: [
      { path: 'category', select: 'name slug' },
      { path: 'instructor', select: 'firstName lastName profilePicture' }
    ]
  };

  // 2. Initialize ApiFeatures with the correct base model and query
  const features = new ApiFeatures(Course.find(baseFilter), req.query)
    .filter()
    .search(options.searchFields)
    .sort()
    .limitFields();

  // 3. Apply pagination (either standard or cursor-based)
  if (req.query.cursor) {
    features.cursorPaginate();
  } else {
    features.paginate();
  }
  
  // 4. Add population
  if (options.populate) {
    features.populate(options.populate);
  }

  // 5. Execute query and send response
  const result = await features.execute(Course);

  res.status(200).json({
    status: 'success',
    results: result.results,
    pagination: result.pagination,
    data: result.data
  });
});
exports.getMyCourses = catchAsync(async (req, res, next) => {
  const courses = await Course.find({ instructor: req.user.id, isDeleted: false })
    .populate('category', 'name')
    .sort('-createdAt')
    .lean();

  res.status(200).json({ status: 'success', results: courses.length, data: { courses } });
});
exports.deleteCourse = factory.deleteOne(Course);

exports.getCourseStudents = catchAsync(async (req, res, next) => {
  const course = await Course.findOne({ _id: req.params.id, instructor: req.user.id });
  if (!course) return next(new AppError('Course not found or unauthorized', 404));

  const enrollments = await Enrollment.find({ course: course._id, isActive: true })
    .populate('student', 'firstName lastName email profilePicture')
    .sort('-enrolledAt');

  res.status(200).json({ status: 'success', results: enrollments.length, data: { students: enrollments.map(e => e.student) } });
});


exports.getInstructorCourse = catchAsync(async (req, res, next) => {
  // Find course by ID and ensure the logged-in user is the instructor
  const course = await Course.findOne({ 
    _id: req.params.id, 
    instructor: req.user.id,
    isDeleted: false 
  });

  if (!course) {
    return next(new AppError('Course not found or unauthorized', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { data: course }
  });
});

// // ==========================================
// // STATE MANAGEMENT & FACTORY CRUD
// // ==========================================
exports.publishCourse = catchAsync(async (req, res, next) => {
  const course = await Course.findOneAndUpdate(
    { _id: req.params.id, instructor: req.user.id, isDeleted: false },
    { isPublished: true, publishedAt: Date.now() },
    { new: true, runValidators: true }
  );
  if (!course) return next(new AppError('Course not found or unauthorized', 404));
  res.status(200).json({ status: 'success', data: { course } });
});

exports.unpublishCourse = catchAsync(async (req, res, next) => {
  const course = await Course.findOneAndUpdate(
    { _id: req.params.id, instructor: req.user.id, isDeleted: false },
    { isPublished: false },
    { new: true, runValidators: true }
  );
  if (!course) return next(new AppError('Course not found or unauthorized', 404));
  res.status(200).json({ status: 'success', data: { course } });
});

exports.approveCourse = catchAsync(async (req, res, next) => {
  const course = await Course.findByIdAndUpdate(req.params.id, { isApproved: true, approvedBy: req.user.id, approvedAt: Date.now() }, { new: true });
  if (!course) return next(new AppError('No course found with that ID', 404));
  res.status(200).json({ status: 'success', data: { course } });
});

