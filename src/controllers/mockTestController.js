const { 
    MockTest, 
    MockTestQuestion, 
    MockTestAttempt,
    Category,
    User 
  } = require('../models');
  const AppError = require('../utils/appError');
  const catchAsync = require('../utils/catchAsync');
  const factory = require('./handlerFactory');
  
  exports.createMockTest = catchAsync(async (req, res, next) => {
    req.body.instructor = req.user.id;
    
    const mockTest = await MockTest.create(req.body);
    
    res.status(201).json({
      status: 'success',
      data: { mockTest }
    });
  });
  
  exports.addQuestions = catchAsync(async (req, res, next) => {
    const { questions } = req.body;
    const mockTestId = req.params.mockTestId;
    
    if (!Array.isArray(questions)) {
      return next(new AppError('Questions array is required', 400));
    }
    
    const mockTest = await MockTest.findById(mockTestId);
    if (!mockTest) {
      return next(new AppError('No mock test found with that ID', 404));
    }
    
    if (mockTest.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new AppError('Unauthorized to modify this mock test', 403));
    }
    
    const questionsWithTest = questions.map(q => ({
      ...q,
      mockTest: mockTestId
    }));
    
    const createdQuestions = await MockTestQuestion.insertMany(questionsWithTest);
    
    // Update totals
    const totalQuestions = await MockTestQuestion.countDocuments({ mockTest: mockTestId });
    const totalMarks = await MockTestQuestion.aggregate([
      { $match: { mockTest: mockTestId } },
      { $group: { _id: null, total: { $sum: '$marks' } } }
    ]);
    
    mockTest.totalQuestions = totalQuestions;
    mockTest.totalMarks = totalMarks[0]?.total || 0;
    await mockTest.save();
    
    res.status(201).json({
      status: 'success',
      results: createdQuestions.length,
      data: { questions: createdQuestions }
    });
  });
  
  exports.startAttempt = catchAsync(async (req, res, next) => {
    const mockTestId = req.params.mockTestId;
    
    const mockTest = await MockTest.findById(mockTestId);
    if (!mockTest) {
      return next(new AppError('No mock test found with that ID', 404));
    }
    
    // Check if user has reached max attempts (if set)
    if (mockTest.maxAttempts) {
      const attemptsCount = await MockTestAttempt.countDocuments({
        mockTest: mockTestId,
        student: req.user.id
      });
      
      if (attemptsCount >= mockTest.maxAttempts) {
        return next(new AppError('Maximum attempts reached for this mock test', 400));
      }
    }
    
    const attempt = await MockTestAttempt.create({
      mockTest: mockTestId,
      student: req.user.id,
      startedAt: Date.now(),
      status: 'started'
    });
    
    // Get questions for the attempt
    const questions = await MockTestQuestion.find({ mockTest: mockTestId }).sort('order');
    
    res.status(201).json({
      status: 'success',
      data: {
        attempt,
        questions: questions.map(q => ({
          _id: q._id,
          question: q.question,
          options: q.options,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          sectionName: q.sectionName
        }))
      }
    });
  });
  
  exports.submitAttempt = catchAsync(async (req, res, next) => {
    const { answers } = req.body; // Array of { questionId, selectedOptionIndex, answerText }
    const attemptId = req.params.attemptId;
    
    const attempt = await MockTestAttempt.findById(attemptId)
      .populate('mockTest');
    
    if (!attempt) {
      return next(new AppError('No attempt found with that ID', 404));
    }
    
    if (attempt.student.toString() !== req.user.id) {
      return next(new AppError('Unauthorized to submit this attempt', 403));
    }
    
    if (attempt.status === 'completed') {
      return next(new AppError('This attempt has already been submitted', 400));
    }
    
    // Get all questions
    const questions = await MockTestQuestion.find({ 
      mockTest: attempt.mockTest._id 
    });
    
    let totalScore = 0;
    const processedAnswers = [];
    
    answers.forEach(answer => {
      const question = questions.find(q => q._id.toString() === answer.questionId);
      if (!question) return;
      
      let isCorrect = false;
      let marksObtained = 0;
      
      if (question.options && question.options.length > 0) {
        const correctOption = question.options.findIndex(opt => opt.isCorrect);
        isCorrect = answer.selectedOptionIndex === correctOption;
      } else {
        isCorrect = answer.answerText?.toLowerCase().trim() === question.correctAnswer?.toLowerCase().trim();
      }
      
      if (isCorrect) {
        marksObtained = question.marks;
      } else if (question.negativeMarks > 0) {
        marksObtained = -question.negativeMarks;
      }
      
      totalScore += marksObtained;
      
      processedAnswers.push({
        questionId: question._id,
        selectedOptionIndex: answer.selectedOptionIndex,
        answerText: answer.answerText,
        isCorrect,
        marksObtained
      });
    });
    
    // Calculate percentage
    const percentage = (totalScore / attempt.mockTest.totalMarks) * 100;
    const isPassed = percentage >= attempt.mockTest.passingMarks;
    
    // Get total students for ranking
    const totalStudents = await MockTestAttempt.countDocuments({
      mockTest: attempt.mockTest._id,
      status: 'completed'
    });
    
    // Calculate rank
    const betterScores = await MockTestAttempt.countDocuments({
      mockTest: attempt.mockTest._id,
      score: { $gt: totalScore }
    });
    
    const rank = betterScores + 1;
    
    attempt.answers = processedAnswers;
    attempt.score = totalScore;
    attempt.percentage = percentage;
    attempt.isPassed = isPassed;
    attempt.completedAt = Date.now();
    attempt.timeTaken = (attempt.completedAt - attempt.startedAt) / 1000 / 60; // in minutes
    attempt.rank = rank;
    attempt.totalStudents = totalStudents + 1;
    attempt.status = 'completed';
    
    await attempt.save();
    
    // Update mock test stats
    const { MockTest } = require('../models');
    const mockTest = await MockTest.findById(attempt.mockTest._id);
    
    const avgScore = await MockTestAttempt.aggregate([
      { $match: { mockTest: mockTest._id, status: 'completed' } },
      { $group: { _id: null, avg: { $avg: '$score' } } }
    ]);
    
    mockTest.attemptsCount = await MockTestAttempt.countDocuments({ 
      mockTest: mockTest._id,
      status: 'completed'
    });
    mockTest.averageScore = avgScore[0]?.avg || 0;
    await mockTest.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        attempt,
        rank,
        totalStudents: totalStudents + 1,
        isPassed
      }
    });
  });
  
  exports.getMyAttempts = catchAsync(async (req, res, next) => {
    const attempts = await MockTestAttempt.find({ 
      student: req.user.id 
    })
    .populate('mockTest', 'title category level totalMarks')
    .sort('-createdAt');
    
    res.status(200).json({
      status: 'success',
      results: attempts.length,
      data: { attempts }
    });
  });
  
  exports.getAttemptDetails = catchAsync(async (req, res, next) => {
    const attempt = await MockTestAttempt.findById(req.params.id)
      .populate('mockTest')
      .populate('answers.questionId');
    
    if (!attempt) {
      return next(new AppError('No attempt found with that ID', 404));
    }
    
    if (attempt.student.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new AppError('Unauthorized to view this attempt', 403));
    }
    
    res.status(200).json({
      status: 'success',
      data: { attempt }
    });
  });
  
  // CRUD operations
  exports.getAllMockTests = factory.getAll(MockTest, {
    searchFields: ['title', 'description'],
    populate: [
      { path: 'category', select: 'name' },
      { path: 'instructor', select: 'firstName lastName' }
    ]
  });
  exports.getMockTest = factory.getOne(MockTest);
  exports.updateMockTest = factory.updateOne(MockTest);
  exports.deleteMockTest = factory.deleteOne(MockTest);