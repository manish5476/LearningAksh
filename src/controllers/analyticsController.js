const { Course, User, Enrollment, ProgressTracking, Payment, Review } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const mongoose = require('mongoose');

exports.getPlatformStats = catchAsync(async (req, res, next) => {
  // Get basic counts
  const [
    totalUsers,
    totalStudents,
    totalInstructors,
    totalCourses,
    totalEnrollments,
    totalRevenue,
    totalReviews
  ] = await Promise.all([
    User.countDocuments({ isDeleted: { $ne: true } }),
    User.countDocuments({ role: 'student', isDeleted: { $ne: true } }),
    User.countDocuments({ role: 'instructor', isDeleted: { $ne: true } }),
    Course.countDocuments({ isDeleted: { $ne: true } }),
    Enrollment.countDocuments({ isActive: true }),
    Payment.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Review.countDocuments({ isApproved: true })
  ]);

  // Get monthly trends
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const [newUsers, newEnrollments, newCourses] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Enrollment.countDocuments({ enrolledAt: { $gte: thirtyDaysAgo } }),
    Course.countDocuments({ createdAt: { $gte: thirtyDaysAgo } })
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      overview: {
        totalUsers,
        totalStudents,
        totalInstructors,
        totalCourses,
        totalEnrollments,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalReviews
      },
      trends: {
        newUsersLast30Days: newUsers,
        newEnrollmentsLast30Days: newEnrollments,
        newCoursesLast30Days: newCourses,
        growthRate: ((newUsers / totalUsers) * 100).toFixed(1) + '%'
      }
    }
  });
});

