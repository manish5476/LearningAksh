const { Announcement, Course, Enrollment, User } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');
const emailQueue = require('../jobs/emailQueue');
const notificationQueue = require('../jobs/notificationQueue');

exports.createAnnouncement = catchAsync(async (req, res, next) => {
  const { course: courseId, title, content, sendEmailNotification } = req.body;

  // Verify course ownership
  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError('Course not found', 404));
  }

  if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('You can only create announcements for your own courses', 403));
  }

  // Create announcement
  const announcement = await Announcement.create({
    course: courseId,
    instructor: req.user.id,
    title,
    content,
    sendEmailNotification
  });

  // Get all enrolled students
  const enrollments = await Enrollment.find({ 
    course: courseId,
    isActive: true 
  }).populate('student');

  // Send notifications
  if (sendEmailNotification) {
    const studentEmails = enrollments.map(e => ({
      email: e.student.email,
      name: `${e.student.firstName} ${e.student.lastName}`
    }));

    // Queue email notifications
    emailQueue.add({
      type: 'announcement',
      data: {
        students: studentEmails,
        courseTitle: course.title,
        announcementTitle: title,
        announcementContent: content,
        instructorName: `${req.user.firstName} ${req.user.lastName}`
      }
    });
  }

  // Create in-app notifications
  const notifications = enrollments.map(e => ({
    user: e.student._id,
    type: 'announcement',
    title: `New Announcement: ${course.title}`,
    message: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
    data: {
      courseId: course._id,
      announcementId: announcement._id,
      courseTitle: course.title
    }
  }));

  if (notifications.length > 0) {
    notificationQueue.add({
      type: 'bulk',
      data: { notifications }
    });
  }

  res.status(201).json({
    status: 'success',
    data: { announcement }
  });
});

exports.getCourseAnnouncements = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;

  const announcements = await Announcement.find({ 
    course: courseId,
    isDeleted: { $ne: true }
  })
  .populate('instructor', 'firstName lastName profilePicture')
  .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: announcements.length,
    data: { announcements }
  });
});

exports.getAnnouncement = catchAsync(async (req, res, next) => {
  const announcement = await Announcement.findById(req.params.id)
    .populate('course', 'title slug thumbnail')
    .populate('instructor', 'firstName lastName profilePicture');

  if (!announcement) {
    return next(new AppError('Announcement not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { announcement }
  });
});

exports.updateAnnouncement = catchAsync(async (req, res, next) => {
  const announcement = await Announcement.findOneAndUpdate(
    {
      _id: req.params.id,
      instructor: req.user.id
    },
    req.body,
    { new: true, runValidators: true }
  );

  if (!announcement) {
    return next(new AppError('Announcement not found or unauthorized', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { announcement }
  });
});

exports.deleteAnnouncement = catchAsync(async (req, res, next) => {
  const announcement = await Announcement.findOneAndUpdate(
    {
      _id: req.params.id,
      instructor: req.user.id
    },
    { isDeleted: true },
    { new: true }
  );

  if (!announcement) {
    return next(new AppError('Announcement not found or unauthorized', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.getMyAnnouncements = catchAsync(async (req, res, next) => {
  const announcements = await Announcement.find({ 
    instructor: req.user.id,
    isDeleted: { $ne: true }
  })
  .populate('course', 'title slug')
  .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: announcements.length,
    data: { announcements }
  });
});

// Admin only
exports.getAllAnnouncements = factory.getAll(Announcement);