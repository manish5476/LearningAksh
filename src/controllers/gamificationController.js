'use strict';
const catchAsync = require('../utils/catchAsync');
const GamificationService = require('../services/GamificationService');
const BadgeRepository = require('../repositories/BadgeRepository');
const UserBadgeRepository = require('../repositories/UserBadgeRepository');

// ==========================================
// STUDENT ACTIONS
// ==========================================
exports.getUserBadges = catchAsync(async (req, res, next) => {
  const userBadges = await UserBadgeRepository.model.find({ student: req.user.id })
    .populate('badge')
    .sort('-earnedAt')
    .lean();

  const badges = userBadges.map(ub => ({
    ...ub.badge,
    earnedAt: ub.earnedAt,
    context: ub.context
  }));

  res.status(200).json({ status: 'success', results: badges.length, data: { badges } });
});

exports.getLeaderboard = catchAsync(async (req, res, next) => {
  const leaderboard = await GamificationService.getLeaderboard(req.query.criteria, req.query.limit);
  res.status(200).json({ status: 'success', results: leaderboard.length, data: { leaderboard } });
});

// ==========================================
// SYSTEM / ADMIN / INSTRUCTOR ACTIONS
// ==========================================
exports.createBadge = catchAsync(async (req, res, next) => {
  const badge = await GamificationService.createBadge(req.body);
  res.status(201).json({ status: 'success', data: { badge } });
});

exports.awardBadge = catchAsync(async (req, res, next) => {
  const userBadge = await GamificationService.awardBadge(req.body.studentId, req.body.badgeId, req.body.context);
  res.status(201).json({ status: 'success', data: { userBadge } });
});

exports.checkAndAwardBadges = catchAsync(async (req, res, next) => {
  const awardedCount = await GamificationService.checkAndAwardByCriteria(
    req.body.studentId, 
    req.body.criteria, 
    req.body.context
  );
  res.status(200).json({ status: 'success', data: { awarded: awardedCount } });
});

exports.removeBadge = catchAsync(async (req, res, next) => {
  await UserBadgeRepository.model.findOneAndDelete({
    student: req.params.studentId,
    badge: req.params.badgeId
  });
  res.status(204).json({ status: 'success', data: null });
});

// ==========================================
// STANDARD REPOSITORY CRUD
// ==========================================
exports.getStudentBadges = catchAsync(async (req, res, next) => {
  const result = await UserBadgeRepository.findMany({}, { student: req.params.studentId }, 'badge');
  const badges = result.data.map(ub => ub.badge);
  res.status(200).json({ status: 'success', results: badges.length, data: { badges } });
});

exports.getAllBadges = catchAsync(async (req, res, next) => {
  const result = await BadgeRepository.findMany(req.query);
  res.status(200).json({ status: 'success', results: result.results, data: { badges: result.data } });
});

exports.getBadge = catchAsync(async (req, res, next) => {
  const badge = await BadgeRepository.findById(req.params.id);
  res.status(200).json({ status: 'success', data: { badge } });
});

exports.updateBadge = catchAsync(async (req, res, next) => {
  const badge = await BadgeRepository.updateById(req.params.id, req.body);
  res.status(200).json({ status: 'success', data: { badge } });
});

exports.deleteBadge = catchAsync(async (req, res, next) => {
  await BadgeRepository.deleteById(req.params.id);
  res.status(204).json({ status: 'success', data: null });
});