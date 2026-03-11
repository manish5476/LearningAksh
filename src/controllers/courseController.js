'use strict';
const catchAsync = require('../utils/catchAsync');
const CourseService = require('../services/CourseService');
const CourseRepository = require('../repositories/CourseRepository');

// ==========================================
// CORE COURSE CREATION & UPDATING
// ==========================================
exports.createCourse = catchAsync(async (req, res, next) => {
  const course = await CourseService.createCourse(req.user.id, req.body);
  res.status(201).json({ status: 'success', data: { course } });
});

exports.updateCourse = catchAsync(async (req, res, next) => {
  const updatedCourse = await CourseService.updateCourse(req.params.id, req.user.id, req.body);
  res.status(200).json({ status: 'success', data: { data: updatedCourse } });
});

exports.cloneCourse = catchAsync(async (req, res, next) => {
  const clonedCourse = await CourseService.cloneCourse(req.params.id, req.user.id);
  res.status(201).json({
    status: 'success',
    message: 'Course successfully cloned.',
    data: { course: clonedCourse }
  });
});

// ==========================================
// PUBLIC STOREFRONT & DISCOVERY
// ==========================================
exports.getTopRatedCourses = catchAsync(async (req, res, next) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 8;
  const courses = await CourseService.getTopRatedCourses(limit);
  res.status(200).json({ status: 'success', results: courses.length, data: { courses } });
});

exports.getRelatedCourses = catchAsync(async (req, res, next) => {
  const relatedCourses = await CourseService.getRelatedCourses(req.params.id);
  res.status(200).json({ status: 'success', results: relatedCourses.length, data: { relatedCourses } });
});

exports.getAllCourses = catchAsync(async (req, res, next) => {
  // Using Repository directly for simple queries
  const result = await CourseRepository.findMany(req.query, {}, [
    { path: 'category', select: 'name slug' },
    { path: 'instructor', select: 'firstName lastName profilePicture' }
  ]);
  
  res.status(200).json({ 
    status: 'success', 
    results: result.results,
    pagination: result.pagination,
    data: { courses: result.data } 
  });
});

// ==========================================
// INSTRUCTOR DASHBOARD
// ==========================================
exports.getMyCourses = catchAsync(async (req, res, next) => {
  const result = await CourseRepository.findMany({}, { instructor: req.user.id }, 'category');
  res.status(200).json({ status: 'success', results: result.results, data: { courses: result.data } });
});

exports.getCourseStudents = catchAsync(async (req, res, next) => {
  const students = await CourseService.getCourseStudents(req.params.id, req.user.id);
  res.status(200).json({ status: 'success', results: students.length, data: { students } });
});

exports.getCourse = catchAsync(async (req, res, next) => {
  // Fetches the heavily populated course for the Angular frontend
  const data = await CourseService.getInstructorCourseDetails(req.params.id, req.user.id);
  res.status(200).json({ status: 'success', data });
});

exports.getInstructorCourse = catchAsync(async (req, res, next) => {
  const course = await CourseRepository.findOne({ _id: req.params.id, instructor: req.user.id });
  if (!course) return next(new AppError('Course not found or unauthorized', 404));
  res.status(200).json({ status: 'success', data: { data: course } });
});

// ==========================================
// STATE MANAGEMENT
// ==========================================
exports.publishCourse = catchAsync(async (req, res, next) => {
  const course = await CourseService.changeCourseStatus(req.params.id, req.user.id, true);
  res.status(200).json({ status: 'success', data: { course } });
});

exports.unpublishCourse = catchAsync(async (req, res, next) => {
  const course = await CourseService.changeCourseStatus(req.params.id, req.user.id, false);
  res.status(200).json({ status: 'success', data: { course } });
});

exports.approveCourse = catchAsync(async (req, res, next) => {
  const course = await CourseService.approveCourse(req.params.id, req.user.id);
  res.status(200).json({ status: 'success', data: { course } });
});

