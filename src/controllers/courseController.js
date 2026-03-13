// controllers/courseController.js (Complete with Publish/Unpublish and Master Data)
const { Course, Section, Lesson, InstructorInvitation, Master } = require('../models');
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
  const { category, level, language, currency } = req.body;
  
  const validationPromises = [];
  
  if (category) {
    validationPromises.push(
      Master.validateValue('COURSE_CATEGORY', category).then(isValid => {
        if (!isValid) throw new AppError(`Invalid category: ${category}`, 400);
      })
    );
  }
  
  if (level) {
    validationPromises.push(
      Master.validateValue('COURSE_LEVEL', level).then(isValid => {
        if (!isValid) throw new AppError(`Invalid level: ${level}`, 400);
      })
    );
  }
  
  if (language) {
    validationPromises.push(
      Master.validateValue('LANGUAGE', language).then(isValid => {
        if (!isValid) throw new AppError(`Invalid language: ${language}`, 400);
      })
    );
  }
  
  if (currency) {
    validationPromises.push(
      Master.validateValue('CURRENCY', currency).then(isValid => {
        if (!isValid) throw new AppError(`Invalid currency: ${currency}`, 400);
      })
    );
  }
  
  await Promise.all(validationPromises);
  next();
});

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
  
  // Log activity
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
  
  // Log activity
  console.log(`📢 Course unpublished: ${course.title} by ${req.user.email}`);
  
  res.status(200).json({
    status: 'success',
    message: 'Course unpublished successfully',
    data: course
  });
});

// Toggle publish status (admin/instructor convenience)
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
  
  // Send notification to instructor
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
  
  // Store rejection reason (you might want to add this field to schema)
  course.rejectionReason = reason;
  
  await course.save();
  
  // Send notification to instructor with reason
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
  
  // Validate instructor role against master data
  if (role) {
    const isValidRole = await Master.validateValue('INSTRUCTOR_ROLE', role);
    if (!isValidRole) {
      return next(new AppError(`Invalid instructor role: ${role}`, 400));
    }
  }
  
  const course = await Course.findById(courseId);
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  // Check if instructor already exists
  const existing = course.instructors.find(
    inst => inst.instructor.toString() === instructorId
  );
  
  if (existing) {
    return next(new AppError('Instructor already added to this course', 400));
  }
  
  // Add new instructor
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
  
  // Check if trying to remove primary instructor
  if (course.primaryInstructor.toString() === instructorId) {
    return next(new AppError('Cannot remove primary instructor', 400));
  }
  
  // Remove instructor
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
  
  // Find and update instructor
  const instructor = course.instructors.find(
    inst => inst.instructor.toString() === instructorId
  );
  
  if (!instructor) {
    return next(new AppError('Instructor not found in this course', 404));
  }
  
  // Don't allow modifying primary instructor permissions
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
  
  // Validate role against master data
  if (role) {
    const isValidRole = await Master.validateValue('INSTRUCTOR_ROLE', role);
    if (!isValidRole) {
      return next(new AppError(`Invalid instructor role: ${role}`, 400));
    }
  }
  
  // Check if user is already an instructor
  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  // Generate unique token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Create invitation (expires in 7 days)
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
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
  
  // TODO: Send email with invitation link
  // The link would be: /api/v1/courses/${courseId}/invitations/accept?token=${token}
  
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
  
  // Add user as instructor to course
  const course = await Course.findById(invitation.course);
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  // Check if user is already an instructor
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
  
  // Update invitation
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
  
  // Add role information
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

