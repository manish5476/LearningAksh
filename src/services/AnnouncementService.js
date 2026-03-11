'use strict';
const AppError = require('../utils/appError');
const AnnouncementRepository = require('../repositories/AnnouncementRepository');
const CourseRepository = require('../repositories/CourseRepository');
const EnrollmentRepository = require('../repositories/EnrollmentRepository');
const emailQueue = require('../jobs/emailQueue');
const notificationQueue = require('../jobs/notificationQueue');

class AnnouncementService {
  
  async createAnnouncement(instructorId, data, isAdmin = false) {
    // 1. Verify course ownership
    const course = await CourseRepository.findById(data.course);
    if (!course) throw new AppError('Course not found', 404);

    if (course.instructor.toString() !== instructorId.toString() && !isAdmin) {
      throw new AppError('You can only create announcements for your own courses', 403);
    }

    // 2. Create the announcement
    const announcement = await AnnouncementRepository.create({
      ...data,
      instructor: instructorId
    });

    // 3. Process Notifications asynchronously
    // We don't await this because we don't want to block the HTTP response!
    this.dispatchNotifications(course, announcement, instructorId, data.sendEmailNotification).catch(err => {
      console.error('Failed to dispatch announcement notifications:', err);
    });

    return announcement;
  }

  async dispatchNotifications(course, announcement, instructorId, sendEmail) {
    // Fetch enrolled students
    const enrollments = await EnrollmentRepository.model.find({ 
      course: course._id, 
      isActive: true 
    }).populate('student', 'firstName lastName email');

    if (enrollments.length === 0) return;

    // Queue Emails
    if (sendEmail) {
      const studentEmails = enrollments.map(e => ({
        email: e.student.email,
        name: `${e.student.firstName} ${e.student.lastName}`
      }));

      // In a pure Clean Architecture, we would use an EventDispatcher here
      // But using your existing Queue implementation works fine for now
      emailQueue.add({
        type: 'announcement',
        data: {
          students: studentEmails,
          courseTitle: course.title,
          announcementTitle: announcement.title,
          announcementContent: announcement.content,
          instructorId // Might want to look up instructor name if needed
        }
      });
    }

    // Queue In-App Notifications
    const notifications = enrollments.map(e => ({
      user: e.student._id,
      type: 'announcement',
      title: `New Announcement: ${course.title}`,
      message: announcement.content.substring(0, 100) + (announcement.content.length > 100 ? '...' : ''),
      data: {
        courseId: course._id,
        announcementId: announcement._id,
        courseTitle: course.title
      }
    }));

    notificationQueue.add({
      type: 'bulk',
      data: { notifications }
    });
  }

  async updateAnnouncement(announcementId, instructorId, data) {
    const announcement = await AnnouncementRepository.model.findOneAndUpdate(
      { _id: announcementId, instructor: instructorId, isDeleted: { $ne: true } },
      data,
      { new: true, runValidators: true }
    ).lean();

    if (!announcement) throw new AppError('Announcement not found or unauthorized', 404);
    return announcement;
  }

  async deleteAnnouncement(announcementId, instructorId) {
    const announcement = await AnnouncementRepository.model.findOneAndUpdate(
      { _id: announcementId, instructor: instructorId, isDeleted: { $ne: true } },
      { isDeleted: true },
      { new: true }
    );

    if (!announcement) throw new AppError('Announcement not found or unauthorized', 404);
    return true;
  }
}

module.exports = new AnnouncementService();