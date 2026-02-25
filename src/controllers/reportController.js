const { Course, User, Enrollment, Payment, ProgressTracking } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

exports.generateCourseReport = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const { format = 'pdf' } = req.query;

  const course = await Course.findById(courseId)
    .populate('instructor', 'firstName lastName email')
    .populate('category', 'name');

  if (!course) {
    return next(new AppError('Course not found', 404));
  }

  // Get enrollments with student details
  const enrollments = await Enrollment.find({ course: courseId, isActive: true })
    .populate('student', 'firstName lastName email')
    .populate('payment');

  // Get progress for all students
  const progress = await ProgressTracking.find({ course: courseId });

  // Calculate statistics
  const totalStudents = enrollments.length;
  const completedStudents = progress.filter(p => p.isCompleted).length;
  const averageProgress = progress.reduce((acc, p) => acc + p.courseProgressPercentage, 0) / totalStudents || 0;
  const totalRevenue = enrollments.reduce((acc, e) => acc + (e.payment?.amount || 0), 0);

  const reportData = {
    course: {
      title: course.title,
      description: course.description,
      instructor: `${course.instructor.firstName} ${course.instructor.lastName}`,
      category: course.category?.name,
      price: course.price,
      createdAt: course.createdAt,
      totalLessons: course.totalLessons,
      totalDuration: course.totalDuration
    },
    statistics: {
      totalStudents,
      completedStudents,
      completionRate: (completedStudents / totalStudents * 100).toFixed(1) + '%',
      averageProgress: averageProgress.toFixed(1) + '%',
      totalRevenue,
      averageRevenuePerStudent: (totalRevenue / totalStudents).toFixed(2)
    },
    students: enrollments.map(e => {
      const studentProgress = progress.find(p => p.student.toString() === e.student._id.toString());
      return {
        name: `${e.student.firstName} ${e.student.lastName}`,
        email: e.student.email,
        enrolledAt: e.enrolledAt,
        progress: studentProgress?.courseProgressPercentage || 0,
        completed: studentProgress?.isCompleted || false,
        lastActivity: studentProgress?.lastActivity,
        paymentAmount: e.payment?.amount,
        paymentStatus: e.payment?.status
      };
    })
  };

  if (format === 'excel') {
    await generateExcelReport(reportData, res);
  } else {
    await generatePDFReport(reportData, res);
  }
});

exports.generateInstructorReport = catchAsync(async (req, res, next) => {
  const { instructorId } = req.params;
  const { format = 'pdf' } = req.query;

  const instructor = await User.findById(instructorId);
  if (!instructor) {
    return next(new AppError('Instructor not found', 404));
  }

  // Get instructor's courses
  const courses = await Course.find({ instructor: instructorId, isDeleted: { $ne: true } });

  // Get all enrollments for these courses
  const courseIds = courses.map(c => c._id);
  const enrollments = await Enrollment.find({ 
    course: { $in: courseIds },
    isActive: true 
  }).populate('student').populate('course');

  // Get payments
  const payments = await Payment.find({
    course: { $in: courseIds },
    status: 'success'
  });

  const reportData = {
    instructor: {
      name: `${instructor.firstName} ${instructor.lastName}`,
      email: instructor.email,
      joinedAt: instructor.createdAt
    },
    summary: {
      totalCourses: courses.length,
      totalStudents: enrollments.length,
      totalRevenue: payments.reduce((acc, p) => acc + p.amount, 0),
      averageCourseRating: courses.reduce((acc, c) => acc + c.rating, 0) / courses.length || 0
    },
    courses: courses.map(course => {
      const courseEnrollments = enrollments.filter(e => e.course._id.toString() === course._id.toString());
      const courseRevenue = payments
        .filter(p => p.course.toString() === course._id.toString())
        .reduce((acc, p) => acc + p.amount, 0);

      return {
        title: course.title,
        price: course.price,
        enrollments: courseEnrollments.length,
        revenue: courseRevenue,
        rating: course.rating,
        publishedAt: course.publishedAt
      };
    }),
    recentEnrollments: enrollments.slice(0, 20).map(e => ({
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      courseTitle: e.course.title,
      enrolledAt: e.enrolledAt,
      amount: e.payment?.amount
    }))
  };

  if (format === 'excel') {
    await generateExcelReport(reportData, res, 'instructor');
  } else {
    await generatePDFReport(reportData, res, 'instructor');
  }
});

