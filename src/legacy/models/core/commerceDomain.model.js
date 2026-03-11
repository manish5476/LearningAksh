const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  mockTest: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' }, // Changed default to INR based on your earlier course JSON
  paymentMethod: { type: String, enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'upi', 'razorpay', 'stripe'] },
  transactionId: { type: String, required: true, unique: true }, // Mongoose auto-creates the index here
  paymentGateway: String,
  status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending' },
  refundAmount: Number,
  refundReason: String,
  refundedAt: Date,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const enrollmentSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }, 
  enrolledAt: { type: Date, default: Date.now },
  expiryDate: Date,
  isActive: { type: Boolean, default: true },
  isRevoked: { type: Boolean, default: false }
}, { timestamps: true });

// ==========================================
// STATICS & AGGREGATIONS
// ==========================================
enrollmentSchema.statics.calcTotalEnrollments = async function(courseId) {
  try {
    const stats = await this.aggregate([
      { $match: { course: courseId, isActive: true, isRevoked: false } }, // Added isRevoked check for accuracy
      { $group: { _id: '$course', totalEnrollments: { $sum: 1 } } }
    ]);

    // Dynamically resolve model to avoid circular dependencies
    const Course = mongoose.model('Course');

    if (stats.length > 0) {
      await Course.findByIdAndUpdate(courseId, { totalEnrollments: stats[0].totalEnrollments });
    } else {
      await Course.findByIdAndUpdate(courseId, { totalEnrollments: 0 });
    }
  } catch (error) {
    console.error('Error calculating total enrollments:', error);
  }
};

// ==========================================
// MIDDLEWARE (HOOKS)
// ==========================================
// Hook for Creation
enrollmentSchema.post('save', function() {
  this.constructor.calcTotalEnrollments(this.course);
});

// Hook for Admin Deletion / Updates / Revokes
enrollmentSchema.post(/^findOneAnd/, async function(doc) {
  // Check if doc exists (in case a findOneAndDelete didn't find a matching document)
  if (doc) {
    await doc.constructor.calcTotalEnrollments(doc.course);
  }
});

// ==========================================
// INDEXES
// ==========================================
// Removed the redundant transactionId index to fix the Mongoose warning!
// paymentSchema.index({ transactionId: 1 }); 

// Prevent a student from enrolling in the exact same course twice
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

// Added index for faster dashboard queries (e.g. "Find all payments for User X")
paymentSchema.index({ user: 1, status: 1 });

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  Payment: mongoose.models.Payment || mongoose.model('Payment', paymentSchema),
  Enrollment: mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema)
};


// const mongoose = require('mongoose');

// const paymentSchema = new mongoose.Schema({
//   user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
//   mockTest: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest' },
//   amount: { type: Number, required: true },
//   currency: { type: String, default: 'USD' },
//   paymentMethod: { type: String, enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'upi', 'razorpay', 'stripe'] },
//   transactionId: { type: String, required: true, unique: true },
//   paymentGateway: String,
//   status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending' },
//   refundAmount: Number,
//   refundReason: String,
//   refundedAt: Date,
//   metadata: mongoose.Schema.Types.Mixed
// }, { timestamps: true });

// const enrollmentSchema = new mongoose.Schema({
//   course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
//   student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }, 
//   enrolledAt: { type: Date, default: Date.now },
//   expiryDate: Date,
//   isActive: { type: Boolean, default: true },
//   isRevoked: { type: Boolean, default: false }
// }, { timestamps: true });

// enrollmentSchema.statics.calcTotalEnrollments = async function(courseId) {
//   const stats = await this.aggregate([
//     { $match: { course: courseId, isActive: true } },
//     { $group: { _id: '$course', totalEnrollments: { $sum: 1 } } }
//   ]);

//   // Dynamically resolve model
//   const Course = mongoose.model('Course');

//   if (stats.length > 0) {
//     await Course.findByIdAndUpdate(courseId, { totalEnrollments: stats[0].totalEnrollments });
//   } else {
//     await Course.findByIdAndUpdate(courseId, { totalEnrollments: 0 });
//   }
// };

// // Hook for Creation / Expiry Updates
// enrollmentSchema.post('save', function() {
//   this.constructor.calcTotalEnrollments(this.course);
// });

// // Hook for Admin Deletion / Revokes
// enrollmentSchema.post(/^findOneAnd/, async function(doc) {
//   if (doc) {
//     await doc.constructor.calcTotalEnrollments(doc.course);
//   }
// });

// paymentSchema.index({ transactionId: 1 });
// enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

// // Serverless / Hot-Reload Safe Exports
// module.exports = {
//   Payment: mongoose.models.Payment || mongoose.model('Payment', paymentSchema),
//   Enrollment: mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema)
// };