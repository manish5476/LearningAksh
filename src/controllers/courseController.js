// controllers/courseController.js
const { Course,Quiz, Section, Lesson, InstructorInvitation, Master } = require('../models');
const factory = require('../utils/handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');
const crypto = require('crypto');

// ==================== MIDDLEWARE ====================

// Set primary instructor from logged in user
exports.setPrimaryInstructor = (req, res, next) => {
  if (!req.body.primaryInstructor) {
    req.body.primaryInstructor = req.user.id;
  }
  next();
};

// Add instructors array if not present
exports.initializeInstructors = (req, res, next) => {
  if (!req.body.instructors && req.body.primaryInstructor) {
    req.body.instructors = [{
      instructor: req.body.primaryInstructor,
      role: 'primary',
      permissions: {
        canEditCourse: true,
        canManageSections: true,
        canManageLessons: true,
        canManageStudents: true,
        canViewAnalytics: true,
        canGradeAssignments: true
      }
    }];
  }
  next();
};

// Validate master data fields
exports.validateMasterFields = catchAsync(async (req, res, next) => {
  let { category, level, language, currency } = req.body;

  // 1. Category Check (Using aggressive normalization)
  if (category) {
    // Console log to debug - check your terminal when you hit Save
    console.log('🔍 Validating Category Input:', category);

    let query = { type: 'course_category', isActive: true };

    if (mongoose.Types.ObjectId.isValid(category)) {
      // If it looks like an ID, search by ID OR by Code (just in case)
      query.$or = [
        { _id: new mongoose.Types.ObjectId(category) }, 
        { code: String(category).toUpperCase() }
      ];
    } else {
      // If it's just a string (like "DEVELOPMENT"), search by Code
      query.code = String(category).toUpperCase();
    }

    const categoryExists = await Master.findOne(query);

    if (!categoryExists) {
      console.log('❌ Category NOT found in database for query:', query);
      return next(new AppError(`Invalid category selection.`, 400));
    }

    // CRITICAL: Overwrite the request body with the real MongoDB ObjectId
    // This ensures your Course model saves a valid reference
    req.body.category = categoryExists._id;
    console.log('✅ Category validated & normalized to:', categoryExists._id);
  }

  // 2. Level (String Code)
  if (level) {
    const isValid = await Master.validateValue('course_level', String(level).trim());
    if (!isValid) return next(new AppError(`Invalid difficulty level: ${level}`, 400));
  }

  // 3. Language (String Code)
  if (language) {
    const isValid = await Master.validateValue('language', String(language).trim());
    if (!isValid) return next(new AppError(`Invalid language: ${language}`, 400));
  }

  // 4. Currency (String Code)
  if (currency) {
    const isValid = await Master.validateValue('currency', String(currency).trim());
    if (!isValid) return next(new AppError(`Invalid currency: ${currency}`, 400));
  }

  next();
});

// // Validate master data fields
// exports.validateMasterFields = catchAsync(async (req, res, next) => {
//   const { category, level, language, currency } = req.body;
  
//   // 1. Category Check (Handles both old IDs, new IDs, and text Codes)
//   if (category) {
//     const isObjectId = mongoose.Types.ObjectId.isValid(category);
    
//     const categoryExists = await Master.findOne({ 
//       type: 'course_category',
//       isActive: true,
//       $or: [
//         ...(isObjectId ? [{ _id: category }] : []), // Check by ID if valid
//         { code: String(category).toUpperCase() }    // Fallback: Check by Code
//       ]
//     });

//     if (!categoryExists) {
//       return next(new AppError(`Invalid category. If you are editing an old course, please re-select the category from the dropdown.`, 400));
//     }
    
//     // Normalize it: ensure we save the actual Master _id to the database
//     req.body.category = categoryExists._id; 
//   }
  
//   // 2. Level uses a String Code.
//   if (level) {
//     const isValid = await Master.validateValue('course_level', String(level).trim());
//     if (!isValid) return next(new AppError(`Invalid level: ${level}`, 400));
//   }
  
//   // 3. Language uses a String Code.
//   if (language) {
//     const isValid = await Master.validateValue('language', String(language).trim());
//     if (!isValid) return next(new AppError(`Invalid language: ${language}`, 400));
//   }
  
//   // 4. Currency uses a String Code.
//   if (currency) {
//     const isValid = await Master.validateValue('currency', String(currency).trim());
//     if (!isValid) return next(new AppError(`Invalid currency: ${currency}`, 400));
//   }
  
//   next();
// });
// Check if user has permission to modify course
exports.checkCoursePermission = catchAsync(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  // Check if user is admin
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Check if user is an instructor with edit permissions
  const instructor = course.instructors.find(
    inst => inst.instructor.toString() === req.user.id && inst.isActive
  );
  
  if (!instructor) {
    return next(new AppError('You are not an instructor of this course', 403));
  }
  
  // Check specific permissions based on action
  const action = req.method + ' ' + req.path;
  if (action.includes('PATCH') || action.includes('PUT')) {
    if (!instructor.permissions.canEditCourse && instructor.role !== 'primary') {
      return next(new AppError('You do not have permission to edit this course', 403));
    }
  }
  
  // Store instructor info in request for later use
  req.instructorInfo = instructor;
  
  next();
});

// Check if user can publish/unpublish
exports.checkPublishPermission = catchAsync(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  // Admin can always publish/unpublish
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Only primary instructor can publish/unpublish
  const isPrimary = course.primaryInstructor.toString() === req.user.id;
  
  if (!isPrimary) {
    return next(new AppError('Only primary instructor can publish/unpublish courses', 403));
  }
  
  next();
});

// ==================== PUBLISH/UNPUBLISH FUNCTIONS ====================

// Publish course
exports.publishCourse = catchAsync(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  // Check if course has minimum requirements to publish
  const sections = await Section.countDocuments({ 
    course: course._id, 
    isDeleted: { $ne: true },
    isPublished: true
  });
  
  const lessons = await Lesson.countDocuments({ 
    course: course._id, 
    isDeleted: { $ne: true },
    isPublished: true
  });
  
  if (sections === 0) {
    return next(new AppError('Cannot publish course with no sections', 400));
  }
  
  if (lessons === 0) {
    return next(new AppError('Cannot publish course with no lessons', 400));
  }
  
  // Check if course is approved (if approval required)
  if (!course.isApproved && req.user.role !== 'admin') {
    return next(new AppError('Course must be approved by admin before publishing', 400));
  }
  
  course.isPublished = true;
  course.publishedAt = new Date();
  course.updatedBy = req.user.id;
  
  await course.save();
  
  console.log(`📢 Course published: ${course.title} by ${req.user.email}`);
  
  res.status(200).json({
    status: 'success',
    message: 'Course published successfully',
    data: course
  });
});