// Get published courses only (for public viewing)
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
    .populate('category', 'name slug')
    .sort(sortOption)
    .limit(parseInt(req.query.limit) || 50);
  
  // Get additional master data for filters
  const [categories, levels, languages] = await Promise.all([
    Master.getMasterValues('COURSE_CATEGORY', { includeMetadata: true }),
    Master.getMasterValues('COURSE_LEVEL'),
    Master.getMasterValues('LANGUAGE')
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

// Get full course structure with instructor info
exports.getCourseStructure = catchAsync(async (req, res, next) => {
  const course = await Course.findOne({ 
    _id: req.params.id,
    isDeleted: { $ne: true }
  })
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
  
  // Get lessons for each section with creator info
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

// Get course analytics
exports.getCourseAnalytics = catchAsync(async (req, res, next) => {
  const course = await Course.findById(req.params.id)
    .select('title totalEnrollments totalDuration totalLessons totalSections rating totalRatings totalReviews');
  
  if (!course) {
    return next(new AppError('Course not found', 404));
  }
  
  // Get section and lesson stats
  const sectionStats = await Section.aggregate([
    { $match: { course: mongoose.Types.ObjectId(req.params.id), isDeleted: { $ne: true } } },
    { $group: {
        _id: null,
        totalSections: { $sum: 1 },
        publishedSections: { $sum: { $cond: ['$isPublished', 1, 0] } },
        avgDuration: { $avg: '$totalDuration' }
      }
    }
  ]);
  
  const lessonStats = await Lesson.aggregate([
    { $match: { course: mongoose.Types.ObjectId(req.params.id), isDeleted: { $ne: true } } },
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

// Get all master data for course creation
exports.getCourseMasterData = catchAsync(async (req, res, next) => {
  const [categories, levels, languages, currencies, instructorRoles] = await Promise.all([
    Master.getMasterValues('COURSE_CATEGORY', { includeMetadata: true }),
    Master.getMasterValues('COURSE_LEVEL', { includeMetadata: true }),
    Master.getMasterValues('LANGUAGE', { includeMetadata: true }),
    Master.getMasterValues('CURRENCY', { includeMetadata: true }),
    Master.getMasterValues('INSTRUCTOR_ROLE', { includeMetadata: true })
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

exports.createCourse = factory.createOne(Course);
exports.updateCourse = factory.updateOne(Course);
exports.deleteCourse = factory.deleteOne(Course);
exports.getCourse = factory.getOne(Course, {
  populate: [
    { path: 'category', select: 'name slug' },
    { path: 'primaryInstructor', select: 'name email avatar' },
    { 
      path: 'instructors.instructor', 
      select: 'name email avatar' 
    },
    { path: 'approvedBy', select: 'name email' }
  ]
});

exports.getAllCourses = factory.getAll(Course, {
  searchFields: ['title', 'subtitle', 'description'],
  populate: [
    { path: 'category', select: 'name slug' },
    { path: 'primaryInstructor', select: 'name email' }
  ]
});

exports.bulkCreateCourses = factory.bulkCreate(Course);
exports.bulkUpdateCourses = factory.bulkUpdate(Course);
exports.bulkDeleteCourses = factory.bulkDelete(Course);
exports.restoreCourse = factory.restoreOne(Course);
exports.countCourses = factory.count(Course);

// // controllers/courseController.js (Updated)
// const { Course, Section, Lesson, InstructorInvitation } = require('../models');
// const factory = require('../utils/handlerFactory');
// const catchAsync = require('../utils/catchAsync');
// const AppError = require('../utils/appError');
// const mongoose = require('mongoose');
// const crypto = require('crypto');

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

// // Add co-instructor to course
// exports.addInstructor = catchAsync(async (req, res, next) => {
//   const { instructorId, role, permissions } = req.body;
//   const courseId = req.params.id;
  
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

// // Create instructor invitation
// exports.createInvitation = catchAsync(async (req, res, next) => {
//   const { email, role, permissions } = req.body;
//   const courseId = req.params.id;
  
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

// // Get courses where user is an instructor
// exports.getMyInstructorCourses = catchAsync(async (req, res, next) => {
//   const courses = await Course.find({
//     'instructors.instructor': req.user.id,
//     'instructors.isActive': true
//   }).populate('category', 'name slug');
  
//   // Add role information
//   const coursesWithRole = courses.map(course => {
//     const instructorInfo = course.instructors.find(
//       inst => inst.instructor.toString() === req.user.id
//     );
//     return {
//       ...course.toObject(),
//       myRole: instructorInfo.role,
//       myPermissions: instructorInfo.permissions
//     };
//   });
  
//   res.status(200).json({
//     status: 'success',
//     results: coursesWithRole.length,
//     data: coursesWithRole
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
//   }).sort('order').lean();
  
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

// // Standard CRUD operations
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
//     { path: 'approvedBy', select: 'name' }
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



// // const mongoose = require('mongoose');
// // const slugify = require('slugify');
// // const jwt = require('jsonwebtoken');
// // const { promisify } = require('util');

// // const {Course,Category,Section,Lesson,Enrollment,ProgressTracking,Review,Payment} = require('../models');

// // const AppError = require('../utils/appError');
// // const catchAsync = require('../utils/catchAsync');
// // const factory = require('../utils/handlerFactory');
// // const CacheService = require('../services/cacheService');
// // const ApiFeatures = require('../utils/ApiFeatures');


// // exports.getCourseAnalytics = catchAsync(async (req, res, next) => {
// //   const { identifier } = req.params;

// //   const query = identifier.match(/^[0-9a-fA-F]{24}$/) 
// //       ? { _id: identifier } 
// //       : { slug: identifier };

// //   const course = await Course.findOne(query);

// //   if (!course) {
// //       return next(new AppError('No course found with that ID or slug', 404));
// //   }

// //   const courseId = course._id;

// //   // 2. Fetch all related data in parallel for performance
// //   // UPGRADE: Added .populate() to get the student's actual details
// //   const [enrollments, payments, reviews, progressData] = await Promise.all([
// //       Enrollment.find({ course: courseId })
// //         .populate('student', 'firstName lastName email profilePicture') 
// //         .sort('-createdAt'), // Sort so newest students are first
// //       Payment.find({ course: courseId, status: 'success' }),
// //       Review.find({ course: courseId, isApproved: true }),
// //       ProgressTracking.find({ course: courseId })
// //   ]);

// //   // 3. Calculate Financial Metrics
// //   const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  
// //   // 4. Calculate Enrollment & Engagement Metrics
// //   const totalEnrollments = enrollments.length;
// //   const activeEnrollments = enrollments.filter(e => e.isActive).length;
  
// //   // 5. Calculate Completion Rates
// //   const completedCount = progressData.filter(p => p.isCompleted).length;
// //   const completionRate = totalEnrollments > 0 
// //       ? ((completedCount / totalEnrollments) * 100).toFixed(2) 
// //       : 0;

// //   // 6. Calculate Average Progress
// //   const avgProgress = progressData.length > 0
// //       ? (progressData.reduce((acc, p) => acc + (p.progressPercentage || 0), 0) / progressData.length).toFixed(2)
// //       : 0;

// //   // 7. Aggregate Ratings
// //   const avgRating = reviews.length > 0
// //       ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
// //       : course.rating; // Fallback to course model rating

// //   // 8. Format the Student List
// //   // UPGRADE: Map through enrollments to create a clean list of students
// //   const studentList = enrollments.map(enrollment => {
// //       // Safely access student properties in case a user was deleted from the DB
// //       const student = enrollment.student || {}; 
      
// //       // Find this specific student's progress if it exists
// //       const studentProgress = progressData.find(
// //           p => p.student?.toString() === student._id?.toString()
// //       );

// //       return {
// //           id: student._id,
// //           firstName: student.firstName || 'Unknown',
// //           lastName: student.lastName || 'User',
// //           email: student.email,
// //           profilePicture: student.profilePicture,
// //           enrolledAt: enrollment.createdAt,
// //           isActive: enrollment.isActive,
// //           progressPercentage: studentProgress ? studentProgress.progressPercentage : 0,
// //           isCompleted: studentProgress ? studentProgress.isCompleted : false
// //       };
// //   });

// //   // 9. Construct Response
// //   res.status(200).json({
// //       status: 'success',
// //       data: {
// //           courseInfo: {
// //               id: course._id,
// //               title: course.title,
// //               slug: course.slug,
// //               price: course.price
// //           },
// //           stats: {
// //               revenue: {
// //                   total: totalRevenue,
// //                   currency: 'USD',
// //                   transactionCount: payments.length
// //               },
// //               enrollment: {
// //                   total: totalEnrollments,
// //                   active: activeEnrollments,
// //                   inactive: totalEnrollments - activeEnrollments
// //               },
// //               engagement: {
// //                   averageRating: parseFloat(avgRating),
// //                   totalReviews: reviews.length,
// //                   completionRate: parseFloat(completionRate),
// //                   averageProgress: parseFloat(avgProgress)
// //               }
// //           },
// //           // UPGRADE: Add the beautifully formatted student list to the response payload!
// //           students: studentList 
// //       }
// //   });
// // });

// // // exports.getCourseAnalytics = catchAsync(async (req, res, next) => {
// // //   const { identifier } = req.params;

// // //   const query = identifier.match(/^[0-9a-fA-F]{24}$/) 
// // //       ? { _id: identifier } 
// // //       : { slug: identifier };

// // //   const course = await Course.findOne(query);

// // //   if (!course) {
// // //       return next(new AppError('No course found with that ID or slug', 404));
// // //   }

// // //   const courseId = course._id;

// // //   // 2. Fetch all related data in parallel for performance
// // //   const [enrollments, payments, reviews, progressData] = await Promise.all([
// // //       Enrollment.find({ course: courseId }),
// // //       Payment.find({ course: courseId, status: 'success' }),
// // //       Review.find({ course: courseId, isApproved: true }),
// // //       ProgressTracking.find({ course: courseId })
// // //   ]);

// // //   // 3. Calculate Financial Metrics
// // //   const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  
// // //   // 4. Calculate Enrollment & Engagement Metrics
// // //   const totalEnrollments = enrollments.length;
// // //   const activeEnrollments = enrollments.filter(e => e.isActive).length;
  
// // //   // 5. Calculate Completion Rates
// // //   const completedCount = progressData.filter(p => p.isCompleted).length;
// // //   const completionRate = totalEnrollments > 0 
// // //       ? ((completedCount / totalEnrollments) * 100).toFixed(2) 
// // //       : 0;

// // //   // 6. Calculate Average Progress
// // //   const avgProgress = progressData.length > 0
// // //       ? (progressData.reduce((acc, p) => acc + (p.progressPercentage || 0), 0) / progressData.length).toFixed(2)
// // //       : 0;

// // //   // 7. Aggregate Ratings
// // //   const avgRating = reviews.length > 0
// // //       ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
// // //       : course.rating; // Fallback to course model rating

// // //   // 8. Construct Response
// // //   res.status(200).json({
// // //       status: 'success',
// // //       data: {
// // //           courseInfo: {
// // //               id: course._id,
// // //               title: course.title,
// // //               slug: course.slug,
// // //               price: course.price
// // //           },
// // //           stats: {
// // //               revenue: {
// // //                   total: totalRevenue,
// // //                   currency: 'USD', // Adjust as needed
// // //                   transactionCount: payments.length
// // //               },
// // //               enrollment: {
// // //                   total: totalEnrollments,
// // //                   active: activeEnrollments,
// // //                   inactive: totalEnrollments - activeEnrollments
// // //               },
// // //               engagement: {
// // //                   averageRating: parseFloat(avgRating),
// // //                   totalReviews: reviews.length,
// // //                   completionRate: parseFloat(completionRate),
// // //                   averageProgress: parseFloat(avgProgress)
// // //               }
// // //           }
// // //       }
// // //   });
// // // });

// // /* =========================================================
// // CREATE COURSE
// // ========================================================= */

// // exports.createCourse = catchAsync(async (req, res, next) => {

// //   req.body.instructor = req.user.id;

// //   if (req.body.title) {
// //     const baseSlug = slugify(req.body.title, { lower: true, strict: true });
// //     req.body.slug = `${baseSlug}-${Date.now().toString(36)}`;
// //   }

// //   const course = await Course.create(req.body);

// //   await CacheService.delByPattern('cache:/courses*');

// //   res.status(201).json({
// //     status: 'success',
// //     data: { course }
// //   });

// // });



// // /* =========================================================
// // TOP RATED COURSES
// // ========================================================= */

// // exports.getTopRatedCourses = catchAsync(async (req, res, next) => {

// //   const limit = Number(req.query.limit) || 8;

// //   const cacheKey = `courses:top:${limit}`;

// //   const courses = await CacheService.remember(cacheKey, 300, async () => {

// //     return Course.find({
// //       isPublished: true,
// //       isApproved: true,
// //       isDeleted: false
// //     })
// //       .sort({ rating: -1, totalEnrollments: -1 })
// //       .limit(limit)
// //       .populate('instructor', 'firstName lastName profilePicture')
// //       .select('title slug thumbnail price discountPrice rating totalRatings totalEnrollments level')
// //       .lean();

// //   });

// //   res.status(200).json({
// //     status: 'success',
// //     results: courses.length,
// //     data: { courses }
// //   });

// // });



// // /* =========================================================
// // RELATED COURSES
// // ========================================================= */

// // exports.getRelatedCourses = catchAsync(async (req, res, next) => {

// //   const cacheKey = `courses:related:${req.params.id}`;

// //   const relatedCourses = await CacheService.remember(cacheKey, 300, async () => {

// //     const course = await Course.findById(req.params.id).select('category');

// //     if (!course) throw new AppError('Course not found', 404);

// //     return Course.find({
// //       category: course.category,
// //       _id: { $ne: course._id },
// //       isPublished: true,
// //       isApproved: true,
// //       isDeleted: false
// //     })
// //       .sort({ rating: -1 })
// //       .limit(4)
// //       .select('title slug thumbnail price rating level instructor')
// //       .lean();

// //   });

// //   res.status(200).json({
// //     status: 'success',
// //     results: relatedCourses.length,
// //     data: { relatedCourses }
// //   });

// // });



// // /* =========================================================
// // CLONE COURSE (FAST BULK VERSION)
// // ========================================================= */

// // exports.cloneCourse = catchAsync(async (req, res, next) => {

// //   const originalCourse = await Course.findOne({
// //     _id: req.params.id,
// //     instructor: req.user.id
// //   }).lean();

// //   if (!originalCourse)
// //     return next(new AppError('Course not found or unauthorized', 404));

// //   delete originalCourse._id;

// //   originalCourse.title += ' (Copy)';
// //   originalCourse.slug = `${originalCourse.slug}-copy-${Date.now()}`;
// //   originalCourse.isPublished = false;
// //   originalCourse.isApproved = false;
// //   originalCourse.totalEnrollments = 0;
// //   originalCourse.rating = 0;
// //   originalCourse.totalReviews = 0;

// //   const clonedCourse = await Course.create(originalCourse);

// //   const sections = await Section.find({ course: req.params.id }).lean();
// //   const lessons = await Lesson.find({ course: req.params.id }).lean();

// //   const sectionMap = {};

// //   const clonedSections = sections.map(section => {

// //     const newId = new mongoose.Types.ObjectId();
// //     sectionMap[section._id] = newId;

// //     return {
// //       ...section,
// //       _id: newId,
// //       course: clonedCourse._id
// //     };

// //   });

// //   await Section.insertMany(clonedSections);

// //   const clonedLessons = lessons.map(lesson => ({
// //     ...lesson,
// //     _id: new mongoose.Types.ObjectId(),
// //     course: clonedCourse._id,
// //     section: sectionMap[lesson.section]
// //   }));

// //   await Lesson.insertMany(clonedLessons);

// //   await CacheService.delByPattern('courses:*');

// //   res.status(201).json({
// //     status: 'success',
// //     data: { course: clonedCourse }
// //   });

// // });



// // /* =========================================================
// // GET COURSE (OPTIMIZED)
// // ========================================================= */

// // exports.getCourse = catchAsync(async (req, res, next) => {

// //   const cacheKey = `course:${req.params.id}`;

// //   const cached = await CacheService.get(cacheKey);

// //   if (cached) {
// //     return res.status(200).json(cached);
// //   }

// //   const course = await Course.findOne({
// //     _id: req.params.id,
// //     isDeleted: false
// //   })
// //     .populate('category', 'name slug')
// //     .populate('instructor', 'firstName lastName email profilePicture bio')
// //     .lean();

// //   if (!course)
// //     return next(new AppError('Course not found', 404));

// //   const sections = await Section.find({
// //     course: course._id,
// //     isDeleted: false
// //   })
// //     .sort('order')
// //     .lean();

// //   const lessons = await Lesson.find({
// //     course: course._id,
// //     isDeleted: false
// //   })
// //     .sort('order')
// //     .lean();

// //   const lessonsMap = {};

// //   lessons.forEach(lesson => {

// //     if (!lessonsMap[lesson.section])
// //       lessonsMap[lesson.section] = [];

// //     lessonsMap[lesson.section].push(lesson);

// //   });

// //   const sectionsWithLessons = sections.map(section => ({
// //     ...section,
// //     lessons: lessonsMap[section._id] || []
// //   }));

// //   const response = {
// //     status: 'success',
// //     data: {
// //       course,
// //       sections: sectionsWithLessons
// //     }
// //   };

// //   await CacheService.set(cacheKey, response, 600);

// //   res.status(200).json(response);

// // });



// // /* =========================================================
// // GET COURSE WITH CONTENT (SALES PAGE)
// // ========================================================= */

// // exports.getCourseWithContent = catchAsync(async (req, res, next) => {

// //   const cacheKey = `course:content:${req.params.slug}`;

// //   const cached = await CacheService.get(cacheKey);

// //   if (cached) {
// //     return res.status(200).json(cached);
// //   }

// //   const course = await Course.findOne({
// //     slug: req.params.slug,
// //     isDeleted: false
// //   })
// //     .populate('category', 'name slug')
// //     .populate('instructor', 'firstName lastName profilePicture bio totalStudents totalReviews')
// //     .lean();

// //   if (!course)
// //     return next(new AppError('Course not found', 404));

// //   const sections = await Section.find({
// //     course: course._id,
// //     isDeleted: false,
// //     isPublished: true
// //   })
// //     .sort('order')
// //     .lean();

// //   const lessons = await Lesson.find({
// //     course: course._id,
// //     isDeleted: false,
// //     isPublished: true
// //   })
// //     .sort('order')
// //     .lean();

// //   const lessonsMap = {};

// //   lessons.forEach(lesson => {

// //     if (!lessonsMap[lesson.section])
// //       lessonsMap[lesson.section] = [];

// //     lessonsMap[lesson.section].push(lesson);

// //   });

// //   const sectionsWithLessons = sections.map(section => ({
// //     ...section,
// //     lessons: lessonsMap[section._id] || []
// //   }));

// //   const reviews = await Review.find({
// //     course: course._id,
// //     isApproved: true
// //   })
// //     .sort('-helpfulCount -rating')
// //     .limit(3)
// //     .populate('user', 'firstName lastName profilePicture')
// //     .lean();

// //   const response = {
// //     status: 'success',
// //     data: {
// //       course,
// //       sections: sectionsWithLessons,
// //       recentReviews: reviews
// //     }
// //   };

// //   await CacheService.set(cacheKey, response, 600);

// //   res.status(200).json(response);

// // });



// // /* =========================================================
// // UPDATE COURSE
// // ========================================================= */

// // exports.updateCourse = catchAsync(async (req, res, next) => {

// //   delete req.body.slug;

// //   const updatedDoc = await Course.findOneAndUpdate(
// //     { _id: req.params.id, instructor: req.user.id, isDeleted: false },
// //     req.body,
// //     { new: true, runValidators: true }
// //   );

// //   if (!updatedDoc)
// //     return next(new AppError('Course not found or unauthorized', 404));

// //   await CacheService.delByPattern(`course:*${req.params.id}*`);

// //   res.status(200).json({
// //     status: 'success',
// //     data: { course: updatedDoc }
// //   });

// // });

// // exports.getAllCourses = catchAsync(async (req, res, next) => {

// //   // 1. Define base filter for public, approved, and non-deleted courses
// //   const baseFilter = {
// //     isPublished: true,
// //     isApproved: true,
// //     isDeleted: { $ne: true }
// //   };

// //   const options = {
// //     searchFields: ['title', 'description', 'subtitle', 'tags'],
// //     populate: [
// //       { path: 'category', select: 'name slug' },
// //       { path: 'instructor', select: 'firstName lastName profilePicture' }
// //     ]
// //   };

// //   // 2. Initialize ApiFeatures with the correct base model and query
// //   const features = new ApiFeatures(Course.find(baseFilter), req.query)
// //     .filter()
// //     .search(options.searchFields)
// //     .sort()
// //     .limitFields();

// //   // 3. Apply pagination (either standard or cursor-based)
// //   if (req.query.cursor) {
// //     features.cursorPaginate();
// //   } else {
// //     features.paginate();
// //   }
  
// //   // 4. Add population
// //   if (options.populate) {
// //     features.populate(options.populate);
// //   }

// //   // 5. Execute query and send response
// //   const result = await features.execute(Course);

// //   res.status(200).json({
// //     status: 'success',
// //     results: result.results,
// //     pagination: result.pagination,
// //     data: result.data
// //   });
// // });
// // exports.getMyCourses = catchAsync(async (req, res, next) => {
// //   const courses = await Course.find({ instructor: req.user.id, isDeleted: false })
// //     .populate('category', 'name')
// //     .sort('-createdAt')
// //     .lean();

// //   res.status(200).json({ status: 'success', results: courses.length, data: { courses } });
// // });
// // exports.deleteCourse = factory.deleteOne(Course);

// // exports.getCourseStudents = catchAsync(async (req, res, next) => {
// //   const course = await Course.findOne({ _id: req.params.id, instructor: req.user.id });
// //   if (!course) return next(new AppError('Course not found or unauthorized', 404));

// //   const enrollments = await Enrollment.find({ course: course._id, isActive: true })
// //     .populate('student', 'firstName lastName email profilePicture')
// //     .sort('-enrolledAt');

// //   res.status(200).json({ status: 'success', results: enrollments.length, data: { students: enrollments.map(e => e.student) } });
// // });

// // exports.getInstructorCourse = catchAsync(async (req, res, next) => {
// //   // 1. Find course and verify ownership
// //   const course = await Course.findOne({ 
// //     _id: req.params.id, 
// //     instructor: req.user.id,
// //     isDeleted: false 
// //   }).lean();

// //   if (!course) {
// //     return next(new AppError('Course not found or unauthorized', 404));
// //   }

// //   // 2. Fetch all sections and lessons for this course
// //   const sections = await Section.find({ 
// //     course: course._id, 
// //     isDeleted: false 
// //   }).sort('order').lean();

// //   const lessons = await Lesson.find({ 
// //     course: course._id, 
// //     isDeleted: false 
// //   }).sort('order').lean();

// //   // 3. Group lessons by section ID safely using .toString()
// //   const lessonsMap = {};

// //   lessons.forEach(lesson => {
// //     const sectionId = lesson.section.toString(); // 👈 Safe string conversion
// //     if (!lessonsMap[sectionId]) {
// //       lessonsMap[sectionId] = [];
// //     }
// //     lessonsMap[sectionId].push(lesson);
// //   });

// //   // 4. Attach lessons to their respective sections
// //   const sectionsWithLessons = sections.map(section => ({
// //     ...section,
// //     lessons: lessonsMap[section._id.toString()] || [] // 👈 Safe string lookup
// //   }));

// //   // 5. Send the full curriculum tree back
// //   res.status(200).json({
// //     status: 'success',
// //     data: { 
// //       course,
// //       sections: sectionsWithLessons 
// //     }
// //   });
// // });

// // // exports.getInstructorCourse = catchAsync(async (req, res, next) => {
// // //   // Find course by ID and ensure the logged-in user is the instructor
// // //   const course = await Course.findOne({ 
// // //     _id: req.params.id, 
// // //     instructor: req.user.id,
// // //     isDeleted: false 
// // //   });

// // //   if (!course) {
// // //     return next(new AppError('Course not found or unauthorized', 404));
// // //   }

// // //   res.status(200).json({
// // //     status: 'success',
// // //     data: { data: course }
// // //   });
// // // });

// // // // ==========================================
// // // // STATE MANAGEMENT & FACTORY CRUD
// // // // ==========================================
// // exports.publishCourse = catchAsync(async (req, res, next) => {
// //   const course = await Course.findOneAndUpdate(
// //     { _id: req.params.id, instructor: req.user.id, isDeleted: false },
// //     { isPublished: true, publishedAt: Date.now() },
// //     { new: true, runValidators: true }
// //   );
// //   if (!course) return next(new AppError('Course not found or unauthorized', 404));
// //   res.status(200).json({ status: 'success', data: { course } });
// // });

// // exports.unpublishCourse = catchAsync(async (req, res, next) => {
// //   const course = await Course.findOneAndUpdate(
// //     { _id: req.params.id, instructor: req.user.id, isDeleted: false },
// //     { isPublished: false },
// //     { new: true, runValidators: true }
// //   );
// //   if (!course) return next(new AppError('Course not found or unauthorized', 404));
// //   res.status(200).json({ status: 'success', data: { course } });
// // });

// // exports.approveCourse = catchAsync(async (req, res, next) => {
// //   const course = await Course.findByIdAndUpdate(req.params.id, { isApproved: true, approvedBy: req.user.id, approvedAt: Date.now() }, { new: true });
// //   if (!course) return next(new AppError('No course found with that ID', 404));
// //   res.status(200).json({ status: 'success', data: { course } });
// // });

