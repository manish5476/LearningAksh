const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  discountType: { type: String, enum: ['percentage', 'fixed_amount'], required: true },
  discountValue: { type: Number, required: true },
  
  validForCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }], // If empty, platform-wide
  
  expiryDate: { type: Date, required: true },
  usageLimit: { type: Number, default: null }, 
  usedCount: { type: Number, default: 0 },
  
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

couponSchema.index({ code: 1, isActive: 1 });

module.exports = mongoose.model('Coupon', couponSchema);