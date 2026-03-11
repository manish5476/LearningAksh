const nodemailer = require('nodemailer');
const twilio = require('twilio');
const webpush = require('web-push');
const { Notification, User } = require('../models');
const emailQueue = require('../jobs/emailQueue');
const AppError = require('../utils/appError');

class NotificationService {
  constructor() {
    // Initialize email transport
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Initialize SMS client
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.smsClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }

    // Initialize web push
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        'mailto:' + process.env.VAPID_EMAIL,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
    }
  }

  /**
   * Send notification to user
   * @param {Object} options - Notification options
   */
  async send(options) {
    const {
      userId,
      type,
      title,
      message,
      data = {},
      channels = ['in-app'],
      priority = 'normal'
    } = options;

    try {
      // Create in-app notification
      if (channels.includes('in-app')) {
        await this.createInAppNotification(userId, type, title, message, data);
      }

      // Get user preferences and contact info
      const user = await User.findById(userId);
      if (!user) throw new AppError('User not found', 404);

      // Send email
      if (channels.includes('email') && user.email) {
        await this.sendEmail(user.email, title, message, data);
      }

      // Send SMS
      if (channels.includes('sms') && user.phoneNumber) {
        await this.sendSMS(user.phoneNumber, message);
      }

      // Send push notification
      if (channels.includes('push')) {
        await this.sendPushNotification(userId, title, message, data);
      }

      return true;
    } catch (error) {
      console.error('Notification error:', error);
      return false;
    }
  }

  /**
   * Send bulk notifications
   * @param {Array} notifications - Array of notification options
   */
  async sendBulk(notifications) {
    const results = await Promise.allSettled(
      notifications.map(notification => this.send(notification))
    );

    return {
      successful: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length
    };
  }

  /**
   * Create in-app notification
   * @private
   */
  async createInAppNotification(userId, type, title, message, data = {}) {
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      message,
      data,
      isRead: false
    });

    // Emit socket event for real-time notification
    if (global.io) {
      global.io.to(userId.toString()).emit('notification', notification);
    }

    return notification;
  }

  /**
   * Send email notification
   * @private
   */
  async sendEmail(email, subject, message, data = {}) {
    const mailOptions = {
      from: `"EdTech Platform" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html: this.generateEmailHTML(subject, message, data),
      text: message
    };

    // Queue email for sending
    await emailQueue.add({
      type: 'notification',
      data: mailOptions
    });

    return true;
  }

  /**
   * Send SMS notification
   * @private
   */
  async sendSMS(phoneNumber, message) {
    if (!this.smsClient) {
      console.warn('SMS client not configured');
      return false;
    }

    try {
      await this.smsClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
      return true;
    } catch (error) {
      console.error('SMS error:', error);
      return false;
    }
  }

  /**
   * Send push notification
   * @private
   */
  async sendPushNotification(userId, title, message, data = {}) {
    // Get user's push subscription from database
    const user = await User.findById(userId).select('pushSubscriptions');
    
    if (!user?.pushSubscriptions?.length) {
      return false;
    }

    const payload = JSON.stringify({
      title,
      body: message,
      data,
      icon: '/logo.png',
      badge: '/badge.png'
    });

    const results = await Promise.allSettled(
      user.pushSubscriptions.map(subscription =>
        webpush.sendNotification(subscription, payload)
      )
    );

    // Remove invalid subscriptions
    const validSubscriptions = user.pushSubscriptions.filter((sub, index) => {
      return results[index].status === 'fulfilled';
    });

    if (validSubscriptions.length !== user.pushSubscriptions.length) {
      await User.findByIdAndUpdate(userId, { pushSubscriptions: validSubscriptions });
    }

    return true;
  }

  /**
   * Send course update notification to all enrolled students
   * @param {String} courseId - Course ID
   * @param {String} title - Notification title
   * @param {String} message - Notification message
   */
  async notifyCourseStudents(courseId, title, message) {
    const { Enrollment } = require('../models');
    
    const enrollments = await Enrollment.find({ 
      course: courseId, 
      isActive: true 
    }).populate('student');

    const notifications = enrollments.map(enrollment => ({
      userId: enrollment.student._id,
      type: 'course_update',
      title,
      message,
      data: { courseId },
      channels: ['in-app', 'email']
    }));

    return this.sendBulk(notifications);
  }

  /**
   * Send announcement to all users with specific role
   * @param {String} role - User role
   * @param {String} title - Announcement title
   * @param {String} message - Announcement message
   */
  async announceToRole(role, title, message) {
    const users = await User.find({ role, isActive: true });

    const notifications = users.map(user => ({
      userId: user._id,
      type: 'announcement',
      title,
      message,
      channels: ['in-app', 'email']
    }));

    return this.sendBulk(notifications);
  }

  /**
   * Generate HTML email template
   * @private
   */
  generateEmailHTML(title, message, data = {}) {
    const actionUrl = data.actionUrl || '#';
    const actionText = data.actionText || 'View Details';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .content {
            background: #fff;
            padding: 30px;
            border: 1px solid #e9ecef;
            border-top: none;
            border-radius: 0 0 10px 10px;
          }
          .message {
            font-size: 16px;
            margin-bottom: 30px;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 25px;
            font-weight: 500;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #6c757d;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
          </div>
          <div class="content">
            <div class="message">
              ${message}
            </div>
            ${actionUrl !== '#' ? `
              <div style="text-align: center;">
                <a href="${actionUrl}" class="button">${actionText}</a>
              </div>
            ` : ''}
            <div class="footer">
              <p>© ${new Date().getFullYear()} EdTech Platform. All rights reserved.</p>
              <p>If you didn't request this notification, please ignore this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Mark notifications as read
   * @param {String} userId - User ID
   * @param {Array} notificationIds - Array of notification IDs
   */
  async markAsRead(userId, notificationIds) {
    await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        user: userId
      },
      { isRead: true }
    );
  }

  /**
   * Get user's unread count
   * @param {String} userId - User ID
   */
  async getUnreadCount(userId) {
    return await Notification.countDocuments({
      user: userId,
      isRead: false
    });
  }

  /**
   * Clean up old notifications
   * @param {Number} days - Days to keep
   */
  async cleanupOldNotifications(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    await Notification.deleteMany({
      createdAt: { $lt: cutoffDate },
      isRead: true
    });
  }
}

module.exports = new NotificationService();