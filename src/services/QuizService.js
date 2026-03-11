'use strict';
const AppError = require('../utils/appError');
const QuizRepository = require('../repositories/QuizRepository');
const LessonRepository = require('../repositories/LessonRepository');
const CourseRepository = require('../repositories/CourseRepository');
const EnrollmentRepository = require('../repositories/EnrollmentRepository');
const LessonProgressRepository = require('../repositories/LessonProgressRepository');
const { QuizQuestion } = require('../models');

class QuizService {

  async createQuiz(instructorId, userRole, data) {
    const course = await CourseRepository.findById(data.course);
    if (!course) throw new AppError('Course not found', 404);

    if (course.instructor.toString() !== instructorId.toString() && userRole !== 'admin') {
      throw new AppError('Unauthorized quiz creation', 403);
    }

    const quiz = await QuizRepository.create(data);

    if (data.lesson) {
      await LessonRepository.updateById(data.lesson, { 'content.quiz': quiz._id });
    }

    return quiz;
  }

  async submitQuiz(studentId, userRole, quizId, answers) {
    const quiz = await QuizRepository.findById(quizId, ['course', 'lesson']);
    if (!quiz) throw new AppError('Quiz not found', 404);

    // 1. Enrollment Check
    if (userRole !== 'admin') {
      const isEnrolled = await EnrollmentRepository.findOne({ student: studentId, course: quiz.course._id, isActive: true });
      if (!isEnrolled) throw new AppError('You must be enrolled to take this quiz', 403);
    }

    const questions = await QuizQuestion.find({ quiz: quizId }).lean();
    let totalScore = 0;
    const results = answers.map(answer => {
      const q = questions.find(item => item._id.toString() === answer.questionId);
      if (!q) return null;

      let isCorrect = false;
      if (q.type === 'multiple-choice') {
        const correctIdx = q.options.findIndex(opt => opt.isCorrect);
        isCorrect = answer.selectedOption === correctIdx;
      } else if (q.type === 'true-false') {
        isCorrect = answer.selectedOption === (q.correctAnswer === 'true');
      } else {
        isCorrect = answer.answerText?.toLowerCase().trim() === q.correctAnswer?.toLowerCase().trim();
      }

      if (isCorrect) totalScore += q.points;
      return { questionId: q._id, isCorrect, pointsEarned: isCorrect ? q.points : 0 };
    }).filter(Boolean);

    const percentage = (totalScore / (quiz.totalPoints || 1)) * 100;
    const passed = percentage >= quiz.passingScore;

    // 2. Optimized Progress Update (Using our new flat schema)
    if (passed && quiz.lesson) {
      await LessonProgressRepository.model.findOneAndUpdate(
        { student: studentId, course: quiz.course._id, lesson: quiz.lesson._id },
        { isCompleted: true, completedAt: Date.now() },
        { upsert: true }
      );
    }

    return { score: totalScore, totalPoints: quiz.totalPoints, percentage, passed, results };
  }
}

module.exports = new QuizService();