exports.generatePlatformReport = catchAsync(async (req, res, next) => {
  const { startDate, endDate, format = 'pdf' } = req.query;

  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  // Get counts
  const [
    newUsers,
    newCourses,
    newEnrollments,
    newPayments
  ] = await Promise.all([
    User.countDocuments(dateFilter),
    Course.countDocuments(dateFilter),
    Enrollment.countDocuments(dateFilter),
    Payment.countDocuments({ ...dateFilter, status: 'success' })
  ]);

  // Get revenue
  const revenue = await Payment.aggregate([
    { $match: { ...dateFilter, status: 'success' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  // Get popular courses
  const popularCourses = await Enrollment.aggregate([
    { $match: dateFilter },
    { $group: { _id: '$course', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'courses',
        localField: '_id',
        foreignField: '_id',
        as: 'course'
      }
    },
    { $unwind: '$course' },
    {
      $project: {
        title: '$course.title',
        enrollments: '$count',
        instructor: '$course.instructor'
      }
    }
  ]);

  const reportData = {
    period: {
      start: startDate || 'All time',
      end: endDate || 'Present'
    },
    summary: {
      newUsers,
      newCourses,
      newEnrollments,
      newPayments,
      totalRevenue: revenue[0]?.total || 0
    },
    popularCourses,
    timestamp: new Date().toISOString()
  };

  if (format === 'excel') {
    await generateExcelReport(reportData, res, 'platform');
  } else {
    await generatePDFReport(reportData, res, 'platform');
  }
});

// Helper functions for report generation
const generatePDFReport = async (data, res, type = 'course') => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${type}-report-${Date.now()}.pdf`);

  doc.pipe(res);

  // Add logo and header
  doc.fontSize(20).text('EdTech Platform', 50, 50);
  doc.fontSize(16).text(`${type.charAt(0).toUpperCase() + type.slice(1)} Report`, 50, 80);
  doc.moveDown();

  // Add date
  doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, 50, 110);
  doc.moveDown();

  // Add content based on type
  if (type === 'course') {
    // Course info
    doc.fontSize(14).text('Course Information', 50, 150);
    doc.fontSize(10).text(`Title: ${data.course.title}`, 70, 170);
    doc.text(`Instructor: ${data.course.instructor}`, 70, 185);
    doc.text(`Category: ${data.course.category}`, 70, 200);
    doc.text(`Price: $${data.course.price}`, 70, 215);
    doc.moveDown();

    // Statistics
    doc.fontSize(14).text('Statistics', 50, 250);
    doc.fontSize(10).text(`Total Students: ${data.statistics.totalStudents}`, 70, 270);
    doc.text(`Completion Rate: ${data.statistics.completionRate}`, 70, 285);
    doc.text(`Average Progress: ${data.statistics.averageProgress}`, 70, 300);
    doc.text(`Total Revenue: $${data.statistics.totalRevenue}`, 70, 315);
  }

  doc.end();
};

const generateExcelReport = async (data, res, type = 'course') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`${type} Report`);

  // Add headers
  if (type === 'course') {
    worksheet.columns = [
      { header: 'Student Name', key: 'name', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Enrolled Date', key: 'enrolledAt', width: 20 },
      { header: 'Progress (%)', key: 'progress', width: 15 },
      { header: 'Completed', key: 'completed', width: 12 },
      { header: 'Payment ($)', key: 'payment', width: 15 }
    ];

    // Add data
    data.students.forEach(student => {
      worksheet.addRow({
        name: student.name,
        email: student.email,
        enrolledAt: new Date(student.enrolledAt).toLocaleDateString(),
        progress: student.progress,
        completed: student.completed ? 'Yes' : 'No',
        payment: student.paymentAmount || 0
      });
    });

    // Add summary
    worksheet.addRow({});
    worksheet.addRow({ name: 'SUMMARY' });
    worksheet.addRow({ name: 'Total Students:', progress: data.statistics.totalStudents });
    worksheet.addRow({ name: 'Completion Rate:', progress: data.statistics.completionRate });
    worksheet.addRow({ name: 'Total Revenue:', payment: data.statistics.totalRevenue });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${type}-report-${Date.now()}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
};

exports.generateCustomReport = catchAsync(async (req, res, next) => {
  const { metrics, filters, groupBy } = req.body;

  // Build aggregation pipeline based on requested metrics
  const pipeline = [];

  // Add filters
  if (filters) {
    const matchStage = {};
    Object.keys(filters).forEach(key => {
      matchStage[key] = filters[key];
    });
    pipeline.push({ $match: matchStage });
  }

  // Add group by
  if (groupBy) {
    const groupStage = { _id: `$${groupBy}` };
    metrics.forEach(metric => {
      if (metric.operation === 'sum') {
        groupStage[metric.name] = { $sum: `$${metric.field}` };
      } else if (metric.operation === 'avg') {
        groupStage[metric.name] = { $avg: `$${metric.field}` };
      } else if (metric.operation === 'count') {
        groupStage[metric.name] = { $sum: 1 };
      }
    });
    pipeline.push({ $group: groupStage });
  }

  // Determine collection based on request
  const collection = req.body.collection; // 'enrollments', 'payments', 'users', etc.
  let Model;
  switch(collection) {
    case 'enrollments':
      Model = Enrollment;
      break;
    case 'payments':
      Model = Payment;
      break;
    case 'users':
      Model = User;
      break;
    case 'courses':
      Model = Course;
      break;
    default:
      return next(new AppError('Invalid collection specified', 400));
  }

  const results = await Model.aggregate(pipeline);

  res.status(200).json({
    status: 'success',
    data: { results }
  });
});