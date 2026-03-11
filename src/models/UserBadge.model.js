const mongoose = require('mongoose');

const userBadgeSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  badge: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge', required: true },
  
  earnedAt: { type: Date, default: Date.now },
  
  // Stores dynamic data like { courseId: "...", quizId: "..." }
  context: mongoose.Schema.Types.Mixed 
}, { timestamps: true });

// Prevents earning the exact same badge twice (unless that's a feature you want, 
// in which case you'd remove the unique constraint or include context in the index)
userBadgeSchema.index({ student: 1, badge: 1 }, { unique: true });
// For rendering the student's profile timeline
userBadgeSchema.index({ student: 1, earnedAt: -1 });

module.exports = mongoose.model('UserBadge', userBadgeSchema);