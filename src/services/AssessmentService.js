'use strict';
const _ = require('lodash');
const AppError = require('../utils/appError');
const QuizRepository = require('../repositories/QuizRepository');
const QuizQuestionRepository = require('../repositories/QuizQuestionRepository');
const MockTestRepository = require('../repositories/MockTestRepository');
const MockTestAttemptRepository = require('../repositories/MockTestAttemptRepository');
// Replaced ProgressTracking with LessonProgress per our new schema
const LessonProgressRepository = require('../repositories/LessonProgressRepository'); 
const EventDispatcher = require('../events/EventDispatcher');

class AssessmentService {

  // ==========================================
  // QUIZ LOGIC
  // ==========================================
  async getQuizForStudent(quizId, shuffle = false) {
    const quiz = await QuizRepository.findById(quizId);
    if (!quiz) throw new AppError('Quiz not found', 404);

    // Fetch questions and MASK the correct answers for security
    let questions = await QuizQuestionRepository.model.find({ quiz: quiz._id })
      .select('-correctAnswer -options.isCorrect')
      .sort('order')
      .lean();

    if (shuffle) questions = _.shuffle(questions);

    return { quiz, questions };
  }

  async submitQuiz(studentId, quizId, answers) {
    const quiz = await QuizRepository.findById(quizId);
    if (!quiz) throw new AppError('Quiz not found', 404);

    const questions = await QuizQuestionRepository.findQuestionsByQuizId(quiz._id);
    let score = 0;

    // Grade the answers
    const gradedAnswers = questions.map(q => {
      const userAns = answers.find(a => a.questionId === q._id.toString());
      const isCorrect = userAns && q.options[userAns.selectedOptionIndex]?.isCorrect;
      
      if (isCorrect) score += q.points;
      
      return {
        questionId: q._id,
        isCorrect,
        correctAnswer: q.options.find(opt => opt.isCorrect)?.text,
        explanation: q.explanation
      };
    });

    const percentage = (score / quiz.totalPoints) * 100;
    const passed = percentage >= quiz.passingScore;

    // Sync with new LessonProgress schema (Flat architecture instead of array bloat)
    if (passed && quiz.lesson) {
       await LessonProgressRepository.model.findOneAndUpdate(
         { student: studentId, course: quiz.course, lesson: quiz.lesson },
         { isCompleted: true },
         { upsert: true }
       );
       EventDispatcher.emit('progress.updated', { studentId, courseId: quiz.course });
    }

    return { score, totalPoints: quiz.totalPoints, percentage, passed, results: gradedAnswers };
  }

  // ==========================================
  // MOCK TEST LIFECYCLE
  // ==========================================
  async startMockTestAttempt(studentId, mockTestId) {
    const mockTest = await MockTestRepository.findById(mockTestId);
    if (!mockTest) throw new AppError('Mock Test not found', 404);

    let attempt = await MockTestAttemptRepository.model.findOne({ 
      mockTest: mockTest._id, 
      student: studentId, 
      status: { $in: ['started', 'in-progress'] } 
    });

    if (!attempt) {
      attempt = await MockTestAttemptRepository.create({
        mockTest: mockTest._id,
        student: studentId,
        status: 'started',
        startedAt: Date.now()
      });
    }

    return attempt;
  }

  async trackAttemptActivity(attemptId, studentId, tabSwitches) {
    // Verifying studentId ensures one student can't ping another student's heartbeat
    await MockTestAttemptRepository.model.findOneAndUpdate(
      { _id: attemptId, student: studentId },
      { 
        $set: { lastHeartbeat: Date.now() },
        $inc: { tabSwitches: tabSwitches || 0 }
      }
    );
  }

