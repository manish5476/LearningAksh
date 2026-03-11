'use strict';
const AppError = require('../utils/appError');
const LessonProgressRepository = require('../repositories/LessonProgressRepository');
const CourseRepository = require('../repositories/CourseRepository');
const LessonRepository = require('../repositories/LessonRepository');
const EnrollmentRepository = require('../repositories/EnrollmentRepository');
const CertificateRepository = require('../repositories/CertificateRepository');
const EventDispatcher = require('../events/EventDispatcher');

class ProgressService {

  async getCourseProgress(studentId, courseId) {
    const [course, enrollment, progressRecords] = await Promise.all([
      CourseRepository.model.findById(courseId).populate({
        path: 'sections',
        populate: { path: 'lessons' }
      }).lean(),
      EnrollmentRepository.findOne({ student: studentId, course: courseId }),
      LessonProgressRepository.model.find({ student: studentId, course: courseId }).populate('lesson').lean()
    ]);

    if (!enrollment) throw new AppError('You are not enrolled in this course', 403);

    // Calculate dynamic stats from our flat schema
    const totalLessons = course.totalLessons || 0;
    const completedLessons = progressRecords.filter(p => p.isCompleted).length;
    const percentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Breakdown by type
    const breakdown = {
      video: progressRecords.filter(p => p.lesson?.type === 'video').length,
      quiz: progressRecords.filter(p => p.lesson?.type === 'quiz').length,
      assignment: progressRecords.filter(p => p.lesson?.type === 'assignment').length
    };

    return {
      percentage,
      totalLessons,
      completedLessons,
      isCompleted: enrollment.isCompleted,
      breakdown,
      lastActivity: enrollment.lastActivity,
      recentActivity: progressRecords.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)
    };
  }

  async markLessonComplete(studentId, courseId, lessonId, timeSpent) {
    const lesson = await LessonRepository.findById(lessonId);
    if (!lesson) throw new AppError('Lesson not found', 404);

    // 1. Atomic Upsert of Lesson Progress
    await LessonProgressRepository.model.findOneAndUpdate(
      { student: studentId, course: courseId, lesson: lessonId },
      { 
        isCompleted: true, 
        completedAt: Date.now(),
        $inc: { timeSpent: timeSpent || 0 }
      },
      { upsert: true }
    );

    // 2. Recalculate Course Completion
    const course = await CourseRepository.findById(courseId);
    const completedCount = await LessonProgressRepository.model.countDocuments({ 
      student: studentId, course: courseId, isCompleted: true 
    });

    const percentage = Math.min(100, Math.round((completedCount / course.totalLessons) * 100));

    // 3. Update Enrollment State
    const enrollment = await EnrollmentRepository.model.findOneAndUpdate(
      { student: studentId, course: courseId },
      { 
        lastActivity: Date.now(),
        progressPercentage: percentage,
        ...(percentage === 100 && { isCompleted: true, completedAt: Date.now() })
      },
      { new: true }
    );

    // 4. Trigger Certificate Event if 100%
    if (percentage === 100) {
      EventDispatcher.emit('course.completed', { studentId, course });
    }

    return { percentage, isCompleted: enrollment.isCompleted };
  }
}

module.exports = new ProgressService();

// const { ProgressTracking, Course, Lesson, Quiz, Assignment } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');

// exports.getMyProgress = catchAsync(async (req, res, next) => {
//   const progress = await ProgressTracking.find({ 
//     student: req.user.id 
//   })
//   .populate('course', 'title thumbnail totalLessons totalDuration')
//   .populate('completedLessons.lesson', 'title duration')
//   .populate('completedQuizzes.quiz', 'title totalPoints')
//   .populate('completedAssignments.assignment', 'title totalPoints');
  
//   res.status(200).json({
//     status: 'success',
//     results: progress.length,
//     data: { progress }
//   });
// });

// exports.getCourseProgress = catchAsync(async (req, res, next) => {
//   const { courseId } = req.params;
  
//   const progress = await ProgressTracking.findOne({ 
//     student: req.user.id,
//     course: courseId 
//   })
//   .populate('completedLessons.lesson')
//   .populate('completedQuizzes.quiz')
//   .populate('completedAssignments.assignment');
  
//   if (!progress) {
//     return next(new AppError('No progress found for this course', 404));
//   }
  
//   // Get course structure for detailed breakdown
//   const course = await Course.findById(courseId).populate({
//     path: 'sections',
//     populate: { path: 'lessons' }
//   });
  
//   // Calculate detailed statistics
//   const totalLessons = course.totalLessons;
//   const completedLessons = progress.completedLessons.length;
  
