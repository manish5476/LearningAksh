const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false }, // Hashing will now happen in the Auth Service!
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  role: { type: String, enum: ['student', 'instructor', 'admin'], default: 'student' },
  profilePicture: String,
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  
  // Auth Tracking
  passwordChangedAt: Date,
  lastLogin: Date,

  // Soft Delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date
}, { timestamps: true });

// Compound index to quickly find active users by email
userSchema.index({ email: 1, isDeleted: 1 });
userSchema.index({ role: 1, isDeleted: 1 });

module.exports = mongoose.model('User', userSchema);