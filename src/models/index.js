// models/index.js
const User = require('./User.model');
const InstructorProfile = require('./InstructorProfile.model');
const Course = require('./Course.model');
const Category = require('./Category.model');
const Section = require('./Section.model');
const Lesson = require('./Lesson.model');
const Order = require('./Order.model');
const OrderItem = require('./OrderItem.model');
const Coupon = require('./Coupon.model');
const Enrollment = require('./Enrollment.model');
const LessonProgress = require('./LessonProgress.model');
const Certificate = require('./Certificate.model');
const QuizQuestion = require('./QuizQuestion.model');
const Quiz = require('./Quiz.model');
const MockTest = require('./MockTest.model');
const MockTestAttempt = require('./MockTestAttempt.model');
const Review = require('./Review.model');
const Announcement = require('./Announcement.model');
const { Discussion, DiscussionReply } = require('./Discussion.model');
const AuditLog = require('./AuditLog.model');
const Assignment = require('./Assignment.model');
const AssignmentSubmission = require('./AssignmentSubmission.model');
const CodingExercise = require('./CodingExercise.model');
const CodingSubmission = require('./CodingSubmission.model');
const StudentNote = require('./StudentNote.model');
const Badge = require('./Badge.model');
const UserBadge = require('./UserBadge.model');
module.exports = {
    // Core
    User, InstructorProfile,StudentNote,Badge,UserBadge,
    // Content
    Course, Category, Section, Lesson,CodingSubmission,
    // Commerce
    Assignment,
    AssignmentSubmission,
    CodingExercise,
    Order, OrderItem, Coupon, Announcement,
    // Learning
    Enrollment, LessonProgress, Certificate,
    // Assessment
    Quiz, QuizQuestion, MockTest, MockTestAttempt,
    // Social
    Review, Discussion, DiscussionReply,
    // System
    AuditLog
};