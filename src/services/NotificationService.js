'use strict';
const AppError = require('../utils/appError');
const NotificationRepository = require('../repositories/NotificationRepository');

class NotificationService {
  
  async getMyNotifications(userId) {
    // Fetch notifications and unread count in parallel for speed
    const [notifications, unreadCount] = await Promise.all([
      NotificationRepository.model.find({ 
        user: userId,
        $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }]
      }).sort('-createdAt').lean(),
      
      NotificationRepository.model.countDocuments({ user: userId, isRead: false })
    ]);

    return { notifications, unreadCount };
  }

  async createNotification(data) {
    // This can be called directly by other services (Badge, Course, etc.)
    return await NotificationRepository.create(data);
  }

  async createBulk(users, notificationData) {
    const notifications = users.map(userId => ({
      ...notificationData,
      user: userId
    }));
    return await NotificationRepository.model.insertMany(notifications);
  }

  async markAsRead(userId, ids) {
    let query = { user: userId };

    if (ids === 'all') {
      query.isRead = false;
    } else if (Array.isArray(ids)) {
      query._id = { $in: ids };
    } else {
      throw new AppError('Invalid notification IDs', 400);
    }

    return await NotificationRepository.model.updateMany(query, { isRead: true });
  }

  async toggleImportant(userId, notificationId) {
    const notification = await NotificationRepository.findOne({ _id: notificationId, user: userId });
    if (!notification) throw new AppError('No notification found', 404);

    notification.isImportant = !notification.isImportant;
    return await notification.save();
  }
}

module.exports = new NotificationService();