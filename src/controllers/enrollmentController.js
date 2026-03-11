'use strict';
const catchAsync = require('../utils/catchAsync');
const EnrollmentService = require('../services/EnrollmentService');
const EnrollmentRepository = require('../repositories/EnrollmentRepository');
const LessonProgressRepository = require('../repositories/LessonProgressRepository');
const AppError = require('../utils/appError');

// ==========================
// STUDENT ACTIONS
// ==========================

exports.enrollStudent = catchAsync(async (req, res, next) => {
  const courseId = req.body.courseId || req.params.courseId;
  const enrollment = await EnrollmentService.enrollStudent(req.user.id, courseId, req.user.role);
  
  res.status(201).json({ status: 'success', data: { enrollment } });
});

exports.bulkEnroll = catchAsync(async (req, res, next) => {
  const result = await EnrollmentService.bulkEnroll(req.user.id, req.body.courseIds, req.user.role);
  res.status(201).json({ status: 'success', data: result });
});

exports.getMyEnrollments = catchAsync(async (req, res, next) => {
  const result = await EnrollmentRepository.findMany(
    req.query,
    { student: req.user.id, isActive: true },
    { path: 'course', select: 'title slug thumbnail instructor' }
  );
  
  res.status(200).json({ status: 'success', results: result.results, data: { enrollments: result.data } });
});

exports.checkEnrollment = catchAsync(async (req, res, next) => {
  const enrollment = await EnrollmentRepository.findOne({ student: req.user.id, course: req.params.courseId, isActive: true });
  res.status(200).json({ status: 'success', data: { isEnrolled: !!enrollment, enrollment } });
});

// ==========================
// PROGRESS ACTIONS
// ==========================

exports.updateLessonProgress = catchAsync(async (req, res, next) => {
  const progressData = await EnrollmentService.updateLessonProgress(
    req.user.id, 
    req.params.courseId, 
    req.body.lessonId, 
    req.body.completed, 
    req.body.timeSpent
  );
  
  res.status(200).json({ status: 'success', data: progressData });
});

exports.getEnrollmentProgress = catchAsync(async (req, res, next) => {
  // Using the new schema: fetching all completed lessons for this course
  const progressRecords = await LessonProgressRepository.findMany({}, { 
    student: req.user.id, 
    course: req.params.courseId,
    isCompleted: true
  });
  
  res.status(200).json({ status: 'success', data: { completedLessons: progressRecords.data } });
});

// ==========================
// INSTRUCTOR / ADMIN ANALYTICS
// ==========================

exports.getInstructorStats = catchAsync(async (req, res, next) => {
  const stats = await EnrollmentService.getInstructorStats(req.user.id, req.query.courseId);
  res.status(200).json({ status: 'success', data: stats });
});

exports.getCourseStudents = catchAsync(async (req, res, next) => {
  // Pass this off to a standard repository query with population
  const result = await EnrollmentRepository.findMany(
    req.query, 
    { course: req.params.courseId, isActive: true },
    { path: 'student', select: 'firstName lastName email profilePicture' }
  );
  
  res.status(200).json({ status: 'success', results: result.results, data: { students: result.data } });
});

// ==========================
// STANDARD CRUD
// ==========================
exports.getAllEnrollments = catchAsync(async (req, res, next) => {
  const result = await EnrollmentRepository.findMany(req.query);
  res.status(200).json({ status: 'success', results: result.results, data: { enrollments: result.data } });
});

exports.getEnrollment = catchAsync(async (req, res, next) => {
  const enrollment = await EnrollmentRepository.findById(req.params.id);
  res.status(200).json({ status: 'success', data: { enrollment } });
});

exports.deleteEnrollment = catchAsync(async (req, res, next) => {
  await EnrollmentRepository.deleteById(req.params.id);
  res.status(204).json({ status: 'success' });
});





// const { Enrollment, Course, User, Payment, ProgressTracking, Lesson } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');
// // const { generateCertificatePDF } = require('./certificateController'); // Uncomment when certificate module is ready
// const ExcelJS = require('exceljs');
// const PDFDocument = require('pdfkit');

// // ==========================
// // 1. STUDENT CONTROLLERS
// // ==========================

