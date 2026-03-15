const { Quiz, QuizQuestion, Course, Lesson, ProgressTracking } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');
const mongoose = require('mongoose');

exports.createQuiz = catchAsync(async (req, res, next) => {
  const { course, lesson } = req.body;
  
  // Verify course ownership
  const courseDoc = await Course.findById(course);
  if (!courseDoc) {
    return next(new AppError('No course found with that ID', 404));
  }
  
  // ✅ FIX: Changed 'instructor' to 'primaryInstructor' and added check for co-instructors
  const isPrimary = courseDoc.primaryInstructor.toString() === req.user.id;
  const isCoInstructor = courseDoc.instructors?.some(inst => inst.instructor.toString() === req.user.id && inst.isActive);
  
  if (!isPrimary && !isCoInstructor && req.user.role !== 'admin') {
    return next(new AppError('You are not authorized to create quizzes for this course', 403));
  }
  
  const quiz = await Quiz.create(req.body);
  
  // If lesson is provided, update lesson content
  if (lesson) {
    await Lesson.findByIdAndUpdate(lesson, {
      'content.quiz': quiz._id
    });
  }
  
  res.status(201).json({
    status: 'success',
    data: { quiz }
  });
});

exports.getQuizzesByCourse = catchAsync(async (req, res, next) => {
  const { identifier } = req.params;
  let course;
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    course = await Course.findById(identifier);
  } else {
    // Otherwise search by slug
    course = await Course.findOne({ slug: identifier });
  }

  if (!course) {
    return next(new AppError('No course found with that identifier', 404));
  }

  // Fetch quizzes using course _id
  const quizzes = await Quiz.find({
    course: course._id,
    isDeleted: false
  })
  .populate('lesson', 'title order')
  .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: quizzes.length,
    data: {
      course: {
        id: course._id,
        title: course.title,
        slug: course.slug
      },
      quizzes
    }
  });

});


// exports.getQuizzesByCourse = catchAsync(async (req, res, next) => {
//   const { courseId } = req.params;
//   const course = await Course.findById(courseId);
//   if (!course) {
//     return next(new AppError('No course found with that ID', 404));
//   }
//   if (req.user.role === 'student') {
//     const { Enrollment } = require('../models');
//     const enrollment = await Enrollment.findOne({
//       student: req.user.id,
//       course: courseId,
//       isActive: true
//     });
//     if (!enrollment) {
//       return next(new AppError('You are not enrolled in this course', 403));
//     }
//   }

//   const quizzes = await Quiz.find({ course: courseId })
//     .populate('lesson', 'title order')
//     .sort({ createdAt: -1 });

//   res.status(200).json({
//     status: 'success',
//     results: quizzes.length,
//     data: {
//       quizzes
//     }
//   });
// });

exports.addQuestions = catchAsync(async (req, res, next) => {
  const { questions } = req.body;
  
  if (!Array.isArray(questions) || questions.length === 0) {
    return next(new AppError('Questions array is required', 400));
  }
  
  const quiz = await Quiz.findById(req.params.quizId).populate('course');
  if (!quiz) {
    return next(new AppError('No quiz found with that ID', 404));
  }
  
  // ✅ FIX: Changed 'instructor' to 'primaryInstructor' and added check for co-instructors
  const isPrimary = quiz.course.primaryInstructor.toString() === req.user.id;
  const isCoInstructor = quiz.course.instructors?.some(inst => inst.instructor.toString() === req.user.id && inst.isActive);
  
  if (!isPrimary && !isCoInstructor && req.user.role !== 'admin') {
    return next(new AppError('You are not authorized to modify this quiz', 403));
  }
  
  // Add quiz ID to each question
  const questionsWithQuiz = questions.map(q => ({
    ...q,
    quiz: quiz._id
  }));
  
  const createdQuestions = await QuizQuestion.insertMany(questionsWithQuiz);
  
  // Update quiz totals
  const totalQuestions = await QuizQuestion.countDocuments({ quiz: quiz._id });
  const totalPoints = await QuizQuestion.aggregate([
    { $match: { quiz: quiz._id } },
    { $group: { _id: null, total: { $sum: '$points' } } }
  ]);
  
  quiz.totalQuestions = totalQuestions;
  quiz.totalPoints = totalPoints[0]?.total || 0;
  await quiz.save();
  
  res.status(201).json({
    status: 'success',
    results: createdQuestions.length,
    data: { questions: createdQuestions }
  });
});

