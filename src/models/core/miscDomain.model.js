const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['course_update', 'new_course', 'discount', 'assignment_grade', 'certificate_issued', 'payment_received', 'mocktest_result', 'reminder'], 
    required: true 
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: mongoose.Schema.Types.Mixed,
  isRead: { type: Boolean, default: false },
  isImportant: { type: Boolean, default: false },
  expiresAt: Date
}, { timestamps: true });

const learningPathSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  level: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
  courses: [{
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    order: Number,
    isRequired: { type: Boolean, default: true }
  }],
  duration: Number,
  totalCourses: Number,
  totalCredits: Number,
  skills: [String],
  careerOpportunities: [String],
  prerequisites: [String],
  isPublished: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

const liveSessionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  duration: Number,
  meetingLink: String,
  recordingUrl: String,
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: Date,
    leftAt: Date
  }],
  maxParticipants: Number,
  status: { type: String, enum: ['scheduled', 'live', 'ended', 'cancelled'], default: 'scheduled' },
  isRecorded: { type: Boolean, default: true },
  materials: [String],
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

notificationSchema.index({ user: 1, isRead: 1 });
liveSessionSchema.index({ course: 1, status: 1 });

module.exports = {
  Notification: mongoose.model('Notification', notificationSchema),
  LearningPath: mongoose.model('LearningPath', learningPathSchema),
  LiveSession: mongoose.model('LiveSession', liveSessionSchema)
};