// Unpublish course
exports.unpublishCourse = catchAsync(async (req, res, next) => {
  const course = await Course.findByIdAndUpdate(
    req.params.id,
    {
      isPublished: false,
      publishedAt: null,
      updatedBy: req.user.id
    },
    { new: true, runValidators: true }
  );
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  console.log(`📢 Course unpublished: ${course.title} by ${req.user.email}`);
  
  res.status(200).json({
    status: 'success',
    message: 'Course unpublished successfully',
    data: course
  });
});

// Toggle publish status
exports.togglePublishStatus = catchAsync(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  if (course.isPublished) {
    return exports.unpublishCourse(req, res, next);
  } else {
    return exports.publishCourse(req, res, next);
  }
});

// ==================== APPROVAL FUNCTIONS ====================

// Approve course (admin only)
exports.approveCourse = catchAsync(async (req, res, next) => {
  const course = await Course.findByIdAndUpdate(
    req.params.id,
    {
      isApproved: true,
      approvedBy: req.user.id,
      approvedAt: new Date(),
      updatedBy: req.user.id
    },
    { new: true, runValidators: true }
  );
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  console.log(`✅ Course approved: ${course.title} by admin ${req.user.email}`);
  
  res.status(200).json({
    status: 'success',
    message: 'Course approved successfully',
    data: course
  });
});

// Reject course with reason (admin only)
exports.rejectCourse = catchAsync(async (req, res, next) => {
  const { reason } = req.body;
  
  if (!reason) {
    return next(new AppError('Rejection reason is required', 400));
  }
  
  const course = await Course.findById(req.params.id);
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  course.isApproved = false;
  course.approvedBy = null;
  course.approvedAt = null;
  course.isPublished = false;
  course.publishedAt = null;
  course.updatedBy = req.user.id;
  course.rejectionReason = reason;
  
  await course.save();
  
  console.log(`❌ Course rejected: ${course.title} by admin ${req.user.email}. Reason: ${reason}`);
  
  res.status(200).json({
    status: 'success',
    message: 'Course rejected successfully',
    data: course
  });
});

// ==================== INSTRUCTOR MANAGEMENT ====================

// Add co-instructor to course
exports.addInstructor = catchAsync(async (req, res, next) => {
  const { instructorId, role, permissions } = req.body;
  const courseId = req.params.id;
  
  if (role) {
    const isValidRole = await Master.validateValue('instructor_role', role);
    if (!isValidRole) {
      return next(new AppError(`Invalid instructor role: ${role}`, 400));
    }
  }
  
  const course = await Course.findById(courseId);
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  const existing = course.instructors.find(
    inst => inst.instructor.toString() === instructorId
  );
  
  if (existing) {
    return next(new AppError('Instructor already added to this course', 400));
  }
  
  course.instructors.push({
    instructor: instructorId,
    role: role || 'co-instructor',
    permissions: permissions || {
      canEditCourse: false,
      canManageSections: true,
      canManageLessons: true,
      canManageStudents: false,
      canViewAnalytics: true,
      canGradeAssignments: false
    },
    addedBy: req.user.id
  });
  
  await course.save();
  
  res.status(200).json({
    status: 'success',
    data: course
  });
});

// Remove instructor from course
exports.removeInstructor = catchAsync(async (req, res, next) => {
  const { instructorId } = req.params;
  const courseId = req.params.id;
  
  const course = await Course.findById(courseId);
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  if (course.primaryInstructor.toString() === instructorId) {
    return next(new AppError('Cannot remove primary instructor', 400));
  }
  
  course.instructors = course.instructors.filter(
    inst => inst.instructor.toString() !== instructorId
  );
  
  await course.save();
  
  res.status(200).json({
    status: 'success',
    data: course
  });
});

// Update instructor permissions
exports.updateInstructorPermissions = catchAsync(async (req, res, next) => {
  const { instructorId } = req.params;
  const { permissions } = req.body;
  const courseId = req.params.id;
  
  const course = await Course.findById(courseId);
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  const instructor = course.instructors.find(
    inst => inst.instructor.toString() === instructorId
  );
  
  if (!instructor) {
    return next(new AppError('Instructor not found in this course', 404));
  }
  
  if (instructor.role === 'primary') {
    return next(new AppError('Cannot modify primary instructor permissions', 400));
  }
  
  instructor.permissions = { ...instructor.permissions, ...permissions };
  
  await course.save();
  
  res.status(200).json({
    status: 'success',
    data: course
  });
});

// Get all instructors for a course
exports.getCourseInstructors = catchAsync(async (req, res, next) => {
  const course = await Course.findById(req.params.id)
    .populate({
      path: 'instructors.instructor',
      select: 'name email avatar'
    })
    .populate('primaryInstructor', 'name email avatar');
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      primaryInstructor: course.primaryInstructor,
      instructors: course.instructors
    }
  });
});

// ==================== INVITATION MANAGEMENT ====================

