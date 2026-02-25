const mongoose = require('mongoose');

// Base User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
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
  // Soft Delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true }); // Automatically handles createdAt and updatedAt

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

// Student Profile Schema (Refactored to remove redundant progress data)
const studentProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  education: [{
    degree: String, institution: String, fieldOfStudy: String, startDate: Date, endDate: Date, grade: String
  }],
  interests: [{
    type: String,
    enum: ['Web Development', 'Data Science', 'Mobile Development', 'DevOps', 'Cloud Computing', 'AI/ML', 'Cybersecurity']
  }],
  // Enrolled courses now references Enrollment documents. Progress is handled in ProgressTracking
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
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

module.exports = {
  User: mongoose.model('User', userSchema),
  InstructorProfile: mongoose.model('InstructorProfile', instructorProfileSchema),
  StudentProfile: mongoose.model('StudentProfile', studentProfileSchema)
};