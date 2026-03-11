'use strict';
const catchAsync = require('../utils/catchAsync');
const AssignmentService = require('../services/AssignmentService');
const AssignmentRepository = require('../repositories/AssignmentRepository');
const AssignmentSubmissionRepository = require('../repositories/AssignmentSubmissionRepository');
const AppError = require('../utils/appError');

// ==========================
// STUDENT ACTIONS
// ==========================
exports.submitAssignment = catchAsync(async (req, res, next) => {
  // We pass req.file (from Multer middleware) directly to the service
  const submission = await AssignmentService.submitAssignment(
    req.user.id, 
    req.params.assignmentId, 
    req.body.content, 
    req.file 
  );
  
  res.status(201).json({ status: 'success', data: { submission } });
});

exports.getMySubmission = catchAsync(async (req, res, next) => {
  const submission = await AssignmentSubmissionRepository.findOne({
    assignment: req.params.assignmentId,
    student: req.user.id
  });
  
  res.status(200).json({ status: 'success', data: { submission } });
});

// ==========================
// INSTRUCTOR ACTIONS
// ==========================
exports.gradeSubmission = catchAsync(async (req, res, next) => {
  // We explicitly pass req.user.id so the service can verify ownership!
  const submission = await AssignmentService.gradeSubmission(
    req.user.id, 
    req.params.id, 
    req.body
  );
  
  res.status(200).json({ status: 'success', data: { submission } });
});

exports.getAssignmentSubmissions = catchAsync(async (req, res, next) => {
  // Optional: Add an ownership check here so instructors can't spy on other courses
  const result = await AssignmentSubmissionRepository.findMany(
    req.query, 
    { assignment: req.params.assignmentId },
    { path: 'student', select: 'firstName lastName email profilePicture' }
  );

  res.status(200).json({ 
    status: 'success', 
    results: result.results, 
    data: { submissions: result.data } 
  });
});

// ==========================
// STANDARD FACTORY REPLACEMENTS
// ==========================
exports.createAssignment = catchAsync(async (req, res, next) => {
  // Make sure course ownership is checked before creating! (Can be added to service)
  const assignment = await AssignmentRepository.create(req.body);
  res.status(201).json({ status: 'success', data: { assignment } });
});

exports.getAssignment = catchAsync(async (req, res, next) => {
  const assignment = await AssignmentRepository.findById(req.params.id);
  if (!assignment) return next(new AppError('Assignment not found', 404));
  res.status(200).json({ status: 'success', data: { assignment } });
});



// const { Assignment, Submission, ProgressTracking, Course } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');

// // ==========================
// // STUDENT ACTIONS
// // ==========================

// exports.submitAssignment = catchAsync(async (req, res, next) => {
//   const { assignmentId } = req.params;

//   // 1. Check if assignment exists
//   const assignment = await Assignment.findById(assignmentId);
//   if (!assignment) return next(new AppError('Assignment not found', 404));

//   // 2. Check for existing submission (Allow resubmission if not graded)
//   const existingSubmission = await Submission.findOne({ 
//     assignment: assignmentId, 
//     student: req.user.id 
//   });

//   if (existingSubmission && existingSubmission.status === 'graded') {
//     return next(new AppError('Cannot resubmit a graded assignment', 400));
//   }

//   // 3. Create or Update Submission
//   const submissionData = {
//     assignment: assignmentId,
//     student: req.user.id,
//     content: req.body.content, // Text part
//     fileUrl: req.file ? `/uploads/assignments/${req.file.filename}` : undefined,
//     submittedAt: Date.now(),
//     status: 'pending'
//   };

//   const submission = await Submission.findOneAndUpdate(
//     { assignment: assignmentId, student: req.user.id },
//     submissionData,
//     { upsert: true, new: true }
//   );

//   res.status(201).json({ status: 'success', data: { submission } });
// });

// // ==========================
// // INSTRUCTOR ACTIONS
// // ==========================

// exports.gradeSubmission = catchAsync(async (req, res, next) => {
//   const { grade, feedback } = req.body;
//   const submission = await Submission.findById(req.params.id).populate('assignment');

//   if (!submission) return next(new AppError('Submission not found', 404));

//   submission.grade = grade;
//   submission.feedback = feedback;
//   submission.status = 'graded';
//   submission.gradedAt = Date.now();
//   await submission.save();

//   // PRO FEATURE: Update progress if grade is passing
//   if (grade >= submission.assignment.passingGrade) {
//     await ProgressTracking.findOneAndUpdate(
//       { student: submission.student, course: submission.assignment.course },
//       { $addToSet: { completedAssignments: submission.assignment._id } }
//     );
//   }

//   res.status(200).json({ status: 'success', data: { submission } });
// });

// exports.getAssignmentSubmissions = catchAsync(async (req, res, next) => {
//   const submissions = await Submission.find({ assignment: req.params.assignmentId })
//     .populate('student', 'firstName lastName email profilePicture')
//     .sort('-submittedAt');

//   res.status(200).json({ status: 'success', results: submissions.length, data: { submissions } });
// });

// // Standard CRUD
// exports.createAssignment = factory.createOne(Assignment);
// exports.getAssignment = factory.getOne(Assignment);