// Create instructor invitation
exports.createInvitation = catchAsync(async (req, res, next) => {
  const { email, role, permissions } = req.body;
  const courseId = req.params.id;
  
  if (role) {
    const isValidRole = await Master.validateValue('instructor_role', role);
    if (!isValidRole) {
      return next(new AppError(`Invalid instructor role: ${role}`, 400));
    }
  }
  
  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  const token = crypto.randomBytes(32).toString('hex');
  
  const invitation = await InstructorInvitation.create({
    course: courseId,
    email,
    invitedBy: req.user.id,
    token,
    role: role || 'co-instructor',
    permissions: permissions || {
      canEditCourse: false,
      canManageSections: true,
      canManageLessons: true,
      canManageStudents: false,
      canViewAnalytics: true,
      canGradeAssignments: false
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
  });
  
  res.status(201).json({
    status: 'success',
    data: invitation
  });
});

// Accept invitation
exports.acceptInvitation = catchAsync(async (req, res, next) => {
  const { token } = req.body;
  
  const invitation = await InstructorInvitation.findOne({ 
    token, 
    status: 'pending' 
  });
  
  if (!invitation) {
    return next(new AppError('Invalid or expired invitation', 400));
  }
  
  if (invitation.expiresAt < new Date()) {
    invitation.status = 'expired';
    await invitation.save();
    return next(new AppError('Invitation has expired', 400));
  }
  
  const course = await Course.findById(invitation.course);
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  const existing = course.instructors.find(
    inst => inst.instructor.toString() === req.user.id
  );
  
  if (!existing) {
    course.instructors.push({
      instructor: req.user.id,
      role: invitation.role,
      permissions: invitation.permissions,
      addedBy: invitation.invitedBy
    });
    
    await course.save();
  }
  
  invitation.status = 'accepted';
  invitation.acceptedAt = new Date();
  await invitation.save();
  
  res.status(200).json({
    status: 'success',
    message: 'Successfully joined as instructor'
  });
});

// Get all invitations for a course
exports.getCourseInvitations = catchAsync(async (req, res, next) => {
  const invitations = await InstructorInvitation.find({ 
    course: req.params.id 
  })
  .populate('invitedBy', 'name email')
  .sort('-createdAt');
  
  res.status(200).json({
    status: 'success',
    results: invitations.length,
    data: invitations
  });
});

// Revoke invitation
exports.revokeInvitation = catchAsync(async (req, res, next) => {
  const invitation = await InstructorInvitation.findById(req.params.invitationId);
  
  if (!invitation) {
    return next(new AppError('Invitation not found', 404));
  }
  
  invitation.status = 'revoked';
  invitation.revokedAt = new Date();
  invitation.revokedBy = req.user.id;
  await invitation.save();
  
  res.status(200).json({
    status: 'success',
    message: 'Invitation revoked successfully'
  });
});

// ==================== COURSE QUERIES ====================

// Get courses where user is an instructor
exports.getMyInstructorCourses = catchAsync(async (req, res, next) => {
  const courses = await Course.find({
    'instructors.instructor': req.user.id,
    'instructors.isActive': true,
    isDeleted: { $ne: true }
  })
  .populate('category', 'name slug')
  .populate('primaryInstructor', 'name email')
  .sort('-createdAt');
  
  const coursesWithRole = courses.map(course => {
    const instructorInfo = course.instructors.find(
      inst => inst.instructor.toString() === req.user.id
    );
    return {
      ...course.toObject(),
      myRole: instructorInfo?.role,
      myPermissions: instructorInfo?.permissions
    };
  });
  
  res.status(200).json({
    status: 'success',
    results: coursesWithRole.length,
    data: coursesWithRole
  });
});

// Get published courses only (for public viewing) - Updated for new Master structure
exports.getPublishedCourses = catchAsync(async (req, res, next) => {
  const { category, level, language, price, sort } = req.query;
  
  let filter = { 
    isPublished: true, 
    isApproved: true,
    isDeleted: { $ne: true }
  };
  
  if (category) filter.category = category;
  if (level) filter.level = level;
  if (language) filter.language = language;
  if (price) {
    if (price === 'free') filter.isFree = true;
    if (price === 'paid') filter.isFree = false;
  }
  
  let sortOption = '-createdAt';
  if (sort === 'price-asc') sortOption = 'price';
  if (sort === 'price-desc') sortOption = '-price';
  if (sort === 'popular') sortOption = '-totalEnrollments';
  if (sort === 'rating') sortOption = '-rating';
  
  const courses = await Course.find(filter)
    .populate('primaryInstructor', 'name email avatar')
    .populate('category', 'name slug') // Works automatically since category ref is 'Master'
    .sort(sortOption)
    .limit(parseInt(req.query.limit) || 50);
  
  // Replaced old `.getMasterValues()` with `.find()` queries for the new flat schema
  const [categories, levels, languages] = await Promise.all([
    Master.find({ type: 'course_category', isActive: true }).sort('metadata.sortOrder name'),
    Master.find({ type: 'course_level', isActive: true }).sort('metadata.sortOrder name'),
    Master.find({ type: 'language', isActive: true }).sort('metadata.sortOrder name')
  ]);
  
  res.status(200).json({
    status: 'success',
    results: courses.length,
    filters: {
      categories,
      levels,
      languages
    },
    data: courses
  });
});

exports.getCourseStructure = catchAsync(async (req, res, next) => {

  const { id } = req.params;

  let courseQuery = { isDeleted: { $ne: true } };

  if (mongoose.Types.ObjectId.isValid(id)) {
    courseQuery._id = id;
  } else {
    courseQuery.slug = id;
  }

  const course = await Course.findOne(courseQuery)
    .populate({
      path: 'instructors.instructor',
      select: 'name email avatar'
    })
    .populate('primaryInstructor', 'name email avatar')
    .populate('category', 'name slug')
    .lean();

  if (!course) {
    return next(new AppError('Course not found', 404));
  }

  const sections = await Section.find({
    course: course._id,
    isDeleted: { $ne: true }
  })
  .sort('order')
  .lean();

  const sectionsWithLessons = await Promise.all(
    sections.map(async (section) => {

      const lessons = await Lesson.find({
        section: section._id,
        isDeleted: { $ne: true }
      })
        .populate('createdBy', 'name email')
        .populate('lastModifiedBy', 'name email')
        .sort('order')
        .lean();

      return {
        ...section,
        lessons
      };
    })
  );

  res.status(200).json({
    status: 'success',
    data: {
      ...course,
      sections: sectionsWithLessons
    }
  });

});

// Get course analytics (Fixed ObjectId instantiation for newer Mongoose versions)
exports.getCourseAnalytics = catchAsync(async (req, res, next) => {
  const course = await Course.findById(req.params.id)
    .select('title totalEnrollments totalDuration totalLessons totalSections rating totalRatings totalReviews');
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  // Use `new mongoose.Types.ObjectId` to avoid strict mode errors in Mongoose 7+
  const courseObjectId = new mongoose.Types.ObjectId(req.params.id);

  const sectionStats = await Section.aggregate([
    { $match: { course: courseObjectId, isDeleted: { $ne: true } } },
    { $group: {
        _id: null,
        totalSections: { $sum: 1 },
        publishedSections: { $sum: { $cond: ['$isPublished', 1, 0] } },
        avgDuration: { $avg: '$totalDuration' }
      }
    }
  ]);
  
  const lessonStats = await Lesson.aggregate([
    { $match: { course: courseObjectId, isDeleted: { $ne: true } } },
    { $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalDuration: { $sum: '$duration' }
      }
    }
  ]);
  
  res.status(200).json({
    status: 'success',
    data: {
      course,
      sections: sectionStats[0] || { totalSections: 0, publishedSections: 0 },
      lessonsByType: lessonStats
    }
  });
});

