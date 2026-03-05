const { Course, Category, Section, Lesson, Enrollment, ProgressTracking, Review } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');
const slugify = require('slugify');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');

// ==========================================
// CORE COURSE CREATION
// ==========================================
exports.createCourse = catchAsync(async (req, res, next) => {
  req.body.instructor = req.user.id;
  
  if (req.body.title) {
    const baseSlug = slugify(req.body.title, { lower: true, strict: true });
    const randomString = Math.random().toString(36).substring(2, 6);
    req.body.slug = `${baseSlug}-${randomString}`;
  }

  const course = await Course.create(req.body);

  res.status(201).json({ status: 'success', data: { course } });
});

// ==========================================
// PUBLIC STOREFRONT & DISCOVERY
// ==========================================

exports.getTopRatedCourses = catchAsync(async (req, res, next) => {
  const limit = req.query.limit * 1 || 8;
  const courses = await Course.find({ isPublished: true, isApproved: true, isDeleted: false })
    .sort({ rating: -1, totalEnrollments: -1 }) // Sort by best rating, then most popular
    .limit(limit)
    .populate('instructor', 'firstName lastName profilePicture')
    .select('title slug thumbnail price discountPrice rating totalRatings totalEnrollments level');

  res.status(200).json({ status: 'success', results: courses.length, data: { courses } });
});

exports.getRelatedCourses = catchAsync(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
  if (!course) return next(new AppError('Course not found', 404));

  const relatedCourses = await Course.find({
    category: course.category,
    _id: { $ne: course._id }, // Exclude current course
    isPublished: true,
    isApproved: true,
    isDeleted: false
  })
  .sort({ rating: -1 })
  .limit(4)
  .select('title slug thumbnail price rating level instructor');

  res.status(200).json({ status: 'success', results: relatedCourses.length, data: { relatedCourses } });
});

// ==========================================
// THE ULTIMATE SYLLABUS ENGINE
// ==========================================

exports.getCourseWithContent = catchAsync(async (req, res, next) => {
  const course = await Course.findOne({ 
    slug: req.params.slug,
    isDeleted: false
  }).populate('category', 'name slug').populate('instructor', 'firstName lastName profilePicture bio totalStudents totalReviews');

  if (!course) return next(new AppError('No course found with that slug', 404));

  // 1. Authenticate user silently
  let currentUser = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    const token = req.headers.authorization.split(' ')[1];
    try {
      const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
      currentUser = decoded.id;
    } catch (err) { /* Ignore */ }
  }

  // 2. Access Control & Progress
  let isEnrolled = false;
  let isOwner = currentUser && course.instructor._id.toString() === currentUser.toString();
  let progress = null;

  if (currentUser && !isOwner) {
    // const enrollment = await Enrollment.findOne({ student: currentUser, course: course._id, isActive: true });
    const enrollment = await Enrollment.findOne({ student: currentUser, course: course._id, isActive: true });
    isEnrolled = !!enrollment;

    // PRO FEATURE: If enrolled, fetch their exact progress tracking document
    if (isEnrolled) {
      progress = await ProgressTracking.findOne({ student: currentUser, course: course._id }).select('courseProgressPercentage completedLessons completedQuizzes');
    }
  }

  // 3. Fetch Syllabus & Mask Content
  const sections = await Section.find({ course: course._id, isDeleted: false, isPublished: true }).sort('order').lean();
  
  const sectionsWithLessons = await Promise.all(
    sections.map(async (section) => {
      let lessons = await Lesson.find({ section: section._id, isDeleted: false, isPublished: true }).sort('order').lean();
      
      lessons = lessons.map(lesson => {
        // PRO FEATURE: Tag completed lessons if progress exists
        if (progress && progress.completedLessons) {
          lesson.isCompleted = progress.completedLessons.some(cl => cl.lesson.toString() === lesson._id.toString());
        }

        if (!isEnrolled && !isOwner && !lesson.isFree) {
          delete lesson.content;
          delete lesson.resources;
          lesson.isLocked = true; 
        }
        return lesson;
      });
      
      return { ...section, lessons };
    })
  );

  // 4. Fetch Top Reviews for the sales page
  const reviews = await Review.find({ course: course._id, isApproved: true })
    .sort('-helpfulCount -rating')
    .limit(3)
    .populate('user', 'firstName lastName profilePicture');

  res.status(200).json({
    status: 'success',
    data: {
      course,
      isEnrolled,
      isOwner,
      userProgress: progress ? progress.courseProgressPercentage : 0,
      sections: sectionsWithLessons,
      recentReviews: reviews
    }
  });
});

