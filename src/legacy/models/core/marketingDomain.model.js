const mongoose = require('mongoose');

// Dynamic Discount Codes
const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: String,
  discountType: { type: String, enum: ['percentage', 'fixed_amount', 'free'], required: true },
  discountValue: { type: Number, required: true }, // e.g., 20 for 20%, or 15 for $15 off
  validForCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }], // If empty, applies platform-wide
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // If created by an instructor
  startDate: { type: Date, default: Date.now },
  expiryDate: { type: Date, required: true },
  usageLimit: { type: Number, default: null }, // Max number of times this coupon can be used total
  usedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Instructor Announcements to Enrolled Students
const announcementSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, required: true }, // Usually rich text/HTML
  sendEmailNotification: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Bootcamps / Cohort-based Learning
const cohortSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Fall 2024 Fullstack Bootcamp"
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  instructors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  maxStudents: { type: Number },
  enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  scheduleInfo: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

couponSchema.index({ code: 1 });
announcementSchema.index({ course: 1, createdAt: -1 });
cohortSchema.index({ course: 1, startDate: 1 });

module.exports = {
  Coupon: mongoose.models.Coupon || mongoose.model('Coupon', couponSchema),
  Announcement: mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema),
  Cohort: mongoose.models.Cohort || mongoose.model('Cohort', cohortSchema)
};