const mongoose = require('mongoose');

const courseInstructorSchema = new mongoose.Schema({
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue' }, // e.g., 'Co-Instructor'
  permissions: {
    canEditCourse: { type: Boolean, default: false },
    canManageSections: { type: Boolean, default: false },
    canManageLessons: { type: Boolean, default: false },
    canManageStudents: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: true }
  },
  isActive: { type: Boolean, default: true }
}, { _id: false });

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subtitle: String,
  slug: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  
  instructors: [courseInstructorSchema],
  primaryInstructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Replaced complex string validators with clean Master references
  level: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue', required: true },
  language: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue', required: true },
  currency: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue', required: true },
  
  thumbnail: String,
  previewVideo: String,
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0 },
  isFree: { type: Boolean, default: false },
  
  totalDuration: { type: Number, default: 0 },
  totalLessons: { type: Number, default: 0 },
  totalSections: { type: Number, default: 0 },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  totalEnrollments: { type: Number, default: 0 },
  
  requirements: [String],
  whatYouWillLearn: [String],
  tags: [String],
  
  isPublished: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

courseSchema.index({ slug: 1 }, { unique: true });
module.exports = mongoose.model('Course', courseSchema);