// ==========================================
// THE ULTIMATE SYLLABUS ENGINE
// ==========================================
exports.getCourseWithContent = catchAsync(async (req, res, next) => {
  // Extract token from header if it exists (Optional Auth)
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  // Pass token to service so the service can decode it cleanly without polluting the controller
  const syllabusData = await CourseService.getSyllabusWithAccessControl(req.params.slug, token);

  res.status(200).json({
    status: 'success',
    data: syllabusData
  });
});




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

// exports.getCourseStudents = catchAsync(async (req, res, next) => {
//   const course = await Course.findOne({ _id: req.params.id, instructor: req.user.id });
//   if (!course) return next(new AppError('Course not found or unauthorized', 404));

//   const enrollments = await Enrollment.find({ course: course._id, isActive: true })
//     .populate('student', 'firstName lastName email profilePicture')
//     .sort('-enrolledAt');

//   res.status(200).json({ status: 'success', results: enrollments.length, data: { students: enrollments.map(e => e.student) } });
// });


// exports.getInstructorCourse = catchAsync(async (req, res, next) => {
//   // Find course by ID and ensure the logged-in user is the instructor
//   const course = await Course.findOne({ 
//     _id: req.params.id, 
//     instructor: req.user.id,
//     isDeleted: false 
//   });

//   if (!course) {
//     return next(new AppError('Course not found or unauthorized', 404));
//   }

//   res.status(200).json({
//     status: 'success',
//     data: { data: course }
//   });
// });
// // exports.getInstructorCourseStats = catchAsync(async (req, res, next) => {
// //   const stats = await Enrollment.aggregate([
// //     { $match: { course: req.params.id, isActive: true } },
// //     { $lookup: { from: 'payments', localField: 'payment', foreignField: '_id', as: 'paymentDetails' } },
// //     { $group: { _id: '$course', totalStudents: { $sum: 1 }, totalRevenue: { $sum: { $arrayElemAt: ['$paymentDetails.amount', 0] } } } }
// //   ]);
// //   res.status(200).json({ status: 'success', data: { stats: stats[0] || { totalStudents: 0, totalRevenue: 0 } } });
// // });

// // ==========================================
// // STATE MANAGEMENT & FACTORY CRUD
// // ==========================================
// exports.publishCourse = catchAsync(async (req, res, next) => {
//   const course = await Course.findOneAndUpdate(
//     { _id: req.params.id, instructor: req.user.id, isDeleted: false },
//     { isPublished: true, publishedAt: Date.now() },
//     { new: true, runValidators: true }
//   );
//   if (!course) return next(new AppError('Course not found or unauthorized', 404));
//   res.status(200).json({ status: 'success', data: { course } });
// });

// exports.unpublishCourse = catchAsync(async (req, res, next) => {
//   const course = await Course.findOneAndUpdate(
//     { _id: req.params.id, instructor: req.user.id, isDeleted: false },
//     { isPublished: false },
//     { new: true, runValidators: true }
//   );
//   if (!course) return next(new AppError('Course not found or unauthorized', 404));
//   res.status(200).json({ status: 'success', data: { course } });
// });

// exports.approveCourse = catchAsync(async (req, res, next) => {
//   const course = await Course.findByIdAndUpdate(req.params.id, { isApproved: true, approvedBy: req.user.id, approvedAt: Date.now() }, { new: true });
//   if (!course) return next(new AppError('No course found with that ID', 404));
//   res.status(200).json({ status: 'success', data: { course } });
// });


// exports.formatQueryBooleans = (req, res, next) => {
//   // Convert string booleans to actual booleans for the query
//   Object.keys(req.query).forEach(key => {
//     if (req.query[key] === 'true') req.query[key] = true;
//     if (req.query[key] === 'false') req.query[key] = false;
//   });
//   next();
// };

// // exports.getAllCourses = [
// //   exports.formatQueryBooleans, 
// //   factory.getAll(Course, {
// //     searchFields: ['title', 'description', 'subtitle', 'tags'],
// //     populate: [
// //       { path: 'category', select: 'name slug' },
// //       { path: 'instructor', select: 'firstName lastName profilePicture' }
// //     ]
// //   })
// // ];

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