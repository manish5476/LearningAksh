const { CodingExercise, CodingSubmission, Course, Lesson, ProgressTracking } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const execPromise = util.promisify(exec);

exports.createCodingExercise = catchAsync(async (req, res, next) => {
  const { course, lesson } = req.body;
  
  const courseDoc = await Course.findById(course);
  if (!courseDoc) {
    return next(new AppError('No course found with that ID', 404));
  }
  
  if (courseDoc.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('You are not authorized to create coding exercises for this course', 403));
  }
  
  const exercise = await CodingExercise.create(req.body);
  
  if (lesson) {
    await Lesson.findByIdAndUpdate(lesson, {
      'content.codingExercise': exercise._id
    });
  }
  
  res.status(201).json({
    status: 'success',
    data: { exercise }
  });
});

// Code execution service (simplified - in production, use Docker for isolation)
exports.executeCode = catchAsync(async (req, res, next) => {
  const { code, language, testCases } = req.body;
  const exerciseId = req.params.exerciseId;
  
  const exercise = await CodingExercise.findById(exerciseId);
  if (!exercise) {
    return next(new AppError('No exercise found', 404));
  }
  
  // Create temporary file
  const tempId = uuidv4();
  const fileExt = {
    javascript: 'js',
    python: 'py',
    java: 'java',
    cpp: 'cpp',
    csharp: 'cs'
  }[language] || 'txt';
  
  const fileName = `temp_${tempId}.${fileExt}`;
  const filePath = path.join(__dirname, '../../temp', fileName);
  
  try {
    await fs.mkdir(path.join(__dirname, '../../temp'), { recursive: true });
    await fs.writeFile(filePath, code);
    
    // Execute based on language
    let command;
    let results = [];
    let totalPoints = 0;
    
    const testCasesToRun = testCases || exercise.testCases.filter(tc => !tc.isHidden);
    
    for (const testCase of testCasesToRun) {
      let output;
      let error;
      let executionTime;
      
      try {
        const startTime = Date.now();
        
        if (language === 'javascript') {
          const { stdout, stderr } = await execPromise(`node ${filePath}`, {
            input: testCase.input,
            timeout: 5000
          });
          output = stdout.trim();
          error = stderr;
          executionTime = Date.now() - startTime;
        } else if (language === 'python') {
          const { stdout, stderr } = await execPromise(`python ${filePath}`, {
            input: testCase.input,
            timeout: 5000
          });
          output = stdout.trim();
          error = stderr;
          executionTime = Date.now() - startTime;
        }
        // Add more language support as needed
        
        const passed = output === testCase.expectedOutput;
        if (passed) totalPoints += testCase.points;
        
        results.push({
          testCase: testCase.input,
          passed,
          output,
          expectedOutput: testCase.expectedOutput,
          points: passed ? testCase.points : 0,
          error: error || null
        });
      } catch (err) {
        results.push({
          testCase: testCase.input,
          passed: false,
          output: null,
          expectedOutput: testCase.expectedOutput,
          points: 0,
          error: err.message
        });
      }
    }
    
    // Save submission
    const submission = await CodingSubmission.create({
      exercise: exerciseId,
      student: req.user.id,
      code,
      language,
      status: 'completed',
      testResults: results,
      totalPoints,
      executionTime
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        results,
        totalPoints,
        submissionId: submission._id
      }
    });
  } catch (error) {
    return next(new AppError(`Execution error: ${error.message}`, 400));
  } finally {
    // Cleanup temp file
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.error('Error deleting temp file:', err);
    }
  }
});

exports.submitSolution = catchAsync(async (req, res, next) => {
  const { code, language } = req.body;
  const exerciseId = req.params.exerciseId;
  
  const exercise = await CodingExercise.findById(exerciseId).populate('course');
  if (!exercise) {
    return next(new AppError('No exercise found', 404));
  }
  
  // Check enrollment
  const { Enrollment } = require('../models');
  const enrollment = await Enrollment.findOne({
    student: req.user.id,
    course: exercise.course._id,
    isActive: true
  });
  
  if (!enrollment && req.user.role !== 'admin') {
    return next(new AppError('You must be enrolled to submit this exercise', 403));
  }
  
  // Run all test cases (including hidden ones)
  const allTestCases = exercise.testCases;
  let totalPoints = 0;
  const results = [];
  
  // Simplified execution - in production, use proper sandboxing
  for (const testCase of allTestCases) {
    // ... (similar execution logic as above)
  }
  
  const passedAll = results.every(r => r.passed);
  const percentage = (totalPoints / exercise.totalPoints) * 100;
  
  const submission = await CodingSubmission.create({
    exercise: exerciseId,
    student: req.user.id,
    code,
    language,
    status: 'completed',
    testResults: results,
    totalPoints,
    executionTime: 0
  });
  
  // Update progress if passed
  if (passedAll) {
    const { ProgressTracking } = require('../models');
    const progress = await ProgressTracking.findOne({
      student: req.user.id,
      course: exercise.course._id
    });
    
    if (progress) {
      // Add to completed lessons or track separately
      progress.lastActivity = Date.now();
      await progress.save();
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      submission,
      passed: passedAll,
      percentage,
      results
    }
  });
});

exports.getMySubmissions = catchAsync(async (req, res, next) => {
  const submissions = await CodingSubmission.find({ 
    student: req.user.id,
    exercise: req.params.exerciseId 
  })
  .sort('-submittedAt');
  
  res.status(200).json({
    status: 'success',
    results: submissions.length,
    data: { submissions }
  });
});

// CRUD operations
exports.getAllExercises = factory.getAll(CodingExercise);
exports.getExercise = factory.getOne(CodingExercise);
exports.updateExercise = factory.updateOne(CodingExercise);
exports.deleteExercise = factory.deleteOne(CodingExercise);