// ==================== BULK OPERATIONS ====================

// Bulk publish courses
exports.bulkPublishCourses = catchAsync(async (req, res, next) => {
  const { ids } = req.body;
  
  if (!Array.isArray(ids)) {
    return next(new AppError('ids array required', 400));
  }
  
  const result = await Course.updateMany(
    { _id: { $in: ids }, isApproved: true },
    { 
      isPublished: true, 
      publishedAt: new Date(),
      updatedBy: req.user.id
    }
  );
  
  res.status(200).json({
    status: 'success',
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount
    }
  });
});

// Bulk unpublish courses
exports.bulkUnpublishCourses = catchAsync(async (req, res, next) => {
  const { ids } = req.body;
  
  if (!Array.isArray(ids)) {
    return next(new AppError('ids array required', 400));
  }
  
  const result = await Course.updateMany(
    { _id: { $in: ids } },
    { 
      isPublished: false, 
      publishedAt: null,
      updatedBy: req.user.id
    }
  );
  
  res.status(200).json({
    status: 'success',
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount
    }
  });
});

// ==================== MASTER DATA ENHANCEMENTS ====================

// Get all master data for course creation (Updated for flat schema)
exports.getCourseMasterData = catchAsync(async (req, res, next) => {
  const [categories, levels, languages, currencies, instructorRoles] = await Promise.all([
    Master.find({ type: 'course_category', isActive: true }).sort('metadata.sortOrder name'),
    Master.find({ type: 'course_level', isActive: true }).sort('metadata.sortOrder name'),
    Master.find({ type: 'language', isActive: true }).sort('metadata.sortOrder name'),
    Master.find({ type: 'currency', isActive: true }).sort('metadata.sortOrder name'),
    Master.find({ type: 'instructor_role', isActive: true }).sort('metadata.sortOrder name')
  ]);
  
  res.status(200).json({
    status: 'success',
    data: {
      categories,
      levels,
      languages,
      currencies,
      instructorRoles
    }
  });
});

// ==================== STANDARD CRUD OPERATIONS ====================

exports.getCourseSmart = catchAsync(async (req, res, next) => {
  const { id } = req.params; 

  const isMongoId = mongoose.Types.ObjectId.isValid(id) && (String(new mongoose.Types.ObjectId(id)) === id);
  
  const query = isMongoId ? { _id: id } : { slug: id };
  query.isDeleted = false; 

  const course = await Course.findOne(query)
    .populate('category', 'name slug')
    .populate('primaryInstructor', 'firstName lastName profilePicture bio totalStudents totalReviews')
    .populate('instructors.instructor', 'firstName lastName profilePicture bio')
    .lean(); 

  if (!course) {
    return next(new AppError('No course found with that ID or slug', 404));
  }

  const sections = await Section.find({ 
    course: course._id, 
    isDeleted: false, 
    isPublished: true 
  }).sort('order').lean();

  const lessons = await Lesson.find({ 
    course: course._id, 
    isDeleted: false, 
    isPublished: true 
  }).sort('order').lean();

  const lessonsMap = {};
  lessons.forEach(lesson => {
    const sectionId = lesson.section.toString();
    if (!lessonsMap[sectionId]) lessonsMap[sectionId] = [];
    lessonsMap[sectionId].push(lesson);
  });

  const sectionsWithLessons = sections.map(section => ({
    ...section,
    lessons: lessonsMap[section._id.toString()] || []
  }));

  res.status(200).json({
    status: 'success',
    data: {
      course,
      sections: sectionsWithLessons
    }
  });
});

exports.getCourseQuizzes = catchAsync(async (req, res, next) => {
  const identifier = req.params.slug; // Even though the route says :slug, it might hold an ID

  // 1. Create a dynamic query based on what the frontend sent
  const query = mongoose.isValidObjectId(identifier) 
    ? { _id: identifier } 
    : { slug: identifier };

  // 2. Find the course using the smart query
  const course = await Course.findOne(query).select('_id title');

  if (!course) {
    return next(new AppError('Course not found', 404));
  }

  // 3. Fetch the quizzes using the guaranteed course._id
  const quizzes = await Quiz.find({
    course: course._id,
    isDeleted: false
  })
  .select('-questions') // Excludes the heavy questions array
  .populate('lesson', 'title order')
  .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: quizzes.length,
    data: {
      course, 
      quizzes
    }
  });
});

// exports.getCourseQuizzes = catchAsync(async (req, res, next) => {

//   // 👇 ADDED .select('_id title') to only fetch the ID and Name (title) of the course
//   const course = await Course.findOne({ slug: req.params.slug }).select('_id title');

//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }

//   const quizzes = await Quiz.find({
//     course: course._id,
//     isDeleted: false
//   })
//   .select('-questions') // Excludes the heavy questions array
//   .populate('lesson', 'title order')
//   .sort({ createdAt: -1 });
//   res.status(200).json({
//     status: 'success',
//     results: quizzes.length,
//     data: {
//       course,   // Now this will only contain { _id: '...', title: '...' }
//       quizzes
//     }
//   });

// });


exports.createCourse = factory.createOne(Course);
exports.updateCourse = factory.updateOne(Course);
exports.deleteCourse = factory.deleteOne(Course);
exports.getCourse = factory.getOne(Course, {
  populate: [
    { path: 'category', select: 'name slug code' }, 
    { path: 'primaryInstructor', select: 'firstName lastName email profilePicture' },    
    { path: 'instructors.instructor', select: 'firstName lastName email profilePicture' },
    { path: 'approvedBy', select: 'firstName lastName email' }
  ]
});
exports.getAllCourses = factory.getAll(Course, {
  searchFields: ['title', 'subtitle', 'description'],
  populate: [
    { path: 'category', select: 'name slug code' },
    { path: 'primaryInstructor', select: 'firstName lastName email profilePicture' }
  ]
});

