const { StudentNote, Course, Lesson } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');

exports.createNote = catchAsync(async (req, res, next) => {
  const { courseId, lessonId } = req.params;

  // Verify lesson exists and belongs to course
  const lesson = await Lesson.findOne({ 
    _id: lessonId,
    course: courseId 
  });

  if (!lesson) {
    return next(new AppError('Lesson not found in this course', 404));
  }

  const note = await StudentNote.create({
    student: req.user.id,
    course: courseId,
    lesson: lessonId,
    content: req.body.content,
    videoTimestamp: req.body.videoTimestamp || 0
  });

  res.status(201).json({
    status: 'success',
    data: { note }
  });
});

exports.getMyNotes = catchAsync(async (req, res, next) => {
  const { courseId, lessonId } = req.params;

  let filter = { student: req.user.id };
  if (courseId) filter.course = courseId;
  if (lessonId) filter.lesson = lessonId;

  const notes = await StudentNote.find(filter)
    .populate('lesson', 'title type')
    .populate('course', 'title slug')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: notes.length,
    data: { notes }
  });
});

exports.getNote = catchAsync(async (req, res, next) => {
  const note = await StudentNote.findOne({
    _id: req.params.id,
    student: req.user.id
  })
  .populate('lesson', 'title')
  .populate('course', 'title');

  if (!note) {
    return next(new AppError('Note not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { note }
  });
});

exports.updateNote = catchAsync(async (req, res, next) => {
  const note = await StudentNote.findOneAndUpdate(
    {
      _id: req.params.id,
      student: req.user.id
    },
    {
      content: req.body.content,
      videoTimestamp: req.body.videoTimestamp
    },
    { new: true, runValidators: true }
  );

  if (!note) {
    return next(new AppError('Note not found or unauthorized', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { note }
  });
});

exports.deleteNote = catchAsync(async (req, res, next) => {
  const note = await StudentNote.findOneAndDelete({
    _id: req.params.id,
    student: req.user.id
  });

  if (!note) {
    return next(new AppError('Note not found or unauthorized', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.exportNotes = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;

  const notes = await StudentNote.find({
    student: req.user.id,
    course: courseId
  })
  .populate('lesson', 'title order')
  .sort('lesson.order createdAt');

  // Format notes for export
  const course = await Course.findById(courseId).select('title');
  
  const exportData = {
    course: course.title,
    student: `${req.user.firstName} ${req.user.lastName}`,
    exportDate: new Date().toISOString(),
    notes: notes.map(note => ({
      lesson: note.lesson.title,
      timestamp: note.videoTimestamp,
      content: note.content,
      created: note.createdAt,
      updated: note.updatedAt
    }))
  };

  // Set response headers for file download
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=notes-${courseId}.json`);

  res.status(200).json(exportData);
});

exports.searchNotes = catchAsync(async (req, res, next) => {
  const { query } = req.query;

  if (!query) {
    return next(new AppError('Search query is required', 400));
  }

  const notes = await StudentNote.find({
    student: req.user.id,
    $text: { $search: query }
  })
  .populate('course', 'title slug')
  .populate('lesson', 'title')
  .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: notes.length,
    data: { notes }
  });
});

// Admin only - get all notes for a student
exports.getStudentNotes = catchAsync(async (req, res, next) => {
  const { studentId } = req.params;

  const notes = await StudentNote.find({ student: studentId })
    .populate('course', 'title')
    .populate('lesson', 'title')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: notes.length,
    data: { notes }
  });
});