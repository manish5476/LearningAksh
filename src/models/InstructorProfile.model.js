const mongoose = require('mongoose');

const instructorProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bio: { type: String, maxlength: 2000 },
  expertise: [{ type: String }], // e.g., 'React', 'Node.js'
  socialLinks: { linkedin: String, github: String, website: String },
  
  // Aggregated Stats (Updated by background workers, not hooks)
  rating: { type: Number, default: 0 },
  totalStudents: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  
  isApproved: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('InstructorProfile', instructorProfileSchema);