exports.bulkCreateCourses = factory.bulkCreate(Course);
exports.bulkUpdateCourses = factory.bulkUpdate(Course);
exports.bulkDeleteCourses = factory.bulkDelete(Course);
exports.restoreCourse = factory.restoreOne(Course);
exports.countCourses = factory.count(Course);


// // controllers/courseController.js (Complete with Publish/Unpublish and Master Data)
// const { Course, Section, Lesson, InstructorInvitation, Master } = require('../models');
// const factory = require('../utils/handlerFactory');
// const catchAsync = require('../utils/catchAsync');
// const AppError = require('../utils/appError');
// const mongoose = require('mongoose');
// const crypto = require('crypto');

// // ==================== MIDDLEWARE ====================

// // Set primary instructor from logged in user
// exports.setPrimaryInstructor = (req, res, next) => {
//   if (!req.body.primaryInstructor) {
//     req.body.primaryInstructor = req.user.id;
//   }
//   next();
// };

// // Add instructors array if not present
// exports.initializeInstructors = (req, res, next) => {
//   if (!req.body.instructors && req.body.primaryInstructor) {
//     req.body.instructors = [{
//       instructor: req.body.primaryInstructor,
//       role: 'primary',
//       permissions: {
//         canEditCourse: true,
//         canManageSections: true,
//         canManageLessons: true,
//         canManageStudents: true,
//         canViewAnalytics: true,
//         canGradeAssignments: true
//       }
//     }];
//   }
//   next();
// };

// // Validate master data fields
// exports.validateMasterFields = catchAsync(async (req, res, next) => {
//   const { category, level, language, currency } = req.body;
  
//   const validationPromises = [];
  
//   if (category) {
//     validationPromises.push(
//       Master.validateValue('COURSE_CATEGORY', category).then(isValid => {
//         if (!isValid) throw new AppError(`Invalid category: ${category}`, 400);
//       })
//     );
//   }
  
//   if (level) {
//     validationPromises.push(
//       Master.validateValue('COURSE_LEVEL', level).then(isValid => {
//         if (!isValid) throw new AppError(`Invalid level: ${level}`, 400);
//       })
//     );
//   }
  
//   if (language) {
//     validationPromises.push(
//       Master.validateValue('LANGUAGE', language).then(isValid => {
//         if (!isValid) throw new AppError(`Invalid language: ${language}`, 400);
//       })
//     );
//   }
  
//   if (currency) {
//     validationPromises.push(
//       Master.validateValue('CURRENCY', currency).then(isValid => {
//         if (!isValid) throw new AppError(`Invalid currency: ${currency}`, 400);
//       })
//     );
//   }
  
//   await Promise.all(validationPromises);
//   next();
// });

// // Check if user has permission to modify course
// exports.checkCoursePermission = catchAsync(async (req, res, next) => {
//   const course = await Course.findById(req.params.id);
  
//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }
  
//   // Check if user is admin
//   if (req.user.role === 'admin') {
//     return next();
//   }
  
//   // Check if user is an instructor with edit permissions
//   const instructor = course.instructors.find(
//     inst => inst.instructor.toString() === req.user.id && inst.isActive
//   );
  
//   if (!instructor) {
//     return next(new AppError('You are not an instructor of this course', 403));
//   }
  
//   // Check specific permissions based on action
//   const action = req.method + ' ' + req.path;
//   if (action.includes('PATCH') || action.includes('PUT')) {
//     if (!instructor.permissions.canEditCourse && instructor.role !== 'primary') {
//       return next(new AppError('You do not have permission to edit this course', 403));
//     }
//   }
  
//   // Store instructor info in request for later use
//   req.instructorInfo = instructor;
  
//   next();
// });

// // Check if user can publish/unpublish
// exports.checkPublishPermission = catchAsync(async (req, res, next) => {
//   const course = await Course.findById(req.params.id);
  
//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }
  
//   // Admin can always publish/unpublish
//   if (req.user.role === 'admin') {
//     return next();
//   }
  
//   // Only primary instructor can publish/unpublish
//   const isPrimary = course.primaryInstructor.toString() === req.user.id;
  
//   if (!isPrimary) {
//     return next(new AppError('Only primary instructor can publish/unpublish courses', 403));
//   }
  
//   next();
// });

// // ==================== PUBLISH/UNPUBLISH FUNCTIONS ====================

// // Publish course
// exports.publishCourse = catchAsync(async (req, res, next) => {
//   const course = await Course.findById(req.params.id);
  
//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }
  
//   // Check if course has minimum requirements to publish
//   const sections = await Section.countDocuments({ 
//     course: course._id, 
//     isDeleted: { $ne: true },
//     isPublished: true
//   });
  
//   const lessons = await Lesson.countDocuments({ 
//     course: course._id, 
//     isDeleted: { $ne: true },
//     isPublished: true
//   });
  
//   if (sections === 0) {
//     return next(new AppError('Cannot publish course with no sections', 400));
//   }
  
//   if (lessons === 0) {
//     return next(new AppError('Cannot publish course with no lessons', 400));
//   }
  
//   // Check if course is approved (if approval required)
//   if (!course.isApproved && req.user.role !== 'admin') {
//     return next(new AppError('Course must be approved by admin before publishing', 400));
//   }
  
//   course.isPublished = true;
//   course.publishedAt = new Date();
//   course.updatedBy = req.user.id;
  
//   await course.save();
  
//   // Log activity
//   console.log(`📢 Course published: ${course.title} by ${req.user.email}`);
  
//   res.status(200).json({
//     status: 'success',
//     message: 'Course published successfully',
//     data: course
//   });
// });

// // Unpublish course
// exports.unpublishCourse = catchAsync(async (req, res, next) => {
//   const course = await Course.findByIdAndUpdate(
//     req.params.id,
//     {
//       isPublished: false,
//       publishedAt: null,
//       updatedBy: req.user.id
//     },
//     { new: true, runValidators: true }
//   );
  
//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }
  
//   // Log activity
//   console.log(`📢 Course unpublished: ${course.title} by ${req.user.email}`);
  
//   res.status(200).json({
//     status: 'success',
//     message: 'Course unpublished successfully',
//     data: course
//   });
// });

// // Toggle publish status (admin/instructor convenience)
// exports.togglePublishStatus = catchAsync(async (req, res, next) => {
//   const course = await Course.findById(req.params.id);
  
//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }
  
