const mongoose = require('mongoose');

// Private Notes taken by students during a video lesson
const studentNoteSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
  content: { type: String, required: true },
  videoTimestamp: { type: Number, default: 0 }, // Timestamp in seconds
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Gamification: Badges & Achievements
const badgeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  iconUrl: { type: String, required: true },
  criteria: {
    type: String, 
    enum: ['complete_course', 'perfect_quiz', 'first_login', '7_day_streak', '100_hours_watched'],
    required: true
  },
  points: { type: Number, default: 0 }
}, { timestamps: true });

const userBadgeSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  badge: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge', required: true },
  earnedAt: { type: Date, default: Date.now },
  context: mongoose.Schema.Types.Mixed // e.g., { courseId: "..." } if badge is course-specific
}, { timestamps: true });

studentNoteSchema.index({ student: 1, lesson: 1 });
userBadgeSchema.index({ student: 1, badge: 1 }, { unique: true });

module.exports = {
  StudentNote: mongoose.models.StudentNote || mongoose.model('StudentNote', studentNoteSchema),
  Badge: mongoose.models.Badge || mongoose.model('Badge', badgeSchema),
  UserBadge: mongoose.models.UserBadge || mongoose.model('UserBadge', userBadgeSchema)
};