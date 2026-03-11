const mongoose = require('mongoose');

// This acts as a snapshot of the price at the time of purchase
const orderItemSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  pricePaid: { type: Number, required: true },
  couponApplied: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' }
}, { timestamps: true });

orderItemSchema.index({ order: 1 });
orderItemSchema.index({ student: 1, course: 1 }); // Useful to check if user bought a specific course

module.exports = mongoose.model('OrderItem', orderItemSchema);