//   if (course.isPublished) {
//     return exports.unpublishCourse(req, res, next);
//   } else {
//     return exports.publishCourse(req, res, next);
//   }
// });

// // ==================== APPROVAL FUNCTIONS ====================

// // Approve course (admin only)
// exports.approveCourse = catchAsync(async (req, res, next) => {
//   const course = await Course.findByIdAndUpdate(
//     req.params.id,
//     {
//       isApproved: true,
//       approvedBy: req.user.id,
//       approvedAt: new Date(),
//       updatedBy: req.user.id
//     },
//     { new: true, runValidators: true }
//   );
  
//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }
  
//   // Send notification to instructor
//   console.log(`✅ Course approved: ${course.title} by admin ${req.user.email}`);
  
//   res.status(200).json({
//     status: 'success',
//     message: 'Course approved successfully',
//     data: course
//   });
// });

// // Reject course with reason (admin only)
// exports.rejectCourse = catchAsync(async (req, res, next) => {
//   const { reason } = req.body;
  
//   if (!reason) {
//     return next(new AppError('Rejection reason is required', 400));
//   }
  
//   const course = await Course.findById(req.params.id);
  
//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }
  
//   course.isApproved = false;
//   course.approvedBy = null;
//   course.approvedAt = null;
//   course.isPublished = false;
//   course.publishedAt = null;
//   course.updatedBy = req.user.id;
  
//   // Store rejection reason (you might want to add this field to schema)
//   course.rejectionReason = reason;
  
//   await course.save();
  
//   // Send notification to instructor with reason
//   console.log(`❌ Course rejected: ${course.title} by admin ${req.user.email}. Reason: ${reason}`);
  
//   res.status(200).json({
//     status: 'success',
//     message: 'Course rejected successfully',
//     data: course
//   });
// });

// // ==================== INSTRUCTOR MANAGEMENT ====================

// // Add co-instructor to course
// exports.addInstructor = catchAsync(async (req, res, next) => {
//   const { instructorId, role, permissions } = req.body;
//   const courseId = req.params.id;
  
//   // Validate instructor role against master data
//   if (role) {
//     const isValidRole = await Master.validateValue('INSTRUCTOR_ROLE', role);
//     if (!isValidRole) {
//       return next(new AppError(`Invalid instructor role: ${role}`, 400));
//     }
//   }
  
//   const course = await Course.findById(courseId);
  
//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }
  
//   // Check if instructor already exists
//   const existing = course.instructors.find(
//     inst => inst.instructor.toString() === instructorId
//   );
  
//   if (existing) {
//     return next(new AppError('Instructor already added to this course', 400));
//   }
  
//   // Add new instructor
//   course.instructors.push({
//     instructor: instructorId,
//     role: role || 'co-instructor',
//     permissions: permissions || {
//       canEditCourse: false,
//       canManageSections: true,
//       canManageLessons: true,
//       canManageStudents: false,
//       canViewAnalytics: true,
//       canGradeAssignments: false
//     },
//     addedBy: req.user.id
//   });
  
//   await course.save();
  
//   res.status(200).json({
//     status: 'success',
//     data: course
//   });
// });

// // Remove instructor from course
// exports.removeInstructor = catchAsync(async (req, res, next) => {
//   const { instructorId } = req.params;
//   const courseId = req.params.id;
  
//   const course = await Course.findById(courseId);
  
//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }
  
//   // Check if trying to remove primary instructor
//   if (course.primaryInstructor.toString() === instructorId) {
//     return next(new AppError('Cannot remove primary instructor', 400));
//   }
  
//   // Remove instructor
//   course.instructors = course.instructors.filter(
//     inst => inst.instructor.toString() !== instructorId
//   );
  
//   await course.save();
  
//   res.status(200).json({
//     status: 'success',
//     data: course
//   });
// });

// // Update instructor permissions
// exports.updateInstructorPermissions = catchAsync(async (req, res, next) => {
//   const { instructorId } = req.params;
//   const { permissions } = req.body;
//   const courseId = req.params.id;
  
//   const course = await Course.findById(courseId);
  
//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }
  
//   // Find and update instructor
//   const instructor = course.instructors.find(
//     inst => inst.instructor.toString() === instructorId
//   );
  
//   if (!instructor) {
//     return next(new AppError('Instructor not found in this course', 404));
//   }
  
//   // Don't allow modifying primary instructor permissions
//   if (instructor.role === 'primary') {
//     return next(new AppError('Cannot modify primary instructor permissions', 400));
//   }
  
//   instructor.permissions = { ...instructor.permissions, ...permissions };
  
//   await course.save();
  
//   res.status(200).json({
//     status: 'success',
//     data: course
//   });
// });

// // Get all instructors for a course
// exports.getCourseInstructors = catchAsync(async (req, res, next) => {
//   const course = await Course.findById(req.params.id)
//     .populate({
//       path: 'instructors.instructor',
//       select: 'name email avatar'
//     })
//     .populate('primaryInstructor', 'name email avatar');
  
//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       primaryInstructor: course.primaryInstructor,
//       instructors: course.instructors
//     }
//   });
// });

// // ==================== INVITATION MANAGEMENT ====================

// // Create instructor invitation
// exports.createInvitation = catchAsync(async (req, res, next) => {
//   const { email, role, permissions } = req.body;
//   const courseId = req.params.id;
  
//   // Validate role against master data
//   if (role) {
//     const isValidRole = await Master.validateValue('INSTRUCTOR_ROLE', role);
//     if (!isValidRole) {
//       return next(new AppError(`Invalid instructor role: ${role}`, 400));
//     }
//   }
  
//   // Check if user is already an instructor
//   const course = await Course.findById(courseId);
//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }
  
//   // Generate unique token
//   const token = crypto.randomBytes(32).toString('hex');
  
//   // Create invitation (expires in 7 days)
//   const invitation = await InstructorInvitation.create({
//     course: courseId,
//     email,
//     invitedBy: req.user.id,
//     token,
//     role: role || 'co-instructor',
//     permissions: permissions || {
//       canEditCourse: false,
//       canManageSections: true,
//       canManageLessons: true,
//       canManageStudents: false,
//       canViewAnalytics: true,
//       canGradeAssignments: false
//     },
//     expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
//   });
  
//   // TODO: Send email with invitation link
//   // The link would be: /api/v1/courses/${courseId}/invitations/accept?token=${token}
  