// ==========================================
// PRO FEATURE: DEEP CLONING
// ==========================================
exports.cloneCourse = catchAsync(async (req, res, next) => {
  const originalCourseId = req.params.id;
  
  // 1. Find original
  const originalCourse = await Course.findOne({ _id: originalCourseId, instructor: req.user.id }).lean();
  if (!originalCourse) return next(new AppError('Course not found or unauthorized', 404));

  // 2. Clone Course Document
  delete originalCourse._id;
  originalCourse.title = `${originalCourse.title} (Copy)`;
  originalCourse.slug = `${originalCourse.slug}-copy-${Math.random().toString(36).substring(2, 6)}`;
  originalCourse.isPublished = false;
  originalCourse.isApproved = false;
  originalCourse.totalEnrollments = 0;
  originalCourse.rating = 0;
  originalCourse.totalReviews = 0;
  
  const clonedCourse = await Course.create(originalCourse);

  // 3. Clone Sections and Lessons
  const originalSections = await Section.find({ course: originalCourseId }).lean();
  
  for (const oSection of originalSections) {
    const sectionId = oSection._id;
    delete oSection._id;
    oSection.course = clonedCourse._id;
    const clonedSection = await Section.create(oSection);

    const originalLessons = await Lesson.find({ section: sectionId }).lean();
    for (const oLesson of originalLessons) {
      delete oLesson._id;
      oLesson.course = clonedCourse._id;
      oLesson.section = clonedSection._id;
      await Lesson.create(oLesson);
    }
  }

  res.status(201).json({
    status: 'success',
    message: 'Course successfully cloned.',
    data: { course: clonedCourse }
  });
});

// ==========================================
// INSTRUCTOR DASHBOARD & ANALYTICS
// ==========================================
exports.getMyCourses = catchAsync(async (req, res, next) => {
  const courses = await Course.find({ instructor: req.user.id, isDeleted: false })
    .populate('category', 'name')
    .sort('-createdAt')
    .lean();

  res.status(200).json({ status: 'success', results: courses.length, data: { courses } });
});

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
// exports.getInstructorCourseStats = catchAsync(async (req, res, next) => {
//   const stats = await Enrollment.aggregate([
//     { $match: { course: req.params.id, isActive: true } },
//     { $lookup: { from: 'payments', localField: 'payment', foreignField: '_id', as: 'paymentDetails' } },
//     { $group: { _id: '$course', totalStudents: { $sum: 1 }, totalRevenue: { $sum: { $arrayElemAt: ['$paymentDetails.amount', 0] } } } }
//   ]);
//   res.status(200).json({ status: 'success', data: { stats: stats[0] || { totalStudents: 0, totalRevenue: 0 } } });
// });

// ==========================================
// STATE MANAGEMENT & FACTORY CRUD
// ==========================================
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

exports.getAllCourses = factory.getAll(Course, {
  searchFields: ['title', 'description', 'subtitle', 'tags'],
  populate: [
    { path: 'category', select: 'name slug' },
    { path: 'instructor', select: 'firstName lastName profilePicture' }
  ]
});

exports.getCourse = factory.getOne(Course, {
  populate: [
    { path: 'category', select: 'name slug' },
    { path: 'instructor', select: 'firstName lastName email profilePicture bio' }
  ]
});

