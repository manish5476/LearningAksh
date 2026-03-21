const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

// ==================== HELPERS ====================
const slugify = (text) => text.toString().toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/[^\w\-]+/g, '')
  .replace(/\-\-+/g, '-')
  .replace(/^-+/, '')
  .replace(/-+$/, '');

// ==================== MASTER DATA SCHEMA (SIMPLIFIED) ====================
const masterSchema = new mongoose.Schema({
  type: { type: String, required: true, trim: true, lowercase: true, index: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, lowercase: true, trim: true, index: true },
  code: { type: String, trim: true, uppercase: true },
  description: { type: String, trim: true },
  imageUrl: { type: String, trim: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Master", default: null },
  isActive: { type: Boolean, default: true },
  metadata: {
    isFeatured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 }
  }
}, { timestamps: true });

masterSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = `${slugify(this.name)}-${nanoid(6)}`;
  }
  next();
});

masterSchema.index({ type: 1, name: 1 }, { unique: true });
masterSchema.index({ type: 1, slug: 1 }, { unique: true });

masterSchema.statics.validateValue = async function (type, value) {
  if (!value) return true;
  const exists = await this.exists({
    type: type.toLowerCase(),
    $or: [{ code: value.toUpperCase() }, { name: value }, { slug: value.toLowerCase() }],
    isActive: true
  });
  return !!exists;
};

// ==================== CATEGORY SCHEMA ====================
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: String,
  slug: { type: String, required: true, unique: true },
  icon: String,
  image: String,
  parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for subcategories
categorySchema.virtual('subCategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory'
});

// Virtual for courses count (lazy load)
categorySchema.virtual('courseCount', {
  ref: 'Course',
  localField: '_id',
  foreignField: 'category',
  count: true
});

categorySchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    // Generate simple slug (using the helper defined at the top of the file)
    this.slug = slugify(this.name);
  }
  next();
});

// ==================== COURSE INSTRUCTOR SUB-SCHEMA ====================
const courseInstructorSchema = new mongoose.Schema({
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String }, // Assuming validation is handled or simplified
  permissions: {
    canEditCourse: { type: Boolean, default: false },
    canManageSections: { type: Boolean, default: false },
    canManageLessons: { type: Boolean, default: false },
    canManageStudents: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: true },
    canGradeAssignments: { type: Boolean, default: false }
  },
  addedAt: { type: Date, default: Date.now },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true }
}, { _id: false });

// ==================== COURSE SCHEMA ====================
const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subtitle: String,
  slug: { type: String, required: true, unique: true },
  description: { type: String, required: true },

  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },

  instructors: [courseInstructorSchema],
  primaryInstructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  level: { type: String, default: 'beginner' },
  language: { type: String, default: 'English' },
  currency: { type: String, default: 'USD' },

  thumbnail: String,
  previewVideo: String,
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0 },
  discountStartDate: Date,
  discountEndDate: Date,
  isFree: { type: Boolean, default: false },

  totalDuration: { type: Number, default: 0 },
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
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });


// ==================== SECTION SCHEMA ====================
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


