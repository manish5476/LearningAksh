const { Course, User, Enrollment, ProgressTracking, Category } = require('../models');
const mongoose = require('mongoose');
const cacheService = require('./cacheService');

class RecommendationService {
  /**
   * Get personalized course recommendations for user
   * @param {String} userId - User ID
   * @param {Number} limit - Number of recommendations
   */
  async getPersonalizedRecommendations(userId, limit = 10) {
    const cacheKey = cacheService.generateKey(['recommendations', userId, limit]);
    
    return cacheService.remember(cacheKey, 3600, async () => {
      const user = await User.findById(userId);
      if (!user) return [];

      // Get user's completed courses
      const completedProgress = await ProgressTracking.find({
        student: userId,
        isCompleted: true
      }).populate('course');

      const completedCourseIds = completedProgress.map(p => p.course._id);

      // Get user's enrolled but not completed courses
      const inProgress = await ProgressTracking.find({
        student: userId,
        isCompleted: false
      }).populate('course');

      const inProgressIds = inProgress.map(p => p.course._id);

      // Get user's interests from profile
      let userInterests = [];
      if (user.role === 'student') {
        const { StudentProfile } = require('../models');
        const profile = await StudentProfile.findOne({ user: userId });
        userInterests = profile?.interests || [];
      }

      // Collaborative filtering: find similar users
      const similarUsers = await this.findSimilarUsers(userId, completedCourseIds);
      
      // Content-based filtering: find courses similar to completed ones
      const similarCourses = await this.findSimilarCourses(completedCourseIds, inProgressIds);

      // Popular courses in user's interest areas
      const popularInInterests = await this.getPopularCoursesByCategories(userInterests, limit);

      // Combine recommendations with weights
      let recommendations = [];

      // Add collaborative recommendations (40% weight)
      if (similarUsers.length > 0) {
        const collabCourses = await this.getCoursesFromSimilarUsers(similarUsers, completedCourseIds, inProgressIds);
        recommendations.push(...collabCourses.map(c => ({ ...c, score: c.score * 0.4 })));
      }

      // Add content-based recommendations (30% weight)
      if (similarCourses.length > 0) {
        recommendations.push(...similarCourses.map(c => ({ ...c, score: c.score * 0.3 })));
      }

      // Add popular in interests (20% weight)
      if (popularInInterests.length > 0) {
        recommendations.push(...popularInInterests.map(c => ({ ...c, score: c.score * 0.2 })));
      }

      // Add trending courses (10% weight)
      const trending = await this.getTrendingCourses(limit);
      recommendations.push(...trending.map(c => ({ ...c, score: c.score * 0.1 })));

      // Aggregate scores by course
      const aggregated = this.aggregateRecommendations(recommendations);

      // Remove courses user already has
      const filtered = aggregated.filter(c => 
        !completedCourseIds.includes(c._id.toString()) && 
        !inProgressIds.includes(c._id.toString())
      );

      // Sort by score and limit
      return filtered
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(c => ({
          ...c,
          score: Math.round(c.score * 100) / 100
        }));
    });
  }

  /**
   * Find similar users based on completed courses
   * @private
   */
  async findSimilarUsers(userId, completedCourseIds) {
    if (completedCourseIds.length === 0) return [];

    const similarUsers = await ProgressTracking.aggregate([
      {
        $match: {
          student: { $ne: mongoose.Types.ObjectId(userId) },
          course: { $in: completedCourseIds.map(id => mongoose.Types.ObjectId(id)) },
          isCompleted: true
        }
      },
      {
        $group: {
          _id: '$student',
          commonCourses: { $sum: 1 },
          courses: { $push: '$course' }
        }
      },
      {
        $match: {
          commonCourses: { $gte: Math.min(3, completedCourseIds.length) }
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
          userId: '$_id',
          commonCourses: 1,
          similarity: { $divide: ['$commonCourses', completedCourseIds.length] }
        }
      },
      { $sort: { similarity: -1 } },
      { $limit: 10 }
    ]);

    return similarUsers;
  }

