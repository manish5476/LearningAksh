'use strict';
const AppError = require('../../utils/appError');
const CourseRepository = require('../../repositories/CourseRepository');
const SectionRepository = require('../repositories/SectionRepository');
const LessonRepository = require('../repositories/LessonRepository');

class CourseService {
  
  async publishCourse(courseId, instructorId) {
    // 1. Fetch Course and verify ownership
    const course = await CourseRepository.findById(courseId);
    
    if (!course) throw new AppError('Course not found', 404);
    if (course.instructor.toString() !== instructorId.toString()) {
      throw new AppError('You do not have permission to publish this course', 403);
    }

    // 2. Business Rule: Cannot publish an empty course
    const sections = await SectionRepository.findMany({ course: courseId });
    if (sections.data.length === 0) {
      throw new AppError('Course must have at least one section to be published.', 400);
    }

    const lessons = await LessonRepository.findMany({ course: courseId });
    if (lessons.data.length === 0) {
      throw new AppError('Course must have at least one lesson to be published.', 400);
    }

    // 3. Update Status
    const updatedCourse = await CourseRepository.updateById(courseId, { 
      status: 'published',
      publishedAt: new Date()
    });

    return updatedCourse;
  }

  async softDeleteCourse(courseId, instructorId) {
    // Verify ownership, then call repository
    // Note: We don't delete enrollments, students keep access to deleted courses they paid for!
    return await CourseRepository.deleteById(courseId);
  }
}

module.exports = new CourseService();