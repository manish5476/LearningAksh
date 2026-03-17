const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  amount: { type: Number, required: true },
  currency: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue', required: true },
  paymentMethod: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue' }, // 'stripe', 'paypal'
  transactionId: { type: String, required: true, unique: true },
  status: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue', required: true } // 'pending', 'success'
}, { timestamps: true });

paymentSchema.index({ user: 1, status: 1 });
module.exports = mongoose.model('Payment', paymentSchema);