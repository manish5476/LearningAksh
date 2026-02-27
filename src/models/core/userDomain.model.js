const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Added for password hashing/comparison
const crypto = require('crypto');   // Added for password reset tokens

// Base User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false }, // Added select: false to hide by default
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  profilePicture: { type: String, default: null },
  phoneNumber: { type: String, trim: true },
  dateOfBirth: Date,
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer-not-to-say'] },
  address: {
    street: String, city: String, state: String, country: String, zipCode: String
  },
  role: { type: String, enum: ['student', 'instructor', 'admin'], default: 'student', required: true },
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  lastLogin: Date,
  
  // Auth specific fields needed by your authController
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,

  // Soft Delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

// ==========================================
// MONGOOSE MIDDLEWARE & METHODS
// ==========================================

// 1. Hash the password before saving
userSchema.pre('save', async function(next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// 2. Update passwordChangedAt property for the user
userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();

  // Subtract 1 second to ensure token is created AFTER password has been changed
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// 3. Compare passwords for login
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// 4. Check if user changed password after token was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  // False means NOT changed
  return false;
};

// 5. Generate random reset token
userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Encrypt it to save in the database
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Token expires in 10 minutes
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

// ==========================================
// PROFILES
// ==========================================

// Instructor Profile Schema
const instructorProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bio: { type: String, maxlength: 1000 },
  qualifications: [{
    degree: String, institution: String, year: Number, certificate: String
  }],
  expertise: [{
    type: String, 
    enum: ['Web Development', 'Data Science', 'Mobile Development', 'DevOps', 'Cloud Computing', 'AI/ML', 'Cybersecurity', 'Database', 'Programming Languages']
  }],
  experience: { years: Number, summary: String },
  socialLinks: { linkedin: String, github: String, twitter: String, website: String },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  totalStudents: { type: Number, default: 0 },
  totalCourses: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  isApproved: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  paymentDetails: {
    bankName: String, accountNumber: String, accountHolderName: String, ifscCode: String, paypalEmail: String
  }
}, { timestamps: true });

// Student Profile Schema
const studentProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  education: [{
    degree: String, institution: String, fieldOfStudy: String, startDate: Date, endDate: Date, grade: String
  }],
  interests: [{
    type: String,
    // FIX: Added 'Programming' and 'Design' to the enum array to prevent the validation crash
    enum: ['Web Development', 'Data Science', 'Mobile Development', 'DevOps', 'Cloud Computing', 'AI/ML', 'Cybersecurity', 'Programming', 'Design']
  }],
  enrollments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment' }],
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  savedForLater: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  learningPath: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LearningPath' }],
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    language: { type: String, default: 'en' },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' }
  }
}, { timestamps: true });

// Indexes
// FIX: Removed `userSchema.index({ email: 1 })` because `unique: true` on the email field already creates this index automatically!
userSchema.index({ role: 1 });

module.exports = {
  User: mongoose.model('User', userSchema),
  InstructorProfile: mongoose.model('InstructorProfile', instructorProfileSchema),
  StudentProfile: mongoose.model('StudentProfile', studentProfileSchema)
};
// const mongoose = require('mongoose');

// // Base User Schema
// const userSchema = new mongoose.Schema({
//   email: { type: String, required: true, unique: true, lowercase: true, trim: true },
//   password: { type: String, required: true, minlength: 6 },
//   firstName: { type: String, required: true, trim: true },
//   lastName: { type: String, required: true, trim: true },
//   profilePicture: { type: String, default: null },
//   phoneNumber: { type: String, trim: true },
//   dateOfBirth: Date,
//   gender: { type: String, enum: ['male', 'female', 'other', 'prefer-not-to-say'] },
//   address: {
//     street: String, city: String, state: String, country: String, zipCode: String
//   },
//   role: { type: String, enum: ['student', 'instructor', 'admin'], default: 'student', required: true },
//   isActive: { type: Boolean, default: true },
//   isEmailVerified: { type: Boolean, default: false },
//   lastLogin: Date,
//   // Soft Delete
//   isDeleted: { type: Boolean, default: false },
//   deletedAt: { type: Date, default: null }
// }, { timestamps: true }); // Automatically handles createdAt and updatedAt

// // Instructor Profile Schema
// const instructorProfileSchema = new mongoose.Schema({
//   user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
//   bio: { type: String, maxlength: 1000 },
//   qualifications: [{
//     degree: String, institution: String, year: Number, certificate: String
//   }],
//   expertise: [{
//     type: String, 
//     enum: ['Web Development', 'Data Science', 'Mobile Development', 'DevOps', 'Cloud Computing', 'AI/ML', 'Cybersecurity', 'Database', 'Programming Languages']
//   }],
//   experience: { years: Number, summary: String },
//   socialLinks: { linkedin: String, github: String, twitter: String, website: String },
//   rating: { type: Number, min: 0, max: 5, default: 0 },
//   totalStudents: { type: Number, default: 0 },
//   totalCourses: { type: Number, default: 0 },
//   totalReviews: { type: Number, default: 0 },
//   isApproved: { type: Boolean, default: false },
//   approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   approvedAt: Date,
//   paymentDetails: {
//     bankName: String, accountNumber: String, accountHolderName: String, ifscCode: String, paypalEmail: String
//   }
// }, { timestamps: true });

// // Student Profile Schema (Refactored to remove redundant progress data)
// const studentProfileSchema = new mongoose.Schema({
//   user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
//   education: [{
//     degree: String, institution: String, fieldOfStudy: String, startDate: Date, endDate: Date, grade: String
//   }],
//   interests: [{
//     type: String,
//     enum: ['Web Development', 'Data Science', 'Mobile Development', 'DevOps', 'Cloud Computing', 'AI/ML', 'Cybersecurity']
//   }],
//   // Enrolled courses now references Enrollment documents. Progress is handled in ProgressTracking
//   enrollments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment' }],
//   wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
//   savedForLater: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
//   learningPath: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LearningPath' }],
//   preferences: {
//     emailNotifications: { type: Boolean, default: true },
//     pushNotifications: { type: Boolean, default: true },
//     language: { type: String, default: 'en' },
//     theme: { type: String, enum: ['light', 'dark'], default: 'light' }
//   }
// }, { timestamps: true });

// // Indexes
// userSchema.index({ email: 1 });
// userSchema.index({ role: 1 });

// module.exports = {
//   User: mongoose.model('User', userSchema),
//   InstructorProfile: mongoose.model('InstructorProfile', instructorProfileSchema),
//   StudentProfile: mongoose.model('StudentProfile', studentProfileSchema)

// };
