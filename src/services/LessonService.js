'use strict';
const AppError = require('../utils/appError');
const LessonRepository = require('../repositories/LessonRepository');
const SectionRepository = require('../repositories/SectionRepository');
const CourseRepository = require('../repositories/CourseRepository');
const EnrollmentRepository = require('../repositories/EnrollmentRepository');
const LessonProgressRepository = require('../repositories/LessonProgressRepository');
const EventDispatcher = require('../events/EventDispatcher');

class LessonService {

  // ==========================================
  // INTERNAL HELPERS
  // ==========================================
  async _verifyLessonOwnership(sectionId, userId, role) {
    const section = await SectionRepository.findById(sectionId, ['course']);
    if (!section || !section.course) throw new AppError('Parent section or course not found', 404);
    
    // Extract instructor ID (handling whether course is populated or just an ID)
    const instructorId = section.course.instructor ? section.course.instructor.toString() : null;
    
    if (instructorId !== userId.toString() && role !== 'admin') {
      throw new AppError('You are not authorized to modify lessons in this course', 403);
    }
    return section;
  }

  async _recalculateTotals(courseId, sectionId) {
    // 1. Calculate Section Totals
    const sectionStats = await LessonRepository.model.aggregate([
      { $match: { section: sectionId, isDeleted: false } },
      { $group: { _id: '$section', totalDuration: { $sum: '$duration' }, totalLessons: { $sum: 1 } } }
    ]);

    const secDuration = sectionStats.length > 0 ? sectionStats[0].totalDuration : 0;
    const secCount = sectionStats.length > 0 ? sectionStats[0].totalLessons : 0;
    await SectionRepository.updateById(sectionId, { totalDuration: secDuration, totalLessons: secCount });

    // 2. Calculate Course Totals
    const courseStats = await SectionRepository.model.aggregate([
      { $match: { course: courseId, isDeleted: false } },
      { $group: { _id: '$course', totalDuration: { $sum: '$totalDuration' }, totalLessons: { $sum: '$totalLessons' } } }
    ]);

    const courseDuration = courseStats.length > 0 ? courseStats[0].totalDuration : 0;
    const courseCount = courseStats.length > 0 ? courseStats[0].totalLessons : 0;
    await CourseRepository.updateById(courseId, { totalDuration: courseDuration, totalLessons: courseCount });
  }

  // ==========================================
  // CORE CRUD
  // ==========================================
  async createLesson(userId, role, data) {
    const section = await this._verifyLessonOwnership(data.section, userId, role);
    data.course = section.course._id;

    const lastLesson = await LessonRepository.model.findOne({ section: data.section, isDeleted: false }).sort('-order');
    data.order = lastLesson ? lastLesson.order + 1 : 1;

    const lesson = await LessonRepository.create(data);
    await this._recalculateTotals(section.course._id, section._id);

    return lesson;
  }

  async updateLesson(lessonId, userId, role, data) {
    const lessonToUpdate = await LessonRepository.findOne({ _id: lessonId, isDeleted: false });
    if (!lessonToUpdate) throw new AppError('Lesson not found', 404);

    const section = await this._verifyLessonOwnership(lessonToUpdate.section, userId, role);
    const updatedLesson = await LessonRepository.updateById(lessonId, data);

    if (data.duration !== undefined) {
      await this._recalculateTotals(section.course._id, section._id);
    }

    return updatedLesson;
  }

  async deleteLesson(lessonId, userId, role) {
    const lessonToDelete = await LessonRepository.findOne({ _id: lessonId, isDeleted: false });
    if (!lessonToDelete) throw new AppError('Lesson not found', 404);

    const section = await this._verifyLessonOwnership(lessonToDelete.section, userId, role);
    
    await LessonRepository.updateById(lessonId, { isDeleted: true, isPublished: false });
    await this._recalculateTotals(section.course._id, section._id);
    
    return true;
  }

  async reorderLessons(sectionId, userId, role, lessons) {
    if (!Array.isArray(lessons)) throw new AppError('Lessons array is required', 400);
    await this._verifyLessonOwnership(sectionId, userId, role);

    const bulkOperations = lessons.map(les => ({
      updateOne: {
        filter: { _id: les.id, section: sectionId },
        update: { $set: { order: les.order } }
      }
    }));

    if (bulkOperations.length > 0) {
      await LessonRepository.model.bulkWrite(bulkOperations);
    }
    return true;
  }

  // ==========================================
  // ACCESS & PAYWALL
  // ==========================================
  async getLessonWithDetails(lessonId, userId, role) {
    const lesson = await LessonRepository.model.findOne({ _id: lessonId, isDeleted: false, isPublished: true })
      .populate('section', 'title course')
      .populate('content.quiz')
      .populate('content.assignment')
      .populate('content.codingExercise')
      .lean();

    if (!lesson) throw new AppError('No published lesson found with that ID', 404);

    let hasAccess = false;
    if (lesson.isFreePreview || lesson.isFree) {
      hasAccess = true;
    } else if (role === 'admin') {
      hasAccess = true;
    } else {
      const course = await CourseRepository.findById(lesson.course);
      if (course && course.instructor.toString() === userId.toString()) {
        hasAccess = true;
      } else {
        const enrollment = await EnrollmentRepository.findOne({ student: userId, course: lesson.course, isActive: true });
        hasAccess = !!enrollment;
      }
    }

    if (!hasAccess) throw new AppError('You do not have access to this premium lesson. Please enroll.', 403);
    return lesson;
  }

  // ==========================================
  // STUDENT PROGRESS (Optimized Flat Schema)
  // ==========================================
  async markAsCompleted(lessonId, studentId) {
    const lesson = await LessonRepository.findOne({ _id: lessonId, isDeleted: false });
    if (!lesson) throw new AppError('Lesson not found', 404);

    // 1. Verify Enrollment if it's not a free lesson
    if (!lesson.isFreePreview && !lesson.isFree) {
      const enrollment = await EnrollmentRepository.findOne({ student: studentId, course: lesson.course, isActive: true });
      if (!enrollment) throw new AppError('You are not enrolled in this course', 403);
    }

    // 2. Upsert the flat LessonProgress document
    await LessonProgressRepository.model.findOneAndUpdate(
      { student: studentId, course: lesson.course, lesson: lesson._id },
      { isCompleted: true, completedAt: Date.now(), lastActivity: Date.now() },
      { upsert: true }
    );

    // 3. Recalculate Course Progress Percentage
    const course = await CourseRepository.findById(lesson.course);
    const completedLessonsCount = await LessonProgressRepository.model.countDocuments({ 
      student: studentId, course: lesson.course, isCompleted: true 
    });

    let percentage = 0;
    if (course && course.totalLessons > 0) {
      percentage = Math.min(100, Math.round((completedLessonsCount / course.totalLessons) * 100));
      
      if (percentage === 100) {
        // Find enrollment and mark complete
        await EnrollmentRepository.model.findOneAndUpdate(
          { student: studentId, course: lesson.course },
          { isCompleted: true, completedAt: Date.now() }
        );
        EventDispatcher.emit('course.completed', { studentId, courseId: lesson.course });
      }
    }

    return { lessonId: lesson._id, completed: true, courseProgressPercentage: percentage };
  }

  async togglePublishStatus(lessonId, userId, role, isPublished) {
    const lesson = await LessonRepository.findOne({ _id: lessonId, isDeleted: false });
    if (!lesson) throw new AppError('Lesson not found', 404);
    
    await this._verifyLessonOwnership(lesson.section, userId, role);
    return await LessonRepository.updateById(lessonId, { isPublished });
  }
}

module.exports = new LessonService();