exports.updateCourse = catchAsync(async (req, res, next) => {
  if (req.body.title) {
    const baseSlug = slugify(req.body.title, { lower: true, strict: true });
    const randomString = Math.random().toString(36).substring(2, 6);
    req.body.slug = `${baseSlug}-${randomString}`;
  }
  
  const updatedDoc = await Course.findOneAndUpdate(
    { _id: req.params.id, instructor: req.user.id, isDeleted: false }, 
    req.body, 
    { new: true, runValidators: true }
  );

  if (!updatedDoc) return next(new AppError('Course not found or unauthorized', 404));
  res.status(200).json({ status: 'success', data: { data: updatedDoc } });
});

exports.deleteCourse = factory.deleteOne(Course);




// const { Course, Category, Section, Lesson, Enrollment } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');
// const slugify = require('slugify');
// const jwt = require('jsonwebtoken');
// const { promisify } = require('util');

// // ==========================================
// // CORE COURSE CREATION & FETCHING
// // ==========================================

// exports.createCourse = catchAsync(async (req, res, next) => {
//   // 1. Enforce ownership
//   req.body.instructor = req.user.id;
  
//   // 2. Generate safe slug (adding a random string prevents crashes if two courses have the exact same name)
//   if (req.body.title) {
//     const baseSlug = slugify(req.body.title, { lower: true, strict: true });
//     const randomString = Math.random().toString(36).substring(2, 6);
//     req.body.slug = `${baseSlug}-${randomString}`;
//   }

//   const course = await Course.create(req.body);

//   res.status(201).json({
//     status: 'success',
//     data: { course }
//   });
// });

// exports.getMyCourses = catchAsync(async (req, res, next) => {
//   // Uses lean() for performance since we just need to list them
//   const courses = await Course.find({ instructor: req.user.id, isDeleted: false })
//     .populate('category', 'name')
//     .sort('-createdAt')
//     .lean();

//   res.status(200).json({
//     status: 'success',
//     results: courses.length,
//     data: { courses }
//   });
// });

// // ==========================================
// // THE SYLLABUS & PAYWALL ENGINE
// // ==========================================

// exports.getCourseWithContent = catchAsync(async (req, res, next) => {
//   const course = await Course.findOne({ 
//     slug: req.params.slug,
//     isDeleted: false,
//     isPublished: true // Only allow public viewing of published courses
//   }).populate('category', 'name slug').populate('instructor', 'firstName lastName profilePicture bio');

//   if (!course) {
//     return next(new AppError('No course found with that slug', 404));
//   }

//   // 1. Soft-check if user is logged in (since this is a public route, req.user might not exist)
//   let currentUser = null;
//   if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
//     const token = req.headers.authorization.split(' ')[1];
//     try {
//       const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
//       currentUser = decoded.id;
//     } catch (err) { /* Ignore invalid tokens on public routes */ }
//   }

//   // 2. Check Enrollment Status
//   let isEnrolled = false;
//   let isOwner = currentUser && course.instructor._id.toString() === currentUser.toString();

//   if (currentUser && !isOwner) {
//     const enrollment = await Enrollment.findOne({ student: currentUser, course: course._id, isActive: true });
//     isEnrolled = !!enrollment;
//   }

//   // 3. Fetch Syllabus
//   const sections = await Section.find({ course: course._id, isDeleted: false, isPublished: true }).sort('order').lean();
  
//   const sectionsWithLessons = await Promise.all(
//     sections.map(async (section) => {
//       let lessons = await Lesson.find({ section: section._id, isDeleted: false, isPublished: true })
//         .sort('order')
//         .lean();
      
//       // THE PAYWALL MASKING: Hide sensitive content if not enrolled/owner
//       if (!isEnrolled && !isOwner) {
//         lessons = lessons.map(lesson => {
//           if (!lesson.isFree) {
//             // Delete secure content but keep the title/duration for the syllabus display
//             delete lesson.content;
//             delete lesson.resources;
//             lesson.isLocked = true; 
//           }
//           return lesson;
//         });
//       }
      
//       return { ...section, lessons };
//     })
//   );

//   res.status(200).json({
//     status: 'success',
//     data: {
//       course,
//       isEnrolled,
//       isOwner,
//       sections: sectionsWithLessons
//     }
//   });
// });

// // ==========================================
// // STATE MANAGEMENT (Publish/Approve)
// // ==========================================

