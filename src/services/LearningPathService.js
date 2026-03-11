'use strict';
const AppError = require('../utils/appError');
const LearningPathRepository = require('../repositories/LearningPathRepository');
const CourseRepository = require('../repositories/CourseRepository');
const LessonProgressRepository = require('../repositories/LessonProgressRepository');
// Using StudentProfile logic you had, assuming we create a repository for it later if needed
// For now, we'll interact with it via its Mongoose model directly to save time.
const { StudentProfile } = require('../models'); 

class LearningPathService {

  async createLearningPath(data) {
    if (data.courses && data.courses.length > 0) {
      const courseIds = data.courses.map(c => c.course);
      
      // Use Repository to fetch courses
      const coursesData = await CourseRepository.model.find({ _id: { $in: courseIds } }).lean();
      
      if (coursesData.length !== courseIds.length) {
        throw new AppError('One or more courses not found', 400);
      }

      data.courses = data.courses.map((c, index) => ({
        ...c,
        order: c.order || index + 1
      }));

      data.totalCourses = data.courses.length;
      data.totalCredits = data.courses.reduce((acc, c) => acc + (c.credits || 0), 0);
    }

    return await LearningPathRepository.create(data);
  }

  async enrollInPath(studentId, pathId) {
    const path = await LearningPathRepository.findById(pathId);
    if (!path) throw new AppError('Learning path not found', 404);

    // Assuming StudentProfile exists. If not, this logic might need to move to the User model.
    await StudentProfile.findOneAndUpdate(
      { user: studentId },
      { $addToSet: { learningPath: pathId } },
      { upsert: true }
    );

    return true;
  }

  async getPathProgress(studentId, pathId) {
    const path = await LearningPathRepository.findById(pathId, ['courses.course']);
    if (!path) throw new AppError('Learning path not found', 404);

    const courseIds = path.courses.map(c => c.course._id);

    // Using our NEW optimized LessonProgress schema
    // We count how many lessons a student completed in EACH course
    const completedLessons = await LessonProgressRepository.model.aggregate([
      { $match: { student: studentId, course: { $in: courseIds }, isCompleted: true } },
      { $group: { _id: '$course', completedCount: { $sum: 1 } } }
    ]);

    const courseProgressMap = {};
    completedLessons.forEach(p => {
      courseProgressMap[p._id.toString()] = p.completedCount;
    });

    const pathProgress = path.courses.map(c => {
      const completedCount = courseProgressMap[c.course._id.toString()] || 0;
      const totalLessonsInCourse = c.course.totalLessons || 1; // Prevent division by zero
      
      const percentage = Math.round((completedCount / totalLessonsInCourse) * 100);
      const isCompleted = percentage >= 100;

      return {
        course: c.course,
        order: c.order,
        isRequired: c.isRequired,
        progress: {
          courseProgressPercentage: Math.min(percentage, 100),
          isCompleted
        }
      };
    });

    const completedCoursesCount = pathProgress.filter(c => c.progress.isCompleted).length;
    const totalCourses = path.courses.length;
    const overallProgress = Math.round((completedCoursesCount / totalCourses) * 100);

    return {
      path: {
        _id: path._id,
        title: path.title,
        description: path.description,
        totalCourses,
        completedCourses: completedCoursesCount,
        overallProgress
      },
      courses: pathProgress
    };
  }

  async getRecommendedPaths(studentId) {
    // 1. Find which courses the student has completed 100% of
    // Since we don't use ProgressTracking anymore, we have to aggregate LessonProgress
    const completedCoursesData = await LessonProgressRepository.model.aggregate([
      { $match: { student: studentId, isCompleted: true } },
      { $group: { _id: '$course', lessonsFinished: { $sum: 1 } } },
      { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'courseObj' } },
      { $unwind: '$courseObj' },
      { $match: { $expr: { $gte: ['$lessonsFinished', '$courseObj.totalLessons'] } } } // Only keep fully finished courses
    ]);

    const completedCourseIds = completedCoursesData.map(c => c._id.toString());

    // 2. Fetch active paths
    const paths = await LearningPathRepository.model.find({ 
      isPublished: true,
      isDeleted: { $ne: true }
    }).populate('courses.course').lean();

    // 3. Score paths
    const scoredPaths = paths.map(path => {
      let score = 0;
      
      const pathCourseIds = path.courses.map(c => c.course._id.toString());
      const completedInPath = pathCourseIds.filter(id => completedCourseIds.includes(id)).length;
      
      // Higher score for paths where they already have partial progress!
      if (completedInPath > 0 && completedInPath < path.courses.length) {
        score += completedInPath * 10;
      }

      return { path, score };
    });

    return scoredPaths
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.path);
  }
}

module.exports = new LearningPathService();