exports.submitQuiz = catchAsync(async (req, res, next) => {
  const { answers } = req.body; // Array of { questionId, selectedOption, answerText }
  const quizId = req.params.quizId;
  
  const quiz = await Quiz.findById(quizId).populate('course lesson');
  if (!quiz) {
    return next(new AppError('No quiz found with that ID', 404));
  }
  
  // Check enrollment
  const { Enrollment } = require('../models');
  const enrollment = await Enrollment.findOne({
    student: req.user.id,
    course: quiz.course._id,
    isActive: true
  });
  
  if (!enrollment && req.user.role !== 'admin') {
    return next(new AppError('You must be enrolled to take this quiz', 403));
  }
  
  // Get all questions
  const questions = await QuizQuestion.find({ quiz: quizId });
  
  // Calculate score
  let totalScore = 0;
  const results = [];
  
  answers.forEach(answer => {
    const question = questions.find(q => q._id.toString() === answer.questionId);
    if (!question) return;
    
    let isCorrect = false;
    
    if (question.type === 'MULTIPLE-CHOICE' || question.type === 'multiple-choice') {
      const correctOption = question.options.findIndex(opt => opt.isCorrect);
      isCorrect = answer.selectedOption === correctOption;
    } else if (question.type === 'TRUE-FALSE' || question.type === 'true-false') {
      isCorrect = answer.selectedOption === (question.correctAnswer === 'true');
    } else {
      isCorrect = answer.answerText?.toLowerCase().trim() === question.correctAnswer?.toLowerCase().trim();
    }
    
    if (isCorrect) {
      totalScore += question.points;
    }
    
    results.push({
      questionId: question._id,
      isCorrect,
      correctAnswer: (question.type !== 'ESSAY' && question.type !== 'essay') ? question.correctAnswer : null,
      pointsEarned: isCorrect ? question.points : 0
    });
  });
  
  const percentage = (totalScore / quiz.totalPoints) * 100;
  const passed = percentage >= quiz.passingScore;
  
  // Update progress
  let progress = await ProgressTracking.findOne({
    student: req.user.id,
    course: quiz.course._id
  });
  
  if (progress) {
    const quizCompletion = {
      quiz: quizId,
      score: totalScore,
      completedAt: Date.now(),
      attempts: 1
    };
    
    progress.completedQuizzes.push(quizCompletion);
    progress.lastActivity = Date.now();
    
    // Recalculate overall progress
    const totalLessons = await Lesson.countDocuments({ course: quiz.course._id });
    const completedLessons = progress.completedLessons.length;
    const completedQuizzes = progress.completedQuizzes.length;
    
    progress.courseProgressPercentage = Math.round(
      ((completedLessons + completedQuizzes) / (totalLessons + 1)) * 100
    );
    
    await progress.save();
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      score: totalScore,
      totalPoints: quiz.totalPoints,
      percentage,
      passed,
      results
    }
  });
});

exports.getQuizWithQuestions = catchAsync(async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.id)
    .populate('course', 'title primaryInstructor instructors') 
    .populate('lesson', 'title');
  
  if (!quiz) {
    return next(new AppError('No quiz found with that ID', 404));
  }
  
  const questions = await QuizQuestion.find({ quiz: quiz._id }).sort('order');
  
  // Remove correct answers if quiz is for taking
  const isTaking = req.query.mode === 'take';
  if (isTaking) {
    questions.forEach(q => {
      if (q.type === 'multiple-choice' || q.type === 'MULTIPLE-CHOICE') {
        q.options.forEach(opt => { opt.isCorrect = undefined; });
      } else {
        q.correctAnswer = undefined;
      }
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      quiz,
      questions
    }
  });
});

// CRUD operations
exports.getAllQuizzes = factory.getAll(Quiz);
exports.getQuiz = factory.getOne(Quiz);
exports.updateQuiz = factory.updateOne(Quiz);
exports.deleteQuiz = factory.deleteOne(Quiz);

// const { Quiz, QuizQuestion, Course, Lesson, ProgressTracking } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');

// exports.createQuiz = catchAsync(async (req, res, next) => {
//   const { course, lesson } = req.body;
  
//   // Verify course ownership
//   const courseDoc = await Course.findById(course);
//   if (!courseDoc) {
//     return next(new AppError('No course found with that ID', 404));
//   }
  
//   if (courseDoc.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
//     return next(new AppError('You are not authorized to create quizzes for this course', 403));
//   }
  
//   const quiz = await Quiz.create(req.body);
  
//   // If lesson is provided, update lesson content
//   if (lesson) {
//     await Lesson.findByIdAndUpdate(lesson, {
//       'content.quiz': quiz._id
//     });
//   }
  
//   res.status(201).json({
//     status: 'success',
//     data: { quiz }
//   });
// });

// exports.addQuestions = catchAsync(async (req, res, next) => {
//   const { questions } = req.body;
  
//   if (!Array.isArray(questions) || questions.length === 0) {
//     return next(new AppError('Questions array is required', 400));
//   }
  
//   const quiz = await Quiz.findById(req.params.quizId).populate('course');
//   if (!quiz) {
//     return next(new AppError('No quiz found with that ID', 404));
//   }
  
//   // Check authorization
//   if (quiz.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
//     return next(new AppError('You are not authorized to modify this quiz', 403));
//   }
  
