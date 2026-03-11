const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  iconUrl: { type: String, required: true },
  
  criteria: {
    type: String, 
    enum: ['complete_course', 'perfect_quiz', 'first_login', '7_day_streak', '100_hours_watched'],
    required: true
  },
  points: { type: Number, default: 0 },
  
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

badgeSchema.index({ criteria: 1, isActive: 1 });

module.exports = mongoose.model('Badge', badgeSchema);