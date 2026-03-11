'use strict';
const slugify = require('slugify');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const AppError = require('../utils/appError');
const CourseRepository = require('../repositories/CourseRepository');
const SectionRepository = require('../repositories/SectionRepository');
const LessonRepository = require('../repositories/LessonRepository');
const EnrollmentRepository = require('../repositories/EnrollmentRepository');
const LessonProgressRepository = require('../repositories/LessonProgressRepository'); // Replaces ProgressTracking
const ReviewRepository = require('../repositories/ReviewRepository');

class CourseService {

  async createCourse(instructorId, data) {
    data.instructor = instructorId;
    
    if (data.title) {
      const baseSlug = slugify(data.title, { lower: true, strict: true });
      const randomString = Math.random().toString(36).substring(2, 6);
      data.slug = `${baseSlug}-${randomString}`;
    }

    return await CourseRepository.create(data);
  }

  async updateCourse(courseId, instructorId, data) {
    if (data.slug) delete data.slug; // Prevent manual slug updates
    
    const course = await CourseRepository.model.findOneAndUpdate(
      { _id: courseId, instructor: instructorId, isDeleted: false }, 
      data, 
      { new: true, runValidators: true }
    ).lean();

    if (!course) throw new AppError('Course not found or unauthorized', 404);
    return course;
  }

  async cloneCourse(originalCourseId, instructorId) {
    const originalCourse = await CourseRepository.findOne({ _id: originalCourseId, instructor: instructorId });
    if (!originalCourse) throw new AppError('Course not found or unauthorized', 404);

    // 1. Clone Course
    const clonedData = { ...originalCourse };
    delete clonedData._id;
    clonedData.title = `${originalCourse.title} (Copy)`;
    clonedData.slug = `${originalCourse.slug}-copy-${Math.random().toString(36).substring(2, 6)}`;
    clonedData.isPublished = false;
    clonedData.isApproved = false;
    clonedData.totalEnrollments = 0;
    clonedData.rating = 0;
    clonedData.totalReviews = 0;
    
    const clonedCourse = await CourseRepository.create(clonedData);

    // 2. Clone Sections and Lessons
    const sections = await SectionRepository.findMany({}, { course: originalCourseId });
    
    for (const oSection of sections.data) {
      const sectionData = { ...oSection, course: clonedCourse._id };
      delete sectionData._id;
      const clonedSection = await SectionRepository.create(sectionData);

      const lessons = await LessonRepository.findMany({}, { section: oSection._id });
      for (const oLesson of lessons.data) {
        const lessonData = { ...oLesson, course: clonedCourse._id, section: clonedSection._id };
        delete lessonData._id;
        await LessonRepository.create(lessonData);
      }
    }

    return clonedCourse;
  }

  async getTopRatedCourses(limit) {
    return await CourseRepository.model.find({ isPublished: true, isApproved: true, isDeleted: false })
      .sort({ rating: -1, totalEnrollments: -1 })
      .limit(limit)
      .populate('instructor', 'firstName lastName profilePicture')
      .select('title slug thumbnail price discountPrice rating totalRatings totalEnrollments level')
      .lean();
  }

  async getRelatedCourses(courseId) {
    const course = await CourseRepository.findById(courseId);
    if (!course) throw new AppError('Course not found', 404);

    return await CourseRepository.model.find({
      category: course.category,
      _id: { $ne: course._id },
      isPublished: true,
      isApproved: true,
      isDeleted: false
    })
    .sort({ rating: -1 })
    .limit(4)
    .select('title slug thumbnail price rating level instructor')
    .lean();
  }

  async getInstructorCourseDetails(courseId, instructorId) {
    const course = await CourseRepository.findOne({ _id: courseId, instructor: instructorId }, ['category', 'instructor']);
    if (!course) throw new AppError('No course found with that ID', 404);

    const sectionsData = await SectionRepository.findMany({}, { course: course._id });
    
    const sectionsWithLessons = await Promise.all(
      sectionsData.data.map(async (section) => {
        const lessonsData = await LessonRepository.findMany({}, { section: section._id });
        return { ...section, lessons: lessonsData.data };
      })
    );

    return { course, sections: sectionsWithLessons };
  }

  async getCourseStudents(courseId, instructorId) {
    const course = await CourseRepository.findOne({ _id: courseId, instructor: instructorId });
    if (!course) throw new AppError('Course not found or unauthorized', 404);

    const enrollments = await EnrollmentRepository.model.find({ course: course._id, isActive: true })
      .populate('student', 'firstName lastName email profilePicture')
      .sort('-enrolledAt')
      .lean();

    return enrollments.map(e => e.student);
  }

