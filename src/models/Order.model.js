const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  totalAmount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  
  status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
  paymentIntentId: { type: String, unique: true, sparse: true }, // Stripe/Razorpay ID
  paymentMethod: String,
  
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

orderSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);