// exports.enrollStudent = catchAsync(async (req, res, next) => {
//   const { courseId } = req.body; // Removed paymentDetails from here. Payments are handled in paymentController now.
  
//   const course = await Course.findOne({ 
//     _id: courseId, 
//     isPublished: true,
//     isApproved: true,
//     isDeleted: false 
//   });
  
//   if (!course) return next(new AppError('Course not available for enrollment', 404));
  
//   // SECURITY CHECK: If it's a paid course, reject direct enrollment unless the user is an admin manually adding someone
//   if (!course.isFree && course.price > 0 && req.user.role !== 'admin') {
//     return next(new AppError('This is a paid course. Please go through the /api/payments/create-intent checkout process.', 403));
//   }
  
//   const existingEnrollment = await Enrollment.findOne({ student: req.user.id, course: courseId, isActive: true });
//   if (existingEnrollment) return next(new AppError('You are already enrolled in this course', 400));
  
//   // Create enrollment
//   const enrollment = await Enrollment.create({
//     student: req.user.id,
//     course: courseId,
//     enrolledAt: Date.now(),
//     isActive: true
//   });
  
//   // Update course enrollment count safely
//   await Course.findByIdAndUpdate(courseId, { $inc: { totalEnrollments: 1 } });
  
//   // Initialize progress tracking
//   await ProgressTracking.create({
//     student: req.user.id,
//     course: courseId,
//     courseProgressPercentage: 0,
//     lastActivity: Date.now()
//   });
  
//   res.status(201).json({
//     status: 'success',
//     data: { 
//       enrollment: await enrollment.populate([{ path: 'course', select: 'title thumbnail' }])
//     }
//   });
// });

// exports.bulkEnroll = catchAsync(async (req, res, next) => {
//   const { courseIds } = req.body;
//   if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
//     return next(new AppError('Please provide an array of course IDs', 400));
//   }
  
//   const enrollments = [];
//   const errors = [];
  
//   for (const courseId of courseIds) {
//     try {
//       const course = await Course.findOne({ _id: courseId, isPublished: true, isDeleted: false });
//       if (!course) { errors.push({ courseId, error: 'Course not found' }); continue; }
      
//       // Prevent bulk enrolling into paid courses for free!
//       if (!course.isFree && req.user.role !== 'admin') {
//         errors.push({ courseId, error: 'Cannot bulk-enroll into paid courses directly.' }); continue;
//       }

//       const existing = await Enrollment.findOne({ student: req.user.id, course: courseId, isActive: true });
//       if (existing) { errors.push({ courseId, error: 'Already enrolled' }); continue; }
      
//       const enrollment = await Enrollment.create({ student: req.user.id, course: courseId, isActive: true });
//       await Course.findByIdAndUpdate(courseId, { $inc: { totalEnrollments: 1 } });
//       await ProgressTracking.create({ student: req.user.id, course: courseId, courseProgressPercentage: 0, lastActivity: Date.now() });
      
//       enrollments.push(enrollment);
//     } catch (err) {
//       errors.push({ courseId, error: err.message });
//     }
//   }
  
//   res.status(201).json({ status: 'success', data: { enrollments, errors: errors.length > 0 ? errors : undefined } });
// });

// exports.checkEnrollment = catchAsync(async (req, res, next) => {
//   const enrollment = await Enrollment.findOne({ student: req.user.id, course: req.params.courseId, isActive: true })
//     .populate('course', 'title instructor');
//   res.status(200).json({ status: 'success', data: { isEnrolled: !!enrollment, enrollment: enrollment || undefined } });
// });

// exports.getEnrollmentProgress = catchAsync(async (req, res, next) => {
//   const progress = await ProgressTracking.findOne({ student: req.user.id, course: req.params.courseId });
//   if (!progress) return next(new AppError('Progress or Enrollment not found', 404));
//   res.status(200).json({ status: 'success', data: { progress } });
// });

// exports.updateLessonProgress = catchAsync(async (req, res, next) => {
//   const { lessonId, completed, timeSpent } = req.body;
//   const { courseId } = req.params;
  
