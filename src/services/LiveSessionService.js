'use strict';
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/appError');
const LiveSessionRepository = require('../repositories/LiveSessionRepository');
const CourseRepository = require('../repositories/CourseRepository');
const EnrollmentRepository = require('../repositories/EnrollmentRepository');
const EventDispatcher = require('../events/EventDispatcher');

class LiveSessionService {
  
  async _generateMeetingLink() {
    // In production, you'd call the Zoom or Google Meet API here.
    return `https://meet.jit.si/${uuidv4()}`;
  }

  async createSession(instructorId, userRole, data) {
    const course = await CourseRepository.findById(data.course);
    if (!course) throw new AppError('Course not found', 404);

    if (course.instructor.toString() !== instructorId.toString() && userRole !== 'admin') {
      throw new AppError('Unauthorized course access', 403);
    }

    // Auto-calculate duration
    if (data.startTime && data.endTime) {
      data.duration = Math.round((new Date(data.endTime) - new Date(data.startTime)) / 60000);
    }

    data.meetingLink = data.meetingLink || await this._generateMeetingLink();
    data.instructor = instructorId;

    const session = await LiveSessionRepository.create(data);

    // Emit event: Let Notification Service handle notifying enrolled students
    EventDispatcher.emit('live.scheduled', { session, courseTitle: course.title });

    return session;
  }

  async joinSession(userId, userRole, sessionId) {
    const session = await LiveSessionRepository.findById(sessionId, ['course']);
    if (!session) throw new AppError('Session not found', 404);

    // 1. Authorization: Are they the teacher, an admin, or an enrolled student?
    const isTeacher = session.instructor.toString() === userId.toString();
    if (!isTeacher && userRole !== 'admin') {
      const isEnrolled = await EnrollmentRepository.findOne({ 
        student: userId, 
        course: session.course._id, 
        isActive: true 
      });
      if (!isEnrolled) throw new AppError('You must be enrolled to join this session', 403);
    }

    // 2. Timing check
    const now = new Date();
    const canJoin = now >= new Date(new Date(session.startTime) - 15 * 60000) && now <= new Date(session.endTime);
    if (!canJoin && session.status !== 'live') {
      throw new AppError('This session is not yet open for joining', 400);
    }

    // 3. Record Participation using Atomic Operators (Prevents data loss during mass joins)
    await LiveSessionRepository.model.updateOne(
      { _id: sessionId, 'participants.user': { $ne: userId } },
      { $addToSet: { participants: { user: userId, joinedAt: now } } }
    );
    
    // If they were already in the array, update their last joined time
    await LiveSessionRepository.model.updateOne(
      { _id: sessionId, 'participants.user': userId },
      { $set: { 'participants.$.joinedAt': now, 'participants.$.leftAt': null } }
    );

    return {
      meetingLink: session.meetingLink,
      title: session.title,
      recordingUrl: session.recordingUrl
    };
  }

  async startSession(instructorId, sessionId) {
    const session = await LiveSessionRepository.model.findOneAndUpdate(
      { _id: sessionId, instructor: instructorId, status: 'scheduled' },
      { status: 'live', startTime: new Date() },
      { new: true }
    );

    if (!session) throw new AppError('Session not found or already live', 404);

    EventDispatcher.emit('live.started', { session });
    return session;
  }
}

module.exports = new LiveSessionService();