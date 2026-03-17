const mongoose = require('mongoose');

// ==================== QUIZ & QUIZ QUESTIONS (Unchanged) ====================
const quizQuestionSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  question: { type: String, required: true },
  type: { type: String, required: true, uppercase: true, trim: true },
  options: [{ text: String, isCorrect: Boolean }],
  correctAnswer: String,
  points: { type: Number, default: 1 },
  explanation: String,
  order: Number
}, { timestamps: true });

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
  timeLimit: { type: Number, default: 30 },
  passingScore: { type: Number, min: 0, max: 100, default: 70 },
  maxAttempts: { type: Number, default: 3 },
  totalQuestions: { type: Number, default: 0 }, 
  totalPoints: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// ==================== NEW: TEST SERIES SCHEMA ====================
// This acts as the "Product" that users buy, grouping multiple mock tests together.
const testSeriesSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true }, // e.g., UPSC
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Pricing for the entire bundle
  isFree: { type: Boolean, default: false },
  price: { type: Number, default: 0 },
  discountPrice: { type: Number, default: 0 },

  // Grouping the tests
  tests: [{
    mockTestId: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest' },
    subject: { type: String }, // e.g., "History"
    chapter: { type: String }, // e.g., "Ancient India"
    order: { type: Number, default: 0 }
  }],

  totalTests: { type: Number, default: 0 },
  totalEnrollments: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// ==================== MOCK TEST SCHEMA (Updated) ====================
const mockTestSchema = new mongoose.Schema({
  title: { type: String, required: true }, // e.g., "Ancient India Chapter 1"
  description: String,
  
  // ✅ FIX: Linked to Category
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  level: { type: String, required: true, uppercase: true, trim: true },
  duration: { type: Number, required: true }, // in minutes
  totalQuestions: { type: Number, required: true, default: 0 },
  totalMarks: { type: Number, required: true, default: 0 },
  passingMarks: { type: Number, required: true },
  instructions: [String],
  tags: [String],
  
  // ✅ NEW: Allows this specific test to be taken for free even if the TestSeries is paid
  isFreePreview: { type: Boolean, default: false }, 
  
  // Kept in case you want to sell a MockTest individually, outside of a series
  price: { type: Number, default: 0 }, 
  
  isPublished: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  attemptsCount: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });


const mockTestQuestionSchema = new mongoose.Schema({
  mockTest: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest', required: true },
  sectionName: { type: String, required: true }, 
  question: { type: String, required: true },
  options: [{ text: String, isCorrect: Boolean }],
  marks: { type: Number, default: 1 },
  negativeMarks: { type: Number, default: 0 },
  explanation: String,
  order: Number
}, { timestamps: true });

const mockTestAttemptSchema = new mongoose.Schema({
  mockTest: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  timeTaken: Number,
  answers: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTestQuestion' },
    selectedOptionIndex: Number,
    answerText: String,
    isCorrect: Boolean,
    marksObtained: Number
  }],
  score: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  rank: Number,
  totalStudents: Number, 
  status: { type: String, enum: ['started', 'in-progress', 'completed', 'abandoned'], default: 'started' },
  isPassed: Boolean,
  feedback: String
}, { timestamps: true });

// Indexes
testSeriesSchema.index({ title: 'text', description: 'text' });
mockTestSchema.index({ title: 'text', description: 'text' });
mockTestAttemptSchema.index({ mockTest: 1, student: 1 });

// ✅ Exports updated
module.exports = {
  Quiz: mongoose.models.Quiz || mongoose.model('Quiz', quizSchema),
  QuizQuestion: mongoose.models.QuizQuestion || mongoose.model('QuizQuestion', quizQuestionSchema),
  TestSeries: mongoose.models.TestSeries || mongoose.model('TestSeries', testSeriesSchema),
  MockTest: mongoose.models.MockTest || mongoose.model('MockTest', mockTestSchema),
  MockTestQuestion: mongoose.models.MockTestQuestion || mongoose.model('MockTestQuestion', mockTestQuestionSchema),
  MockTestAttempt: mongoose.models.MockTestAttempt || mongoose.model('MockTestAttempt', mockTestAttemptSchema)
};
// const mongoose = require('mongoose');

