const { LiveSession, Course, User, Enrollment } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const { v4: uuidv4 } = require('uuid');

// For video conferencing integration (Zoom, Google Meet, etc.)
const generateMeetingLink = async (session) => {
  // Integration with Zoom API, Jitsi, etc.
  // This is a placeholder - implement based on your provider
  return `https://meet.jit.si/${uuidv4()}`;
};

exports.createLiveSession = catchAsync(async (req, res, next) => {
  const { course: courseId } = req.body;

  // Verify course ownership
  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError('Course not found', 404));
  }

  if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('You can only create sessions for your own courses', 403));
  }

  // Calculate duration from start and end times
  if (req.body.startTime && req.body.endTime) {
    req.body.duration = Math.round(
      (new Date(req.body.endTime) - new Date(req.body.startTime)) / (1000 * 60)
    );
  }

  // Generate meeting link if not provided
  if (!req.body.meetingLink) {
    req.body.meetingLink = await generateMeetingLink(req.body);
  }

  req.body.instructor = req.user.id;

  const session = await LiveSession.create(req.body);

  // Notify enrolled students
  const { Notification } = require('../models');
  const enrollments = await Enrollment.find({ 
    course: courseId,
    isActive: true 
  });

  const notifications = enrollments.map(e => ({
    user: e.student,
    type: 'live_session',
    title: `New Live Session: ${req.body.title}`,
    message: `A new live session has been scheduled for ${course.title}`,
    data: {
      courseId: course._id,
      sessionId: session._id,
      startTime: req.body.startTime
    }
  }));

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }

  res.status(201).json({
    status: 'success',
    data: { session }
  });
});

exports.getUpcomingSessions = catchAsync(async (req, res, next) => {
  const sessions = await LiveSession.find({
    startTime: { $gt: new Date() },
    status: { $in: ['scheduled', 'live'] },
    isDeleted: { $ne: true }
  })
  .populate('course', 'title slug thumbnail')
  .populate('instructor', 'firstName lastName')
  .sort('startTime')
  .limit(10);

  res.status(200).json({
    status: 'success',
    results: sessions.length,
    data: { sessions }
  });
});

exports.getCourseSessions = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;

  const sessions = await LiveSession.find({
    course: courseId,
    isDeleted: { $ne: true }
  })
  .populate('instructor', 'firstName lastName')
  .sort('startTime');

  res.status(200).json({
    status: 'success',
    results: sessions.length,
    data: { sessions }
  });
});

exports.joinSession = catchAsync(async (req, res, next) => {
  const session = await LiveSession.findById(req.params.id)
    .populate('course');

  if (!session) {
    return next(new AppError('Session not found', 404));
  }

  // Check if user has access (enrolled in course or instructor)
  const isInstructor = session.instructor.toString() === req.user.id;
  let isEnrolled = false;

  if (!isInstructor) {
    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: session.course._id,
      isActive: true
    });
    isEnrolled = !!enrollment;
  }

  if (!isInstructor && !isEnrolled && req.user.role !== 'admin') {
    return next(new AppError('You are not enrolled in this course', 403));
  }

  // Check if session is accessible
  const now = new Date();
  const sessionStart = new Date(session.startTime);
  const sessionEnd = new Date(session.endTime);

  // Allow joining 15 minutes before start
  const canJoin = now >= new Date(sessionStart - 15 * 60000) && now <= sessionEnd;

  if (!canJoin && session.status !== 'live') {
    return next(new AppError('Session is not available for joining', 400));
  }

  // Record participant joining
  const participantIndex = session.participants.findIndex(
    p => p.user.toString() === req.user.id
  );

  if (participantIndex === -1) {
    session.participants.push({
      user: req.user.id,
      joinedAt: now
    });
  } else {
    session.participants[participantIndex].joinedAt = now;
    session.participants[participantIndex].leftAt = null;
  }

  await session.save();

  res.status(200).json({
    status: 'success',
    data: {
      meetingLink: session.meetingLink,
      title: session.title,
      startTime: session.startTime,
      endTime: session.endTime,
      recordingUrl: session.recordingUrl
    }
  });
});

exports.leaveSession = catchAsync(async (req, res, next) => {
  const session = await LiveSession.findById(req.params.id);

  if (!session) {
    return next(new AppError('Session not found', 404));
  }

  const participant = session.participants.find(
    p => p.user.toString() === req.user.id
  );

  if (participant) {
    participant.leftAt = new Date();
    await session.save();
  }

  res.status(200).json({
    status: 'success',
    message: 'Left session successfully'
  });
});

exports.startSession = catchAsync(async (req, res, next) => {
  const session = await LiveSession.findOneAndUpdate(
    {
      _id: req.params.id,
      instructor: req.user.id,
      status: 'scheduled'
    },
    {
      status: 'live',
      startTime: new Date() // Update to actual start time
    },
    { new: true }
  );

  if (!session) {
    return next(new AppError('Session not found or cannot be started', 404));
  }

  // Notify enrolled students that session is starting
  const { Notification } = require('../models');
  const enrollments = await Enrollment.find({ 
    course: session.course,
    isActive: true 
  });

  const notifications = enrollments.map(e => ({
    user: e.student,
    type: 'live_session_starting',
    title: `Session Starting Now: ${session.title}`,
    message: 'The live session is starting now. Click to join!',
    data: {
      sessionId: session._id,
      meetingLink: session.meetingLink
    }
  }));

  await Notification.insertMany(notifications);

  res.status(200).json({
    status: 'success',
    data: { session }
  });
});

exports.endSession = catchAsync(async (req, res, next) => {
  const session = await LiveSession.findOneAndUpdate(
    {
      _id: req.params.id,
      instructor: req.user.id,
      status: 'live'
    },
    {
      status: 'ended',
      endTime: new Date(),
      recordingUrl: req.body.recordingUrl // If recording was made
    },
    { new: true }
  );

  if (!session) {
    return next(new AppError('Session not found or cannot be ended', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { session }
  });
});

exports.uploadRecording = catchAsync(async (req, res, next) => {
  const session = await LiveSession.findOneAndUpdate(
    {
      _id: req.params.id,
      instructor: req.user.id
    },
    {
      recordingUrl: req.body.recordingUrl,
      isRecorded: true
    },
    { new: true }
  );

  if (!session) {
    return next(new AppError('Session not found', 404));
  }

  // Notify students that recording is available
  const { Notification } = require('../models');
  const enrollments = await Enrollment.find({ 
    course: session.course,
    isActive: true 
  });

  const notifications = enrollments.map(e => ({
    user: e.student,
    type: 'recording_available',
    title: `Recording Available: ${session.title}`,
    message: 'The session recording is now available for viewing',
    data: {
      sessionId: session._id,
      recordingUrl: req.body.recordingUrl
    }
  }));

  await Notification.insertMany(notifications);

  res.status(200).json({
    status: 'success',
    data: { session }
  });
});

// CRUD operations
exports.getAllSessions = factory.getAll(LiveSession);
exports.getSession = factory.getOne(LiveSession);
exports.updateSession = factory.updateOne(LiveSession);
exports.deleteSession = factory.deleteOne(LiveSession);