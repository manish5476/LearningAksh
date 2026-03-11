'use strict';
const EventDispatcher = require('./EventDispatcher');
const emailQueue = require('../jobs/emailQueue');
const notificationQueue = require('../jobs/notificationQueue');
// const CertificateService = require('../services/CertificateService');
const EnrollmentRepository = require('../repositories/EnrollmentRepository');
// 1. Listen for Forgot Password
EventDispatcher.on('auth.forgotPassword', ({ email, resetURL }) => {
  emailQueue.add({
    type: 'forgot-password',
    data: { email, resetURL }
  });
});

// 2. Listen for Course Completion (Triggered by ProgressService or AssessmentService)
EventDispatcher.on('progress.updated', async ({ studentId, courseId }) => {
  console.log(`Checking if student ${studentId} finished course ${courseId}...`);
  // Example: await CertificateService.generateCertificate(studentId, courseId);
});

// 3. Listen for New Announcements
EventDispatcher.on('course.announcement', ({ notifications, emails }) => {
  if (notifications.length > 0) {
    notificationQueue.add({ type: 'bulk', data: { notifications } });
  }
  if (emails.length > 0) {
    emailQueue.add({ type: 'bulk-announcement', data: { emails } });
  }
});

// ==========================================
// LIVE SESSION LISTENERS
// ==========================================

// 1. When a session is scheduled
EventDispatcher.on('live.scheduled', async ({ session, courseTitle }) => {
  // Fetch all students enrolled in this course
  const enrollments = await EnrollmentRepository.model.find({
    course: session.course,
    isActive: true
  }).populate('student', 'email firstName');

  if (enrollments.length === 0) return;

  // Prepare Bulk Notifications
  const notifications = enrollments.map(e => ({
    user: e.student._id,
    type: 'live_session_scheduled',
    title: `New Live Session: ${session.title}`,
    message: `A new live session has been scheduled for ${courseTitle} on ${new Date(session.startTime).toLocaleString()}`,
    data: { sessionId: session._id, courseId: session.course }
  }));

  notificationQueue.add({ type: 'bulk', data: { notifications } });
});

// 2. When an instructor clicks "Start Session"
EventDispatcher.on('live.started', async ({ session }) => {
  const enrollments = await EnrollmentRepository.model.find({
    course: session.course,
    isActive: true
  }).populate('student', 'email');

  const notifications = enrollments.map(e => ({
    user: e.student._id,
    type: 'live_session_starting',
    title: `Class is starting now! 🔴`,
    message: `The live session "${session.title}" is live. Join now to participate!`,
    data: { sessionId: session._id, meetingLink: session.meetingLink }
  }));

  notificationQueue.add({ type: 'bulk', data: { notifications } });

  // Optional: Send a quick "Starting Now" email to students
  const emails = enrollments.map(e => e.student.email);
  emailQueue.add({ type: 'live-alert', data: { emails, sessionTitle: session.title } });
});

EventDispatcher.on('course.completed', async ({ studentId, course }) => {
  const user = await UserRepository.findById(studentId);

  // Logic to generate the certificate record
  await CertificateRepository.create({
    student: studentId,
    course: course._id,
    studentName: `${user.firstName} ${user.lastName}`,
    courseName: course.title,
    certificateNumber: `CERT-${Date.now()}-${studentId.slice(-6)}`,
    instructor: course.instructor
  });

  console.log(`Certificate generated for ${user.firstName} in ${course.title}`);
});
module.exports = EventDispatcher;