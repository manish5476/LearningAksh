const mongoose = require('mongoose');

// Extracted Questions to prevent 16MB document bloat limit on large quizzes
const quizQuestionSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  question: { type: String, required: true },
  type: { type: String, enum: ['multiple-choice', 'true-false', 'short-answer', 'essay'], required: true },
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
  totalQuestions: { type: Number, default: 0 }, // Updated via Question inserts
  totalPoints: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

const mockTestQuestionSchema = new mongoose.Schema({
  mockTest: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest', required: true },
  sectionName: { type: String, required: true }, // Groups questions within the mock test
  question: { type: String, required: true },
  options: [{ text: String, isCorrect: Boolean }],
  marks: { type: Number, default: 1 },
  negativeMarks: { type: Number, default: 0 },
  explanation: String,
  order: Number
}, { timestamps: true });

const mockTestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
  duration: { type: Number, required: true },
  totalQuestions: { type: Number, required: true, default: 0 },
  totalMarks: { type: Number, required: true, default: 0 },
  passingMarks: { type: Number, required: true },
  instructions: [String],
  tags: [String],
  isFree: { type: Boolean, default: false },
  price: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  attemptsCount: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false }
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
  totalStudents: Number, // snapshot at time of completion
  status: { type: String, enum: ['started', 'in-progress', 'completed', 'abandoned'], default: 'started' },
  isPassed: Boolean,
  feedback: String
}, { timestamps: true });

mockTestSchema.index({ title: 'text', description: 'text' });
mockTestAttemptSchema.index({ mockTest: 1, student: 1 });

module.exports = {
  Quiz: mongoose.model('Quiz', quizSchema),
  QuizQuestion: mongoose.model('QuizQuestion', quizQuestionSchema),
  MockTest: mongoose.model('MockTest', mockTestSchema),
  MockTestQuestion: mongoose.model('MockTestQuestion', mockTestQuestionSchema),
  MockTestAttempt: mongoose.model('MockTestAttempt', mockTestAttemptSchema)
};