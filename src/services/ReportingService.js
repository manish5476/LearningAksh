'use strict';
const AppError = require('../utils/appError');
const CourseRepository = require('../repositories/CourseRepository');
const EnrollmentRepository = require('../repositories/EnrollmentRepository');
const LessonProgressRepository = require('../repositories/LessonProgressRepository');
const { User, Payment, Enrollment } = require('../models');

class ReportingService {
  /**
   * COURSE LEVEL REPORT
   */
  async getCourseReportData(courseId) {
    const [course, enrollments, progress] = await Promise.all([
      CourseRepository.model.findById(courseId).populate('instructor', 'firstName lastName email').populate('category', 'name').lean(),
      EnrollmentRepository.model.find({ course: courseId, isActive: true }).populate('student', 'firstName lastName email').populate('payment').lean(),
      LessonProgressRepository.model.find({ course: courseId }).lean()
    ]);

    if (!course) throw new AppError('Course not found', 404);

    const totalStudents = enrollments.length;
    const completedStudents = enrollments.filter(e => e.isCompleted).length;
    const totalRevenue = enrollments.reduce((acc, e) => acc + (e.payment?.amount || 0), 0);

    return {
      courseInfo: course,
      stats: {
        totalStudents,
        completedStudents,
        completionRate: totalStudents > 0 ? ((completedStudents / totalStudents) * 100).toFixed(2) : 0,
        totalRevenue
      },
      studentDetails: enrollments.map(e => ({
        name: `${e.student.firstName} ${e.student.lastName}`,
        email: e.student.email,
        enrolledAt: e.enrolledAt,
        isCompleted: e.isCompleted,
        paymentAmount: e.payment?.amount || 0
      }))
    };
  }

  /**
   * INSTRUCTOR LEVEL REPORT
   */
  async getInstructorReportData(instructorId) {
    const instructor = await User.findById(instructorId).lean();
    if (!instructor) throw new AppError('Instructor not found', 404);

    // Get all courses owned by this instructor
    const courses = await CourseRepository.model.find({ 
      instructor: instructorId, 
      isDeleted: { $ne: true } 
    }).lean();

    const courseIds = courses.map(c => c._id);

    // Fetch associated data in parallel
    const [enrollments, payments] = await Promise.all([
      EnrollmentRepository.model.find({ course: { $in: courseIds }, isActive: true }).populate('student').populate('course').lean(),
      Payment.find({ course: { $in: courseIds }, status: 'success' }).lean()
    ]);

    const totalRevenue = payments.reduce((acc, p) => acc + p.amount, 0);

    return {
      instructor: {
        name: `${instructor.firstName} ${instructor.lastName}`,
        email: instructor.email
      },
      summary: {
        totalCourses: courses.length,
        totalStudents: enrollments.length,
        totalRevenue,
        averageCourseRating: courses.reduce((acc, c) => acc + (c.averageRating || 0), 0) / courses.length || 0
      },
      courseBreakdown: courses.map(course => {
        const count = enrollments.filter(e => e.course._id.toString() === course._id.toString()).length;
        const rev = payments.filter(p => p.course.toString() === course._id.toString()).reduce((acc, p) => acc + p.amount, 0);
        return {
          title: course.title,
          enrollments: count,
          revenue: rev,
          rating: course.averageRating || 0
        };
      })
    };
  }

  /**
   * PLATFORM LEVEL REPORT (Admin Only)
   */
  async getPlatformReportData(startDate, endDate) {
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const [newUsers, newCourses, newEnrollments, revenueData] = await Promise.all([
      User.countDocuments(dateFilter),
      CourseRepository.model.countDocuments(dateFilter),
      EnrollmentRepository.model.countDocuments(dateFilter),
      Payment.aggregate([
        { $match: { ...dateFilter, status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    // Popular Courses Aggregation
    const popularCourses = await Enrollment.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$course', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'details' } },
      { $unwind: '$details' },
      { $project: { title: '$details.title', enrollmentCount: '$count' } }
    ]);

    return {
      period: { start: startDate || 'Beginning', end: endDate || 'Today' },
      summary: {
        newUsers,
        newCourses,
        newEnrollments,
        totalRevenue: revenueData[0]?.total || 0
      },
      popularCourses
    };
  }
}

module.exports = new ReportingService();