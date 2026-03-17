// // models/Course.js (Updated to use Master data)
// const mongoose = require('mongoose');
// const Master = require('../models/core/Master');

// const courseInstructorSchema = new mongoose.Schema({
//   instructor: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'User', 
//     required: true 
//   },
//   role: { 
//     type: String,
//     // This will reference master data dynamically
//     // We'll validate in middleware
//   },
//   permissions: {
//     canEditCourse: { type: Boolean, default: false },
//     canManageSections: { type: Boolean, default: false },
//     canManageLessons: { type: Boolean, default: false },
//     canManageStudents: { type: Boolean, default: false },
//     canViewAnalytics: { type: Boolean, default: true },
//     canGradeAssignments: { type: Boolean, default: false }
//   },
//   addedAt: { type: Date, default: Date.now },
//   addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   isActive: { type: Boolean, default: true }
// }, { _id: false });

// const courseSchema = new mongoose.Schema({
//   title: { type: String, required: true, trim: true },
//   subtitle: String,
//   slug: { type: String, required: true, unique: true },
//   description: { type: String, required: true },
  
//   // Using Master for category
//   category: { 
//     type: String,
//     required: true,
//     // This will reference master data
//     validate: {
//       validator: async function(value) {
//         const isValid = await Master.validateValue('COURSE_CATEGORY', value);
//         return isValid;
//       },
//       message: 'Invalid course category'
//     }
//   },
  
//   // Multiple instructors support
//   instructors: [courseInstructorSchema],
//   primaryInstructor: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'User',
//     required: true 
//   },
  
//   // Using Master for level
//   level: { 
//     type: String,
//     default: 'beginner',
//     validate: {
//       validator: async function(value) {
//         const isValid = await Master.validateValue('COURSE_LEVEL', value);
//         return isValid;
//       },
//       message: 'Invalid course level'
//     }
//   },
  
//   // Using Master for language
//   language: { 
//     type: String,
//     default: 'English',
//     validate: {
//       validator: async function(value) {
//         const isValid = await Master.validateValue('LANGUAGE', value);
//         return isValid;
//       },
//       message: 'Invalid language'
//     }
//   },
  
//   thumbnail: String,
//   previewVideo: String,
//   price: { type: Number, required: true, min: 0 },
//   discountPrice: { type: Number, min: 0 },
//   discountStartDate: Date,
//   discountEndDate: Date,
//   isFree: { type: Boolean, default: false },
//   currency: { 
//     type: String,
//     default: 'USD',
//     validate: {
//       validator: async function(value) {
//         const isValid = await Master.validateValue('CURRENCY', value);
//         return isValid;
//       },
//       message: 'Invalid currency'
//     }
//   },
  
//   // Counters
//   totalDuration: { type: Number, default: 0 },
//   totalLessons: { type: Number, default: 0 },
//   totalSections: { type: Number, default: 0 },
//   rating: { type: Number, min: 0, max: 5, default: 0 },
//   totalRatings: { type: Number, default: 0 },
//   totalEnrollments: { type: Number, default: 0 },
//   totalReviews: { type: Number, default: 0 },
  
//   requirements: [String],
//   whatYouWillLearn: [String],
//   targetAudience: [String],
//   tags: [String],
  
//   isPublished: { type: Boolean, default: false },
//   isApproved: { type: Boolean, default: false },
//   approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   approvedAt: Date,
//   publishedAt: Date,
  
//   isDeleted: { type: Boolean, default: false },
//   deletedAt: { type: Date, default: null }
// }, { timestamps: true });

// // Middleware to validate instructor role from master
// courseSchema.pre('save', async function(next) {
//   if (this.isModified('instructors')) {
//     for (const instructor of this.instructors) {
//       const isValid = await Master.validateValue('INSTRUCTOR_ROLE', instructor.role);
//       if (!isValid) {
//         throw new Error(`Invalid instructor role: ${instructor.role}`);
//       }
//     }
//   }
//   next();
// });

// module.exports = mongoose.model('Course', courseSchema);