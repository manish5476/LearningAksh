'use strict';
const AppError = require('../utils/appError');
const BadgeRepository = require('../repositories/BadgeRepository');
const UserBadgeRepository = require('../repositories/UserBadgeRepository');
const UserRepository = require('../repositories/UserRepository');
const EventDispatcher = require('../events/EventDispatcher');

class GamificationService {

  async createBadge(data) {
    const existingBadge = await BadgeRepository.findOne({ name: data.name });
    if (existingBadge) {
      throw new AppError('Badge with this name already exists', 400);
    }
    return await BadgeRepository.create(data);
  }

  async awardBadge(studentId, badgeId, context = null) {
    // 1. Verify Entities
    const badge = await BadgeRepository.findById(badgeId);
    if (!badge) throw new AppError('Badge not found', 404);

    const student = await UserRepository.findById(studentId);
    if (!student) throw new AppError('Student not found', 404);

    // 2. Check if already awarded
    const existingAward = await UserBadgeRepository.findOne({ student: studentId, badge: badgeId });
    if (existingAward) {
      throw new AppError('Student already has this badge', 400);
    }

    // 3. Award the badge
    const userBadge = await UserBadgeRepository.create({
      student: studentId,
      badge: badgeId,
      context,
      earnedAt: Date.now()
    });

    // 4. FIRE EVENT: Let the Notification system handle the alert asynchronously!
    EventDispatcher.emit('gamification.badgeEarned', { studentId, badge });

    return await UserBadgeRepository.findById(userBadge._id, 'badge');
  }

  async checkAndAwardByCriteria(studentId, criteria, context = null) {
    const badges = await BadgeRepository.findMany({}, { criteria });
    const awarded = [];

    for (const badge of badges.data) {
      const existing = await UserBadgeRepository.findOne({ student: studentId, badge: badge._id });
      
      if (!existing) {
        const userBadge = await UserBadgeRepository.create({
          student: studentId,
          badge: badge._id,
          context,
          earnedAt: Date.now()
        });
        awarded.push(userBadge);
        
        // Emit event for each new badge
        EventDispatcher.emit('gamification.badgeEarned', { studentId, badge });
      }
    }

    return awarded.length;
  }

  async getLeaderboard(criteria = 'points', limit = 10) {
    // This heavy aggregation belongs in the data/service layer!
    return await UserBadgeRepository.model.aggregate([
      {
        $lookup: {
          from: 'badges', // MongoDB collection name
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
          'userInfo.__v': 0,
          'userInfo.role': 0
        }
      },
      { $sort: criteria === 'points' ? { totalPoints: -1 } : { totalBadges: -1 } },
      { $limit: parseInt(limit, 10) }
    ]);
  }
}

module.exports = new GamificationService();