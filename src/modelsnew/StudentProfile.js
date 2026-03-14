const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  education: [{ degree: String, institution: String, fieldOfStudy: String, startDate: Date, endDate: Date, grade: String }],
  interests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue' }], // Dynamic interests
  enrollments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment' }],
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  savedForLater: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    language: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue' },
    theme: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue' }
  }
}, { timestamps: true });

module.exports = mongoose.model('StudentProfile', studentProfileSchema);