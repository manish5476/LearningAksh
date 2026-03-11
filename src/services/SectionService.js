'use strict';
const AppError = require('../utils/appError');
const SectionRepository = require('../repositories/SectionRepository');
const CourseRepository = require('../repositories/CourseRepository');
const LessonRepository = require('../repositories/LessonRepository');

class SectionService {
  
  async _verifyOwnership(courseId, userId, role) {
    const course = await CourseRepository.findById(courseId);
    if (!course) throw new AppError('No course found with that ID', 404);
    
    if (course.instructor.toString() !== userId.toString() && role !== 'admin') {
      throw new AppError('You are not authorized to modify this curriculum', 403);
    }
    return course;
  }

  async createSection(userId, role, data) {
    await this._verifyOwnership(data.course, userId, role);

    const lastSection = await SectionRepository.model
      .findOne({ course: data.course, isDeleted: false })
      .sort('-order');
      
    data.order = lastSection ? lastSection.order + 1 : 1;
    const section = await SectionRepository.create(data);

    await CourseRepository.updateById(data.course, { $inc: { totalSections: 1 } });
    return section;
  }

  async deleteSection(userId, role, sectionId) {
    const section = await SectionRepository.findById(sectionId);
    if (!section || section.isDeleted) throw new AppError('Section not found', 404);

    await this._verifyOwnership(section.course, userId, role);

    // Atomic updates in parallel
    await Promise.all([
      SectionRepository.updateById(sectionId, { isDeleted: true, isActive: false }),
      CourseRepository.updateById(section.course, { $inc: { totalSections: -1 } }),
      LessonRepository.model.updateMany({ section: sectionId }, { isDeleted: true, isPublished: false })
    ]);
  }

  async reorderSections(userId, role, courseId, sections) {
    await this._verifyOwnership(courseId, userId, role);

    const bulkOps = sections.map(sec => ({
      updateOne: {
        filter: { _id: sec.id, course: courseId },
        update: { $set: { order: sec.order } }
      }
    }));

    if (bulkOps.length > 0) await SectionRepository.model.bulkWrite(bulkOps);
  }

  async cloneSection(userId, role, sectionId) {
    const original = await SectionRepository.model.findOne({ _id: sectionId, isDeleted: false }).lean();
    if (!original) throw new AppError('Section not found', 404);
    
    await this._verifyOwnership(original.course, userId, role);

    const lastSection = await SectionRepository.model
      .findOne({ course: original.course, isDeleted: false })
      .sort('-order');

    const newSectionData = { 
      ...original, 
      _id: undefined, 
      title: `${original.title} (Copy)`, 
      isPublished: false,
      order: lastSection ? lastSection.order + 1 : 1 
    };

    const clonedSection = await SectionRepository.create(newSectionData);

    const originalLessons = await LessonRepository.model.find({ section: sectionId, isDeleted: false }).lean();
    if (originalLessons.length > 0) {
      const clonedLessons = originalLessons.map(lesson => ({
        ...lesson,
        _id: undefined,
        section: clonedSection._id,
        isPublished: false
      }));
      await LessonRepository.model.insertMany(clonedLessons);
    }

    await CourseRepository.updateById(original.course, { $inc: { totalSections: 1 } });
    return clonedSection;
  }
}

module.exports = new SectionService();