const mongoose = require('mongoose');
const slugify = require('slugify');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const {
  Course,
  Category,
  Section,
  Lesson,
  Enrollment,
  ProgressTracking,
  Review
} = require('../models');

const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');
const CacheService = require('../services/cacheService');



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

exports.getAllCourses = factory.getAll(Course, {
  searchFields: ['title', 'description', 'subtitle', 'tags'],
  populate: [
    { path: 'category', select: 'name slug' },
    { path: 'instructor', select: 'firstName lastName profilePicture' }
  ]
});
exports.getMyCourses = catchAsync(async (req, res, next) => {
  const courses = await Course.find({ instructor: req.user.id, isDeleted: false })
    .populate('category', 'name')
    .sort('-createdAt')
    .lean();

  res.status(200).json({ status: 'success', results: courses.length, data: { courses } });
});
exports.deleteCourse = factory.deleteOne(Course);



// const { Course, Category, Section, Lesson, Enrollment, ProgressTracking, Review } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');
// const slugify = require('slugify');
// const jwt = require('jsonwebtoken');
// const { promisify } = require('util');

// // ==========================================
// // CORE COURSE CREATION
// // ==========================================
// exports.createCourse = catchAsync(async (req, res, next) => {
//   req.body.instructor = req.user.id;
  
//   if (req.body.title) {
//     const baseSlug = slugify(req.body.title, { lower: true, strict: true });
//     const randomString = Math.random().toString(36).substring(2, 6);
//     req.body.slug = `${baseSlug}-${randomString}`;
//   }

//   const course = await Course.create(req.body);

//   res.status(201).json({ status: 'success', data: { course } });
// });

// // ==========================================
// // PUBLIC STOREFRONT & DISCOVERY
// // ==========================================

// exports.getTopRatedCourses = catchAsync(async (req, res, next) => {
//   const limit = req.query.limit * 1 || 8;
//   const courses = await Course.find({ isPublished: true, isApproved: true, isDeleted: false })
//     .sort({ rating: -1, totalEnrollments: -1 }) // Sort by best rating, then most popular
//     .limit(limit)
//     .populate('instructor', 'firstName lastName profilePicture')
//     .select('title slug thumbnail price discountPrice rating totalRatings totalEnrollments level');

//   res.status(200).json({ status: 'success', results: courses.length, data: { courses } });
// });

// exports.getRelatedCourses = catchAsync(async (req, res, next) => {
//   const course = await Course.findById(req.params.id);
//   if (!course) return next(new AppError('Course not found', 404));

//   const relatedCourses = await Course.find({
//     category: course.category,
//     _id: { $ne: course._id }, // Exclude current course
//     isPublished: true,
//     isApproved: true,
//     isDeleted: false
//   })
//   .sort({ rating: -1 })
//   .limit(4)
//   .select('title slug thumbnail price rating level instructor');

//   res.status(200).json({ status: 'success', results: relatedCourses.length, data: { relatedCourses } });
// });


// // ==========================================
// // PRO FEATURE: DEEP CLONING
// // ==========================================
// exports.cloneCourse = catchAsync(async (req, res, next) => {
//   const originalCourseId = req.params.id;
  
//   // 1. Find original
//   const originalCourse = await Course.findOne({ _id: originalCourseId, instructor: req.user.id }).lean();
//   if (!originalCourse) return next(new AppError('Course not found or unauthorized', 404));

//   // 2. Clone Course Document
//   delete originalCourse._id;
//   originalCourse.title = `${originalCourse.title} (Copy)`;
//   originalCourse.slug = `${originalCourse.slug}-copy-${Math.random().toString(36).substring(2, 6)}`;
//   originalCourse.isPublished = false;
//   originalCourse.isApproved = false;
//   originalCourse.totalEnrollments = 0;
//   originalCourse.rating = 0;
//   originalCourse.totalReviews = 0;
  
//   const clonedCourse = await Course.create(originalCourse);

//   // 3. Clone Sections and Lessons
//   const originalSections = await Section.find({ course: originalCourseId }).lean();
  
//   for (const oSection of originalSections) {
//     const sectionId = oSection._id;
//     delete oSection._id;
//     oSection.course = clonedCourse._id;
//     const clonedSection = await Section.create(oSection);

//     const originalLessons = await Lesson.find({ section: sectionId }).lean();
//     for (const oLesson of originalLessons) {
//       delete oLesson._id;
//       oLesson.course = clonedCourse._id;
//       oLesson.section = clonedSection._id;
//       await Lesson.create(oLesson);
//     }
//   }

//   res.status(201).json({
//     status: 'success',
//     message: 'Course successfully cloned.',
//     data: { course: clonedCourse }
//   });
// });

// // ==========================================
// // INSTRUCTOR DASHBOARD & ANALYTICS
// // ==========================================
// exports.getMyCourses = catchAsync(async (req, res, next) => {
//   const courses = await Course.find({ instructor: req.user.id, isDeleted: false })
//     .populate('category', 'name')
//     .sort('-createdAt')
//     .lean();

//   res.status(200).json({ status: 'success', results: courses.length, data: { courses } });
// });

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

// exports.getAllCourses = factory.getAll(Course, {
//   searchFields: ['title', 'description', 'subtitle', 'tags'],
//   populate: [
//     { path: 'category', select: 'name slug' },
//     { path: 'instructor', select: 'firstName lastName profilePicture' }
//   ]
// });