//   const enrollment = await Enrollment.findOne({ student: req.user.id, course: courseId, isActive: true });
//   if (!enrollment) return next(new AppError('You are not enrolled in this course', 404));
  
//   let progress = await ProgressTracking.findOne({ student: req.user.id, course: courseId });
//   if (!progress) {
//     progress = await ProgressTracking.create({ student: req.user.id, course: courseId, courseProgressPercentage: 0 });
//   }
  
//   const lessonIndex = progress.completedLessons.findIndex(l => l.lesson.toString() === lessonId);
  
//   if (completed && lessonIndex === -1) {
//     progress.completedLessons.push({ lesson: lessonId, completedAt: new Date(), timeSpent: timeSpent || 0 });
//   } else if (!completed && lessonIndex !== -1) {
//     progress.completedLessons.splice(lessonIndex, 1);
//   }
  
//   // Optimized progress calculation using Course schema instead of DB counting
//   const course = await Course.findById(courseId);
//   if (course && course.totalLessons > 0) {
//     progress.courseProgressPercentage = Math.round((progress.completedLessons.length / course.totalLessons) * 100);
//   }
  
//   progress.totalTimeSpent = (progress.totalTimeSpent || 0) + (timeSpent || 0);
//   progress.lastActivity = new Date();
  
//   if (progress.courseProgressPercentage >= 100 && !progress.isCompleted) {
//     progress.isCompleted = true;
//     progress.completedAt = new Date();
//   }
  
//   await progress.save();
//   res.status(200).json({ status: 'success', data: { progress } });
// });

// exports.completeCourse = catchAsync(async (req, res, next) => {
//   const { courseId } = req.params;
  
//   const enrollment = await Enrollment.findOne({ student: req.user.id, course: courseId, isActive: true });
//   if (!enrollment) return next(new AppError('You are not enrolled in this course', 404));
  
//   const progress = await ProgressTracking.findOneAndUpdate(
//     { student: req.user.id, course: courseId },
//     { isCompleted: true, completedAt: new Date(), courseProgressPercentage: 100 },
//     { new: true }
//   );
  
//   const certificateUrl = `/api/certificates/generate/${enrollment._id}`;
//   res.status(200).json({ status: 'success', data: { certificateUrl, progress } });
// });

// exports.getRecommendedCourses = catchAsync(async (req, res, next) => {
//   const limit = parseInt(req.query.limit) || 5;
//   const enrollments = await Enrollment.find({ student: req.user.id, isActive: true }).select('course');
//   const enrolledCourseIds = enrollments.map(e => e.course);
  
//   const userCourses = await Course.find({ _id: { $in: enrolledCourseIds }, isPublished: true }).select('category tags');
//   const categories = userCourses.map(c => c.category);
//   const tags = userCourses.flatMap(c => c.tags || []);
  
//   const recommendations = await Course.find({
//     _id: { $nin: enrolledCourseIds },
//     isPublished: true,
//     isApproved: true,
//     isDeleted: false,
//     $or: [{ category: { $in: categories } }, { tags: { $in: tags } }]
//   })
//   .limit(limit)
//   .populate('instructor', 'firstName lastName profilePicture');
  
//   res.status(200).json({ status: 'success', data: { recommendations } });
// });

// exports.getStudentTimeline = catchAsync(async (req, res, next) => {
//   const enrollments = await Enrollment.find({ student: req.user.id, isActive: true })
//     .populate('course', 'title slug')
//     .sort('-enrolledAt');
  
//   const timeline = await Promise.all(
//     enrollments.map(async (enrollment) => {
//       const progress = await ProgressTracking.findOne({ student: req.user.id, course: enrollment.course._id });
//       return {
//         type: 'enrollment',
//         date: enrollment.enrolledAt,
//         course: enrollment.course.title,
//         progress: progress?.courseProgressPercentage || 0,
//         completed: progress?.isCompleted || false,
//         completedAt: progress?.completedAt
//       };
//     })
//   );
  
//   res.status(200).json({ status: 'success', data: { timeline } });
// });

// // ==========================
// // 2. INSTRUCTOR CONTROLLERS
// // ==========================