  /**
   * Get courses that similar users took
   * @private
   */
  async getCoursesFromSimilarUsers(similarUsers, excludeIds, inProgressIds) {
    const excludeAll = [...excludeIds.map(id => id.toString()), ...inProgressIds.map(id => id.toString())];
    const similarUserIds = similarUsers.map(u => u.userId);

    const recommendations = await ProgressTracking.aggregate([
      {
        $match: {
          student: { $in: similarUserIds },
          course: { $nin: excludeAll.map(id => mongoose.Types.ObjectId(id)) },
          isCompleted: true
        }
      },
      {
        $group: {
          _id: '$course',
          takenBy: { $addToSet: '$student' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'courses',
          localField: '_id',
          foreignField: '_id',
          as: 'courseInfo'
        }
      },
      { $unwind: '$courseInfo' },
      {
        $match: {
          'courseInfo.isPublished': true,
          'courseInfo.isDeleted': { $ne: true }
        }
      },
      {
        $addFields: {
          score: {
            $multiply: [
              { $divide: ['$count', similarUserIds.length] },
              { $divide: ['$count', 10] } // Normalize
            ]
          }
        }
      },
      { $sort: { score: -1 } },
      { $limit: 20 }
    ]);

    return recommendations.map(r => ({
      _id: r._id,
      title: r.courseInfo.title,
      description: r.courseInfo.description,
      thumbnail: r.courseInfo.thumbnail,
      price: r.courseInfo.price,
      rating: r.courseInfo.rating,
      level: r.courseInfo.level,
      category: r.courseInfo.category,
      score: r.score
    }));
  }

  /**
   * Find similar courses based on content
   * @private
   */
  async findSimilarCourses(courseIds, excludeIds) {
    if (courseIds.length === 0) return [];

    const sourceCourses = await Course.find({ _id: { $in: courseIds } });

    // Extract features from source courses
    const categories = sourceCourses.map(c => c.category);
    const levels = sourceCourses.map(c => c.level);
    const tags = sourceCourses.flatMap(c => c.tags || []);

    const similar = await Course.aggregate([
      {
        $match: {
          _id: { 
            $nin: [...courseIds, ...excludeIds].map(id => mongoose.Types.ObjectId(id))
          },
          isPublished: true,
          isDeleted: { $ne: true },
          $or: [
            { category: { $in: categories } },
            { level: { $in: levels } },
            { tags: { $in: tags } }
          ]
        }
      },
      {
        $addFields: {
          categoryMatch: { $cond: [{ $in: ['$category', categories] }, 3, 0] },
          levelMatch: { $cond: [{ $in: ['$level', levels] }, 1, 0] },
          tagMatch: { $size: { $setIntersection: ['$tags', tags] } }
        }
      },
      {
        $addFields: {
          score: {
            $add: [
              '$categoryMatch',
              '$levelMatch',
              { $multiply: ['$tagMatch', 0.5] },
              { $multiply: ['$rating', 0.1] }
            ]
          }
        }
      },
      { $match: { score: { $gt: 0 } } },
      { $sort: { score: -1 } },
      { $limit: 20 }
    ]);

    return similar.map(c => ({
      _id: c._id,
      title: c.title,
      description: c.description,
      thumbnail: c.thumbnail,
      price: c.price,
      rating: c.rating,
      level: c.level,
      category: c.category,
      score: c.score
    }));
  }

  /**
   * Get popular courses by categories
   * @private
   */
  async getPopularCoursesByCategories(categories, limit) {
    if (!categories || categories.length === 0) return [];

    // Get categories by interest names
    const categoryDocs = await Category.find({ name: { $in: categories } });
    const categoryIds = categoryDocs.map(c => c._id);

    const popular = await Course.aggregate([
      {
        $match: {
          category: { $in: categoryIds },
          isPublished: true,
          isDeleted: { $ne: true }
        }
      },
      {
        $addFields: {
          popularity: {
            $add: [
              { $multiply: ['$totalEnrollments', 0.5] },
              { $multiply: ['$rating', 10] },
              { $multiply: ['$totalReviews', 0.1] }
            ]
          }
        }
      },
      { $sort: { popularity: -1 } },
      { $limit }
    ]);

    return popular.map(c => ({
      _id: c._id,
      title: c.title,
      description: c.description,
      thumbnail: c.thumbnail,
      price: c.price,
      rating: c.rating,
      level: c.level,
      category: c.category,
      score: c.popularity / 100 // Normalize
    }));
  }

  /**
   * Get trending courses
   * @private
   */
  async getTrendingCourses(limit) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trending = await Enrollment.aggregate([
      {
        $match: {
          enrolledAt: { $gte: thirtyDaysAgo },
          isActive: true
        }
      },
      {
        $group: {
          _id: '$course',
          recentEnrollments: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'courses',
          localField: '_id',
          foreignField: '_id',
          as: 'courseInfo'
        }
      },
      { $unwind: '$courseInfo' },
      {
        $match: {
          'courseInfo.isPublished': true,
          'courseInfo.isDeleted': { $ne: true }
        }
      },
      {
        $addFields: {
          trendScore: {
            $add: [
              { $multiply: ['$recentEnrollments', 2] },
              { $multiply: ['$courseInfo.rating', 5] }
            ]
          }
        }
      },
      { $sort: { trendScore: -1 } },
      { $limit }
    ]);

    return trending.map(c => ({
      _id: c._id,
      title: c.courseInfo.title,
      description: c.courseInfo.description,
      thumbnail: c.courseInfo.thumbnail,
      price: c.courseInfo.price,
      rating: c.courseInfo.rating,
      level: c.courseInfo.level,
      category: c.courseInfo.category,
      score: c.trendScore / 100 // Normalize
    }));
  }

  /**
   * Aggregate recommendations by course
   * @private
   */
  aggregateRecommendations(recommendations) {
    const aggregated = {};

    recommendations.forEach(rec => {
      const id = rec._id.toString();
      if (!aggregated[id]) {
        aggregated[id] = { ...rec, score: 0, sources: 0 };
      }
      aggregated[id].score += rec.score;
      aggregated[id].sources += 1;
    });

    return Object.values(aggregated).map(item => ({
      ...item,
      score: item.score / item.sources // Average score across sources
    }));
  }

  /**
   * Get "More like this" for a specific course
   * @param {String} courseId - Course ID
   * @param {Number} limit - Number of recommendations
   */
  async getMoreLikeThis(courseId, limit = 5) {
    const course = await Course.findById(courseId);
    if (!course) return [];

    const similar = await Course.aggregate([
      {
        $match: {
          _id: { $ne: mongoose.Types.ObjectId(courseId) },
          category: course.category,
          isPublished: true,
          isDeleted: { $ne: true }
        }
      },
      {
        $addFields: {
          similarity: {
            $add: [
              { $cond: [{ $eq: ['$level', course.level] }, 2, 0] },
              { $size: { $setIntersection: ['$tags', course.tags || []] } },
              { $multiply: ['$rating', 0.5] }
            ]
          }
        }
      },
      { $sort: { similarity: -1 } },
      { $limit }
    ]);

    return similar;
  }
}

module.exports = new RecommendationService();