// // Extracted Questions to prevent 16MB document bloat limit on large quizzes
// const quizQuestionSchema = new mongoose.Schema({
//   quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
//   question: { type: String, required: true },
//   // ✅ FIX: Removed strict enum, added uppercase/trim for Master code compatibility
//   type: { type: String, required: true, uppercase: true, trim: true },
//   options: [{ text: String, isCorrect: Boolean }],
//   correctAnswer: String,
//   points: { type: Number, default: 1 },
//   explanation: String,
//   order: Number
// }, { timestamps: true });

// const quizSchema = new mongoose.Schema({
//   title: { type: String, required: true },
//   description: String,
//   course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
//   lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
//   timeLimit: { type: Number, default: 30 },
//   passingScore: { type: Number, min: 0, max: 100, default: 70 },
//   maxAttempts: { type: Number, default: 3 },
//   totalQuestions: { type: Number, default: 0 }, // Updated via Question inserts
//   totalPoints: { type: Number, default: 0 },
//   isPublished: { type: Boolean, default: true },
//   isDeleted: { type: Boolean, default: false }
// }, { timestamps: true });

// const mockTestQuestionSchema = new mongoose.Schema({
//   mockTest: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest', required: true },
//   sectionName: { type: String, required: true }, // Groups questions within the mock test
//   question: { type: String, required: true },
//   options: [{ text: String, isCorrect: Boolean }],
//   marks: { type: Number, default: 1 },
//   negativeMarks: { type: Number, default: 0 },
//   explanation: String,
//   order: Number
// }, { timestamps: true });

// const mockTestSchema = new mongoose.Schema({
//   title: { type: String, required: true },
//   description: String,
//   category: { type: mongoose.Schema.Types.ObjectId, ref: 'Master', required: true },
//   instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   level: { type: String, required: true, uppercase: true, trim: true },
//   duration: { type: Number, required: true },
//   totalQuestions: { type: Number, required: true, default: 0 },
//   totalMarks: { type: Number, required: true, default: 0 },
//   passingMarks: { type: Number, required: true },
//   instructions: [String],
//   tags: [String],
//   isFree: { type: Boolean, default: false },
//   price: { type: Number, default: 0 },
//   isPublished: { type: Boolean, default: false },
//   isApproved: { type: Boolean, default: false },
//   attemptsCount: { type: Number, default: 0 },
//   averageScore: { type: Number, default: 0 },
//   isDeleted: { type: Boolean, default: false }
// }, { timestamps: true });

// const mockTestAttemptSchema = new mongoose.Schema({
//   mockTest: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest', required: true },
//   student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   startedAt: { type: Date, default: Date.now },
//   completedAt: Date,
//   timeTaken: Number,
//   answers: [{
//     questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTestQuestion' },
//     selectedOptionIndex: Number,
//     answerText: String,
//     isCorrect: Boolean,
//     marksObtained: Number
//   }],
//   score: { type: Number, default: 0 },
//   percentage: { type: Number, default: 0 },
//   rank: Number,
//   totalStudents: Number, // snapshot at time of completion
//   // Status is internal application state, so it keeps its enum
//   status: { type: String, enum: ['started', 'in-progress', 'completed', 'abandoned'], default: 'started' },
//   isPassed: Boolean,
//   feedback: String
// }, { timestamps: true });

// // Indexes
// mockTestSchema.index({ title: 'text', description: 'text' });
// mockTestAttemptSchema.index({ mockTest: 1, student: 1 });

// // ✅ FIX: Added safety checks to prevent OverwriteModelError during hot-reloads
// module.exports = {
//   Quiz: mongoose.models.Quiz || mongoose.model('Quiz', quizSchema),
//   QuizQuestion: mongoose.models.QuizQuestion || mongoose.model('QuizQuestion', quizQuestionSchema),
//   MockTest: mongoose.models.MockTest || mongoose.model('MockTest', mockTestSchema),
//   MockTestQuestion: mongoose.models.MockTestQuestion || mongoose.model('MockTestQuestion', mockTestQuestionSchema),
//   MockTestAttempt: mongoose.models.MockTestAttempt || mongoose.model('MockTestAttempt', mockTestAttemptSchema)
// };