//   // Add quiz ID to each question
//   const questionsWithQuiz = questions.map(q => ({
//     ...q,
//     quiz: quiz._id
//   }));
  
//   const createdQuestions = await QuizQuestion.insertMany(questionsWithQuiz);
  
//   // Update quiz totals
//   const totalQuestions = await QuizQuestion.countDocuments({ quiz: quiz._id });
//   const totalPoints = await QuizQuestion.aggregate([
//     { $match: { quiz: quiz._id } },
//     { $group: { _id: null, total: { $sum: '$points' } } }
//   ]);
  
//   quiz.totalQuestions = totalQuestions;
//   quiz.totalPoints = totalPoints[0]?.total || 0;
//   await quiz.save();
  
//   res.status(201).json({
//     status: 'success',
//     results: createdQuestions.length,
//     data: { questions: createdQuestions }
//   });
// });

// exports.submitQuiz = catchAsync(async (req, res, next) => {
//   const { answers } = req.body; // Array of { questionId, selectedOption, answerText }
//   const quizId = req.params.quizId;
  
//   const quiz = await Quiz.findById(quizId).populate('course lesson');
//   if (!quiz) {
//     return next(new AppError('No quiz found with that ID', 404));
//   }
  
//   // Check enrollment
//   const { Enrollment } = require('../models');
//   const enrollment = await Enrollment.findOne({
//     student: req.user.id,
//     course: quiz.course._id,
//     isActive: true
//   });
  
//   if (!enrollment && req.user.role !== 'admin') {
//     return next(new AppError('You must be enrolled to take this quiz', 403));
//   }
  
//   // Get all questions
//   const questions = await QuizQuestion.find({ quiz: quizId });
  
//   // Calculate score
//   let totalScore = 0;
//   const results = [];
  
//   answers.forEach(answer => {
//     const question = questions.find(q => q._id.toString() === answer.questionId);
//     if (!question) return;
    
//     let isCorrect = false;
    
//     if (question.type === 'multiple-choice') {
//       const correctOption = question.options.findIndex(opt => opt.isCorrect);
//       isCorrect = answer.selectedOption === correctOption;
//     } else if (question.type === 'true-false') {
//       isCorrect = answer.selectedOption === (question.correctAnswer === 'true');
//     } else {
//       isCorrect = answer.answerText?.toLowerCase().trim() === question.correctAnswer?.toLowerCase().trim();
//     }
    
//     if (isCorrect) {
//       totalScore += question.points;
//     }
    
//     results.push({
//       questionId: question._id,
//       isCorrect,
//       correctAnswer: question.type !== 'essay' ? question.correctAnswer : null,
//       pointsEarned: isCorrect ? question.points : 0
//     });
//   });
  
//   const percentage = (totalScore / quiz.totalPoints) * 100;
//   const passed = percentage >= quiz.passingScore;
  
//   // Update progress
//   let progress = await ProgressTracking.findOne({
//     student: req.user.id,
//     course: quiz.course._id
//   });
  
//   if (progress) {
//     const quizCompletion = {
//       quiz: quizId,
//       score: totalScore,
//       completedAt: Date.now(),
//       attempts: 1
//     };
    
//     progress.completedQuizzes.push(quizCompletion);
//     progress.lastActivity = Date.now();
    
//     // Recalculate overall progress
//     const totalLessons = await Lesson.countDocuments({ course: quiz.course._id });
//     const completedLessons = progress.completedLessons.length;
//     const completedQuizzes = progress.completedQuizzes.length;
    
//     progress.courseProgressPercentage = Math.round(
//       ((completedLessons + completedQuizzes) / (totalLessons + 1)) * 100
//     );
    
//     await progress.save();
//   }
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       score: totalScore,
//       totalPoints: quiz.totalPoints,
//       percentage,
//       passed,
//       results
//     }
//   });
// });

// exports.getQuizWithQuestions = catchAsync(async (req, res, next) => {
//   const quiz = await Quiz.findById(req.params.id)
//     .populate('course', 'title instructor')
//     .populate('lesson', 'title');
  
//   if (!quiz) {
//     return next(new AppError('No quiz found with that ID', 404));
//   }
  
//   const questions = await QuizQuestion.find({ quiz: quiz._id }).sort('order');
  
//   // Remove correct answers if quiz is for taking
//   const isTaking = req.query.mode === 'take';
//   if (isTaking) {
//     questions.forEach(q => {
//       if (q.type === 'multiple-choice') {
//         q.options.forEach(opt => { opt.isCorrect = undefined; });
//       } else {
//         q.correctAnswer = undefined;
//       }
//     });
//   }
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       quiz,
//       questions
//     }
//   });
// });

// // CRUD operations
// exports.getAllQuizzes = factory.getAll(Quiz);
// exports.getQuiz = factory.getOne(Quiz);
// exports.updateQuiz = factory.updateOne(Quiz);
// exports.deleteQuiz = factory.deleteOne(Quiz);