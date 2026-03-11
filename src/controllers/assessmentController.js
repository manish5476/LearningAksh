'use strict';
const catchAsync = require('../utils/catchAsync');
const AssessmentService = require('../services/AssessmentService');
const QuizRepository = require('../repositories/QuizRepository');
const MockTestRepository = require('../repositories/MockTestRepository');

// ==========================================
// 1. QUIZ HTTP HANDLERS
// ==========================================
exports.getQuiz = catchAsync(async (req, res, next) => {
  const shuffle = req.query.shuffle === 'true';
  const data = await AssessmentService.getQuizForStudent(req.params.id, shuffle);
  res.status(200).json({ status: 'success', data });
});

exports.submitQuiz = catchAsync(async (req, res, next) => {
  const result = await AssessmentService.submitQuiz(req.user.id, req.params.id, req.body.answers);
  res.status(200).json({ status: 'success', data: result });
});

// ==========================================
// 2. MOCK TEST HTTP HANDLERS
// ==========================================
exports.startMockTestAttempt = catchAsync(async (req, res, next) => {
  const attempt = await AssessmentService.startMockTestAttempt(req.user.id, req.params.id);
  res.status(201).json({ status: 'success', data: { attempt } });
});

exports.trackAttemptActivity = catchAsync(async (req, res, next) => {
  await AssessmentService.trackAttemptActivity(req.params.attemptId, req.user.id, req.body.tabSwitches);
  res.status(200).json({ status: 'success' });
});

exports.submitMockTestAttempt = catchAsync(async (req, res, next) => {
  const result = await AssessmentService.submitMockTestAttempt(req.params.attemptId, req.user.id, req.body.answers);
  res.status(200).json({ status: 'success', data: result });
});

// ==========================================
// 3. INSTRUCTOR / ADMIN HANDLERS
// ==========================================
exports.getMockTestAnalytics = catchAsync(async (req, res, next) => {
  const hardestQuestions = await AssessmentService.getMockTestAnalytics(req.params.id);
  res.status(200).json({ status: 'success', data: { hardestQuestions } });
});

// Notice we use Repositories directly for pure CRUD
exports.getAllMockTests = catchAsync(async (req, res, next) => {
  const result = await MockTestRepository.findMany(req.query);
  res.status(200).json({ status: 'success', results: result.results, data: { mockTests: result.data } });
});

exports.getMockTest = catchAsync(async (req, res, next) => {
  const mockTest = await MockTestRepository.findById(req.params.id);
  res.status(200).json({ status: 'success', data: { mockTest } });
});

exports.createQuiz = catchAsync(async (req, res, next) => {
  const quiz = await QuizRepository.create(req.body);
  res.status(201).json({ status: 'success', data: { quiz } });
});

exports.createMockTest = catchAsync(async (req, res, next) => {
  req.body.instructor = req.user.id; // Assign ownership
  const mockTest = await MockTestRepository.create(req.body);
  res.status(201).json({ status: 'success', data: { mockTest } });
});





// const { Quiz, QuizQuestion, MockTest, MockTestQuestion, MockTestAttempt, ProgressTracking, Course } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');
// const _ = require('lodash');

// // ==========================================
// // 1. QUIZ LOGIC (In-Course Assessments)
// // ==========================================

// exports.getQuiz = catchAsync(async (req, res, next) => {
//   const quiz = await Quiz.findById(req.params.id).lean();
//   if (!quiz) return next(new AppError('Quiz not found', 404));

//   // SECURITY: Fetch questions but REMOVE 'isCorrect' and 'correctAnswer'
//   // This prevents students from seeing answers in the Network Tab.
//   let questions = await QuizQuestion.find({ quiz: quiz._id })
//     .select('-correctAnswer -options.isCorrect')
//     .sort('order')
//     .lean();

//   // PRO FEATURE: Shuffle if requested
//   if (req.query.shuffle === 'true') questions = _.shuffle(questions);

//   res.status(200).json({ status: 'success', data: { quiz, questions } });
// });

// exports.submitQuiz = catchAsync(async (req, res, next) => {
//   const { answers } = req.body; // Expects [{ questionId, selectedOptionIndex }]
//   const quiz = await Quiz.findById(req.params.id);
//   if (!quiz) return next(new AppError('Quiz not found', 404));

//   const questions = await QuizQuestion.find({ quiz: quiz._id });
//   let score = 0;

//   const gradedAnswers = questions.map(q => {
//     const userAns = answers.find(a => a.questionId === q._id.toString());
//     const isCorrect = userAns && q.options[userAns.selectedOptionIndex]?.isCorrect;
//     if (isCorrect) score += q.points;
    
//     return {
//       questionId: q._id,
//       isCorrect,
//       correctAnswer: q.options.find(opt => opt.isCorrect)?.text,
//       explanation: q.explanation
//     };
//   });

//   const percentage = (score / quiz.totalPoints) * 100;
//   const passed = percentage >= quiz.passingScore;

//   // SYNC WITH COURSE PROGRESS
//   if (passed && quiz.course) {
//     await ProgressTracking.findOneAndUpdate(
//       { student: req.user.id, course: quiz.course },
//       { 
//         $addToSet: { completedQuizzes: { quiz: quiz._id, score, completedAt: Date.now() } },
//         $set: { lastActivity: Date.now() }
//       }
//     );
//   }

//   res.status(200).json({ status: 'success', data: { score, totalPoints: quiz.totalPoints, percentage, passed, results: gradedAnswers } });
// });

// // ==========================================
// // 2. MOCK TEST LIFECYCLE (Competitive Testing)
// // ==========================================

