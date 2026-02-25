const { Notification } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

exports.getMyNotifications = catchAsync(async (req, res, next) => {
  const notifications = await Notification.find({ 
    user: req.user.id,
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: null }
    ]
  })
  .sort('-createdAt');
  
  const unreadCount = notifications.filter(n => !n.isRead).length;
  
  res.status(200).json({
    status: 'success',
    results: notifications.length,
    data: {
      notifications,
      unreadCount
    }
  });
});

exports.markAsRead = catchAsync(async (req, res, next) => {
  const { ids } = req.body; // Array of notification IDs or 'all'
  
  let query = { user: req.user.id };
  
  if (ids === 'all') {
    query.isRead = false;
  } else if (Array.isArray(ids) && ids.length > 0) {
    query._id = { $in: ids };
  } else {
    return next(new AppError('Invalid request. Provide notification IDs or "all"', 400));
  }
  
  await Notification.updateMany(
    query,
    { isRead: true }
  );
  
  res.status(200).json({
    status: 'success',
    message: 'Notifications marked as read'
  });
});

exports.markAsImportant = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    user: req.user.id
  });
  
  if (!notification) {
    return next(new AppError('No notification found', 404));
  }
  
  notification.isImportant = !notification.isImportant;
  await notification.save();
  
  res.status(200).json({
    status: 'success',
    data: { notification }
  });
});

exports.deleteNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    user: req.user.id
  });
  
  if (!notification) {
    return next(new AppError('No notification found', 404));
  }
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.createBulkNotifications = catchAsync(async (req, res, next) => {
  const { users, notification } = req.body;
  
  if (!Array.isArray(users) || !notification) {
    return next(new AppError('Users array and notification data required', 400));
  }
  
  const notifications = users.map(userId => ({
    ...notification,
    user: userId
  }));
  
  const result = await Notification.insertMany(notifications);
  
  res.status(201).json({
    status: 'success',
    results: result.length,
    data: { notifications: result }
  });
});

// CRUD operations
exports.getAllNotifications = factory.getAll(Notification);
exports.getNotification = factory.getOne(Notification);