  async submitMockTestAttempt(attemptId, studentId, answers) {
    const attempt = await MockTestAttemptRepository.model.findOne({ _id: attemptId, student: studentId }).populate('mockTest');
    
    if (!attempt || attempt.status === 'completed') {
      throw new AppError('Attempt invalid or already submitted', 400);
    }

    // You will need to create a MockTestQuestionRepository for this
    const questions = await MockTestQuestionRepository.model.find({ mockTest: attempt.mockTest._id });
    
    let totalMarks = 0;
    const sectionAnalysis = {};

    const processedAnswers = questions.map(q => {
      const userAns = answers.find(a => a.questionId === q._id.toString());
      let marksObtained = 0;
      let isCorrect = false;

      if (userAns) {
        isCorrect = q.options[userAns.selectedOptionIndex]?.isCorrect;
        marksObtained = isCorrect ? q.marks : -(q.negativeMarks || 0);
      }

      if (!sectionAnalysis[q.sectionName]) sectionAnalysis[q.sectionName] = { score: 0, total: 0 };
      sectionAnalysis[q.sectionName].score += marksObtained;
      sectionAnalysis[q.sectionName].total += q.marks;

      totalMarks += marksObtained;
      return { questionId: q._id, selectedOptionIndex: userAns?.selectedOptionIndex, isCorrect, marksObtained };
    });

    const rank = await MockTestAttemptRepository.model.countDocuments({ 
      mockTest: attempt.mockTest._id, 
      score: { $gt: totalMarks },
      status: 'completed'
    }) + 1;

    attempt.answers = processedAnswers;
    attempt.score = totalMarks;
    attempt.percentage = (totalMarks / attempt.mockTest.totalMarks) * 100;
    attempt.status = 'completed';
    attempt.completedAt = Date.now();
    attempt.timeTaken = Math.round((attempt.completedAt - attempt.startedAt) / 1000);
    attempt.isPassed = attempt.percentage >= attempt.mockTest.passingMarks;
    attempt.rank = rank;
    attempt.totalStudents = await MockTestAttemptRepository.model.countDocuments({ mockTest: attempt.mockTest._id, status: 'completed' }) + 1;
    attempt.feedback = JSON.stringify(sectionAnalysis);

    await attempt.save();

    return { attempt, analysis: sectionAnalysis };
  }

  // ==========================================
  // INSTRUCTOR & ADMIN
  // ==========================================
  async getMockTestAnalytics(mockTestId) {
    return await MockTestAttemptRepository.model.aggregate([
      { $match: { mockTest: mockTestId, status: 'completed' } },
      { $unwind: '$answers' },
      { $group: {
          _id: '$answers.questionId',
          failRate: { $avg: { $cond: ['$answers.isCorrect', 0, 1] } },
          totalAttempts: { $sum: 1 }
      }},
      { $sort: { failRate: -1 } },
      { $limit: 5 }
    ]);
  }
}

module.exports = new AssessmentService();


// 'use strict';
// const AppError = require('../utils/appError');
// const { Quiz, QuizQuestion } = require('../models');
// // Assuming Repositories exist for these

// class AssessmentService {
  
//   async submitQuizAttempt(studentId, quizId, submittedAnswers) {
//     // 1. Fetch Quiz and correct answers
//     const quiz = await Quiz.findById(quizId);
//     const questions = await QuizQuestion.find({ quiz: quizId });

//     if (!quiz) throw new AppError('Quiz not found', 404);

//     let totalScore = 0;
//     const gradedAnswers = [];

//     // 2. Grade each answer against the truth
//     for (const sub of submittedAnswers) {
//       const question = questions.find(q => q._id.toString() === sub.questionId);
//       if (!question) continue;

//       // Find the correct option
//       const correctOptionIndex = question.options.findIndex(opt => opt.isCorrect);
//       const isCorrect = correctOptionIndex === sub.selectedOptionIndex;

//       if (isCorrect) totalScore += question.points;

//       gradedAnswers.push({
//         questionId: question._id,
//         isCorrect,
//         pointsAwarded: isCorrect ? question.points : 0
//       });
//     }

//     // 3. Determine Pass/Fail
//     const percentage = (totalScore / quiz.totalPoints) * 100;
//     const isPassed = percentage >= quiz.passingScore;

//     // 4. Save Attempt to DB
//     // await QuizAttemptRepository.create({ ... })

//     return { totalScore, percentage, isPassed, gradedAnswers };
//   }
// }

// module.exports = new AssessmentService();