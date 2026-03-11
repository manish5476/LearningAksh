'use strict';
const BaseRepository = require('./BaseRepository');
const { Review } = require('../models');

class ReviewRepository extends BaseRepository {
  constructor() { 
    super(Review); 
  }
}

module.exports = new ReviewRepository();

// 'use strict';
// const BaseRepository = require('./BaseRepository');
// const { Review } = require('../models');

// class ReviewRepository extends BaseRepository {
//   constructor() { super(Review); }

//   // REPLACES THE MONGOOSE HOOK: This is manually called by the Service Layer
//   async calculateAverageRating(courseId) {
//     const stats = await this.model.aggregate([
//       { $match: { course: courseId, isApproved: true } },
//       { $group: { 
//           _id: '$course', 
//           rating: { $avg: '$rating' }, 
//           totalReviews: { $sum: 1 } 
//       }}
//     ]);
//     return stats.length > 0 ? stats[0] : { rating: 0, totalReviews: 0 };
//   }
// }
// module.exports = new ReviewRepository();