// ==================== LESSON SCHEMA ====================
const lessonSchema = new mongoose.Schema({
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true },
  description: String,

  type: {
    type: String,
    required: true,
    validate: {
      validator: async function (value) {
        if (!value) return true;
        const Master = mongoose.model('Master');
        return await Master.validateValue('lesson_type', value);
      },
      message: 'Invalid lesson type'
    }
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  content: {
    video: {
      url: String,
      duration: Number,
      thumbnail: String,
      provider: {
        type: String,
        validate: {
          validator: async function (value) {
            if (!value) return true;
            const Master = mongoose.model('Master');
            return await Master.validateValue('video_provider', value);
          },
          message: 'Invalid video provider'
        }
      }
    },
    article: { body: String, attachments: [String] },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    codingExercise: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingExercise' }
  },
  order: { type: Number, required: true },
  duration: { type: Number, default: 0 },
  isFree: { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },

  resources: [{
    title: String,
    type: {
      type: String,
      validate: {
        validator: async function (value) {
          if (!value) return true;
          const Master = mongoose.model('Master');
          return await Master.validateValue('resource_type', value);
        },
        message: 'Invalid resource type'
      }
    },
    url: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });


// ==================== INSTRUCTOR INVITATION SCHEMA ====================
const instructorInvitationSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  email: { type: String, required: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true },
  role: {
    type: String,
    default: 'co-instructor',
    validate: {
      validator: async function (value) {
        if (!value) return true;
        const Master = mongoose.model('Master');
        return await Master.validateValue('instructor_role', value);
      },
      message: 'Invalid instructor role'
    }
  },
  permissions: {
    canEditCourse: { type: Boolean, default: false },
    canManageSections: { type: Boolean, default: false },
    canManageLessons: { type: Boolean, default: false },
    canManageStudents: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: true },
    canGradeAssignments: { type: Boolean, default: false }
  },
  status: {
    type: String,
    default: 'pending',
    validate: {
      validator: async function (value) {
        if (!value) return true;
        const Master = mongoose.model('Master');
        return await Master.validateValue('invitation_status', value);
      },
      message: 'Invalid invitation status'
    }
  },
  expiresAt: { type: Date, required: true },
  acceptedAt: Date,
  revokedAt: Date,
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });


// ==================== VIRTUALS & MIDDLEWARE ====================

// ==========================================
// TO THIS (Safe Version):
// ==========================================
courseSchema.virtual('activeInstructors').get(function () {
  // ✅ Check if instructors array exists before filtering
  if (!this.instructors || !Array.isArray(this.instructors)) return [];
  return this.instructors.filter(inst => inst.isActive);
});

courseSchema.virtual('instructorCount').get(function () {
  // ✅ Check if instructors array exists before getting length
  if (!this.instructors || !Array.isArray(this.instructors)) return 0;
  return this.instructors.length;
});
courseSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('primaryInstructor')) {
    const hasPrimary = this.instructors.some(
      inst => inst.instructor.toString() === this.primaryInstructor.toString()
    );

    if (!hasPrimary) {
      this.instructors.push({
        instructor: this.primaryInstructor,
        role: 'primary',
        permissions: {
          canEditCourse: true,
          canManageSections: true,
          canManageLessons: true,
          canManageStudents: true,
          canViewAnalytics: true,
          canGradeAssignments: true
        }
      });
    }
  }
  next();
});

// ==================== INDEXES ====================

courseSchema.index({ title: 'text', description: 'text' });
courseSchema.index({ category: 1, level: 1, price: 1 });
courseSchema.index({ primaryInstructor: 1, isPublished: 1 });
courseSchema.index({ 'instructors.instructor': 1 });
courseSchema.index({ slug: 1 }, { unique: true });
courseSchema.index({ isPublished: 1, isApproved: 1 });

sectionSchema.index({ course: 1, order: 1 }, { unique: true });
sectionSchema.index({ course: 1, isDeleted: 1 });

lessonSchema.index({ section: 1, order: 1 }, { unique: true });
lessonSchema.index({ section: 1, isDeleted: 1 });
lessonSchema.index({ course: 1, isFree: 1, isDeleted: 1 });
lessonSchema.index({ createdBy: 1 });
lessonSchema.index({ type: 1 });

instructorInvitationSchema.index({ token: 1 }, { unique: true });
instructorInvitationSchema.index({ course: 1, email: 1, status: 1 });
instructorInvitationSchema.index({ expiresAt: 1 });

// ==================== MODELS & EXPORTS ====================
const Master = mongoose.model('Master', masterSchema);
const Category = mongoose.model('Category', categorySchema);
const Course = mongoose.model('Course', courseSchema);
const Section = mongoose.model('Section', sectionSchema);
const Lesson = mongoose.model('Lesson', lessonSchema);
const InstructorInvitation = mongoose.model('InstructorInvitation', instructorInvitationSchema);

module.exports = {
  Master,
  Category,
  Course,
  Section,
  Lesson,
  InstructorInvitation
};