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


// 'use strict';
// const AppError = require('../utils/appError');
// const LessonProgressRepository = require('../repositories/LessonProgressRepository');
// const EnrollmentRepository = require('../repositories/EnrollmentRepository');
// const LessonRepository = require('../repositories/LessonRepository');
// const EventDispatcher = require('../events/EventDispatcher');

// class ProgressService {
  
//   /**
//    * Called repeatedly while a student watches a video
//    */
//   async updateVideoProgress(studentId, courseId, lessonId, currentPosition) {
//     // 1. Verify enrollment exists and is active
//     const enrollment = await EnrollmentRepository.findOne({ student: studentId, course: courseId });
//     if (!enrollment || !enrollment.isActive) {
//       throw new AppError('Active enrollment required to track progress', 403);
//     }

//     // 2. Fetch the lesson to know its total duration
//     const lesson = await LessonRepository.findById(lessonId);
//     if (!lesson) throw new AppError('Lesson not found', 404);

//     // 3. Business Rule: If they watched 90% of the video, mark it completed
//     const completionThreshold = lesson.videoDuration * 0.9;
//     const isCompleted = currentPosition >= completionThreshold;

//     // 4. Upsert (Update or Insert) the progress record
//     const progress = await LessonProgressRepository.model.findOneAndUpdate(
//       { student: studentId, course: courseId, lesson: lessonId },
//       { 
//         $set: { lastPosition: currentPosition, isCompleted },
//         $inc: { watchTime: 10 } // Assuming pings happen every 10 seconds
//       },
//       { new: true, upsert: true }
//     );

//     // 5. If newly completed, check if the whole course is done
//     if (isCompleted) {
//       await this.checkCourseCompletion(studentId, courseId);
//     }

//     return progress;
//   }

//   async checkCourseCompletion(studentId, courseId) {
//     // Logic to count total lessons vs completed lessons
//     // If equal, update Enrollment status to completed and EMIT EVENT
    
//     // EventDispatcher.emit('course.completed', { studentId, courseId });
//     // Note: The CertificateService listens to this event to generate the PDF!
//   }
// }

// module.exports = new ProgressService();