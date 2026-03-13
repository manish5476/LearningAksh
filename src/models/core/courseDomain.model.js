const mongoose = require('mongoose');

// ==================== MASTER DATA SCHEMA ====================
const masterValueSchema = new mongoose.Schema({
  value: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  description: String,
  parentValue: { type: mongoose.Schema.Types.ObjectId, ref: 'Master' },
  metadata: {
    icon: String,
    color: String,
    image: String,
    sortOrder: { type: Number, default: 0 },
    attributes: { type: Map, of: mongoose.Schema.Types.Mixed }
  },
  isActive: { type: Boolean, default: true },
  isPublished: { type: Boolean, default: false },
  isDefault: { type: Boolean, default: false },
  isSystem: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedAt: Date,
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const masterSchema = new mongoose.Schema({
  masterName: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  displayName: { type: String, required: true, trim: true },
  description: String,
  config: {
    isHierarchical: { type: Boolean, default: false },
    allowMultiple: { type: Boolean, default: true },
    isTranslatable: { type: Boolean, default: false },
    hasMetadata: { type: Boolean, default: true },
    validationRules: {
      minLength: Number,
      maxLength: Number,
      pattern: String,
      customValidator: String
    }
  },
  category: { 
    type: String,
    enum: ['SYSTEM', 'BUSINESS', 'EDUCATION', 'CONTENT', 'USER', 'SETTINGS'],
    default: 'BUSINESS'
  },
  values: [masterValueSchema],
  stats: {
    totalValues: { type: Number, default: 0 },
    activeValues: { type: Number, default: 0 },
    publishedValues: { type: Number, default: 0 },
    lastValueAdded: Date
  },
  isActive: { type: Boolean, default: true },
  isPublished: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
  isSystem: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedAt: Date,
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==================== CATEGORY SCHEMA ====================
// Kept as a standalone model for rich UI/hierarchy rendering
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

// ==================== COURSE INSTRUCTOR SUB-SCHEMA ====================
const courseInstructorSchema = new mongoose.Schema({
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { 
    type: String,
    validate: {
      validator: async function(value) {
        if (!value) return true; // Let standard validations handle empties
        const Master = mongoose.model('Master');
        return await Master.validateValue('INSTRUCTOR_ROLE', value);
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
  
  // Dedicated Reference to the Category Collection
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  
  // Multiple instructors support
  instructors: [courseInstructorSchema],
  primaryInstructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Master Validated Fields
  level: { 
    type: String,
    default: 'beginner',
    validate: {
      validator: async function(value) {
        if (!value) return true;
        const Master = mongoose.model('Master');
        return await Master.validateValue('COURSE_LEVEL', value);
      },
      message: 'Invalid course level'
    }
  },
  language: { 
    type: String,
    default: 'English',
    validate: {
      validator: async function(value) {
        if (!value) return true;
        const Master = mongoose.model('Master');
        return await Master.validateValue('LANGUAGE', value);
      },
      message: 'Invalid language selection'
    }
  },
  currency: { 
    type: String,
    default: 'USD',
    validate: {
      validator: async function(value) {
        if (!value) return true;
        const Master = mongoose.model('Master');
        return await Master.validateValue('CURRENCY', value);
      },
      message: 'Invalid currency selection'
    }
  },
  
  thumbnail: String,
  previewVideo: String,
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0 },
  discountStartDate: Date,
  discountEndDate: Date,
  isFree: { type: Boolean, default: false },
  
  // Counters
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
  
  // Status flags
  isPublished: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  publishedAt: Date,
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

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
      validator: async function(value) {
        if (!value) return true;
        const Master = mongoose.model('Master');
        return await Master.validateValue('LESSON_TYPE', value);
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
          validator: async function(value) {
            if (!value) return true;
            const Master = mongoose.model('Master');
            return await Master.validateValue('VIDEO_PROVIDER', value);
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
        validator: async function(value) {
          if (!value) return true;
          const Master = mongoose.model('Master');
          return await Master.validateValue('RESOURCE_TYPE', value);
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
      validator: async function(value) {
        if (!value) return true;
        const Master = mongoose.model('Master');
        return await Master.validateValue('INSTRUCTOR_ROLE', value);
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
      validator: async function(value) {
        if (!value) return true;
        const Master = mongoose.model('Master');
        return await Master.validateValue('INVITATION_STATUS', value);
      },
      message: 'Invalid invitation status'
    }
  },
  expiresAt: { type: Date, required: true },
  acceptedAt: Date,
  revokedAt: Date,
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// ==================== VIRTUALS ====================
courseSchema.virtual('activeInstructors').get(function() {
  return this.instructors.filter(inst => inst.isActive);
});

courseSchema.virtual('instructorCount').get(function() {
  return this.instructors.length;
});

masterSchema.virtual('activeValues').get(function() {
  return this.values.filter(v => v.isActive && v.isPublished);
});

masterSchema.virtual('hierarchy').get(function() {
  if (!this.config.isHierarchical) return [];
  
  const valueMap = new Map();
  const roots = [];
  
  this.values.forEach(value => {
    valueMap.set(value._id.toString(), {
      ...value.toObject(),
      children: []
    });
  });
  
  this.values.forEach(value => {
    const valueWithChildren = valueMap.get(value._id.toString());
    if (value.parentValue) {
      const parent = valueMap.get(value.parentValue.toString());
      if (parent) {
        parent.children.push(valueWithChildren);
      }
    } else {
      roots.push(valueWithChildren);
    }
  });
  
  return roots;
});

// ==================== INDEXES ====================
masterSchema.index({ masterName: 1 }, { unique: true });
masterSchema.index({ category: 1, isActive: 1 });
masterSchema.index({ 'values.value': 1, 'values.isActive': 1 });
masterSchema.index({ 'values.label': 'text' });

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

// ==================== MIDDLEWARE ====================
masterSchema.pre('save', function(next) {
  if (this.values) {
    this.stats.totalValues = this.values.length;
    this.stats.activeValues = this.values.filter(v => v.isActive).length;
    this.stats.publishedValues = this.values.filter(v => v.isPublished).length;
    
    const lastValue = this.values[this.values.length - 1];
    if (lastValue) {
      this.stats.lastValueAdded = lastValue.createdAt;
    }
  }
  next();
});

courseSchema.pre('save', function(next) {
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

courseSchema.pre('save', async function(next) {
  if (this.isModified('instructors')) {
    const Master = mongoose.model('Master');
    for (const instructor of this.instructors) {
      if (instructor.role) {
        const isValid = await Master.validateValue('INSTRUCTOR_ROLE', instructor.role);
        if (!isValid) {
          throw new Error(`Invalid instructor role: ${instructor.role}`);
        }
      }
    }
  }
  next();
});

// ==================== STATIC METHODS ====================
masterSchema.statics.getMasterValues = async function(masterName, options = {}) {
  const { activeOnly = true, publishedOnly = true, includeMetadata = false } = options;
  
  const master = await this.findOne({ 
    masterName: masterName.toUpperCase(),
    isActive: true,
    isPublished: true
  });
  
  if (!master) return [];
  
  let values = master.values;
  
  if (activeOnly) {
    values = values.filter(v => v.isActive);
  }
  
  if (publishedOnly) {
    values = values.filter(v => v.isPublished);
  }
  
  return values.map(v => ({
    id: v._id,
    value: v.value,
    label: v.label,
    description: v.description,
    ...(includeMetadata && { metadata: v.metadata })
  }));
};

masterSchema.statics.validateValue = async function(masterName, value) {
  const master = await this.findOne({ 
    masterName: masterName.toUpperCase(),
    isActive: true 
  });
  
  if (!master) return false;
  
  return master.values.some(v => 
    v.value === value && v.isActive && v.isPublished
  );
};

masterSchema.statics.getMasterMap = async function(masterName, options = {}) {
  const values = await this.getMasterValues(masterName, options);
  const map = {};
  values.forEach(v => {
    map[v.value] = v.label;
  });
  return map;
};

// ==================== MODELS ====================
const Master = mongoose.model('Master', masterSchema);
const Category = mongoose.model('Category', categorySchema);
const Course = mongoose.model('Course', courseSchema);
const Section = mongoose.model('Section', sectionSchema);
const Lesson = mongoose.model('Lesson', lessonSchema);
const InstructorInvitation = mongoose.model('InstructorInvitation', instructorInvitationSchema);

// ==================== EXPORTS ====================
module.exports = {
  Master,
  Category,
  Course,
  Section,
  Lesson,
  InstructorInvitation
};


// // models/index.js (Complete Upgraded Version with Master Data Integration)
// const mongoose = require('mongoose');

// // ==================== MASTER DATA SCHEMA ====================
// const masterValueSchema = new mongoose.Schema({
//   value: { 
//     type: String, 
//     required: true,
//     trim: true 
//   },
//   label: { 
//     type: String, 
//     required: true,
//     trim: true 
//   },
//   description: String,
  
//   // For hierarchical data (like parent-child relationships)
//   parentValue: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'Master' 
//   },
  
//   // Metadata for additional context
//   metadata: {
//     icon: String,
//     color: String,
//     image: String,
//     sortOrder: { type: Number, default: 0 },
//     attributes: {
//       type: Map,
//       of: mongoose.Schema.Types.Mixed
//     }
//   },
  
//   // Status flags
//   isActive: { type: Boolean, default: true },
//   isPublished: { type: Boolean, default: false },
//   isDefault: { type: Boolean, default: false },
//   isSystem: { type: Boolean, default: false },
  
//   // Audit fields
//   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   publishedAt: Date,
  
//   // Soft delete
//   isDeleted: { type: Boolean, default: false },
//   deletedAt: Date,
//   deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
// }, { 
//   timestamps: true 
// });

// const masterSchema = new mongoose.Schema({
//   // Master Type Definition
//   masterName: { 
//     type: String, 
//     required: true,
//     unique: true,
//     uppercase: true,
//     trim: true,
//     index: true
//   },
  
//   displayName: { 
//     type: String, 
//     required: true,
//     trim: true 
//   },
  
//   description: String,
  
//   // Master Configuration
//   config: {
//     isHierarchical: { type: Boolean, default: false },
//     allowMultiple: { type: Boolean, default: true },
//     isTranslatable: { type: Boolean, default: false },
//     hasMetadata: { type: Boolean, default: true },
//     validationRules: {
//       minLength: Number,
//       maxLength: Number,
//       pattern: String,
//       customValidator: String
//     }
//   },
  
//   // Master Category/Tag for grouping masters
//   category: { 
//     type: String,
//     enum: ['SYSTEM', 'BUSINESS', 'EDUCATION', 'CONTENT', 'USER', 'SETTINGS'],
//     default: 'BUSINESS'
//   },
  
//   // All values for this master
//   values: [masterValueSchema],
  
//   // Statistics
//   stats: {
//     totalValues: { type: Number, default: 0 },
//     activeValues: { type: Number, default: 0 },
//     publishedValues: { type: Number, default: 0 },
//     lastValueAdded: Date
//   },
  
//   // Status flags
//   isActive: { type: Boolean, default: true },
//   isPublished: { type: Boolean, default: false },
//   isLocked: { type: Boolean, default: false },
//   isSystem: { type: Boolean, default: false },
  
//   // Audit
//   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   publishedAt: Date,
  
//   // Soft delete
//   isDeleted: { type: Boolean, default: false },
//   deletedAt: Date,
//   deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
// }, { 
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // ==================== CATEGORY SCHEMA ====================
// const categorySchema = new mongoose.Schema({
//   name: { type: String, required: true, unique: true, trim: true },
//   description: String,
//   slug: { type: String, required: true, unique: true },
//   icon: String,
//   image: String,
//   parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
//   isActive: { type: Boolean, default: true },
//   isDeleted: { type: Boolean, default: false }
// }, { timestamps: true });

// // ==================== COURSE INSTRUCTOR SUB-SCHEMA ====================
// const courseInstructorSchema = new mongoose.Schema({
//   instructor: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'User', 
//     required: true 
//   },
//   role: { 
//     type: String,
//     // This will be validated against master data
//     validate: {
//       validator: async function(value) {
//         if (!value) return true;
//         const Master = mongoose.model('Master');
//         const isValid = await Master.validateValue('INSTRUCTOR_ROLE', value);
//         return isValid;
//       },
//       message: 'Invalid instructor role'
//     }
//   },
//   permissions: {
//     canEditCourse: { type: Boolean, default: false },
//     canManageSections: { type: Boolean, default: false },
//     canManageLessons: { type: Boolean, default: false },
//     canManageStudents: { type: Boolean, default: false },
//     canViewAnalytics: { type: Boolean, default: true },
//     canGradeAssignments: { type: Boolean, default: false }
//   },
//   addedAt: { type: Date, default: Date.now },
//   addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   isActive: { type: Boolean, default: true }
// }, { _id: false });

// // ==================== COURSE SCHEMA ====================
// const courseSchema = new mongoose.Schema({
//   title: { type: String, required: true, trim: true },
//   subtitle: String,
//   slug: { type: String, required: true, unique: true },
//   description: { type: String, required: true },
//     category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
//   // Multiple instructors support
//   instructors: [courseInstructorSchema],
//   primaryInstructor: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'User',
//     required: true 
//   },
  
//   // Using Master for level
//   level: { 
//     type: String,
//     default: 'beginner',
//     validate: {
//       validator: async function(value) {
//         const Master = mongoose.model('Master');
//         const isValid = await Master.validateValue('COURSE_LEVEL', value);
//         return isValid;
//       },
//       message: 'Invalid course level'
//     }
//   },
  
//   // Using Master for language
//   language: { 
//     type: String,
//     default: 'English',
//     // validate: {
//     //   validator: async function(value) {
//     //     const Master = mongoose.model('Master');
//     //     const isValid = await Master.validateValue('LANGUAGE', value);
//     //     return isValid;
//     //   },
//     //   message: 'Invalid language'
//     // }
//   },
  
//   thumbnail: String,
//   previewVideo: String,
//   price: { type: Number, required: true, min: 0 },
//   discountPrice: { type: Number, min: 0 },
//   discountStartDate: Date,
//   discountEndDate: Date,
//   isFree: { type: Boolean, default: false },
  
//   // Using Master for currency
//   currency: { 
//     type: String,
//     default: 'INR',
//     // validate: {
//     //   validator: async function(value) {
//     //     const Master = mongoose.model('Master');
//     //     const isValid = await Master.validateValue('CURRENCY', value);
//     //     return isValid;
//     //   },
//     //   message: 'Invalid currency'
//     // }
//   },
  
//   // Counters (managed by middleware)
//   totalDuration: { type: Number, default: 0 },
//   totalLessons: { type: Number, default: 0 },
//   totalSections: { type: Number, default: 0 },
//   rating: { type: Number, min: 0, max: 5, default: 0 },
//   totalRatings: { type: Number, default: 0 },
//   totalEnrollments: { type: Number, default: 0 },
//   totalReviews: { type: Number, default: 0 },
  
//   requirements: [String],
//   whatYouWillLearn: [String],
//   targetAudience: [String],
//   tags: [String],
  
//   // Status flags
//   isPublished: { type: Boolean, default: false },
//   isApproved: { type: Boolean, default: false },
//   approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   approvedAt: Date,
//   publishedAt: Date,
  
//   // Soft Delete
//   isDeleted: { type: Boolean, default: false },
//   deletedAt: { type: Date, default: null }
// }, { 
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // ==================== SECTION SCHEMA ====================
// const sectionSchema = new mongoose.Schema({
//   course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
//   title: { type: String, required: true },
//   description: String,
//   order: { type: Number, required: true },
//   totalLessons: { type: Number, default: 0 },
//   totalDuration: { type: Number, default: 0 },
//   isPublished: { type: Boolean, default: true },
//   isDeleted: { type: Boolean, default: false }
// }, { timestamps: true });

// // ==================== LESSON SCHEMA ====================
// const lessonSchema = new mongoose.Schema({
//   section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
//   course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
//   title: { type: String, required: true },
//   description: String,
  
//   // Using Master for lesson type
//   type: { 
//     type: String,
//     required: true,
//     validate: {
//       validator: async function(value) {
//         const Master = mongoose.model('Master');
//         const isValid = await Master.validateValue('LESSON_TYPE', value);
//         return isValid;
//       },
//       message: 'Invalid lesson type'
//     }
//   },
  
//   // Track which instructor created/modified this lesson
//   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
//   content: {
//     video: { 
//       url: String, 
//       duration: Number, 
//       thumbnail: String,
//       // Using Master for video provider
//       provider: {
//         type: String,
//         validate: {
//           validator: async function(value) {
//             if (!value) return true;
//             const Master = mongoose.model('Master');
//             const isValid = await Master.validateValue('VIDEO_PROVIDER', value);
//             return isValid;
//           },
//           message: 'Invalid video provider'
//         }
//       }
//     },
//     article: { body: String, attachments: [String] },
//     quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
//     assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
//     codingExercise: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingExercise' }
//   },
//   order: { type: Number, required: true },
//   duration: { type: Number, default: 0 },
//   isFree: { type: Boolean, default: false },
//   isPublished: { type: Boolean, default: true },
  
//   // Using Master for resource type
//   resources: [{ 
//     title: String,
//     type: {
//       type: String,
//       validate: {
//         validator: async function(value) {
//           const Master = mongoose.model('Master');
//           const isValid = await Master.validateValue('RESOURCE_TYPE', value);
//           return isValid;
//         },
//         message: 'Invalid resource type'
//       }
//     },
//     url: String,
//     uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
//   }],
  
//   isDeleted: { type: Boolean, default: false }
// }, { timestamps: true });

// // ==================== INSTRUCTOR INVITATION SCHEMA ====================
// const instructorInvitationSchema = new mongoose.Schema({
//   course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
//   email: { type: String, required: true },
//   invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   token: { type: String, required: true, unique: true },
  
//   // Using Master for role
//   role: { 
//     type: String,
//     default: 'co-instructor',
//     validate: {
//       validator: async function(value) {
//         const Master = mongoose.model('Master');
//         const isValid = await Master.validateValue('INSTRUCTOR_ROLE', value);
//         return isValid;
//       },
//       message: 'Invalid instructor role'
//     }
//   },
  
//   permissions: {
//     canEditCourse: { type: Boolean, default: false },
//     canManageSections: { type: Boolean, default: false },
//     canManageLessons: { type: Boolean, default: false },
//     canManageStudents: { type: Boolean, default: false },
//     canViewAnalytics: { type: Boolean, default: true },
//     canGradeAssignments: { type: Boolean, default: false }
//   },
  
//   // Using Master for status
//   status: { 
//     type: String,
//     default: 'pending',
//     validate: {
//       validator: async function(value) {
//         const Master = mongoose.model('Master');
//         const isValid = await Master.validateValue('INVITATION_STATUS', value);
//         return isValid;
//       },
//       message: 'Invalid invitation status'
//     }
//   },
  
//   expiresAt: { type: Date, required: true },
//   acceptedAt: Date,
//   revokedAt: Date,
//   revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
// }, { timestamps: true });

// // ==================== USER ROLE ENUM (Direct enum for User model) ====================
// // This is kept as direct enum since user roles are core system functionality
// const userRoleSchema = new mongoose.Schema({
//   role: {
//     type: String,
//     enum: ['user', 'instructor', 'admin'],
//     default: 'user'
//   }
// }, { _id: false });

// // ==================== VIRTUALS ====================
// // Course virtuals
// courseSchema.virtual('activeInstructors').get(function() {
//   return this.instructors.filter(inst => inst.isActive);
// });

// courseSchema.virtual('instructorCount').get(function() {
//   return this.instructors.length;
// });

// // Master virtuals
// masterSchema.virtual('activeValues').get(function() {
//   return this.values.filter(v => v.isActive && v.isPublished);
// });

// masterSchema.virtual('hierarchy').get(function() {
//   if (!this.config.isHierarchical) return [];
  
//   const valueMap = new Map();
//   const roots = [];
  
//   this.values.forEach(value => {
//     valueMap.set(value._id.toString(), {
//       ...value.toObject(),
//       children: []
//     });
//   });
  
//   this.values.forEach(value => {
//     const valueWithChildren = valueMap.get(value._id.toString());
//     if (value.parentValue) {
//       const parent = valueMap.get(value.parentValue.toString());
//       if (parent) {
//         parent.children.push(valueWithChildren);
//       }
//     } else {
//       roots.push(valueWithChildren);
//     }
//   });
  
//   return roots;
// });

// // ==================== INDEXES ====================
// // Master indexes
// masterSchema.index({ masterName: 1 }, { unique: true });
// masterSchema.index({ category: 1, isActive: 1 });
// masterSchema.index({ 'values.value': 1, 'values.isActive': 1 });
// masterSchema.index({ 'values.label': 'text' });

// // Course indexes
// courseSchema.index({ title: 'text', description: 'text' });
// courseSchema.index({ category: 1, level: 1, price: 1 });
// courseSchema.index({ primaryInstructor: 1, isPublished: 1 });
// courseSchema.index({ 'instructors.instructor': 1 });
// courseSchema.index({ slug: 1 }, { unique: true });
// courseSchema.index({ isPublished: 1, isApproved: 1 });

// // Section indexes
// sectionSchema.index({ course: 1, order: 1 }, { unique: true });
// sectionSchema.index({ course: 1, isDeleted: 1 });

// // Lesson indexes
// lessonSchema.index({ section: 1, order: 1 }, { unique: true });
// lessonSchema.index({ section: 1, isDeleted: 1 });
// lessonSchema.index({ course: 1, isFree: 1, isDeleted: 1 });
// lessonSchema.index({ createdBy: 1 });
// lessonSchema.index({ type: 1 });

// // Invitation indexes
// instructorInvitationSchema.index({ token: 1 }, { unique: true });
// instructorInvitationSchema.index({ course: 1, email: 1, status: 1 });
// instructorInvitationSchema.index({ expiresAt: 1 });

// // ==================== MIDDLEWARE ====================
// // Master pre-save middleware to update stats
// masterSchema.pre('save', function(next) {
//   if (this.values) {
//     this.stats.totalValues = this.values.length;
//     this.stats.activeValues = this.values.filter(v => v.isActive).length;
//     this.stats.publishedValues = this.values.filter(v => v.isPublished).length;
    
//     const lastValue = this.values[this.values.length - 1];
//     if (lastValue) {
//       this.stats.lastValueAdded = lastValue.createdAt;
//     }
//   }
//   next();
// });

// // Course pre-save middleware for primary instructor
// courseSchema.pre('save', function(next) {
//   if (this.isNew || this.isModified('primaryInstructor')) {
//     const hasPrimary = this.instructors.some(
//       inst => inst.instructor.toString() === this.primaryInstructor.toString()
//     );
    
//     if (!hasPrimary) {
//       this.instructors.push({
//         instructor: this.primaryInstructor,
//         role: 'primary',
//         permissions: {
//           canEditCourse: true,
//           canManageSections: true,
//           canManageLessons: true,
//           canManageStudents: true,
//           canViewAnalytics: true,
//           canGradeAssignments: true
//         }
//       });
//     }
//   }
//   next();
// });

// // Course pre-save middleware to validate instructor roles
// courseSchema.pre('save', async function(next) {
//   if (this.isModified('instructors')) {
//     const Master = mongoose.model('Master');
//     for (const instructor of this.instructors) {
//       if (instructor.role) {
//         const isValid = await Master.validateValue('INSTRUCTOR_ROLE', instructor.role);
//         if (!isValid) {
//           throw new Error(`Invalid instructor role: ${instructor.role}`);
//         }
//       }
//     }
//   }
//   next();
// });

// // ==================== STATIC METHODS ====================
// // Master static methods
// masterSchema.statics.getMasterValues = async function(masterName, options = {}) {
//   const { activeOnly = true, publishedOnly = true, includeMetadata = false } = options;
  
//   const master = await this.findOne({ 
//     masterName: masterName.toUpperCase(),
//     isActive: true,
//     isPublished: true
//   });
  
//   if (!master) return [];
  
//   let values = master.values;
  
//   if (activeOnly) {
//     values = values.filter(v => v.isActive);
//   }
  
//   if (publishedOnly) {
//     values = values.filter(v => v.isPublished);
//   }
  
//   return values.map(v => ({
//     id: v._id,
//     value: v.value,
//     label: v.label,
//     description: v.description,
//     ...(includeMetadata && { metadata: v.metadata })
//   }));
// };

// masterSchema.statics.validateValue = async function(masterName, value) {
//   const master = await this.findOne({ 
//     masterName: masterName.toUpperCase(),
//     isActive: true 
//   });
  
//   if (!master) return false;
  
//   return master.values.some(v => 
//     v.value === value && v.isActive && v.isPublished
//   );
// };

// masterSchema.statics.getMasterMap = async function(masterName, options = {}) {
//   const values = await this.getMasterValues(masterName, options);
//   const map = {};
//   values.forEach(v => {
//     map[v.value] = v.label;
//   });
//   return map;
// };

// // ==================== MODELS ====================
// const Master = mongoose.model('Master', masterSchema);
// const Category = mongoose.model('Category', categorySchema);
// const Course = mongoose.model('Course', courseSchema);
// const Section = mongoose.model('Section', sectionSchema);
// const Lesson = mongoose.model('Lesson', lessonSchema);
// const InstructorInvitation = mongoose.model('InstructorInvitation', instructorInvitationSchema);

// // ==================== EXPORTS ====================
// module.exports = {
//   Master,
//   Category,
//   Course,
//   Section,
//   Lesson,
//   InstructorInvitation
// };




// // const mongoose = require('mongoose');

// // const categorySchema = new mongoose.Schema({
// //   name: { type: String, required: true, unique: true, trim: true },
// //   description: String,
// //   slug: { type: String, required: true, unique: true },
// //   icon: String,
// //   image: String,
// //   parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
// //   isActive: { type: Boolean, default: true },
// //   isDeleted: { type: Boolean, default: false }
// // }, { timestamps: true });

// // const courseSchema = new mongoose.Schema({
// //   title: { type: String, required: true, trim: true },
// //   subtitle: String,
// //   slug: { type: String, required: true, unique: true },
// //   description: { type: String, required: true },
// //   category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
// //   instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
// //   level: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'all-levels'], default: 'beginner' },
// //   language: { type: String, default: 'English' },
// //   thumbnail: String,
// //   previewVideo: String,
// //   price: { type: Number, required: true, min: 0 },
// //   discountPrice: { type: Number, min: 0 },
// //   discountStartDate: Date,
// //   discountEndDate: Date,
// //   isFree: { type: Boolean, default: false },
// //   currency: { type: String, default: 'USD' },
// //   // Counters (managed by middleware)
// //   totalDuration: { type: Number, default: 0 }, // in minutes
// //   totalLessons: { type: Number, default: 0 },
// //   totalSections: { type: Number, default: 0 },
// //   rating: { type: Number, min: 0, max: 5, default: 0 },
// //   totalRatings: { type: Number, default: 0 },
// //   totalEnrollments: { type: Number, default: 0 },
// //   totalReviews: { type: Number, default: 0 },
  
// //   requirements: [String],
// //   whatYouWillLearn: [String],
// //   targetAudience: [String],
// //   tags: [String],
// //   isPublished: { type: Boolean, default: false },
// //   isApproved: { type: Boolean, default: false },
// //   approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
// //   approvedAt: Date,
// //   publishedAt: Date,
// //   // Soft Delete
// //   isDeleted: { type: Boolean, default: false },
// //   deletedAt: { type: Date, default: null }
// // }, { timestamps: true });

// // const sectionSchema = new mongoose.Schema({
// //   course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
// //   title: { type: String, required: true },
// //   description: String,
// //   order: { type: Number, required: true },
// //   totalLessons: { type: Number, default: 0 },
// //   totalDuration: { type: Number, default: 0 },
// //   isPublished: { type: Boolean, default: true },
// //   isDeleted: { type: Boolean, default: false }
// // }, { timestamps: true });

// // const lessonSchema = new mongoose.Schema({
// //   section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
// //   course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true }, // Added for easier aggregation
// //   title: { type: String, required: true },
// //   description: String,
// //   type: { type: String, enum: ['video', 'article', 'quiz', 'assignment', 'coding-exercise'], required: true },
// //   content: {
// //     video: { url: String, duration: Number, thumbnail: String, provider: { type: String, enum: ['youtube', 'vimeo', 'wistia', 'local'] } },
// //     article: { body: String, attachments: [String] },
// //     quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
// //     assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
// //     codingExercise: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingExercise' }
// //   },
// //   order: { type: Number, required: true },
// //   duration: { type: Number, default: 0 },
// //   isFree: { type: Boolean, default: false },
// //   isPublished: { type: Boolean, default: true },
// //   resources: [{ title: String, type: { type: String, enum: ['pdf', 'code', 'link', 'image'] }, url: String }],
// //   isDeleted: { type: Boolean, default: false }
// // }, { timestamps: true });

// // // Indexes
// // courseSchema.index({ title: 'text', description: 'text' });
// // courseSchema.index({ category: 1, level: 1, price: 1 });
// // sectionSchema.index({ course: 1, order: 1 });
// // lessonSchema.index({ section: 1, order: 1 });
// // // Add this index to make deleting and fetching lessons lightning fast!
// // lessonSchema.index({ section: 1, isDeleted: 1 });
// // module.exports = {
// //   Category: mongoose.model('Category', categorySchema),
// //   Course: mongoose.model('Course', courseSchema),
// //   Section: mongoose.model('Section', sectionSchema),
// //   Lesson: mongoose.model('Lesson', lessonSchema)
// // };