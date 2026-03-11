const { Course, User, Enrollment, Payment, ProgressTracking, Review } = require('../models');
const mongoose = require('mongoose');
const cacheService = require('./cacheService');

class AnalyticsService {
  /**
   * Get platform overview statistics
   */
  async getPlatformOverview() {
    const cacheKey = cacheService.generateKey(['analytics', 'platform', 'overview']);
    
    return cacheService.remember(cacheKey, 3600, async () => {
      const [
        totalUsers,
        totalStudents,
        totalInstructors,
        totalCourses,
        totalEnrollments,
        totalRevenue,
        totalReviews,
        averageRating
      ] = await Promise.all([
        User.countDocuments({ isDeleted: { $ne: true } }),
        User.countDocuments({ role: 'student', isDeleted: { $ne: true } }),
        User.countDocuments({ role: 'instructor', isDeleted: { $ne: true } }),
        Course.countDocuments({ isDeleted: { $ne: true }, isPublished: true }),
        Enrollment.countDocuments({ isActive: true }),
        Payment.aggregate([
          { $match: { status: 'success' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        Review.countDocuments({ isApproved: true }),
        Review.aggregate([
          { $match: { isApproved: true } },
          { $group: { _id: null, avg: { $avg: '$rating' } } }
        ])
      ]);

      return {
        users: {
          total: totalUsers,
          students: totalStudents,
          instructors: totalInstructors,
          studentInstructorRatio: totalStudents / totalInstructors
        },
        content: {
          courses: totalCourses,
          reviews: totalReviews,
          averageRating: averageRating[0]?.avg || 0
        },
        engagement: {
          enrollments: totalEnrollments,
          averagePerCourse: totalEnrollments / totalCourses
        },
        revenue: {
          total: totalRevenue[0]?.total || 0,
          averagePerEnrollment: (totalRevenue[0]?.total || 0) / totalEnrollments
        }
      };
    });
  }

  /**
   * Get instructor analytics
   * @param {String} instructorId - Instructor ID
   * @param {Object} dateRange - Date range filter
   */
  async getInstructorAnalytics(instructorId, dateRange = {}) {
    const cacheKey = cacheService.generateKey(['analytics', 'instructor', instructorId, dateRange]);
    
    return cacheService.remember(cacheKey, 1800, async () => {
      // Get instructor's courses
      const courses = await Course.find({ 
        instructor: instructorId,
        isDeleted: { $ne: true }
      });

      const courseIds = courses.map(c => c._id);

      // Date filter
      const dateFilter = {};
      if (dateRange.startDate || dateRange.endDate) {
        dateFilter.createdAt = {};
        if (dateRange.startDate) dateFilter.createdAt.$gte = new Date(dateRange.startDate);
        if (dateRange.endDate) dateFilter.createdAt.$lte = new Date(dateRange.endDate);
      }

      // Get enrollments
      const enrollments = await Enrollment.find({
        course: { $in: courseIds },
        ...dateFilter,
        isActive: true
      }).populate('student');

      // Get revenue
      const payments = await Payment.find({
        course: { $in: courseIds },
        status: 'success',
        ...dateFilter
      });

      // Get reviews
      const reviews = await Review.find({
        course: { $in: courseIds },
        isApproved: true,
        ...dateFilter
      });

      // Calculate course performance
      const coursePerformance = await Promise.all(
        courses.map(async (course) => {
          const courseEnrollments = enrollments.filter(
            e => e.course.toString() === course._id.toString()
          );
          
          const courseRevenue = payments
            .filter(p => p.course.toString() === course._id.toString())
            .reduce((sum, p) => sum + p.amount, 0);

          const courseReviews = reviews.filter(
            r => r.course.toString() === course._id.toString()
          );

          const avgRating = courseReviews.reduce((sum, r) => sum + r.rating, 0) / courseReviews.length || 0;

          // Get completion rate
          const progress = await ProgressTracking.find({
            course: course._id,
            student: { $in: courseEnrollments.map(e => e.student._id) }
          });

          const completed = progress.filter(p => p.isCompleted).length;
          const completionRate = progress.length > 0 ? (completed / progress.length) * 100 : 0;

          return {
            id: course._id,
            title: course.title,
            enrollments: courseEnrollments.length,
            revenue: courseRevenue,
            reviews: courseReviews.length,
            averageRating: avgRating,
            completionRate: Math.round(completionRate * 100) / 100
          };
        })
      );

      // Calculate trends
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentEnrollments = enrollments.filter(
        e => new Date(e.createdAt) >= thirtyDaysAgo
      ).length;

      const recentRevenue = payments
        .filter(p => new Date(p.createdAt) >= thirtyDaysAgo)
        .reduce((sum, p) => sum + p.amount, 0);

      return {
        summary: {
          totalCourses: courses.length,
          totalStudents: enrollments.length,
          totalRevenue: payments.reduce((sum, p) => sum + p.amount, 0),
          averageRating: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length || 0,
          totalReviews: reviews.length
        },
        trends: {
          recentEnrollments,
          recentRevenue,
          enrollmentGrowth: recentEnrollments / (enrollments.length || 1) * 100,
          revenueGrowth: recentRevenue / (payments.reduce((sum, p) => sum + p.amount, 0) || 1) * 100
        },
        courses: coursePerformance,
        topPerforming: coursePerformance.sort((a, b) => b.enrollments - a.enrollments).slice(0, 5)
      };
    });
  }

  /**
   * Get student analytics
   * @param {String} studentId - Student ID
   */
  async getStudentAnalytics(studentId) {
    const cacheKey = cacheService.generateKey(['analytics', 'student', studentId]);
    
    return cacheService.remember(cacheKey, 1800, async () => {
      // Get enrollments
      const enrollments = await Enrollment.find({ 
        student: studentId,
        isActive: true 
      }).populate('course');

      // Get progress
      const progress = await ProgressTracking.find({
        student: studentId
      }).populate('course');

      // Get certificates
      const { Certificate } = require('../models');
      const certificates = await Certificate.find({ student: studentId });

      // Calculate learning stats
      let totalTimeSpent = 0;
      let completedCourses = 0;
      const courseProgress = [];

      progress.forEach(p => {
        totalTimeSpent += p.totalTimeSpent || 0;
        if (p.isCompleted) completedCourses++;
        
        courseProgress.push({
          courseId: p.course._id,
          courseTitle: p.course.title,
          progress: p.courseProgressPercentage,
          completed: p.isCompleted,
          lastActivity: p.lastActivity,
          timeSpent: p.totalTimeSpent
        });
      });

      // Calculate streak
      const sortedActivity = progress
        .flatMap(p => p.completedLessons.map(l => new Date(l.completedAt)))
        .sort((a, b) => b - a);

      let currentStreak = 0;
      let longestStreak = 0;

      if (sortedActivity.length > 0) {
        let streak = 1;
        let lastDate = sortedActivity[0];

        for (let i = 1; i < sortedActivity.length; i++) {
          const diffDays = Math.round((lastDate - sortedActivity[i]) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            streak++;
          } else {
            longestStreak = Math.max(longestStreak, streak);
            streak = 1;
          }
          lastDate = sortedActivity[i];
        }
        currentStreak = streak;
        longestStreak = Math.max(longestStreak, streak);
      }

      // Get achievements
      const { UserBadge } = require('../models');
      const badges = await UserBadge.find({ student: studentId }).populate('badge');

      return {
        summary: {
          totalCourses: enrollments.length,
          completedCourses,
          inProgress: enrollments.length - completedCourses,
          completionRate: enrollments.length > 0 ? (completedCourses / enrollments.length) * 100 : 0,
          totalCertificates: certificates.length,
          totalTimeSpent: Math.round(totalTimeSpent / 60), // Convert to hours
          averageTimePerCourse: Math.round(totalTimeSpent / (enrollments.length || 1) / 60)
        },
        streak: {
          current: currentStreak,
          longest: longestStreak
        },
        achievements: {
          badges: badges.length,
          badgesList: badges.map(b => b.badge)
        },
        courses: courseProgress,
        certificates: certificates.map(c => ({
          id: c._id,
          courseName: c.courseName,
          issueDate: c.issueDate,
          certificateNumber: c.certificateNumber
        }))
      };
    });
  }

  /**
   * Get revenue analytics
   * @param {Object} filters - Filters for revenue data
   */
  async getRevenueAnalytics(filters = {}) {
    const { startDate, endDate, groupBy = 'day', instructorId } = filters;

    const matchStage = { status: 'success' };
    
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    if (instructorId) {
      const courses = await Course.find({ instructor: instructorId }).distinct('_id');
      matchStage.course = { $in: courses };
    }

    // Revenue over time
    const revenueOverTime = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: this.getDateGroup(groupBy, '$createdAt'),
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Revenue by course
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
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // Revenue by payment method
    const revenueByMethod = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$paymentMethod',
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Daily averages
    const averages = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          averageDaily: { $avg: '$amount' },
          maxAmount: { $max: '$amount' },
          minAmount: { $min: '$amount' },
          totalDays: { $sum: 1 }
        }
      }
    ]);

    return {
      overview: {
        totalRevenue: revenueOverTime.reduce((sum, day) => sum + day.revenue, 0),
        totalTransactions: revenueOverTime.reduce((sum, day) => sum + day.count, 0),
        averageTransactionValue: averages[0]?.averageDaily || 0,
        maxTransaction: averages[0]?.maxAmount || 0,
        minTransaction: averages[0]?.minAmount || 0
      },
      timeline: revenueOverTime.map(item => ({
        period: item._id,
        revenue: item.revenue,
        transactions: item.count
      })),
      byCourse: revenueByCourse,
      byMethod: revenueByMethod
    };
  }