// exports.getCourseStudents = catchAsync(async (req, res, next) => {
//   const course = await Course.findOne({ _id: req.params.courseId, instructor: req.user.id });
//   if (!course && req.user.role !== 'admin') return next(new AppError('You do not have access to this course', 403));
  
//   const enrollments = await Enrollment.find({ course: req.params.courseId, isActive: true })
//     .populate('student', 'firstName lastName email profilePicture')
//     .populate('payment')
//     .lean();
  
//   const studentsWithProgress = await Promise.all(
//     enrollments.map(async (enrollment) => {
//       const progress = await ProgressTracking.findOne({ student: enrollment.student._id, course: req.params.courseId }).lean();
//       return { ...enrollment, progress: progress || { courseProgressPercentage: 0 } };
//     })
//   );
  
//   res.status(200).json({ status: 'success', results: studentsWithProgress.length, data: { students: studentsWithProgress } });
// });

// exports.getInstructorStats = catchAsync(async (req, res, next) => {
//   const courseId = req.query.courseId;
//   let query = {};
  
//   if (courseId) {
//     query.course = courseId;
//   } else {
//     const courses = await Course.find({ instructor: req.user.id }).select('_id');
//     query.course = { $in: courses.map(c => c._id) };
//   }
  
//   const enrollments = await Enrollment.find(query).populate('course').populate('payment');
  
//   const totalEnrollments = enrollments.length;
//   const activeEnrollments = enrollments.filter(e => e.isActive).length;
//   const completedEnrollments = await ProgressTracking.countDocuments({ course: query.course, isCompleted: true });
  
//   const totalRevenue = enrollments.reduce((sum, e) => sum + (e.payment?.amount || 0), 0);
  
//   const byCourse = enrollments.reduce((acc, e) => {
//     const courseTitle = e.course?.title || 'Unknown';
//     if (!acc[courseTitle]) acc[courseTitle] = { count: 0, revenue: 0 };
//     acc[courseTitle].count++;
//     if (e.payment) acc[courseTitle].revenue += e.payment.amount || 0;
//     return acc;
//   }, {});
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       totalEnrollments, activeEnrollments, completedEnrollments, totalRevenue,
//       byCourse: Object.entries(byCourse).map(([course, stats]) => ({ course, ...stats }))
//     }
//   });
// });

// exports.getCourseAnalytics = catchAsync(async (req, res, next) => {
//   const course = await Course.findById(req.params.courseId);
//   if (!course) return next(new AppError('Course not found', 404));
//   if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') return next(new AppError('Unauthorized', 403));
  
//   const enrollments = await Enrollment.find({ course: req.params.courseId, isActive: true });
//   const progress = await ProgressTracking.find({ course: req.params.courseId });
  
//   const completed = progress.filter(p => p.isCompleted).length;
//   const completionRate = enrollments.length > 0 ? (completed / enrollments.length) * 100 : 0;
//   const avgProgress = progress.reduce((sum, p) => sum + (p.courseProgressPercentage || 0), 0) / (progress.length || 1);
  
//   const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
//   const dailyActive = await ProgressTracking.aggregate([
//     { $match: { course: course._id, lastActivity: { $gte: thirtyDaysAgo } } },
//     { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastActivity' } }, count: { $sum: 1 } } },
//     { $sort: { _id: 1 } }
//   ]);
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       totalEnrollments: enrollments.length, completed, completionRate, avgProgress, dailyActive,
//       enrollmentsOverTime: await getEnrollmentsOverTime(course._id)
//     }
//   });
// });

// exports.getCompletionRate = catchAsync(async (req, res, next) => {
//   const { courseId } = req.params;
//   const enrollments = await Enrollment.find({ course: courseId, isActive: true });
//   const completed = await ProgressTracking.countDocuments({ course: courseId, isCompleted: true });
//   const rate = enrollments.length > 0 ? (completed / enrollments.length) * 100 : 0;
//   res.status(200).json({ status: 'success', data: { rate: Math.round(rate * 100) / 100, completed, total: enrollments.length } });
// });

