const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  iconUrl: { type: String, required: true },
  
  // Replaced static enum ['complete_course', 'perfect_quiz', etc.]
  criteria: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue', required: true },
  
  points: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Badge', badgeSchema);