exports.getInstructorAnalytics = catchAsync(async (req, res, next) => {
  const instructorId = req.params.instructorId || req.user.id;

  // Get instructor's courses
  const courses = await Course.find({ 
    instructor: instructorId,
    isDeleted: { $ne: true }
  }).select('_id title price totalEnrollments totalReviews rating');

  const courseIds = courses.map(c => c._id);

  // Get enrollment stats
  const enrollments = await Enrollment.find({
    course: { $in: courseIds },
    isActive: true
  });

  // Get revenue
  const payments = await Payment.find({
    course: { $in: courseIds },
    status: 'success'
  });

  const totalRevenue = payments.reduce((acc, p) => acc + p.amount, 0);

  // Get student progress
  const progress = await ProgressTracking.find({
    course: { $in: courseIds }
  });

  // Calculate completion rate
  const completedCourses = progress.filter(p => p.isCompleted).length;
  const completionRate = progress.length > 0 
    ? (completedCourses / progress.length) * 100 
    : 0;

  // Course performance
  const coursePerformance = courses.map(course => {
    const courseEnrollments = enrollments.filter(e => 
      e.course.toString() === course._id.toString()
    ).length;

    const courseRevenue = payments
      .filter(p => p.course.toString() === course._id.toString())
      .reduce((acc, p) => acc + p.amount, 0);

    return {
      id: course._id,
      title: course.title,
      price: course.price,
      enrollments: courseEnrollments,
      revenue: courseRevenue,
      rating: course.rating,
      reviews: course.totalReviews,
      completionRate: course.totalEnrollments > 0 
        ? (course.totalEnrollments / courseEnrollments) * 100 
        : 0
    };
  });

  res.status(200).json({
    status: 'success',
    data: {
      summary: {
        totalCourses: courses.length,
        totalStudents: enrollments.length,
        totalRevenue,
        averageRating: courses.reduce((acc, c) => acc + c.rating, 0) / courses.length || 0,
        completionRate: completionRate.toFixed(1) + '%'
      },
      coursePerformance,
      recentActivity: {
        last30DaysEnrollments: enrollments.filter(e => 
          new Date(e.enrolledAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length,
        last30DaysRevenue: payments
          .filter(p => new Date(p.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
          .reduce((acc, p) => acc + p.amount, 0)
      }
    }
  });
});

exports.getStudentAnalytics = catchAsync(async (req, res, next) => {
  const studentId = req.params.studentId || req.user.id;

  // Get student's enrollments
  const enrollments = await Enrollment.find({ 
    student: studentId,
    isActive: true 
  }).populate('course');

  // Get progress
  const progress = await ProgressTracking.find({
    student: studentId
  });

  // Calculate statistics
  const totalCourses = enrollments.length;
  const completedCourses = progress.filter(p => p.isCompleted).length;
  const inProgress = totalCourses - completedCourses;

  // Time spent learning
  const totalTimeSpent = progress.reduce((acc, p) => acc + (p.totalTimeSpent || 0), 0);

  // Get certificates
  const { Certificate } = require('../models');
  const certificates = await Certificate.find({ student: studentId });

  // Course breakdown
  const courseBreakdown = enrollments.map(e => {
    const courseProgress = progress.find(p => 
      p.course.toString() === e.course._id.toString()
    );

    return {
      course: {
        id: e.course._id,
        title: e.course.title,
        thumbnail: e.course.thumbnail
      },
      enrolledAt: e.enrolledAt,
      progress: courseProgress?.courseProgressPercentage || 0,
      completed: courseProgress?.isCompleted || false,
      timeSpent: courseProgress?.totalTimeSpent || 0,
      lastActivity: courseProgress?.lastActivity
    };
  });

  // Learning streaks (simplified)
  const sortedProgress = progress
    .flatMap(p => p.completedLessons.map(l => new Date(l.completedAt)))
    .sort((a, b) => b - a);

  let currentStreak = 0;
  if (sortedProgress.length > 0) {
    let lastDate = sortedProgress[0];
    currentStreak = 1;
    
    for (let i = 1; i < sortedProgress.length; i++) {
      const diffDays = Math.round((lastDate - sortedProgress[i]) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
        lastDate = sortedProgress[i];
      } else {
        break;
      }
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      summary: {
        totalCourses,
        completedCourses,
        inProgress,
        totalCertificates: certificates.length,
        totalTimeSpent: Math.round(totalTimeSpent / 60), // Convert to hours
        currentStreak,
        completionRate: totalCourses > 0 
          ? ((completedCourses / totalCourses) * 100).toFixed(1) + '%'
          : '0%'
      },
      courses: courseBreakdown,
      certificates: certificates.map(c => ({
        id: c._id,
        courseName: c.courseName,
        issueDate: c.issueDate,
        certificateNumber: c.certificateNumber
      }))
    }
  });
});

exports.getRevenueAnalytics = catchAsync(async (req, res, next) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;

  const matchStage = { status: 'success' };
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  // Group by time period
  let groupStage;
  switch(groupBy) {
    case 'hour':
      groupStage = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
        hour: { $hour: '$createdAt' }
      };
      break;
    case 'day':
      groupStage = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
      break;
    case 'month':
      groupStage = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
      break;
    case 'year':
      groupStage = { year: { $year: '$createdAt' } };
      break;
    default:
      groupStage = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
  }

  const revenueByPeriod = await Payment.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: groupStage,
        totalRevenue: { $sum: '$amount' },
        count: { $sum: 1 },
        averageValue: { $avg: '$amount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);

  // Format the results
  const formattedData = revenueByPeriod.map(item => {
    const period = item._id;
    let label;
    
    if (groupBy === 'hour') {
      label = `${period.year}-${period.month}-${period.day} ${period.hour}:00`;
    } else if (groupBy === 'day') {
      label = `${period.year}-${period.month}-${period.day}`;
    } else if (groupBy === 'month') {
      label = `${period.year}-${period.month}`;
    } else {
      label = period.year.toString();
    }

    return {
      period: label,
      revenue: item.totalRevenue,
      transactions: item.count,
      averageValue: item.averageValue
    };
  });

  // Get revenue by payment method
  const revenueByMethod = await Payment.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$paymentMethod',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Get revenue by course
  const revenueByCourse = await Payment.aggregate([
    { $match: { ...matchStage, course: { $exists: true } } },
    {
      $lookup: {
        from: 'courses',
        localField: 'course',
        foreignField: '_id',
        as: 'courseInfo'
      }
    },
    { $unwind: '$courseInfo' },
    {
      $group: {
        _id: '$course',
        courseTitle: { $first: '$courseInfo.title' },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { total: -1 } },
    { $limit: 10 }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      timeline: formattedData,
      byPaymentMethod: revenueByMethod,
      topCourses: revenueByCourse,
      summary: {
        totalRevenue: formattedData.reduce((acc, item) => acc + item.revenue, 0),
        totalTransactions: formattedData.reduce((acc, item) => acc + item.transactions, 0),
        averageTransactionValue: formattedData.reduce((acc, item) => acc + item.averageValue, 0) / formattedData.length || 0
      }
    }
  });
});

exports.getEngagementAnalytics = catchAsync(async (req, res, next) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Daily active users
  const dailyActiveUsers = await ProgressTracking.aggregate([
    { $match: { lastActivity: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$lastActivity' } }
        },
        count: { $addToSet: '$student' }
      }
    },
    {
      $project: {
        date: '$_id.date',
        activeUsers: { $size: '$count' }
      }
    },
    { $sort: { date: 1 } }
  ]);

  // Lesson completion rates
  const lessonCompletions = await ProgressTracking.aggregate([
    { $unwind: '$completedLessons' },
    {
      $group: {
        _id: '$completedLessons.lesson',
        completions: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'lessons',
        localField: '_id',
        foreignField: '_id',
        as: 'lessonInfo'
      }
    },
    { $unwind: '$lessonInfo' },
    {
      $project: {
        lessonTitle: '$lessonInfo.title',
        completions: 1
      }
    },
    { $sort: { completions: -1 } },
    { $limit: 10 }
  ]);

  // Average session duration
  const avgSessionDuration = await ProgressTracking.aggregate([
    { $match: { totalTimeSpent: { $gt: 0 } } },
    {
      $group: {
        _id: null,
        averageTime: { $avg: '$totalTimeSpent' },
        maxTime: { $max: '$totalTimeSpent' },
        minTime: { $min: '$totalTimeSpent' }
      }
    }
  ]);

  // User retention (simplified cohort analysis)
  const userCohorts = await User.aggregate([
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        users: { $push: '$_id' }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 6 }
  ]);

  const retention = await Promise.all(
    userCohorts.map(async (cohort) => {
      const cohortUsers = cohort.users;
      const activeNow = await ProgressTracking.countDocuments({
        student: { $in: cohortUsers },
        lastActivity: { $gte: thirtyDaysAgo }
      });

      return {
        cohort: `${cohort._id.year}-${cohort._id.month}`,
        totalUsers: cohortUsers.length,
        activeUsers: activeNow,
        retentionRate: (activeNow / cohortUsers.length) * 100
      };
    })
  );

  res.status(200).json({
    status: 'success',
    data: {
      dailyActiveUsers,
      popularLessons: lessonCompletions,
      sessionDuration: avgSessionDuration[0] || { averageTime: 0 },
      retention
    }
  });
});