module.exports = {
  // Config & Master
  MasterGroup: require('./MasterGroup'),
  MasterValue: require('./MasterValue'),
  Category: require('./Category'),
  SystemSettings: require('./SystemSettings'),
  AuditLog: require('./AuditLog'),

  // Users
  User: require('./User'),
  InstructorProfile: require('./InstructorProfile'),
  StudentProfile: require('./StudentProfile'),

  // Courses
  Course: require('./Course'),
  Section: require('./Section'),
  Lesson: require('./Lesson'),

  // Assessment
  Quiz: require('./Quiz'),
  QuizQuestion: require('./QuizQuestion'),
  MockTest: require('./MockTest'),
  MockTestQuestion: require('./MockTestQuestion'),
  MockTestAttempt: require('./MockTestAttempt'),

  // Financial
  Payment: require('./Payment'),
  Enrollment: require('./Enrollment'),
  Coupon: require('./Coupon'),

  // Tracking & Gamification
  ProgressTracking: require('./ProgressTracking'),
  ActivityLog: require('./ActivityLog'),
  Badge: require('./Badge'),
  UserBadge: require('./UserBadge'),
  Certificate: require('./Certificate'),
  StudentNote: require('./StudentNote'),

  // Community & Marketing
  Review: require('./Review'),
  Discussion: require('./Discussion'),
  DiscussionReply: require('./DiscussionReply'),
  Announcement: require('./Announcement'),
  Cohort: require('./Cohort')
};