// exports.startMockTestAttempt = catchAsync(async (req, res, next) => {
//   const mockTest = await MockTest.findById(req.params.id);
//   if (!mockTest) return next(new AppError('Mock Test not found', 404));

//   // Resume Logic: Check if there is already a started session
//   let attempt = await MockTestAttempt.findOne({ 
//     mockTest: mockTest._id, 
//     student: req.user.id, 
//     status: { $in: ['started', 'in-progress'] } 
//   });

//   if (!attempt) {
//     attempt = await MockTestAttempt.create({
//       mockTest: mockTest._id,
//       student: req.user.id,
//       status: 'started',
//       startedAt: Date.now()
//     });
//   }

//   res.status(201).json({ status: 'success', data: { attempt } });
// });

// // ANTI-CHEAT HEARTBEAT
// exports.trackAttemptActivity = catchAsync(async (req, res, next) => {
//   const { tabSwitches } = req.body;
//   await MockTestAttempt.findByIdAndUpdate(req.params.attemptId, {
//     $set: { lastHeartbeat: Date.now() },
//     $inc: { tabSwitches: tabSwitches || 0 }
//   });
//   res.status(200).json({ status: 'success' });
// });

// exports.submitMockTestAttempt = catchAsync(async (req, res, next) => {
//   const { answers } = req.body; 
//   const attempt = await MockTestAttempt.findById(req.params.attemptId).populate('mockTest');
  
//   if (!attempt || attempt.status === 'completed') return next(new AppError('Attempt invalid or already submitted', 400));

//   const questions = await MockTestQuestion.find({ mockTest: attempt.mockTest._id });
//   let totalMarks = 0;
//   const sectionAnalysis = {};

//   const processedAnswers = questions.map(q => {
//     const userAns = answers.find(a => a.questionId === q._id.toString());
//     let marksObtained = 0;
//     let isCorrect = false;

//     if (userAns) {
//       isCorrect = q.options[userAns.selectedOptionIndex]?.isCorrect;
//       marksObtained = isCorrect ? q.marks : -(q.negativeMarks || 0);
//     }

//     // Sectional breakdown logic
//     if (!sectionAnalysis[q.sectionName]) sectionAnalysis[q.sectionName] = { score: 0, total: 0 };
//     sectionAnalysis[q.sectionName].score += marksObtained;
//     sectionAnalysis[q.sectionName].total += q.marks;

//     totalMarks += marksObtained;
//     return { questionId: q._id, selectedOptionIndex: userAns?.selectedOptionIndex, isCorrect, marksObtained };
//   });

//   // Calculate Global Rank
//   const rank = await MockTestAttempt.countDocuments({ 
//     mockTest: attempt.mockTest._id, 
//     score: { $gt: totalMarks },
//     status: 'completed'
//   }) + 1;

//   attempt.answers = processedAnswers;
//   attempt.score = totalMarks;
//   attempt.percentage = (totalMarks / attempt.mockTest.totalMarks) * 100;
//   attempt.status = 'completed';
//   attempt.completedAt = Date.now();
//   attempt.timeTaken = Math.round((attempt.completedAt - attempt.startedAt) / 1000);
//   attempt.isPassed = attempt.percentage >= attempt.mockTest.passingMarks;
//   attempt.rank = rank;
//   attempt.totalStudents = await MockTestAttempt.countDocuments({ mockTest: attempt.mockTest._id, status: 'completed' }) + 1;
//   attempt.feedback = JSON.stringify(sectionAnalysis);

//   await attempt.save();

//   res.status(200).json({ status: 'success', data: { attempt, analysis: sectionAnalysis } });
// });

// // ==========================================
// // 3. INSTRUCTOR & ADMIN OPERATIONS
// // ==========================================

// exports.getMockTestAnalytics = catchAsync(async (req, res, next) => {
//   const hardestQuestions = await MockTestAttempt.aggregate([
//     { $match: { mockTest: req.params.id, status: 'completed' } },
//     { $unwind: '$answers' },
//     { $group: {
//         _id: '$answers.questionId',
//         failRate: { $avg: { $cond: ['$answers.isCorrect', 0, 1] } },
//         totalAttempts: { $sum: 1 }
//     }},
//     { $sort: { failRate: -1 } },
//     { $limit: 5 }
//   ]);

//   res.status(200).json({ status: 'success', data: { hardestQuestions } });
// });

// exports.addQuestions = catchAsync(async (req, res, next) => {
//   const { type, id } = req.params; // type = 'quiz' or 'mock-test'
//   const Model = type === 'quiz' ? QuizQuestion : MockTestQuestion;
//   const ParentModel = type === 'quiz' ? Quiz : MockTest;

//   const questions = req.body.map(q => ({ ...q, [type === 'quiz' ? 'quiz' : 'mockTest']: id }));
//   const docs = await Model.insertMany(questions);
  
//   const totalPoints = questions.reduce((acc, q) => acc + (q.points || q.marks || 1), 0);
  
//   await ParentModel.findByIdAndUpdate(id, {
//     $inc: { totalQuestions: docs.length, [type === 'quiz' ? 'totalPoints' : 'totalMarks']: totalPoints }
//   });

//   res.status(201).json({ status: 'success', count: docs.length });
// });

// // Standard CRUD
// exports.getAllMockTests = factory.getAll(MockTest);
// exports.getMockTest = factory.getOne(MockTest);
// exports.createQuiz = factory.createOne(Quiz);
// exports.createMockTest = factory.createOne(MockTest);

