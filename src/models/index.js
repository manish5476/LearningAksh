// Central export file unifying all domain models

// Contains: User, InstructorProfile, StudentProfile
const UserModels = require('./core/userDomain.model');
// Contains: Category, Course, Section, Lesson
const CourseModels = require('./core/courseDomain.model');
// Contains: Quiz, QuizQuestion, MockTest, MockTestQuestion, MockTestAttempt
const AssessmentModels = require('./core/assesmentDomain.model');
// Contains: Assignment, AssignmentSubmission, CodingExercise, CodingSubmission
const ExerciseModels = require('./core/exerciseDomain.model');
// Contains: Review, Discussion, DiscussionReply
const InteractionModels = require('./core/interactionDomain.model');
// Contains: Payment, Enrollment
const CommerceModels = require('./core/commerceDomain.model');
// Contains: ProgressTracking, Certificate
const TrackingModels = require('./core/trackingCertificatsDomain.model');
// Contains: AuditLog, SystemSettings, ActivityLog
const MiscModels = require('./core/miscDomain.model');
// Contains: Notification, LearningPath, LiveSession, StudentNote, Badge, UserBadge
const studentExperience = require('./core/studentExperienceDomain.model');
// Contains: Coupon, Announcement, Cohort
const marketing = require('./core/marketingDomain.model');
const Master = require('../config/Master');

module.exports = {
  ...UserModels,
  // ...Master,
  ...CourseModels,
  ...AssessmentModels,
  ...ExerciseModels,
  ...InteractionModels,
  ...CommerceModels,
  ...TrackingModels,
  ...MiscModels,
  ...studentExperience,
  ...marketing
};

// // Central export file unifying all domain models
// const UserModels = require('./core1/userDomain.model');
// const CourseModels = require('./core1/courseDomain.model');
// const AssessmentModels = require('./core1/assesmentDomain.model');
// const ExerciseModels = require('./core1/exerciseDomain.model');
// const InteractionModels = require('./core1/interactionDomain.model');
// const CommerceModels = require('./core1/commerceDomain.model');
// const TrackingModels = require('./core1/trackingCertificatsDomain.model');
// const MiscModels = require('./core1/miscDomain.model');
// const studentExperience = require('./core1/studentExperienceDomain.model');
// const marketing = require('./core1/marketingDomain.model');

// module.exports = {
//   ...UserModels,
//   ...CourseModels,
//   ...AssessmentModels,
//   ...ExerciseModels,
//   ...InteractionModels,
//   ...CommerceModels,
//   ...TrackingModels,
//   ...MiscModels,
//   ...studentExperience,
//   ...marketing
// };