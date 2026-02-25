const { Assignment, AssignmentSubmission, Course, Lesson, ProgressTracking } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

exports.createAssignment = catchAsync(async (req, res, next) => {
  const { course, lesson } = req.body;
  
  const courseDoc = await Course.findById(course);
  if (!courseDoc) {
    return next(new AppError('No course found with that ID', 404));
  }
  
  if (courseDoc.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('You are not authorized to create assignments for this course', 403));
  }
  
  const assignment = await Assignment.create(req.body);
  
  if (lesson) {
    await Lesson.findByIdAndUpdate(lesson, {
      'content.assignment': assignment._id
    });
  }
  
  res.status(201).json({
    status: 'success',
    data: { assignment }
  });
});

exports.submitAssignment = catchAsync(async (req, res, next) => {
  const assignmentId = req.params.assignmentId;
  
  const assignment = await Assignment.findById(assignmentId).populate('course');
  if (!assignment) {
    return next(new AppError('No assignment found with that ID', 404));
  }
  
  // Check enrollment
  const { Enrollment } = require('../models');
  const enrollment = await Enrollment.findOne({
    student: req.user.id,
    course: assignment.course._id,
    isActive: true
  });
  
  if (!enrollment && req.user.role !== 'admin') {
    return next(new AppError('You must be enrolled to submit this assignment', 403));
  }
  
  // Check if already submitted
  let submission = await AssignmentSubmission.findOne({
    assignment: assignmentId,
    student: req.user.id
  });
  
  const isLate = assignment.dueDate && new Date() > assignment.dueDate;
  
  if (submission) {
    // Update existing submission
    submission.content = req.body.content;
    submission.attachments = req.body.attachments;
    submission.status = isLate ? 'late-submitted' : 'submitted';
    submission.submittedAt = Date.now();
    submission.isLate = isLate;
    await submission.save();
  } else {
    // Create new submission
    submission = await AssignmentSubmission.create({
      assignment: assignmentId,
      student: req.user.id,
      content: req.body.content,
      attachments: req.body.attachments,
      status: isLate ? 'late-submitted' : 'submitted',
      isLate
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: { submission }
  });
});

exports.gradeAssignment = catchAsync(async (req, res, next) => {
  const { points, feedback } = req.body;
  const submissionId = req.params.submissionId;
  
  const submission = await AssignmentSubmission.findById(submissionId)
    .populate({
      path: 'assignment',
      populate: { path: 'course' }
    });
  
  if (!submission) {
    return next(new AppError('No submission found with that ID', 404));
  }
  
  // Check if user is instructor
  if (submission.assignment.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('Only the course instructor can grade assignments', 403));
  }
  
  const percentage = (points / submission.assignment.totalPoints) * 100;
  
  submission.grade = {
    points,
    percentage,
    feedback,
    gradedBy: req.user.id,
    gradedAt: Date.now()
  };
  submission.status = 'graded';
  await submission.save();
  
  // Update progress
  const { ProgressTracking } = require('../models');
  const progress = await ProgressTracking.findOne({
    student: submission.student,
    course: submission.assignment.course._id
  });
  
  if (progress) {
    progress.completedAssignments.push({
      assignment: submission.assignment._id,
      score: points,
      completedAt: Date.now()
    });
    await progress.save();
  }
  
  res.status(200).json({
    status: 'success',
    data: { submission }
  });
});

exports.getStudentSubmissions = catchAsync(async (req, res, next) => {
  const submissions = await AssignmentSubmission.find({ 
    student: req.user.id 
  })
  .populate({
    path: 'assignment',
    populate: { path: 'course', select: 'title' }
  })
  .sort('-submittedAt');
  
  res.status(200).json({
    status: 'success',
    results: submissions.length,
    data: { submissions }
  });
});

exports.getAssignmentSubmissions = catchAsync(async (req, res, next) => {
  const assignment = await Assignment.findById(req.params.assignmentId)
    .populate('course');
  
  if (!assignment) {
    return next(new AppError('No assignment found', 404));
  }
  
  if (assignment.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('Unauthorized', 403));
  }
  
  const submissions = await AssignmentSubmission.find({ 
    assignment: req.params.assignmentId 
  })
  .populate('student', 'firstName lastName email profilePicture')
  .sort('-submittedAt');
  
  res.status(200).json({
    status: 'success',
    results: submissions.length,
    data: { submissions }
  });
});

// CRUD operations
exports.getAllAssignments = factory.getAll(Assignment);
exports.getAssignment = factory.getOne(Assignment);
exports.updateAssignment = factory.updateOne(Assignment);
exports.deleteAssignment = factory.deleteOne(Assignment);