  async changeCourseStatus(courseId, instructorId, isPublished) {
    const course = await CourseRepository.model.findOneAndUpdate(
      { _id: courseId, instructor: instructorId, isDeleted: false },
      { isPublished, publishedAt: isPublished ? Date.now() : null },
      { new: true, runValidators: true }
    ).lean();
    if (!course) throw new AppError('Course not found or unauthorized', 404);
    return course;
  }

  async approveCourse(courseId, adminId) {
    const course = await CourseRepository.updateById(courseId, { 
      isApproved: true, 
      approvedBy: adminId, 
      approvedAt: Date.now() 
    });
    return course;
  }

  // ==========================================
  // THE ULTIMATE SYLLABUS ENGINE
  // ==========================================
  async getSyllabusWithAccessControl(slug, token) {
    const course = await CourseRepository.findOne({ slug }, ['category', 'instructor']);
    if (!course) throw new AppError('No course found with that slug', 404);

    // 1. Silent Auth
    let currentUser = null;
    if (token) {
      try {
        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
        currentUser = decoded.id;
      } catch (err) { /* Ignore invalid tokens here */ }
    }

    // 2. Access Control
    let isEnrolled = false;
    let isOwner = currentUser && course.instructor._id.toString() === currentUser.toString();
    let completedLessonIds = [];

    if (currentUser && !isOwner) {
      const enrollment = await EnrollmentRepository.findOne({ student: currentUser, course: course._id, isActive: true });
      isEnrolled = !!enrollment;

      // Use the new LessonProgress schema instead of the bloated ProgressTracking array
      if (isEnrolled) {
        const progressRecords = await LessonProgressRepository.findMany({}, { student: currentUser, course: course._id, isCompleted: true });
        completedLessonIds = progressRecords.data.map(p => p.lesson.toString());
      }
    }

    // 3. Fetch & Mask Syllabus
    const sections = await SectionRepository.findMany({}, { course: course._id, isPublished: true });
    
    const sectionsWithLessons = await Promise.all(
      sections.data.map(async (section) => {
        let lessons = await LessonRepository.findMany({}, { section: section._id, isPublished: true });
        
        const maskedLessons = lessons.data.map(lesson => {
          lesson.isCompleted = completedLessonIds.includes(lesson._id.toString());

          // Mask premium content for non-buyers
          if (!isEnrolled && !isOwner && !lesson.isFreePreview) {
            delete lesson.videoUrl;
            delete lesson.articleBody;
            lesson.isLocked = true; 
          }
          return lesson;
        });
        
        return { ...section, lessons: maskedLessons };
      })
    );

    // 4. Top Reviews
    const reviews = await ReviewRepository.model.find({ course: course._id, isApproved: true })
      .sort('-helpfulCount -rating')
      .limit(3)
      .populate('user', 'firstName lastName profilePicture')
      .lean();

    return {
      course,
      isEnrolled,
      isOwner,
      sections: sectionsWithLessons,
      recentReviews: reviews
    };
  }
}

module.exports = new CourseService();



// 'use strict';
// const AppError = require('../utils/appError');
// const CourseRepository = require('../repositories/CourseRepository');
// const SectionRepository = require('../repositories/SectionRepository');
// const LessonRepository = require('../repositories/LessonRepository');

// class CourseService {
  
//   async publishCourse(courseId, instructorId) {
//     // 1. Fetch Course and verify ownership
//     const course = await CourseRepository.findById(courseId);
    
//     if (!course) throw new AppError('Course not found', 404);
//     if (course.instructor.toString() !== instructorId.toString()) {
//       throw new AppError('You do not have permission to publish this course', 403);
//     }

//     // 2. Business Rule: Cannot publish an empty course
//     const sections = await SectionRepository.findMany({ course: courseId });
//     if (sections.data.length === 0) {
//       throw new AppError('Course must have at least one section to be published.', 400);
//     }

//     const lessons = await LessonRepository.findMany({ course: courseId });
//     if (lessons.data.length === 0) {
//       throw new AppError('Course must have at least one lesson to be published.', 400);
//     }

//     // 3. Update Status
//     const updatedCourse = await CourseRepository.updateById(courseId, { 
//       status: 'published',
//       publishedAt: new Date()
//     });

//     return updatedCourse;
//   }

//   async softDeleteCourse(courseId, instructorId) {
//     // Verify ownership, then call repository
//     // Note: We don't delete enrollments, students keep access to deleted courses they paid for!
//     return await CourseRepository.deleteById(courseId);
//   }
// }

// module.exports = new CourseService();