'use strict';
const AppError = require('../utils/appError');
const MockTestRepository = require('../repositories/MockTestRepository');
const MockTestAttemptRepository = require('../repositories/MockTestAttemptRepository');
// Assuming you have a MockTestQuestion model/repository
const { MockTestQuestion } = require('../models'); 

class MockTestService {

  async startAttempt(studentId, mockTestId) {
    const mockTest = await MockTestRepository.findById(mockTestId);
    if (!mockTest) throw new AppError('Mock test not found', 404);

    // 1. Max Attempts Guard
    if (mockTest.maxAttempts) {
      const attemptsCount = await MockTestAttemptRepository.model.countDocuments({
        mockTest: mockTestId,
        student: studentId
      });
      if (attemptsCount >= mockTest.maxAttempts) {
        throw new AppError('Maximum attempts reached for this mock test', 400);
      }
    }

    // 2. Create the Attempt record
    const attempt = await MockTestAttemptRepository.create({
      mockTest: mockTestId,
      student: studentId,
      startedAt: Date.now(),
      status: 'started'
    });

    // 3. Return questions (Masking correct answers for security)
    const questions = await MockTestQuestion.find({ mockTest: mockTestId })
      .select('-correctAnswer -options.isCorrect')
      .sort('order')
      .lean();

    return { attempt, questions };
  }

  async submitAttempt(studentId, attemptId, answers) {
    const attempt = await MockTestAttemptRepository.model.findById(attemptId).populate('mockTest');
    if (!attempt) throw new AppError('No attempt found', 404);
    if (attempt.student.toString() !== studentId.toString()) throw new AppError('Unauthorized', 403);
    if (attempt.status === 'completed') throw new AppError('Already submitted', 400);

    const questions = await MockTestQuestion.find({ mockTest: attempt.mockTest._id }).lean();
    
    let totalScore = 0;
    const processedAnswers = answers.map(answer => {
      const question = questions.find(q => q._id.toString() === answer.questionId);
      if (!question) return null;

      let isCorrect = false;
      let marksObtained = 0;

      // Logic for Multiple Choice vs Text Answer
      if (question.options?.length > 0) {
        const correctIndex = question.options.findIndex(opt => opt.isCorrect);
        isCorrect = Number(answer.selectedOptionIndex) === correctIndex;
      } else {
        isCorrect = answer.answerText?.toLowerCase().trim() === question.correctAnswer?.toLowerCase().trim();
      }

      marksObtained = isCorrect ? question.marks : -(question.negativeMarks || 0);
      totalScore += marksObtained;

      return {
        questionId: question._id,
        selectedOptionIndex: answer.selectedOptionIndex,
        answerText: answer.answerText,
        isCorrect,
        marksObtained
      };
    }).filter(Boolean);

    // Percentage Calculation (Enterprise-safe)
    const totalPossible = attempt.mockTest.totalMarks || 1;
    let percentage = Math.max(0, (totalScore / totalPossible) * 100);
    const isPassed = percentage >= (attempt.mockTest.passingMarks || 0);

    // Global Ranking Logic
    const betterScores = await MockTestAttemptRepository.model.countDocuments({
      mockTest: attempt.mockTest._id,
      score: { $gt: totalScore },
      status: 'completed'
    });

    // Update Attempt Document
    attempt.answers = processedAnswers;
    attempt.score = totalScore;
    attempt.percentage = percentage;
    attempt.isPassed = isPassed;
    attempt.completedAt = Date.now();
    attempt.timeTaken = (attempt.completedAt - attempt.startedAt) / 60000; // in minutes
    attempt.rank = betterScores + 1;
    attempt.status = 'completed';
    await attempt.save();

    // Asynchronous Background Update: Re-calculate global stats for the MockTest
    this._updateMockTestStats(attempt.mockTest._id);

    return { attempt, rank: attempt.rank, isPassed };
  }

  async _updateMockTestStats(mockTestId) {
    const stats = await MockTestAttemptRepository.model.aggregate([
      { $match: { mockTest: mockTestId, status: 'completed' } },
      { $group: { _id: null, avg: { $avg: '$score' }, count: { $sum: 1 } } }
    ]);

    if (stats.length > 0) {
      await MockTestRepository.updateById(mockTestId, {
        averageScore: stats[0].avg,
        attemptsCount: stats[0].count
      });
    }
  }
}

module.exports = new MockTestService();