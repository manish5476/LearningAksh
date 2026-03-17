const mongoose = require('mongoose');

const instructorProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bio: { type: String, maxlength: 1000 },
  qualifications: [{ degree: String, institution: String, year: Number, certificate: String }],
  expertise: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MasterValue' }], // References dynamic master categories
  experience: { years: Number, summary: String },
  socialLinks: { linkedin: String, github: String, twitter: String, website: String },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  totalStudents: { type: Number, default: 0 },
  totalCourses: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  isApproved: { type: Boolean, default: false },
  paymentDetails: { bankName: String, accountNumber: String, accountHolderName: String, ifscCode: String, paypalEmail: String }
}, { timestamps: true });

module.exports = mongoose.model('InstructorProfile', instructorProfileSchema);