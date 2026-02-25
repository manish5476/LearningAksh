const { LearningPath, Course, Category, User } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

exports.createLearningPath = catchAsync(async (req, res, next) => {
  // Validate courses exist
  if (req.body.courses && req.body.courses.length > 0) {
    const courseIds = req.body.courses.map(c => c.course);
    const courses = await Course.find({ _id: { $in: courseIds } });
    
    if (courses.length !== courseIds.length) {
      return next(new AppError('One or more courses not found', 400));
    }

    // Set order if not provided
    req.body.courses = req.body.courses.map((c, index) => ({
      ...c,
      order: c.order || index + 1
    }));

    req.body.totalCourses = req.body.courses.length;
    req.body.totalCredits = req.body.courses.reduce((acc, c) => acc + (c.credits || 0), 0);
  }

  const learningPath = await LearningPath.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { learningPath }
  });
});

exports.enrollInPath = catchAsync(async (req, res, next) => {
  const { pathId } = req.params;

  const path = await LearningPath.findById(pathId);
  if (!path) {
    return next(new AppError('Learning path not found', 404));
  }

  // Add to user's learning paths (if using StudentProfile)
  const { StudentProfile } = require('../models');
  await StudentProfile.findOneAndUpdate(
    { user: req.user.id },
    { $addToSet: { learningPath: pathId } }
  );

  res.status(200).json({
    status: 'success',
    message: 'Enrolled in learning path successfully'
  });
});

exports.getPathProgress = catchAsync(async (req, res, next) => {
  const { pathId } = req.params;

  const path = await LearningPath.findById(pathId).populate('courses.course');
  if (!path) {
    return next(new AppError('Learning path not found', 404));
  }

  const { ProgressTracking } = require('../models');
  
  // Get progress for all courses in path
  const courseIds = path.courses.map(c => c.course._id);
  const progress = await ProgressTracking.find({
    student: req.user.id,
    course: { $in: courseIds }
  });

  // Calculate overall progress
  const courseProgress = {};
  progress.forEach(p => {
    courseProgress[p.course.toString()] = p;
  });

  const pathProgress = path.courses.map(c => ({
    course: c.course,
    order: c.order,
    isRequired: c.isRequired,
    progress: courseProgress[c.course._id.toString()] || {
      courseProgressPercentage: 0,
      isCompleted: false
    }
  }));

  const completedCourses = pathProgress.filter(c => c.progress.isCompleted).length;
  const totalCourses = path.courses.length;
  const overallProgress = Math.round((completedCourses / totalCourses) * 100);

  res.status(200).json({
    status: 'success',
    data: {
      path: {
        _id: path._id,
        title: path.title,
        description: path.description,
        totalCourses,
        completedCourses,
        overallProgress
      },
      courses: pathProgress
    }
  });
});

exports.getRecommendedPaths = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  // Get user's completed courses
  const { ProgressTracking } = require('../models');
  const completedCourses = await ProgressTracking.find({
    student: req.user.id,
    isCompleted: true
  }).distinct('course');

  // Get all learning paths
  const paths = await LearningPath.find({ 
    isPublished: true,
    isDeleted: { $ne: true }
  }).populate('courses.course');

  // Score paths based on completed courses and interests
  const scoredPaths = paths.map(path => {
    let score = 0;
    
    // Check if user has completed prerequisite courses
    const pathCourseIds = path.courses.map(c => c.course._id.toString());
    const completedInPath = pathCourseIds.filter(id => completedCourses.includes(id)).length;
    
    // Higher score for paths with some completed courses (continuation)
    if (completedInPath > 0 && completedInPath < path.courses.length) {
      score += completedInPath * 10;
    }

    // Check if path matches user interests (if student profile exists)
    // This would need StudentProfile lookup

    return { path, score };
  });

  // Sort by score and return top 5
  const recommended = scoredPaths
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(item => item.path);

  res.status(200).json({
    status: 'success',
    results: recommended.length,
    data: { paths: recommended }
  });
});

exports.getPathAnalytics = catchAsync(async (req, res, next) => {
  const { pathId } = req.params;

  const path = await LearningPath.findById(pathId);
  if (!path) {
    return next(new AppError('Learning path not found', 404));
  }

  const { ProgressTracking, Enrollment } = require('../models');

  // Get all students enrolled in this path (from StudentProfile)
  const { StudentProfile } = require('../models');
  const enrolledStudents = await StudentProfile.find({
    learningPath: pathId
  }).populate('user', 'firstName lastName email');

  // Get progress for all students
  const courseIds = path.courses.map(c => c.course);
  const progress = await ProgressTracking.find({
    student: { $in: enrolledStudents.map(s => s.user._id) },
    course: { $in: courseIds }
  });

  // Calculate statistics
  const stats = {
    totalEnrolled: enrolledStudents.length,
    averageProgress: 0,
    completionRate: 0,
    courseStats: {}
  };

  if (enrolledStudents.length > 0) {
    // Group progress by student
    const studentProgress = {};
    progress.forEach(p => {
      if (!studentProgress[p.student]) {
        studentProgress[p.student] = [];
      }
      studentProgress[p.student].push(p);
    });

    // Calculate per-student path progress
    let totalPathProgress = 0;
    let completedCount = 0;

    Object.values(studentProgress).forEach(studentProg => {
      const completedInPath = studentProg.filter(p => p.isCompleted).length;
      const pathProgress = Math.round((completedInPath / path.courses.length) * 100);
      totalPathProgress += pathProgress;
      
      if (pathProgress === 100) {
        completedCount++;
      }
    });

    stats.averageProgress = totalPathProgress / Object.keys(studentProgress).length;
    stats.completionRate = (completedCount / enrolledStudents.length) * 100;
  }

  res.status(200).json({
    status: 'success',
    data: { stats }
  });
});

// CRUD operations
exports.getAllLearningPaths = factory.getAll(LearningPath, {
  searchFields: ['title', 'description'],
  populate: [
    { path: 'category', select: 'name' },
    { path: 'courses.course', select: 'title slug thumbnail' }
  ]
});
exports.getLearningPath = factory.getOne(LearningPath);
exports.updateLearningPath = factory.updateOne(LearningPath);
exports.deleteLearningPath = factory.deleteOne(LearningPath);