  /**
   * Get engagement analytics
   * @param {Object} filters - Filters for engagement data
   */
  async getEngagementAnalytics(filters = {}) {
    const { days = 30 } = filters;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Daily active users
    const dailyActiveUsers = await ProgressTracking.aggregate([
      { $match: { lastActivity: { $gte: startDate } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$lastActivity' } }
          },
          users: { $addToSet: '$student' }
        }
      },
      {
        $project: {
          date: '$_id.date',
          activeUsers: { $size: '$users' }
        }
      },
      { $sort: { date: 1 } }
    ]);

    // Most engaged users
    const topUsers = await ProgressTracking.aggregate([
      { $match: { lastActivity: { $gte: startDate } } },
      {
        $group: {
          _id: '$student',
          totalTime: { $sum: '$totalTimeSpent' },
          lessonsCompleted: { $sum: { $size: '$completedLessons' } },
          lastActivity: { $max: '$lastActivity' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $sort: { totalTime: -1 } },
      { $limit: 10 },
      {
        $project: {
          'user.password': 0,
          'user.__v': 0
        }
      }
    ]);

    // Course completion rates
    const completionRates = await ProgressTracking.aggregate([
      { $match: { course: { $exists: true } } },
      {
        $group: {
          _id: '$course',
          totalEnrolled: { $sum: 1 },
          completed: {
            $sum: { $cond: ['$isCompleted', 1, 0] }
          }
        }
      },
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
          courseTitle: '$course.title',
          totalEnrolled: 1,
          completed: 1,
          completionRate: { $multiply: [{ $divide: ['$completed', '$totalEnrolled'] }, 100] }
        }
      },
      { $sort: { completionRate: -1 } },
      { $limit: 10 }
    ]);

