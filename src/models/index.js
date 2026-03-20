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
const Post = require('./core/postModel')
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
  ...marketing, Post
};