// exports.publishCourse = catchAsync(async (req, res, next) => {
//   const course = await Course.findOneAndUpdate(
//     { _id: req.params.id, instructor: req.user.id, isDeleted: false },
//     { isPublished: true, publishedAt: Date.now() },
//     { new: true, runValidators: true }
//   );

//   if (!course) return next(new AppError('No course found or you are not authorized', 404));
//   res.status(200).json({ status: 'success', data: { course } });
// });

// exports.unpublishCourse = catchAsync(async (req, res, next) => {
//   const course = await Course.findOneAndUpdate(
//     { _id: req.params.id, instructor: req.user.id, isDeleted: false },
//     { isPublished: false },
//     { new: true, runValidators: true }
//   );

//   if (!course) return next(new AppError('No course found or you are not authorized', 404));
//   res.status(200).json({ status: 'success', data: { course } });
// });

// exports.approveCourse = catchAsync(async (req, res, next) => {
//   const course = await Course.findByIdAndUpdate(
//     req.params.id,
//     { isApproved: true, approvedBy: req.user.id, approvedAt: Date.now() },
//     { new: true }
//   );

//   if (!course) return next(new AppError('No course found with that ID', 404));
//   res.status(200).json({ status: 'success', data: { course } });
// });

// // ==========================================
// // INSTRUCTOR ANALYTICS & ROSTER
// // ==========================================

// exports.getCourseStudents = catchAsync(async (req, res, next) => {
//   // Verify instructor owns this course
//   const course = await Course.findOne({ _id: req.params.id, instructor: req.user.id });
//   if (!course) return next(new AppError('Course not found or unauthorized', 404));

//   const enrollments = await Enrollment.find({ course: course._id, isActive: true })
//     .populate('student', 'firstName lastName email profilePicture')
//     .sort('-enrolledAt');

//   res.status(200).json({
//     status: 'success',
//     results: enrollments.length,
//     data: { students: enrollments.map(e => e.student) }
//   });
// });

// exports.getInstructorCourseStats = catchAsync(async (req, res, next) => {
//   // Generate stats using MongoDB Aggregation for the specific course
//   const stats = await Enrollment.aggregate([
//     { 
//       $match: { course: req.params.id, isActive: true } 
//     },
//     {
//       $lookup: {
//         from: 'payments',
//         localField: 'payment',
//         foreignField: '_id',
//         as: 'paymentDetails'
//       }
//     },
//     {
//       $group: {
//         _id: '$course',
//         totalStudents: { $sum: 1 },
//         totalRevenue: { $sum: { $arrayElemAt: ['$paymentDetails.amount', 0] } }
//       }
//     }
//   ]);

//   res.status(200).json({
//     status: 'success',
//     data: { stats: stats[0] || { totalStudents: 0, totalRevenue: 0 } }
//   });
// });

// // ==========================================
// // STANDARD FACTORY CRUD
// // ==========================================

// exports.getAllCourses = factory.getAll(Course, {
//   searchFields: ['title', 'description', 'subtitle'],
//   populate: [
//     { path: 'category', select: 'name slug' },
//     { path: 'instructor', select: 'firstName lastName profilePicture' }
//   ]
// });

// exports.getCourse = factory.getOne(Course, {
//   populate: [
//     { path: 'category', select: 'name slug' },
//     { path: 'instructor', select: 'firstName lastName email profilePicture bio' }
//   ]
// });

// // Custom update to recalculate slug if title changes
// exports.updateCourse = catchAsync(async (req, res, next) => {
//   if (req.body.title) {
//     const baseSlug = slugify(req.body.title, { lower: true, strict: true });
//     const randomString = Math.random().toString(36).substring(2, 6);
//     req.body.slug = `${baseSlug}-${randomString}`;
//   }
  
//   // Call the factory update manually
//   const updatedDoc = await Course.findOneAndUpdate(
//     { _id: req.params.id, instructor: req.user.id, isDeleted: false }, 
//     req.body, 
//     { new: true, runValidators: true }
//   );

//   if (!updatedDoc) return next(new AppError('Course not found or unauthorized', 404));
//   res.status(200).json({ status: 'success', data: { data: updatedDoc } });
// });