    return {
      dailyActiveUsers,
      topUsers,
      completionRates,
      summary: {
        averageDailyActive: dailyActiveUsers.reduce((sum, d) => sum + d.activeUsers, 0) / dailyActiveUsers.length,
        totalEngagedUsers: topUsers.length,
        averageCompletionRate: completionRates.reduce((sum, c) => sum + c.completionRate, 0) / completionRates.length
      }
    };
  }

  /**
   * Get date group based on interval
   * @private
   */
  getDateGroup(interval, dateField) {
    switch(interval) {
      case 'hour':
        return {
          year: { $year: dateField },
          month: { $month: dateField },
          day: { $dayOfMonth: dateField },
          hour: { $hour: dateField }
        };
      case 'day':
        return {
          year: { $year: dateField },
          month: { $month: dateField },
          day: { $dayOfMonth: dateField }
        };
      case 'week':
        return {
          year: { $year: dateField },
          week: { $week: dateField }
        };
      case 'month':
        return {
          year: { $year: dateField },
          month: { $month: dateField }
        };
      case 'year':
        return { year: { $year: dateField } };
      default:
        return {
          year: { $year: dateField },
          month: { $month: dateField },
          day: { $dayOfMonth: dateField }
        };
    }
  }

  /**
   * Generate exportable report
   * @param {String} type - Report type
   * @param {Object} filters - Report filters
   */
  async generateReport(type, filters = {}) {
    switch(type) {
      case 'platform':
        return this.getPlatformOverview();
      case 'instructor':
        return this.getInstructorAnalytics(filters.instructorId, filters);
      case 'student':
        return this.getStudentAnalytics(filters.studentId);
      case 'revenue':
        return this.getRevenueAnalytics(filters);
      case 'engagement':
        return this.getEngagementAnalytics(filters);
      default:
        throw new AppError('Invalid report type', 400);
    }
  }
}

module.exports = new AnalyticsService();