//   res.status(201).json({
//     status: 'success',
//     data: invitation
//   });
// });

// // Accept invitation
// exports.acceptInvitation = catchAsync(async (req, res, next) => {
//   const { token } = req.body;
  
//   const invitation = await InstructorInvitation.findOne({ 
//     token, 
//     status: 'pending' 
//   });
  
//   if (!invitation) {
//     return next(new AppError('Invalid or expired invitation', 400));
//   }
  
//   if (invitation.expiresAt < new Date()) {
//     invitation.status = 'expired';
//     await invitation.save();
//     return next(new AppError('Invitation has expired', 400));
//   }
  
//   // Add user as instructor to course
//   const course = await Course.findById(invitation.course);
  
//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }
  
//   // Check if user is already an instructor
//   const existing = course.instructors.find(
//     inst => inst.instructor.toString() === req.user.id
//   );
  
//   if (!existing) {
//     course.instructors.push({
//       instructor: req.user.id,
//       role: invitation.role,
//       permissions: invitation.permissions,
//       addedBy: invitation.invitedBy
//     });
    
//     await course.save();
//   }
  
//   // Update invitation
//   invitation.status = 'accepted';
//   invitation.acceptedAt = new Date();
//   await invitation.save();
  
//   res.status(200).json({
//     status: 'success',
//     message: 'Successfully joined as instructor'
//   });
// });

// // Get all invitations for a course
// exports.getCourseInvitations = catchAsync(async (req, res, next) => {
//   const invitations = await InstructorInvitation.find({ 
//     course: req.params.id 
//   })
//   .populate('invitedBy', 'name email')
//   .sort('-createdAt');
  
//   res.status(200).json({
//     status: 'success',
//     results: invitations.length,
//     data: invitations
//   });
// });

// // Revoke invitation
// exports.revokeInvitation = catchAsync(async (req, res, next) => {
//   const invitation = await InstructorInvitation.findById(req.params.invitationId);
  
//   if (!invitation) {
//     return next(new AppError('Invitation not found', 404));
//   }
  
//   invitation.status = 'revoked';
//   invitation.revokedAt = new Date();
//   invitation.revokedBy = req.user.id;
//   await invitation.save();
  
//   res.status(200).json({
//     status: 'success',
//     message: 'Invitation revoked successfully'
//   });
// });

// // ==================== COURSE QUERIES ====================

// // Get courses where user is an instructor
// exports.getMyInstructorCourses = catchAsync(async (req, res, next) => {
//   const courses = await Course.find({
//     'instructors.instructor': req.user.id,
//     'instructors.isActive': true,
//     isDeleted: { $ne: true }
//   })
//   .populate('category', 'name slug')
//   .populate('primaryInstructor', 'name email')
//   .sort('-createdAt');
  
//   // Add role information
//   const coursesWithRole = courses.map(course => {
//     const instructorInfo = course.instructors.find(
//       inst => inst.instructor.toString() === req.user.id
//     );
//     return {
//       ...course.toObject(),
//       myRole: instructorInfo?.role,
//       myPermissions: instructorInfo?.permissions
//     };
//   });
  
//   res.status(200).json({
//     status: 'success',
//     results: coursesWithRole.length,
//     data: coursesWithRole
//   });
// });

// // Get published courses only (for public viewing)
// exports.getPublishedCourses = catchAsync(async (req, res, next) => {
//   const { category, level, language, price, sort } = req.query;
  
//   let filter = { 
//     isPublished: true, 
//     isApproved: true,
//     isDeleted: { $ne: true }
//   };
  
//   if (category) filter.category = category;
//   if (level) filter.level = level;
//   if (language) filter.language = language;
//   if (price) {
//     if (price === 'free') filter.isFree = true;
//     if (price === 'paid') filter.isFree = false;
//   }
  
//   let sortOption = '-createdAt';
//   if (sort === 'price-asc') sortOption = 'price';
//   if (sort === 'price-desc') sortOption = '-price';
//   if (sort === 'popular') sortOption = '-totalEnrollments';
//   if (sort === 'rating') sortOption = '-rating';
  
//   const courses = await Course.find(filter)
//     .populate('primaryInstructor', 'name email avatar')
//     .populate('category', 'name slug')
//     .sort(sortOption)
//     .limit(parseInt(req.query.limit) || 50);
  
//   // Get additional master data for filters
//   const [categories, levels, languages] = await Promise.all([
//     Master.getMasterValues('COURSE_CATEGORY', { includeMetadata: true }),
//     Master.getMasterValues('COURSE_LEVEL'),
//     Master.getMasterValues('LANGUAGE')
//   ]);
  
//   res.status(200).json({
//     status: 'success',
//     results: courses.length,
//     filters: {
//       categories,
//       levels,
//       languages
//     },
//     data: courses
//   });
// });

// // Get full course structure with instructor info
// exports.getCourseStructure = catchAsync(async (req, res, next) => {
//   const course = await Course.findOne({ 
//     _id: req.params.id,
//     isDeleted: { $ne: true }
//   })
//   .populate({
//     path: 'instructors.instructor',
//     select: 'name email avatar'
//   })
//   .populate('primaryInstructor', 'name email avatar')
//   .populate('category', 'name slug')
//   .lean();
  
//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }
  
//   const sections = await Section.find({ 
//     course: course._id,
//     isDeleted: { $ne: true }
//   })
//   .sort('order')
//   .lean();
  
//   // Get lessons for each section with creator info
//   const sectionsWithLessons = await Promise.all(
//     sections.map(async (section) => {
//       const lessons = await Lesson.find({ 
//         section: section._id,
//         isDeleted: { $ne: true }
//       })
//       .populate('createdBy', 'name email')
//       .populate('lastModifiedBy', 'name email')
//       .sort('order')
//       .lean();
      
//       return {
//         ...section,
//         lessons
//       };
//     })
//   );
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       ...course,
//       sections: sectionsWithLessons
//     }
//   });
// });

// // Get course analytics
// exports.getCourseAnalytics = catchAsync(async (req, res, next) => {
//   const course = await Course.findById(req.params.id)
//     .select('title totalEnrollments totalDuration totalLessons totalSections rating totalRatings totalReviews');
  
//   if (!course) {
//     return next(new AppError('Course not found', 404));
//   }
  
