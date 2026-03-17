const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: String,
  
  // Replaced static enum ['percentage', 'fixed_amount', 'free']
  discountType: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue', required: true }, 
  
  discountValue: { type: Number, required: true },
  validForCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  startDate: { type: Date, default: Date.now },
  expiryDate: { type: Date, required: true },
  usageLimit: { type: Number, default: null },
  usedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

couponSchema.index({ code: 1 });
module.exports = mongoose.model('Coupon', couponSchema);