'use strict';
const AppError = require('../utils/appError');
const EnrollmentRepository = require('../repositories/EnrollmentRepository');
const CourseRepository = require('../repositories/CourseRepository');
const LessonProgressRepository = require('../repositories/LessonProgressRepository'); // Replaces ProgressTracking
const OrderRepository = require('../repositories/OrderRepository'); // Replaces Payment
const EventDispatcher = require('../events/EventDispatcher');

class EnrollmentService {

  // ==========================
  // CORE ENROLLMENT
  // ==========================
  async enrollStudent(studentId, courseId, userRole = 'student') {
    const course = await CourseRepository.findOne({ 
      _id: courseId, 
      isPublished: true,
      isApproved: true,
      isDeleted: false 
    });
    
    if (!course) throw new AppError('Course not available for enrollment', 404);
    
    // SECURITY: Block direct enrollment to paid courses unless Admin bypasses
    if (!course.isFree && course.price > 0 && userRole !== 'admin') {
      throw new AppError('This is a paid course. Please go through the checkout process.', 403);
    }
    
    const existing = await EnrollmentRepository.findOne({ student: studentId, course: courseId, isActive: true });
    if (existing) throw new AppError('You are already enrolled in this course', 400);
    
    const enrollment = await EnrollmentRepository.create({
      student: studentId,
      course: courseId,
      isActive: true,
      enrolledAt: Date.now()
    });
    
    // Update course total (Mongoose hooks can also do this, but doing it here is explicit)
    await CourseRepository.updateById(courseId, { $inc: { totalEnrollments: 1 } });
    
    EventDispatcher.emit('student.enrolled', { studentId, courseId });

    return enrollment;
  }

  async bulkEnroll(studentId, courseIds, userRole) {
    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      throw new AppError('Please provide an array of course IDs', 400);
    }
    
    const enrollments = [];
    const errors = [];
    
    for (const courseId of courseIds) {
      try {
        const enrollment = await this.enrollStudent(studentId, courseId, userRole);
        enrollments.push(enrollment);
      } catch (err) {
        errors.push({ courseId, error: err.message });
      }
    }
    return { enrollments, errors: errors.length > 0 ? errors : undefined };
  }

  // ==========================
  // PROGRESS TRACKING (Optimized)
  // ==========================
  async updateLessonProgress(studentId, courseId, lessonId, completed, timeSpent) {
    const enrollment = await EnrollmentRepository.findOne({ student: studentId, course: courseId, isActive: true });
    if (!enrollment) throw new AppError('You are not enrolled in this course', 403);
    
    // 1. Upsert the flat LessonProgress document (No more array bloat!)
    await LessonProgressRepository.model.findOneAndUpdate(
      { student: studentId, course: courseId, lesson: lessonId },
      { 
        isCompleted: completed, 
        $inc: { timeSpent: timeSpent || 0 },
        lastActivity: Date.now()
      },
      { upsert: true, new: true }
    );

    // 2. Calculate dynamic course progress
    const course = await CourseRepository.findById(courseId);
    const completedLessonsCount = await LessonProgressRepository.model.countDocuments({ 
      student: studentId, course: courseId, isCompleted: true 
    });

    let percentage = 0;
    if (course && course.totalLessons > 0) {
      percentage = Math.round((completedLessonsCount / course.totalLessons) * 100);
    }

    // 3. Mark enrollment as completed if 100%
    if (percentage >= 100 && !enrollment.isCompleted) {
      enrollment.isCompleted = true;
      enrollment.completedAt = Date.now();
      await enrollment.save();

      EventDispatcher.emit('course.completed', { studentId, courseId });
    }

    return { percentage, completedLessons: completedLessonsCount };
  }

  // ==========================
  // INSTRUCTOR / ADMIN ANALYTICS
  // ==========================
  async getInstructorStats(instructorId, specificCourseId = null) {
    let courseQuery = {};
    if (specificCourseId) {
      courseQuery._id = specificCourseId;
    } else {
      const courses = await CourseRepository.findMany({}, { instructor: instructorId });
      courseQuery._id = { $in: courses.data.map(c => c._id) };
    }
    
    const enrollments = await EnrollmentRepository.model.find({ course: courseQuery._id })
      .populate('course')
      .lean(); // Faster reads

    const totalEnrollments = enrollments.length;
    const activeEnrollments = enrollments.filter(e => e.isActive).length;
    const completedEnrollments = enrollments.filter(e => e.isCompleted).length;
    
    return { totalEnrollments, activeEnrollments, completedEnrollments };
  }
}

module.exports = new EnrollmentService();