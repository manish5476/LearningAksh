const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  orderItem: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderItem' }, // Null if course was free
  
  progressPercentage: { type: Number, default: 0 },
  isCompleted: { type: Boolean, default: false },
  completedAt: Date,
  
  isActive: { type: Boolean, default: true } // False if refunded or revoked
}, { timestamps: true });

// Prevent double enrollments and allow fast dashboard queries
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ course: 1, isActive: 1 });

module.exports = mongoose.model('Enrollment', enrollmentSchema);