const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: String,
  slug: { type: String, required: true, unique: true },
  icon: String,
  image: String,
  parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subtitle: String,
  slug: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  level: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'all-levels'], default: 'beginner' },
  language: { type: String, default: 'English' },
  thumbnail: String,
  previewVideo: String,
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0 },
  discountStartDate: Date,
  discountEndDate: Date,
  isFree: { type: Boolean, default: false },
  currency: { type: String, default: 'USD' },
  // Counters (managed by middleware)
  totalDuration: { type: Number, default: 0 }, // in minutes
  totalLessons: { type: Number, default: 0 },
  totalSections: { type: Number, default: 0 },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  totalRatings: { type: Number, default: 0 },
  totalEnrollments: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  
  requirements: [String],
  whatYouWillLearn: [String],
  targetAudience: [String],
  tags: [String],
  isPublished: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  publishedAt: Date,
  // Soft Delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

const sectionSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true },
  description: String,
  order: { type: Number, required: true },
  totalLessons: { type: Number, default: 0 },
  totalDuration: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

const lessonSchema = new mongoose.Schema({
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true }, // Added for easier aggregation
  title: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['video', 'article', 'quiz', 'assignment', 'coding-exercise'], required: true },
  content: {
    video: { url: String, duration: Number, thumbnail: String, provider: { type: String, enum: ['youtube', 'vimeo', 'wistia', 'local'] } },
    article: { body: String, attachments: [String] },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    codingExercise: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingExercise' }
  },
  order: { type: Number, required: true },
  duration: { type: Number, default: 0 },
  isFree: { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },
  resources: [{ title: String, type: { type: String, enum: ['pdf', 'code', 'link', 'image'] }, url: String }],
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Indexes
courseSchema.index({ title: 'text', description: 'text' });
courseSchema.index({ category: 1, level: 1, price: 1 });
sectionSchema.index({ course: 1, order: 1 });
lessonSchema.index({ section: 1, order: 1 });

module.exports = {
  Category: mongoose.model('Category', categorySchema),
  Course: mongoose.model('Course', courseSchema),
  Section: mongoose.model('Section', sectionSchema),
  Lesson: mongoose.model('Lesson', lessonSchema)
};