// exports.getActiveEnrollmentsCount = catchAsync(async (req, res, next) => {
//   const { courseId } = req.params;
//   let query = { isActive: true };
//   if (courseId) query.course = courseId;
//   else if (req.user.role === 'instructor') {
//     const courses = await Course.find({ instructor: req.user.id }).select('_id');
//     query.course = { $in: courses.map(c => c._id) };
//   }
//   const count = await Enrollment.countDocuments(query);
//   res.status(200).json({ status: 'success', data: { count } });
// });

// exports.sendReminder = catchAsync(async (req, res, next) => {
//   const { courseId } = req.params;
//   const { message } = req.body;
//   const course = await Course.findById(courseId);
//   if (!course) return next(new AppError('Course not found', 404));
//   if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') return next(new AppError('Unauthorized', 403));
  
//   const enrollments = await Enrollment.find({ course: courseId, isActive: true }).populate('student');
  
//   // NOTE: Hook up your nodemailer / AWS SES logic here
//   const emailPromises = enrollments.map(e => Promise.resolve());
//   await Promise.all(emailPromises);
  
//   res.status(200).json({ status: 'success', message: `Reminders sent to ${enrollments.length} students` });
// });

// exports.exportEnrollments = catchAsync(async (req, res, next) => {
//   const { courseId } = req.params;
//   const format = req.query.format || 'csv';
  
//   const course = await Course.findById(courseId);
//   if (!course) return next(new AppError('Course not found', 404));
//   if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') return next(new AppError('Unauthorized', 403));
  
//   const enrollments = await Enrollment.find({ course: courseId, isActive: true })
//     .populate('student', 'firstName lastName email').populate('payment');
  
//   if (format === 'csv') {
//     const csv = generateEnrollmentCSV(enrollments);
//     res.setHeader('Content-Type', 'text/csv');
//     res.setHeader('Content-Disposition', `attachment; filename=enrollments-${courseId}.csv`);
//     res.send(csv);
//   } else if (format === 'excel') {
//     const workbook = new ExcelJS.Workbook();
//     const worksheet = workbook.addWorksheet('Enrollments');
//     worksheet.columns = [
//       { header: 'Student Name', key: 'name', width: 30 },
//       { header: 'Email', key: 'email', width: 30 },
//       { header: 'Enrolled Date', key: 'date', width: 15 },
//       { header: 'Payment', key: 'payment', width: 15 },
//       { header: 'Status', key: 'status', width: 10 }
//     ];
//     enrollments.forEach(e => worksheet.addRow({
//       name: `${e.student.firstName} ${e.student.lastName}`, email: e.student.email,
//       date: e.enrolledAt.toLocaleDateString(), payment: e.payment ? `$${e.payment.amount}` : 'Free', status: e.isActive ? 'Active' : 'Inactive'
//     }));
//     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//     res.setHeader('Content-Disposition', `attachment; filename=enrollments-${courseId}.xlsx`);
//     await workbook.xlsx.write(res);
//     res.end();
//   }
// });

// // ==========================
// // 3. ADMIN CONTROLLERS
// // ==========================

// exports.getAdminStats = catchAsync(async (req, res, next) => {
//   const totalEnrollments = await Enrollment.countDocuments();
//   const activeEnrollments = await Enrollment.countDocuments({ isActive: true });
//   const totalRevenue = await Payment.aggregate([
//     { $match: { status: 'success' } },
//     { $group: { _id: null, total: { $sum: '$amount' } } }
//   ]);
  
//   const byMonth = await Enrollment.aggregate([
//     { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$enrolledAt' } }, count: { $sum: 1 } } },
//     { $sort: { _id: 1 } },
//     { $limit: 12 }
//   ]);
  
//   res.status(200).json({ status: 'success', data: { totalEnrollments, activeEnrollments, totalRevenue: totalRevenue[0]?.total || 0, byMonth } });
// });

// exports.getEnrollmentTrends = catchAsync(async (req, res, next) => {
//   const { startDate, endDate, groupBy = 'day' } = req.query;
//   let dateFormat = groupBy === 'day' ? '%Y-%m-%d' : (groupBy === 'week' ? '%Y-%W' : '%Y-%m');
  