//   // Get section and lesson stats
//   const sectionStats = await Section.aggregate([
//     { $match: { course: mongoose.Types.ObjectId(req.params.id), isDeleted: { $ne: true } } },
//     { $group: {
//         _id: null,
//         totalSections: { $sum: 1 },
//         publishedSections: { $sum: { $cond: ['$isPublished', 1, 0] } },
//         avgDuration: { $avg: '$totalDuration' }
//       }
//     }
//   ]);
  
//   const lessonStats = await Lesson.aggregate([
//     { $match: { course: mongoose.Types.ObjectId(req.params.id), isDeleted: { $ne: true } } },
//     { $group: {
//         _id: '$type',
//         count: { $sum: 1 },
//         totalDuration: { $sum: '$duration' }
//       }
//     }
//   ]);
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       course,
//       sections: sectionStats[0] || { totalSections: 0, publishedSections: 0 },
//       lessonsByType: lessonStats
//     }
//   });
// });

// // ==================== BULK OPERATIONS ====================

// // Bulk publish courses
// exports.bulkPublishCourses = catchAsync(async (req, res, next) => {
//   const { ids } = req.body;
  
//   if (!Array.isArray(ids)) {
//     return next(new AppError('ids array required', 400));
//   }
  
//   const result = await Course.updateMany(
//     { _id: { $in: ids }, isApproved: true },
//     { 
//       isPublished: true, 
//       publishedAt: new Date(),
//       updatedBy: req.user.id
//     }
//   );
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       matched: result.matchedCount,
//       modified: result.modifiedCount
//     }
//   });
// });

// // Bulk unpublish courses
// exports.bulkUnpublishCourses = catchAsync(async (req, res, next) => {
//   const { ids } = req.body;
  
//   if (!Array.isArray(ids)) {
//     return next(new AppError('ids array required', 400));
//   }
  
//   const result = await Course.updateMany(
//     { _id: { $in: ids } },
//     { 
//       isPublished: false, 
//       publishedAt: null,
//       updatedBy: req.user.id
//     }
//   );
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       matched: result.matchedCount,
//       modified: result.modifiedCount
//     }
//   });
// });

// // ==================== MASTER DATA ENHANCEMENTS ====================

// // Get all master data for course creation
// exports.getCourseMasterData = catchAsync(async (req, res, next) => {
//   const [categories, levels, languages, currencies, instructorRoles] = await Promise.all([
//     Master.getMasterValues('COURSE_CATEGORY', { includeMetadata: true }),
//     Master.getMasterValues('COURSE_LEVEL', { includeMetadata: true }),
//     Master.getMasterValues('LANGUAGE', { includeMetadata: true }),
//     Master.getMasterValues('CURRENCY', { includeMetadata: true }),
//     Master.getMasterValues('INSTRUCTOR_ROLE', { includeMetadata: true })
//   ]);
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       categories,
//       levels,
//       languages,
//       currencies,
//       instructorRoles
//     }
//   });
// });

// // ==================== STANDARD CRUD OPERATIONS ====================
// /* =======================================================
//   SMART GET COURSE (Handles both ID and Slug)
// ======================================================= */
// exports.getCourseSmart = catchAsync(async (req, res, next) => {
//   const { id } = req.params; // We extract 'id' because your route is defined as /slug/:id

//   // 1. Detect if the parameter is a MongoDB ObjectId or a text Slug
//   const isMongoId = mongoose.Types.ObjectId.isValid(id) && (String(new mongoose.Types.ObjectId(id)) === id);
  
//   // 2. Dynamically build the query
//   const query = isMongoId ? { _id: id } : { slug: id };
//   query.isDeleted = false; // Never return deleted courses

//   // 3. Fetch the course and populate relations
//   const course = await Course.findOne(query)
//     .populate('category', 'name slug')
//     // ✅ FIX 1: Populate the primary instructor
//     .populate('primaryInstructor', 'firstName lastName profilePicture bio totalStudents totalReviews')
//     // ✅ FIX 2 (Optional but recommended): Populate the co-instructors array
//     .populate('instructors.instructor', 'firstName lastName profilePicture bio')
//     .lean(); // Use .lean() for faster read-only execution

//   // 4. Handle 404
//   if (!course) {
//     return next(new AppError('No course found with that ID or slug', 404));
//   }

//   // 5. Fetch the Curriculum Tree (Sections and Lessons)
//   const sections = await Section.find({ 
//     course: course._id, 
//     isDeleted: false, 
//     isPublished: true 
//   }).sort('order').lean();

//   const lessons = await Lesson.find({ 
//     course: course._id, 
//     isDeleted: false, 
//     isPublished: true 
//   }).sort('order').lean();

//   // 6. Group lessons to their parent sections using safe .toString() mapping
//   const lessonsMap = {};
//   lessons.forEach(lesson => {
//     const sectionId = lesson.section.toString();
//     if (!lessonsMap[sectionId]) lessonsMap[sectionId] = [];
//     lessonsMap[sectionId].push(lesson);
//   });

//   const sectionsWithLessons = sections.map(section => ({
//     ...section,
//     lessons: lessonsMap[section._id.toString()] || []
//   }));

//   // 7. Send the consolidated response
//   res.status(200).json({
//     status: 'success',
//     data: {
//       course,
//       sections: sectionsWithLessons
//     }
//   });
// });

// exports.createCourse = factory.createOne(Course);
// exports.updateCourse = factory.updateOne(Course);
// exports.deleteCourse = factory.deleteOne(Course);
// exports.getCourse = factory.getOne(Course, {
//   populate: [
//     { path: 'category', select: 'name slug' },
//     { path: 'primaryInstructor', select: 'name email avatar' },
//     { 
//       path: 'instructors.instructor', 
//       select: 'name email avatar' 
//     },
//     { path: 'approvedBy', select: 'name email' }
//   ]
// });

// exports.getAllCourses = factory.getAll(Course, {
//   searchFields: ['title', 'subtitle', 'description'],
//   populate: [
//     { path: 'category', select: 'name slug' },
//     { path: 'primaryInstructor', select: 'name email' }
//   ]
// });

// exports.bulkCreateCourses = factory.bulkCreate(Course);
// exports.bulkUpdateCourses = factory.bulkUpdate(Course);
// exports.bulkDeleteCourses = factory.bulkDelete(Course);
// exports.restoreCourse = factory.restoreOne(Course);
// exports.countCourses = factory.count(Course);
