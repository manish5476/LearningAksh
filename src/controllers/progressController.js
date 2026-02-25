const { ProgressTracking, Course, Lesson, Quiz, Assignment } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

exports.getMyProgress = catchAsync(async (req, res, next) => {
  const progress = await ProgressTracking.find({ 
    student: req.user.id 
  })
  .populate('course', 'title thumbnail totalLessons totalDuration')
  .populate('completedLessons.lesson', 'title duration')
  .populate('completedQuizzes.quiz', 'title totalPoints')
  .populate('completedAssignments.assignment', 'title totalPoints');
  
  res.status(200).json({
    status: 'success',
    results: progress.length,
    data: { progress }
  });
});

exports.getCourseProgress = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  
  const progress = await ProgressTracking.findOne({ 
    student: req.user.id,
    course: courseId 
  })
  .populate('completedLessons.lesson')
  .populate('completedQuizzes.quiz')
  .populate('completedAssignments.assignment');
  
  if (!progress) {
    return next(new AppError('No progress found for this course', 404));
  }
  
  // Get course structure for detailed breakdown
  const course = await Course.findById(courseId).populate({
    path: 'sections',
    populate: { path: 'lessons' }
  });
  
  // Calculate detailed statistics
  const totalLessons = course.totalLessons;
  const completedLessons = progress.completedLessons.length;
  
  const lessonsByType = {
    video: course.sections.reduce((acc, section) => 
      acc + section.lessons.filter(l => l.type === 'video').length, 0),
    quiz: course.sections.reduce((acc, section) => 
      acc + section.lessons.filter(l => l.type === 'quiz').length, 0),
    assignment: course.sections.reduce((acc, section) => 
      acc + section.lessons.filter(l => l.type === 'assignment').length, 0),
    coding: course.sections.reduce((acc, section) => 
      acc + section.lessons.filter(l => l.type === 'coding-exercise').length, 0)
  };
  
  const completedByType = {
    video: progress.completedLessons.filter(l => 
      l.lesson?.type === 'video').length,
    quiz: progress.completedQuizzes.length,
    assignment: progress.completedAssignments.length,
    coding: progress.completedLessons.filter(l => 
      l.lesson?.type === 'coding-exercise').length
  };
  
  res.status(200).json({
    status: 'success',
    data: {
      progress,
      statistics: {
        totalLessons,
        completedLessons,
        percentage: progress.courseProgressPercentage,
        totalTimeSpent: progress.totalTimeSpent,
        lastActivity: progress.lastActivity,
        isCompleted: progress.isCompleted,
        completedAt: progress.completedAt,
        breakdown: {
          byType: {
            lessonsByType,
            completedByType
          },
          recentActivity: progress.completedLessons
            .sort((a, b) => b.completedAt - a.completedAt)
            .slice(0, 5)
        }
      }
    }
  });
});

exports.markLessonComplete = catchAsync(async (req, res, next) => {
  const { lessonId, timeSpent } = req.body;
  const { courseId } = req.params;
  
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    return next(new AppError('No lesson found with that ID', 404));
  }
  
  let progress = await ProgressTracking.findOne({
    student: req.user.id,
    course: courseId
  });
  
  if (!progress) {
    progress = await ProgressTracking.create({
      student: req.user.id,
      course: courseId,
      courseProgressPercentage: 0,
      lastActivity: Date.now()
    });
  }
  
  // Check if lesson already completed
  const alreadyCompleted = progress.completedLessons.some(
    l => l.lesson.toString() === lessonId
  );
  
  if (!alreadyCompleted) {
    progress.completedLessons.push({
      lesson: lessonId,
      completedAt: Date.now(),
      timeSpent: timeSpent || lesson.duration || 0
    });
    
    // Update total time spent
    progress.totalTimeSpent += (timeSpent || lesson.duration || 0) / 60; // Convert to minutes
  }
  
  progress.lastActivity = Date.now();
  
  // Recalculate overall progress
  const totalLessons = await Lesson.countDocuments({ course: courseId });
  const totalQuizzes = await Quiz.countDocuments({ course: courseId });
  const totalAssignments = await Assignment.countDocuments({ course: courseId });
  
  const totalItems = totalLessons + totalQuizzes + totalAssignments;
  const completedItems = progress.completedLessons.length + 
                        progress.completedQuizzes.length + 
                        progress.completedAssignments.length;
  
  progress.courseProgressPercentage = Math.round((completedItems / totalItems) * 100);
  
  // Check if course is completed
  if (progress.courseProgressPercentage >= 100 && !progress.isCompleted) {
    progress.isCompleted = true;
    progress.completedAt = Date.now();
    
    // Generate certificate
    const { Certificate } = require('../models');
    const certificateNumber = `CERT-${Date.now()}-${req.user.id.slice(-6)}`;
    
    await Certificate.create({
      student: req.user.id,
      course: courseId,
      certificateNumber,
      studentName: `${req.user.firstName} ${req.user.lastName}`,
      courseName: (await Course.findById(courseId)).title,
      issueDate: Date.now(),
      grade: 'Passed',
      percentage: progress.courseProgressPercentage,
      instructor: (await Course.findById(courseId)).instructor
    });
  }
  
  await progress.save();
  
  res.status(200).json({
    status: 'success',
    data: {
      progress,
      isCompleted: progress.isCompleted
    }
  });
});

exports.getStudentProgress = catchAsync(async (req, res, next) => {
  // Instructor/Admin view for a specific student
  const { studentId, courseId } = req.params;
  
  const progress = await ProgressTracking.findOne({
    student: studentId,
    course: courseId
  })
  .populate('student', 'firstName lastName email')
  .populate('completedLessons.lesson')
  .populate('completedQuizzes.quiz')
  .populate('completedAssignments.assignment');
  
  if (!progress) {
    return next(new AppError('No progress found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: { progress }
  });
});