// exports.deleteCourse = factory.deleteOne(Course);


// // const { Course, Category, Section, Lesson, Enrollment } = require('../models');
// // const AppError = require('../utils/appError');
// // const catchAsync = require('../utils/catchAsync');
// // const factory = require('../utils/handlerFactory');

// // exports.createCourse = catchAsync(async (req, res, next) => {
// //   // Add instructor from logged in user
// //   req.body.instructor = req.user.id;
  
// //   // Generate slug from title
// //   req.body.slug = req.body.title
// //     .toLowerCase()
// //     .replace(/[^a-zA-Z0-9 ]/g, '')
// //     .replace(/\s+/g, '-');

// //   const course = await Course.create(req.body);

// //   res.status(201).json({
// //     status: 'success',
// //     data: { course }
// //   });
// // });

// // exports.getMyCourses = catchAsync(async (req, res, next) => {
// //   const courses = await Course.find({ instructor: req.user.id, isDeleted: { $ne: true } });

// //   res.status(200).json({
// //     status: 'success',
// //     results: courses.length,
// //     data: { courses }
// //   });
// // });

// // exports.getCourseWithContent = catchAsync(async (req, res, next) => {
// //   const course = await Course.findOne({ 
// //     slug: req.params.slug,
// //     isDeleted: { $ne: true }
// //   }).populate('category', 'name slug');

// //   if (!course) {
// //     return next(new AppError('No course found with that slug', 404));
// //   }

// //   // Get sections with lessons
// //   const sections = await Section.find({ 
// //     course: course._id,
// //     isDeleted: { $ne: true }
// //   }).sort('order');

// //   const sectionsWithLessons = await Promise.all(
// //     sections.map(async (section) => {
// //       const lessons = await Lesson.find({ 
// //         section: section._id,
// //         isDeleted: { $ne: true }
// //       }).sort('order').select('-__v');
      
// //       return {
// //         ...section.toObject(),
// //         lessons
// //       };
// //     })
// //   );

// //   // Check if user is enrolled (if logged in)
// //   let isEnrolled = false;
// //   if (req.user) {
// //     const enrollment = await Enrollment.findOne({
// //       student: req.user.id,
// //       course: course._id,
// //       isActive: true
// //     });
// //     isEnrolled = !!enrollment;
// //   }

// //   res.status(200).json({
// //     status: 'success',
// //     data: {
// //       course,
// //       sections: sectionsWithLessons,
// //       isEnrolled
// //     }
// //   });
// // });

// // exports.publishCourse = catchAsync(async (req, res, next) => {
// //   const course = await Course.findOneAndUpdate(
// //     { 
// //       _id: req.params.id,
// //       instructor: req.user.id,
// //       isDeleted: { $ne: true }
// //     },
// //     { 
// //       isPublished: true,
// //       publishedAt: Date.now()
// //     },
// //     { new: true, runValidators: true }
// //   );

// //   if (!course) {
// //     return next(new AppError('No course found or you are not authorized', 404));
// //   }

// //   res.status(200).json({
// //     status: 'success',
// //     data: { course }
// //   });
// // });

// // exports.approveCourse = catchAsync(async (req, res, next) => {
// //   const course = await Course.findByIdAndUpdate(
// //     req.params.id,
// //     {
// //       isApproved: true,
// //       approvedBy: req.user.id,
// //       approvedAt: Date.now()
// //     },
// //     { new: true }
// //   );

// //   if (!course) {
// //     return next(new AppError('No course found with that ID', 404));
// //   }

// //   res.status(200).json({
// //     status: 'success',
// //     data: { course }
// //   });
// // });

// // // CRUD operations using factory
// // exports.getAllCourses = factory.getAll(Course, {
// //   searchFields: ['title', 'description', 'subtitle'],
// //   populate: [
// //     { path: 'category', select: 'name slug' },
// //     { path: 'instructor', select: 'firstName lastName email' }
// //   ]
// // });



// // exports.updateCourse = factory.updateOne(Course);
// // exports.deleteCourse = factory.deleteOne(Course);