//   const match = {};
//   if (startDate || endDate) {
//     match.enrolledAt = {};
//     if (startDate) match.enrolledAt.$gte = new Date(startDate);
//     if (endDate) match.enrolledAt.$lte = new Date(endDate);
//   }
  
//   const trends = await Enrollment.aggregate([
//     { $match: match },
//     { $group: { _id: { $dateToString: { format: dateFormat, date: '$enrolledAt' } }, count: { $sum: 1 } } },
//     { $sort: { _id: 1 } }
//   ]);
  
//   res.status(200).json({ status: 'success', data: { trends } });
// });

// exports.generateReport = catchAsync(async (req, res, next) => {
//   const { startDate, endDate, format = 'pdf' } = req.query;
//   const match = {};
//   if (startDate || endDate) {
//     match.enrolledAt = {};
//     if (startDate) match.enrolledAt.$gte = new Date(startDate);
//     if (endDate) match.enrolledAt.$lte = new Date(endDate);
//   }
  
//   const enrollments = await Enrollment.find(match)
//     .populate('student', 'firstName lastName email').populate('course', 'title').populate('payment').sort('-enrolledAt');
  
//   if (format === 'pdf') {
//     const doc = new PDFDocument();
//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', 'attachment; filename=enrollment-report.pdf');
//     doc.pipe(res);
//     doc.fontSize(20).text('Enrollment Report', { align: 'center' }).moveDown();
//     doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`);
//     doc.text(`Total Enrollments: ${enrollments.length}`);
//     doc.end();
//   } else if (format === 'csv') {
//     const csv = generateEnrollmentCSV(enrollments);
//     res.setHeader('Content-Type', 'text/csv');
//     res.setHeader('Content-Disposition', 'attachment; filename=enrollment-report.csv');
//     res.send(csv);
//   }
// });

// exports.exportAllEnrollments = catchAsync(async (req, res, next) => {
//   const format = req.query.format || 'csv';
//   const enrollments = await Enrollment.find({}).populate('student', 'firstName lastName email').populate('course', 'title').populate('payment');
  
//   if (format === 'csv') {
//     const csv = generateEnrollmentCSV(enrollments);
//     res.setHeader('Content-Type', 'text/csv');
//     res.setHeader('Content-Disposition', 'attachment; filename=all-enrollments.csv');
//     res.send(csv);
//   }
// });

// exports.cancelEnrollment = catchAsync(async (req, res, next) => {
//   const enrollment = await Enrollment.findByIdAndUpdate(req.params.id, { isActive: false, isRevoked: true }, { new: true });
//   if (!enrollment) return next(new AppError('No enrollment found with that ID', 404));
//   await Course.findByIdAndUpdate(enrollment.course, { $inc: { totalEnrollments: -1 } });
//   res.status(200).json({ status: 'success', data: { enrollment } });
// });

// exports.refundEnrollment = catchAsync(async (req, res, next) => {
//   const { reason } = req.body;
//   const enrollment = await Enrollment.findById(req.params.id).populate('payment');
//   if (!enrollment) return next(new AppError('No enrollment found', 404));
  
//   if (enrollment.payment) {
//     enrollment.payment.status = 'refunded';
//     enrollment.payment.refundAmount = enrollment.payment.amount;
//     enrollment.payment.refundReason = reason;
//     enrollment.payment.refundedAt = new Date();
//     await enrollment.payment.save();
//   }
  
//   enrollment.isActive = false;
//   enrollment.isRevoked = true;
//   await enrollment.save();
//   await Course.findByIdAndUpdate(enrollment.course, { $inc: { totalEnrollments: -1 } });
  
//   res.status(200).json({ status: 'success', data: { enrollment } });
// });

// exports.transferEnrollment = catchAsync(async (req, res, next) => {
//   const { newStudentId, oldStudentId, courseId } = req.body;
//   const existing = await Enrollment.findOne({ student: newStudentId, course: courseId, isActive: true });
//   if (existing) return next(new AppError('Student is already enrolled', 400));
  
//   const enrollment = await Enrollment.findByIdAndUpdate(req.params.id, { student: newStudentId }, { new: true });
//   await ProgressTracking.findOneAndUpdate({ student: oldStudentId, course: courseId }, { student: newStudentId });
  