// // exports.getCourse = factory.getOne(Course, {
// //   populate: [
// //     { path: 'category', select: 'name slug' },
// //     { path: 'instructor', select: 'firstName lastName email profilePicture bio' }
// //   ]
// // });

// // ✅ ADD THIS
// exports.getCourse = catchAsync(async (req, res, next) => {
//   // 1. Fetch the main course document
//   const course = await Course.findOne({ _id: req.params.id, isDeleted: false })
//     .populate('category', 'name slug')
//     .populate('instructor', 'firstName lastName email profilePicture bio')
//     .lean(); // .lean() makes it a standard JS object so we can attach things to it if needed

//   if (!course) {
//     return next(new AppError('No course found with that ID', 404));
//   }

//   // 2. Fetch ALL sections for this course (Notice we omit 'isPublished: true' so instructors can edit drafts)
//   const sections = await Section.find({ course: course._id, isDeleted: false })
//     .sort('order')
//     .lean();

//   // 3. Fetch ALL lessons for each section
//   const sectionsWithLessons = await Promise.all(
//     sections.map(async (section) => {
//       const lessons = await Lesson.find({ section: section._id, isDeleted: false })
//         .sort('order')
//         .lean();
      
//       return { ...section, lessons };
//     })
//   );

//   // 4. Send the response in the exact format your new Angular frontend expects
//   res.status(200).json({
//     status: 'success',
//     data: {
//       course, // The main course details
//       sections: sectionsWithLessons // The fully populated syllabus
//     }
//   });
// });
  
// // ==========================================
// // THE ULTIMATE SYLLABUS ENGINE
// // ==========================================

// exports.getCourseWithContent = catchAsync(async (req, res, next) => {
//   const course = await Course.findOne({ 
//     slug: req.params.slug,
//     isDeleted: false
//   }).populate('category', 'name slug').populate('instructor', 'firstName lastName profilePicture bio totalStudents totalReviews');

//   if (!course) return next(new AppError('No course found with that slug', 404));

//   // 1. Authenticate user silently
//   let currentUser = null;
//   if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
//     const token = req.headers.authorization.split(' ')[1];
//     try {
//       const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
//       currentUser = decoded.id;
//     } catch (err) { /* Ignore */ }
//   }

//   // 2. Access Control & Progress
//   let isEnrolled = false;
//   let isOwner = currentUser && course.instructor._id.toString() === currentUser.toString();
//   let progress = null;

//   if (currentUser && !isOwner) {
//     // const enrollment = await Enrollment.findOne({ student: currentUser, course: course._id, isActive: true });
//     const enrollment = await Enrollment.findOne({ student: currentUser, course: course._id, isActive: true });
//     isEnrolled = !!enrollment;

//     // PRO FEATURE: If enrolled, fetch their exact progress tracking document
//     if (isEnrolled) {
//       progress = await ProgressTracking.findOne({ student: currentUser, course: course._id }).select('courseProgressPercentage completedLessons completedQuizzes');
//     }
//   }

//   // 3. Fetch Syllabus & Mask Content
//   const sections = await Section.find({ course: course._id, isDeleted: false, isPublished: true }).sort('order').lean();
  
//   const sectionsWithLessons = await Promise.all(
//     sections.map(async (section) => {
//       let lessons = await Lesson.find({ section: section._id, isDeleted: false, isPublished: true }).sort('order').lean();
      
//       lessons = lessons.map(lesson => {
//         // PRO FEATURE: Tag completed lessons if progress exists
//         if (progress && progress.completedLessons) {
//           lesson.isCompleted = progress.completedLessons.some(cl => cl.lesson.toString() === lesson._id.toString());
//         }

//         if (!isEnrolled && !isOwner && !lesson.isFree) {
//           delete lesson.content;
//           delete lesson.resources;
//           lesson.isLocked = true; 
//         }
//         return lesson;
//       });
      
//       return { ...section, lessons };
//     })
//   );

//   // 4. Fetch Top Reviews for the sales page
//   const reviews = await Review.find({ course: course._id, isApproved: true })
//     .sort('-helpfulCount -rating')
//     .limit(3)
//     .populate('user', 'firstName lastName profilePicture');

//   res.status(200).json({
//     status: 'success',
//     data: {
//       course,
//       isEnrolled,
//       isOwner,
//       userProgress: progress ? progress.courseProgressPercentage : 0,
//       sections: sectionsWithLessons,
//       recentReviews: reviews
//     }
//   });
// });

// exports.updateCourse = catchAsync(async (req, res, next) => {
  
//   // 1. Remove the slug regeneration block completely.
//   // We only want to generate slugs in createCourse, NOT updateCourse.
//   if (req.body.slug) {
//      // Optional: Prevent frontend from manually updating the slug by accident
//      delete req.body.slug; 
//   }

//   const updatedDoc = await Course.findOneAndUpdate(
//     { _id: req.params.id, instructor: req.user.id, isDeleted: false }, 
//     req.body, 
//     { new: true, runValidators: true }
//   );

//   if (!updatedDoc) return next(new AppError('Course not found or unauthorized', 404));
//   res.status(200).json({ status: 'success', data: { data: updatedDoc } });
// });
// exports.deleteCourse = factory.deleteOne(Course);