//   const lessonsByType = {
//     video: course.sections.reduce((acc, section) => 
//       acc + section.lessons.filter(l => l.type === 'video').length, 0),
//     quiz: course.sections.reduce((acc, section) => 
//       acc + section.lessons.filter(l => l.type === 'quiz').length, 0),
//     assignment: course.sections.reduce((acc, section) => 
//       acc + section.lessons.filter(l => l.type === 'assignment').length, 0),
//     coding: course.sections.reduce((acc, section) => 
//       acc + section.lessons.filter(l => l.type === 'coding-exercise').length, 0)
//   };
  
//   const completedByType = {
//     video: progress.completedLessons.filter(l => 
//       l.lesson?.type === 'video').length,
//     quiz: progress.completedQuizzes.length,
//     assignment: progress.completedAssignments.length,
//     coding: progress.completedLessons.filter(l => 
//       l.lesson?.type === 'coding-exercise').length
//   };
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       progress,
//       statistics: {
//         totalLessons,
//         completedLessons,
//         percentage: progress.courseProgressPercentage,
//         totalTimeSpent: progress.totalTimeSpent,
//         lastActivity: progress.lastActivity,
//         isCompleted: progress.isCompleted,
//         completedAt: progress.completedAt,
//         breakdown: {
//           byType: {
//             lessonsByType,
//             completedByType
//           },
//           recentActivity: progress.completedLessons
//             .sort((a, b) => b.completedAt - a.completedAt)
//             .slice(0, 5)
//         }
//       }
//     }
//   });
// });

// exports.markLessonComplete = catchAsync(async (req, res, next) => {
//   const { lessonId, timeSpent } = req.body;
//   const { courseId } = req.params;
  
//   const lesson = await Lesson.findById(lessonId);
//   if (!lesson) {
//     return next(new AppError('No lesson found with that ID', 404));
//   }
  
//   let progress = await ProgressTracking.findOne({
//     student: req.user.id,
//     course: courseId
//   });
  
//   if (!progress) {
//     progress = await ProgressTracking.create({
//       student: req.user.id,
//       course: courseId,
//       courseProgressPercentage: 0,
//       lastActivity: Date.now()
//     });
//   }
  
//   // Check if lesson already completed
//   const alreadyCompleted = progress.completedLessons.some(
//     l => l.lesson.toString() === lessonId
//   );
  
//   if (!alreadyCompleted) {
//     progress.completedLessons.push({
//       lesson: lessonId,
//       completedAt: Date.now(),
//       timeSpent: timeSpent || lesson.duration || 0
//     });
    
//     // Update total time spent
//     progress.totalTimeSpent += (timeSpent || lesson.duration || 0) / 60; // Convert to minutes
//   }
  
//   progress.lastActivity = Date.now();
  
//   // Recalculate overall progress
//   const totalLessons = await Lesson.countDocuments({ course: courseId });
//   const totalQuizzes = await Quiz.countDocuments({ course: courseId });
//   const totalAssignments = await Assignment.countDocuments({ course: courseId });
  
//   const totalItems = totalLessons + totalQuizzes + totalAssignments;
//   const completedItems = progress.completedLessons.length + 
//                         progress.completedQuizzes.length + 
//                         progress.completedAssignments.length;
  
//   progress.courseProgressPercentage = Math.round((completedItems / totalItems) * 100);
  
//   // Check if course is completed
//   if (progress.courseProgressPercentage >= 100 && !progress.isCompleted) {
//     progress.isCompleted = true;
//     progress.completedAt = Date.now();
    
//     // Generate certificate
//     const { Certificate } = require('../models');
//     const certificateNumber = `CERT-${Date.now()}-${req.user.id.slice(-6)}`;
    
//     await Certificate.create({
//       student: req.user.id,
//       course: courseId,
//       certificateNumber,
//       studentName: `${req.user.firstName} ${req.user.lastName}`,
//       courseName: (await Course.findById(courseId)).title,
//       issueDate: Date.now(),
//       grade: 'Passed',
//       percentage: progress.courseProgressPercentage,
//       instructor: (await Course.findById(courseId)).instructor
//     });
//   }
  
//   await progress.save();
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       progress,
//       isCompleted: progress.isCompleted
//     }
//   });
// });

// exports.getStudentProgress = catchAsync(async (req, res, next) => {
//   // Instructor/Admin view for a specific student
//   const { studentId, courseId } = req.params;
  
//   const progress = await ProgressTracking.findOne({
//     student: studentId,
//     course: courseId
//   })
//   .populate('student', 'firstName lastName email')
//   .populate('completedLessons.lesson')
//   .populate('completedQuizzes.quiz')
//   .populate('completedAssignments.assignment');
  
//   if (!progress) {
//     return next(new AppError('No progress found', 404));
//   }
  
//   res.status(200).json({
//     status: 'success',
//     data: { progress }
//   });
// });