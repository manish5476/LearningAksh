const { Badge, UserBadge, User } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

exports.createBadge = catchAsync(async (req, res, next) => {
  // Check if badge with same name exists
  const existingBadge = await Badge.findOne({ name: req.body.name });
  if (existingBadge) {
    return next(new AppError('Badge with this name already exists', 400));
  }

  const badge = await Badge.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { badge }
  });
});

exports.getUserBadges = catchAsync(async (req, res, next) => {
  const userBadges = await UserBadge.find({ 
    student: req.user.id 
  })
  .populate('badge')
  .sort('-earnedAt');

  const badges = userBadges.map(ub => ({
    ...ub.badge.toObject(),
    earnedAt: ub.earnedAt,
    context: ub.context
  }));

  res.status(200).json({
    status: 'success',
    results: badges.length,
    data: { badges }
  });
});

exports.getStudentBadges = catchAsync(async (req, res, next) => {
  const { studentId } = req.params;

  const userBadges = await UserBadge.find({ 
    student: studentId 
  })
  .populate('badge')
  .sort('-earnedAt');

  const badges = userBadges.map(ub => ub.badge);

  res.status(200).json({
    status: 'success',
    results: badges.length,
    data: { badges }
  });
});

exports.awardBadge = catchAsync(async (req, res, next) => {
  const { studentId, badgeId, context } = req.body;

  // Check if badge exists
  const badge = await Badge.findById(badgeId);
  if (!badge) {
    return next(new AppError('Badge not found', 404));
  }

  // Check if student exists
  const student = await User.findById(studentId);
  if (!student) {
    return next(new AppError('Student not found', 404));
  }

  // Check if already awarded
  const existingAward = await UserBadge.findOne({
    student: studentId,
    badge: badgeId
  });

  if (existingAward) {
    return next(new AppError('Student already has this badge', 400));
  }

  // Award badge
  const userBadge = await UserBadge.create({
    student: studentId,
    badge: badgeId,
    context,
    earnedAt: Date.now()
  });

  // Create notification
  const { Notification } = require('../models');
  await Notification.create({
    user: studentId,
    type: 'badge_earned',
    title: 'New Badge Earned! 🏆',
    message: `Congratulations! You've earned the "${badge.name}" badge.`,
    data: {
      badgeId: badge._id,
      badgeName: badge.name,
      badgeIcon: badge.iconUrl
    }
  });

  const populatedBadge = await UserBadge.findById(userBadge._id).populate('badge');

  res.status(201).json({
    status: 'success',
    data: { userBadge: populatedBadge }
  });
});

exports.checkAndAwardBadges = catchAsync(async (req, res, next) => {
  const { studentId, criteria } = req.body;

  // Find badges that match the criteria
  const badges = await Badge.find({ criteria });

  const awarded = [];

  for (const badge of badges) {
    // Check if already awarded
    const existing = await UserBadge.findOne({
      student: studentId,
      badge: badge._id
    });

    if (!existing) {
      const userBadge = await UserBadge.create({
        student: studentId,
        badge: badge._id,
        context: req.body.context,
        earnedAt: Date.now()
      });
      awarded.push(userBadge);
    }
  }

  res.status(200).json({
    status: 'success',
    data: { awarded: awarded.length }
  });
});

exports.removeBadge = catchAsync(async (req, res, next) => {
  const { studentId, badgeId } = req.params;

  const result = await UserBadge.findOneAndDelete({
    student: studentId,
    badge: badgeId
  });

  if (!result) {
    return next(new AppError('Badge award not found', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.getLeaderboard = catchAsync(async (req, res, next) => {
  const { criteria = 'points', limit = 10 } = req.query;

  // Aggregate badge points per user
  const leaderboard = await UserBadge.aggregate([
    {
      $lookup: {
        from: 'badges',
        localField: 'badge',
        foreignField: '_id',
        as: 'badgeInfo'
      }
    },
    { $unwind: '$badgeInfo' },
    {
      $group: {
        _id: '$student',
        totalBadges: { $sum: 1 },
        totalPoints: { $sum: '$badgeInfo.points' },
        badges: { $push: '$badgeInfo.name' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: '$userInfo' },
    {
      $project: {
        'userInfo.password': 0,
        'userInfo.__v': 0
      }
    },
    { $sort: criteria === 'points' ? { totalPoints: -1 } : { totalBadges: -1 } },
    { $limit: parseInt(limit) }
  ]);

  res.status(200).json({
    status: 'success',
    results: leaderboard.length,
    data: { leaderboard }
  });
});

// CRUD operations
exports.getAllBadges = factory.getAll(Badge);
exports.getBadge = factory.getOne(Badge);
exports.updateBadge = factory.updateOne(Badge);
exports.deleteBadge = factory.deleteOne(Badge);