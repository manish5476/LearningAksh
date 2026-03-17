const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }, 
  enrolledAt: { type: Date, default: Date.now },
  expiryDate: Date,
  isActive: { type: Boolean, default: true },
  isRevoked: { type: Boolean, default: false }
}, { timestamps: true });

enrollmentSchema.statics.calcTotalEnrollments = async function(courseId) {
  const stats = await this.aggregate([
    { $match: { course: courseId, isActive: true, isRevoked: false } },
    { $group: { _id: '$course', totalEnrollments: { $sum: 1 } } }
  ]);
  const Course = mongoose.model('Course');
  await Course.findByIdAndUpdate(courseId, { 
    totalEnrollments: stats.length > 0 ? stats[0].totalEnrollments : 0 
  });
};

enrollmentSchema.post('save', function() {
  this.constructor.calcTotalEnrollments(this.course);
});

module.exports = mongoose.model('Enrollment', enrollmentSchema);