//   res.status(200).json({ status: 'success', data: { enrollment } });
// });

// exports.getEnrollmentInvoices = catchAsync(async (req, res, next) => {
//   const enrollment = await Enrollment.findById(req.params.id).populate('payment');
//   if (!enrollment) return next(new AppError('No enrollment found', 404));
//   res.status(200).json({ status: 'success', data: { invoices: enrollment.payment ? [enrollment.payment] : [] } });
// });

// // ==========================
// // 4. HELPER FUNCTIONS
// // ==========================

// function generateEnrollmentCSV(enrollments) {
//   const headers = ['Student Name', 'Email', 'Course', 'Enrolled Date', 'Payment Amount', 'Status'];
//   const rows = enrollments.map(e => [
//     `${e.student?.firstName || ''} ${e.student?.lastName || ''}`,
//     e.student?.email || '', e.course?.title || 'Unknown',
//     e.enrolledAt?.toLocaleDateString() || '',
//     e.payment ? `$${e.payment.amount}` : 'Free',
//     e.isActive ? 'Active' : 'Inactive'
//   ]);
//   return [headers, ...rows].map(row => row.join(',')).join('\n');
// }

// async function getEnrollmentsOverTime(courseId) {
//   const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
//   return await Enrollment.aggregate([
//     { $match: { course: courseId, enrolledAt: { $gte: thirtyDaysAgo } }},
//     { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$enrolledAt' } }, count: { $sum: 1 } }},
//     { $sort: { _id: 1 } }
//   ]);
// }

// // ==========================
// // 5. CRUD OPERATIONS
// // ==========================
// exports.getAllEnrollments = factory.getAll(Enrollment, { populate: [{ path: 'student', select: 'firstName lastName email' }, { path: 'course', select: 'title' }, { path: 'payment' }] });
// exports.getEnrollment = factory.getOne(Enrollment, { populate: [{ path: 'student' }, { path: 'course' }, { path: 'payment' }] });
// exports.updateEnrollment = factory.updateOne(Enrollment);
// exports.deleteEnrollment = factory.deleteOne(Enrollment);


// exports.enrollInCourse = catchAsync(async (req, res, next) => {
//   const courseId = req.params.courseId || req.params.id;

//   // 1. Find the course
//   const course = await Course.findById(courseId);
//   if (!course) {
//     return next(new AppError('No course found with that ID', 404));
//   }

//   // 2. Check if the user is already enrolled
//   const existingEnrollment = await Enrollment.findOne({
//     student: req.user.id,
//     course: courseId,
//     isActive: true
//   });

//   if (existingEnrollment) {
//     return res.status(200).json({
//       status: 'success',
//       message: 'You are already enrolled in this course.',
//       data: { enrollment: existingEnrollment }
//     });
//   }

//   // 3. Handle Paid vs. Free Courses
//   // If the course is paid, this is where you'd normally integrate Stripe/Razorpay.
//   // For now, if it's paid, we block it unless a payment ID is provided (or you can bypass for testing).
//   if (!course.isFree) {
//     // TODO: In the future, verify payment status here before enrolling
//     // return next(new AppError('This is a premium course. Payment is required.', 402));
    
//     // TEMPORARY BYPASS FOR TESTING PAID COURSES:
//     console.warn('Enrolling in a paid course without payment for testing purposes.');
//   }

//   // 4. Create the enrollment
//   const enrollment = await Enrollment.create({
//     course: courseId,
//     student: req.user.id,
//     isActive: true
//   });

//   // Note: Your Mongoose hook on enrollmentSchema will automatically fire here 
//   // and update the totalEnrollments count on the Course model!

//   res.status(201).json({
//     status: 'success',
//     message: 'Successfully enrolled in the course!',
//     data: { enrollment }
//   });
// });

// exports.getMyEnrollments = catchAsync(async (req, res, next) => {
//   const enrollments = await Enrollment.find({ student: req.user.id, isActive: true })
//     .populate('course', 'title slug thumbnail instructor');

//   res.status(200).json({
//     status: 'success',
//     results: enrollments.length,
//     data: { enrollments }
//   });
// });
