// controllers/lessonController.js (Complete with Publish/Unpublish)
const { Lesson, Section, Course, Master } = require('../models');
const factory = require('../utils/handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');

// ==================== MIDDLEWARE ====================

// Set IDs from params
exports.setSectionCourseIds = (req, res, next) => {
  if (req.params.sectionId) {
    req.body.section = req.params.sectionId;
  }
  
  if (req.params.courseId) {
    req.body.course = req.params.courseId;
  }
  
  next();
};

// Set creator info
exports.setCreatorInfo = (req, res, next) => {
  if (!req.body.createdBy) {
    req.body.createdBy = req.user.id;
  }
  req.body.lastModifiedBy = req.user.id;
  next();
};

// Get section details and validate
exports.validateAndSetCourse = catchAsync(async (req, res, next) => {
  if (req.body.section) {
    const section = await Section.findById(req.body.section).populate('course');
    
    if (!section || section.isDeleted) {
      return next(new AppError('Section not found', 404));
    }
    
    // Set course from section
    req.body.course = section.course._id;
    
    // Store section info for later use
    req.sectionInfo = section;
  }
  
  next();
});

// Validate lesson data against master
exports.validateLessonData = catchAsync(async (req, res, next) => {
  const { type, content } = req.body;
  
  // Validate lesson type against master
  if (type) {
    const isValidType = await Master.validateValue('LESSON_TYPE', type);
    if (!isValidType) {
      return next(new AppError(`Invalid lesson type: ${type}`, 400));
    }
  }
  
  // Validate video provider if present
  if (content?.video?.provider) {
    const isValidProvider = await Master.validateValue('VIDEO_PROVIDER', content.video.provider);
    if (!isValidProvider) {
      return next(new AppError(`Invalid video provider: ${content.video.provider}`, 400));
    }
  }
  
  // Validate resource types if present
  if (req.body.resources && Array.isArray(req.body.resources)) {
    for (const resource of req.body.resources) {
      if (resource.type) {
        const isValidResourceType = await Master.validateValue('RESOURCE_TYPE', resource.type);
        if (!isValidResourceType) {
          return next(new AppError(`Invalid resource type: ${resource.type}`, 400));
        }
      }
    }
  }
  
  next();
});

// Get max order for new lesson
exports.getMaxOrder = catchAsync(async (req, res, next) => {
  if (req.method === 'POST' && !req.body.order) {
    const lastLesson = await Lesson.findOne({ 
      section: req.body.section || req.params.sectionId,
      isDeleted: { $ne: true }
    }).sort('-order');
    
    req.body.order = lastLesson ? lastLesson.order + 1 : 0;
  }
  next();
});

// Check if user has permission to modify lesson
exports.checkLessonPermission = catchAsync(async (req, res, next) => {
  const lesson = await Lesson.findById(req.params.id).populate({
    path: 'section',
    populate: {
      path: 'course',
      select: 'instructors primaryInstructor'
    }
  });
  
  if (!lesson) {
    return next(new AppError('Lesson not found', 404));
  }
  
  // Check if user is admin
  if (req.user.role === 'admin') {
    return next();
  }
  
  const course = lesson.section.course;
  
  // Find instructor info
  const instructor = course.instructors.find(
    inst => inst.instructor.toString() === req.user.id && inst.isActive
  );
  
  if (!instructor) {
    return next(new AppError('You are not an instructor of this course', 403));
  }
  
  // Check specific permissions
  if (!instructor.permissions.canManageLessons && instructor.role !== 'primary') {
    return next(new AppError('You do not have permission to manage lessons', 403));
  }
  
  next();
});

// Check if user can publish/unpublish lesson
exports.checkPublishPermission = catchAsync(async (req, res, next) => {
  const lesson = await Lesson.findById(req.params.id).populate({
    path: 'section',
    populate: {
      path: 'course',
      select: 'instructors primaryInstructor'
    }
  });
  
  if (!lesson) {
    return next(new AppError('Lesson not found', 404));
  }
  
  // Admin can always publish/unpublish
  if (req.user.role === 'admin') {
    return next();
  }
  
  const course = lesson.section.course;
  
  const instructor = course.instructors.find(
    inst => inst.instructor.toString() === req.user.id && inst.isActive
  );
  
  if (!instructor) {
    return next(new AppError('You are not an instructor of this course', 403));
  }
  
  if (!instructor.permissions.canManageLessons && instructor.role !== 'primary') {
    return next(new AppError('You do not have permission to publish lessons', 403));
  }
  
  next();
});

// ==================== PUBLISH/UNPUBLISH FUNCTIONS ====================

// Publish lesson
exports.publishLesson = catchAsync(async (req, res, next) => {
  const lesson = await Lesson.findByIdAndUpdate(
    req.params.id,
    { 
      isPublished: true,
      lastModifiedBy: req.user.id 
    },
    { new: true, runValidators: true }
  );
  
  if (!lesson) {
    return next(new AppError('Lesson not found', 404));
  }
  
  // Update section totals
  await updateSectionTotals(lesson.section);
  
  res.status(200).json({
    status: 'success',
    message: 'Lesson published successfully',
    data: lesson
  });
});

// Unpublish lesson
exports.unpublishLesson = catchAsync(async (req, res, next) => {
  const lesson = await Lesson.findByIdAndUpdate(
    req.params.id,
    { 
      isPublished: false,
      lastModifiedBy: req.user.id 
    },
    { new: true, runValidators: true }
  );
  
  if (!lesson) {
    return next(new AppError('Lesson not found', 404));
  }
  
  // Update section totals
  await updateSectionTotals(lesson.section);
  
  res.status(200).json({
    status: 'success',
    message: 'Lesson unpublished successfully',
    data: lesson
  });
});

// Toggle publish status
exports.togglePublishStatus = catchAsync(async (req, res, next) => {
  const lesson = await Lesson.findById(req.params.id);
  
  if (!lesson) {
    return next(new AppError('Lesson not found', 404));
  }
  
  if (lesson.isPublished) {
    return exports.unpublishLesson(req, res, next);
  } else {
    return exports.publishLesson(req, res, next);
  }
});

// ==================== LESSON MANAGEMENT ====================

// Create lesson with totals update
exports.createLesson = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Set creator info
    req.body.createdBy = req.user.id;
    req.body.lastModifiedBy = req.user.id;
    
    // Create the lesson
    const [lesson] = await Lesson.create([req.body], { session });
    
    // Update section totals
    await updateSectionTotals(lesson.section, session);
    
    await session.commitTransaction();
    session.endSession();
    
    // Fetch complete lesson with populated fields
    const completeLesson = await Lesson.findById(lesson._id)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email');
    
    res.status(201).json({
      status: 'success',
      data: completeLesson
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// Update lesson with totals recalculation
exports.updateLesson = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Set last modifier
    req.body.lastModifiedBy = req.user.id;
    
    const lesson = await Lesson.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true, session }
    );
    
    if (!lesson) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Lesson not found', 404));
    }
    
    // Update section totals if duration changed or section changed
    if (req.body.duration !== undefined || req.body.section) {
      await updateSectionTotals(lesson.section, session);
      
      // If section changed, also update old section
      if (req.body.section && req.body.section !== lesson.section.toString()) {
        await updateSectionTotals(req.body.section, session);
      }
    }
    
    await session.commitTransaction();
    session.endSession();
    
    // Fetch updated lesson with populated fields
    const updatedLesson = await Lesson.findById(lesson._id)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .populate('section', 'title course');
    
    res.status(200).json({
      status: 'success',
      data: updatedLesson
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// Get lessons for a specific section
exports.getSectionLessons = catchAsync(async (req, res, next) => {
  const { publishedOnly, freeOnly } = req.query;
  
  let filter = { 
    section: req.params.sectionId,
    isDeleted: { $ne: true }
  };
  
  if (publishedOnly === 'true') {
    filter.isPublished = true;
  }
  
  if (freeOnly === 'true') {
    filter.isFree = true;
  }
  
  const lessons = await Lesson.find(filter)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email')
    .sort('order');
  
  // Get lesson types from master for metadata
  const lessonTypes = await Master.getMasterMap('LESSON_TYPE');
  const resourceTypes = await Master.getMasterMap('RESOURCE_TYPE');
  
  const lessonsWithMetadata = lessons.map(lesson => ({
    ...lesson.toObject(),
    typeInfo: lessonTypes[lesson.type] || lesson.type,
    resources: lesson.resources?.map(r => ({
      ...r.toObject(),
      typeInfo: resourceTypes[r.type] || r.type
    }))
  }));
  
  res.status(200).json({
    status: 'success',
    results: lessonsWithMetadata.length,
    data: lessonsWithMetadata
  });
});

// Get free preview lessons for a course
exports.getFreeLessons = catchAsync(async (req, res, next) => {
  const lessons = await Lesson.find({ 
    course: req.params.courseId,
    isFree: true,
    isPublished: true,
    isDeleted: { $ne: true }
  })
  .populate({
    path: 'section',
    select: 'title order course'
  })
  .select('title description type duration section order')
  .sort('section order');
  
  // Group by section
  const lessonsBySection = {};
  lessons.forEach(lesson => {
    const sectionId = lesson.section._id.toString();
    if (!lessonsBySection[sectionId]) {
      lessonsBySection[sectionId] = {
        sectionId: lesson.section._id,
        sectionTitle: lesson.section.title,
        sectionOrder: lesson.section.order,
        lessons: []
      };
    }
    lessonsBySection[sectionId].lessons.push({
      id: lesson._id,
      title: lesson.title,
      description: lesson.description,
      type: lesson.type,
      duration: lesson.duration,
      order: lesson.order
    });
  });
  
  res.status(200).json({
    status: 'success',
    data: Object.values(lessonsBySection)
  });
});

// Get lessons created by specific instructor
exports.getLessonsByInstructor = catchAsync(async (req, res, next) => {
  const lessons = await Lesson.find({ 
    createdBy: req.params.instructorId,
    isDeleted: { $ne: true }
  })
  .populate('course', 'title slug')
  .populate('section', 'title')
  .sort('-createdAt');
  
  res.status(200).json({
    status: 'success',
    results: lessons.length,
    data: lessons
  });
});

// Reorder lessons within a section
exports.reorderLessons = catchAsync(async (req, res, next) => {
  const { lessonOrders } = req.body; // Array of { id, order }
  const sectionId = req.params.sectionId;
  
  if (!Array.isArray(lessonOrders)) {
    return next(new AppError('lessonOrders array required', 400));
  }
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const updatePromises = lessonOrders.map(({ id, order }) => 
      Lesson.findByIdAndUpdate(id, { order, lastModifiedBy: req.user.id }, { session })
    );
    
    await Promise.all(updatePromises);
    
    // Update section's last modified time
    if (lessonOrders.length > 0) {
      await Section.findByIdAndUpdate(
        sectionId,
        { updatedAt: new Date() },
        { session }
      );
    }
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      status: 'success',
      message: 'Lessons reordered successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// Duplicate lesson
exports.duplicateLesson = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const sourceLesson = await Lesson.findById(req.params.id).session(session);
    
    if (!sourceLesson) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Lesson not found', 404));
    }
    
    // Get max order for new lesson
    const lastLesson = await Lesson.findOne({ 
      section: sourceLesson.section,
      isDeleted: { $ne: true }
    }).sort('-order').session(session);
    
    const newOrder = lastLesson ? lastLesson.order + 1 : sourceLesson.order + 1;
    
    // Create duplicate lesson
    const [newLesson] = await Lesson.create([{
      section: sourceLesson.section,
      course: sourceLesson.course,
      title: `${sourceLesson.title} (Copy)`,
      description: sourceLesson.description,
      type: sourceLesson.type,
      content: sourceLesson.content,
      order: newOrder,
      duration: sourceLesson.duration,
      isFree: sourceLesson.isFree,
      isPublished: false, // Default to unpublished
      resources: sourceLesson.resources,
      createdBy: req.user.id,
      lastModifiedBy: req.user.id
    }], { session });
    
    // Update section totals
    await updateSectionTotals(sourceLesson.section, session);
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(201).json({
      status: 'success',
      message: 'Lesson duplicated successfully',
      data: newLesson
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// ==================== BULK OPERATIONS ====================

// Bulk publish lessons
exports.bulkPublishLessons = catchAsync(async (req, res, next) => {
  const { ids } = req.body;
  const sectionId = req.params.sectionId;
  
  if (!Array.isArray(ids)) {
    return next(new AppError('ids array required', 400));
  }
  
  const result = await Lesson.updateMany(
    { _id: { $in: ids }, section: sectionId },
    { 
      isPublished: true,
      lastModifiedBy: req.user.id 
    }
  );
  
  // Update section totals
  if (result.modifiedCount > 0) {
    await updateSectionTotals(sectionId);
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount
    }
  });
});

// Bulk unpublish lessons
exports.bulkUnpublishLessons = catchAsync(async (req, res, next) => {
  const { ids } = req.body;
  const sectionId = req.params.sectionId;
  
  if (!Array.isArray(ids)) {
    return next(new AppError('ids array required', 400));
  }
  
  const result = await Lesson.updateMany(
    { _id: { $in: ids }, section: sectionId },
    { 
      isPublished: false,
      lastModifiedBy: req.user.id 
    }
  );
  
  // Update section totals
  if (result.modifiedCount > 0) {
    await updateSectionTotals(sectionId);
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount
    }
  });
});

// Bulk update lesson durations
exports.bulkUpdateDurations = catchAsync(async (req, res, next) => {
  const { updates } = req.body; // Array of { id, duration }
  const sectionId = req.params.sectionId;
  
  if (!Array.isArray(updates)) {
    return next(new AppError('updates array required', 400));
  }
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const updatePromises = updates.map(({ id, duration }) => 
      Lesson.findByIdAndUpdate(
        id, 
        { 
          duration,
          lastModifiedBy: req.user.id 
        }, 
        { session }
      )
    );
    
    await Promise.all(updatePromises);
    
    // Update section totals
    await updateSectionTotals(sectionId, session);
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      status: 'success',
      message: 'Durations updated successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// ==================== DELETE/RESTORE ====================

// Delete lesson
exports.deleteLesson = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const lesson = await Lesson.findOneAndUpdate(
      { _id: req.params.id },
      { 
        isDeleted: true, 
        deletedAt: new Date(),
        deletedBy: req.user.id 
      },
      { new: true, session }
    );
    
    if (!lesson) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Lesson not found', 404));
    }
    
    // Update section totals
    await updateSectionTotals(lesson.section, session);
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// Restore lesson
exports.restoreLesson = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const lesson = await Lesson.findOneAndUpdate(
      { _id: req.params.id, isDeleted: true },
      { 
        isDeleted: false, 
        deletedAt: null,
        deletedBy: null
      },
      { new: true, session }
    );
    
    if (!lesson) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('No deleted lesson found', 404));
    }
    
    // Update section totals
    await updateSectionTotals(lesson.section, session);
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      status: 'success',
      data: lesson
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// ==================== HELPER FUNCTIONS ====================

// Update section totals
async function updateSectionTotals(sectionId, session) {
  const result = await Lesson.aggregate([
    { $match: { 
        section: new mongoose.Types.ObjectId(sectionId), 
        isDeleted: { $ne: true } 
      } 
    },
    { $group: { 
        _id: null,
        totalLessons: { $sum: 1 },
        totalDuration: { $sum: '$duration' },
        publishedLessons: { $sum: { $cond: ['$isPublished', 1, 0] } },
        freeLessons: { $sum: { $cond: ['$isFree', 1, 0] } }
      } 
    }
  ]).session(session);
  
  const totals = result[0] || { 
    totalLessons: 0, 
    totalDuration: 0,
    publishedLessons: 0,
    freeLessons: 0 
  };
  
  const section = await Section.findByIdAndUpdate(
    sectionId,
    {
      totalLessons: totals.totalLessons,
      totalDuration: totals.totalDuration
    },
    { new: true, session }
  ).populate('course');
  
  // Update course totals
  if (section && section.course) {
    await updateCourseTotals(section.course._id, session);
  }
}

// Update course totals
async function updateCourseTotals(courseId, session) {
  const result = await Section.aggregate([
    { $match: { 
        course: new mongoose.Types.ObjectId(courseId), 
        isDeleted: { $ne: true } 
      } 
    },
    { $group: { 
        _id: null,
        totalSections: { $sum: 1 },
        totalDuration: { $sum: '$totalDuration' },
        totalLessons: { $sum: '$totalLessons' }
      } 
    }
  ]).session(session);
  
  const totals = result[0] || { totalSections: 0, totalDuration: 0, totalLessons: 0 };
  
  await Course.findByIdAndUpdate(
    courseId,
    {
      totalSections: totals.totalSections,
      totalDuration: totals.totalDuration,
      totalLessons: totals.totalLessons
    },
    { session }
  );
}

// ==================== STANDARD CRUD OPERATIONS ====================

exports.getLesson = factory.getOne(Lesson, {
  populate: [
    { path: 'section', select: 'title course' },
    { path: 'course', select: 'title slug' },
    { path: 'createdBy', select: 'name email' },
    { path: 'lastModifiedBy', select: 'name email' }
  ]
});

exports.getAllLessons = factory.getAll(Lesson, {
  searchFields: ['title', 'description'],
  populate: [
    { path: 'section', select: 'title' },
    { path: 'course', select: 'title slug' }
  ]
});

exports.bulkCreateLessons = factory.bulkCreate(Lesson);
exports.bulkUpdateLessons = factory.bulkUpdate(Lesson);
exports.bulkDeleteLessons = factory.bulkDelete(Lesson);
exports.countLessons = factory.count(Lesson);








// const { Lesson, Section, Course, Enrollment, ProgressTracking } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');

// // ==========================================
// // HELPERS
// // ==========================================

// exports.setSectionCourseIds = (req, res, next) => {
//   if (!req.body.section) req.body.section = req.params.sectionId;
//   if (!req.body.course) req.body.course = req.params.courseId;

//   if (!req.query.section && req.params.sectionId) {
//     req.query.section = req.params.sectionId;
//   }
  
//   if (!req.filter) req.filter = {};
//   if (req.params.sectionId) req.filter.section = req.params.sectionId;
//   next();
// };

// const verifyLessonOwnership = async (sectionId, userId, role) => {
//   const section = await Section.findById(sectionId).populate('course', 'instructor');
//   if (!section || !section.course) throw new AppError('Parent section or course not found', 404);

//   if (section.course.instructor.toString() !== userId && role !== 'admin') {
//     throw new AppError('You are not authorized to modify lessons in this course', 403);
//   }
//   return section;
// };

// const recalculateTotals = async (courseId, sectionId) => {
//   const sectionStats = await Lesson.aggregate([
//     { $match: { section: sectionId, isDeleted: false } },
//     { $group: { _id: '$section', totalDuration: { $sum: '$duration' }, totalLessons: { $sum: 1 } } }
//   ]);

//   if (sectionStats.length > 0) {
//     await Section.findByIdAndUpdate(sectionId, {
//       totalDuration: sectionStats[0].totalDuration,
//       totalLessons: sectionStats[0].totalLessons
//     });
//   } else {
//     await Section.findByIdAndUpdate(sectionId, { totalDuration: 0, totalLessons: 0 });
//   }

//   const courseStats = await Section.aggregate([
//     { $match: { course: courseId, isDeleted: false } },
//     { $group: { _id: '$course', totalDuration: { $sum: '$totalDuration' }, totalLessons: { $sum: '$totalLessons' } } }
//   ]);

//   if (courseStats.length > 0) {
//     await Course.findByIdAndUpdate(courseId, {
//       totalDuration: courseStats[0].totalDuration,
//       totalLessons: courseStats[0].totalLessons
//     });
//   } else {
//     await Course.findByIdAndUpdate(courseId, { totalDuration: 0, totalLessons: 0 });
//   }
// };

// // ==========================================
// // CORE CRUD & DURATIONS
// // ==========================================

// exports.createLesson = catchAsync(async (req, res, next) => {
//   const section = await verifyLessonOwnership(req.body.section, req.user.id, req.user.role);
//   req.body.course = section.course._id;

//   const lastLesson = await Lesson.findOne({ section: req.body.section, isDeleted: false }).sort('-order');
//   req.body.order = lastLesson ? lastLesson.order + 1 : 1;

//   const lesson = await Lesson.create(req.body);
//   await recalculateTotals(section.course._id, section._id);

//   res.status(201).json({ status: 'success', data: { lesson } });
// });

// exports.updateLesson = catchAsync(async (req, res, next) => {
//   const lessonToUpdate = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
//   if (!lessonToUpdate) return next(new AppError('Lesson not found', 404));

//   const section = await verifyLessonOwnership(lessonToUpdate.section, req.user.id, req.user.role);
//   const updatedLesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

//   if (req.body.duration !== undefined) {
//     await recalculateTotals(section.course._id, section._id);
//   }

//   res.status(200).json({ status: 'success', data: { lesson: updatedLesson } });
// });

// exports.deleteLesson = catchAsync(async (req, res, next) => {
//   const lessonToDelete = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
//   if (!lessonToDelete) return next(new AppError('Lesson not found', 404));

//   const section = await verifyLessonOwnership(lessonToDelete.section, req.user.id, req.user.role);
//   await Lesson.findByIdAndUpdate(req.params.id, { isDeleted: true, isPublished: false });
//   await recalculateTotals(section.course._id, section._id);

//   res.status(200).json({ status: 'success', data: null });
// });

// // ==========================================
// // BULK REORDER
// // ==========================================

// exports.reorderLessons = catchAsync(async (req, res, next) => {
//   const { lessons } = req.body;
//   if (!Array.isArray(lessons)) return next(new AppError('Lessons array is required', 400));

//   await verifyLessonOwnership(req.params.sectionId, req.user.id, req.user.role);

//   const bulkOperations = lessons.map(les => ({
//     updateOne: {
//       filter: { _id: les.id, section: req.params.sectionId },
//       update: { $set: { order: les.order } }
//     }
//   }));

//   if (bulkOperations.length > 0) {
//     await Lesson.bulkWrite(bulkOperations);
//   }

//   res.status(200).json({ status: 'success', message: 'Lessons reordered successfully' });
// });

// // ==========================================
// // ACCESS, PROGRESS & STATE MANAGEMENT
// // ==========================================

// exports.getLessonWithDetails = catchAsync(async (req, res, next) => {
//   const lesson = await Lesson.findOne({ _id: req.params.id, isDeleted: false, isPublished: true })
//     .populate('section', 'title course')
//     .populate('content.quiz')
//     .populate('content.assignment')
//     .populate('content.codingExercise');

//   if (!lesson) return next(new AppError('No published lesson found with that ID', 404));

//   let hasAccess = false;
//   if (lesson.isFree || req.user.role === 'admin') {
//     hasAccess = true;
//   } else {
//     const course = await Course.findById(lesson.course).select('instructor');
//     if (course && course.instructor.toString() === req.user.id) {
//       hasAccess = true;
//     } else {
//       const enrollment = await Enrollment.findOne({ student: req.user.id, course: lesson.course, isActive: true });
//       hasAccess = !!enrollment;
//     }
//   }

//   if (!hasAccess) return next(new AppError('You do not have access to this premium lesson. Please enroll.', 403));
//   res.status(200).json({ status: 'success', data: { lesson } });
// });

// exports.markAsCompleted = catchAsync(async (req, res, next) => {
//   const lesson = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
//   if (!lesson) return next(new AppError('Lesson not found', 404));

//   let progress = await ProgressTracking.findOne({ student: req.user.id, course: lesson.course });

//   if (!progress) {
//     const enrollment = await Enrollment.findOne({ student: req.user.id, course: lesson.course, isActive: true });
//     if (!enrollment && !lesson.isFree) return next(new AppError('You are not enrolled in this course', 403));

//     progress = await ProgressTracking.create({ student: req.user.id, course: lesson.course, completedLessons: [] });
//   }

//   const isAlreadyCompleted = progress.completedLessons.some(cl => cl.lesson.toString() === lesson._id.toString());

//   if (!isAlreadyCompleted) {
//     progress.completedLessons.push({ lesson: lesson._id, completedAt: Date.now() });

//     const course = await Course.findById(lesson.course);
//     if (course && course.totalLessons > 0) {
//       progress.courseProgressPercentage = Math.min(100, Math.round((progress.completedLessons.length / course.totalLessons) * 100));
//       if (progress.courseProgressPercentage === 100) {
//         progress.isCompleted = true;
//         progress.completedAt = Date.now();
//       }
//     }
//     await progress.save();
//   }

//   res.status(200).json({ status: 'success', data: { lessonId: lesson._id, completed: true, courseProgressPercentage: progress.courseProgressPercentage } });
// });

// exports.getLessonProgress = catchAsync(async (req, res, next) => {
//   const lesson = await Lesson.findOne({ _id: req.params.id });
//   if (!lesson) return next(new AppError('Lesson not found', 404));

//   const progress = await ProgressTracking.findOne({ student: req.user.id, course: lesson.course });
//   const isCompleted = progress ? progress.completedLessons.some(cl => cl.lesson.toString() === lesson._id.toString()) : false;

//   res.status(200).json({ status: 'success', data: { lessonId: lesson._id, completed: isCompleted } });
// });

// exports.publishLesson = catchAsync(async (req, res, next) => {
//   const lesson = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
//   if (!lesson) return next(new AppError('Lesson not found', 404));

//   await verifyLessonOwnership(lesson.section, req.user.id, req.user.role);
//   lesson.isPublished = true;
//   await lesson.save();

//   res.status(200).json({ status: 'success', data: { lesson } });
// });

// exports.unpublishLesson = catchAsync(async (req, res, next) => {
//   const lesson = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
//   if (!lesson) return next(new AppError('Lesson not found', 404));

//   await verifyLessonOwnership(lesson.section, req.user.id, req.user.role);
//   lesson.isPublished = false;
//   await lesson.save();

//   res.status(200).json({ status: 'success', data: { lesson } });
// });

// exports.uploadVideo = catchAsync(async (req, res, next) => {
//   res.status(200).json({ status: 'success', message: 'Video upload endpoint ready' });
// });

// exports.uploadAttachment = catchAsync(async (req, res, next) => {
//   res.status(200).json({ status: 'success', message: 'Attachment upload endpoint ready' });
// });

// exports.getAllLessons = factory.getAll(Lesson);
// exports.getLesson = factory.getOne(Lesson);


// // const { Lesson, Section, Course, Enrollment, ProgressTracking } = require('../models');
// // const AppError = require('../utils/appError');
// // const catchAsync = require('../utils/catchAsync');
// // const factory = require('../utils/handlerFactory');

// // // ==========================================
// // // HELPERS
// // // ==========================================

// // exports.setSectionCourseIds = (req, res, next) => {
// //   if (!req.body.section) req.body.section = req.params.sectionId;
// //   if (!req.filter) req.filter = {};
// //   if (req.params.sectionId) req.filter.section = req.params.sectionId;
// //   next();
// // };

// // /**
// //  * Strictly verifies if the user owns the parent course of this lesson.
// //  */
// // // const verifyLessonOwnership = async (sectionId, userId, role, next) => {
// // //   const section = await Section.findById(sectionId).populate('course', 'instructor');
// // //   if (!section || !section.course) return next(new AppError('Parent section or course not found', 404));
  
// // //   if (section.course.instructor.toString() !== userId && role !== 'admin') {
// // //     return next(new AppError('You are not authorized to modify lessons in this course', 403));
// // //   }
// // //   return section;
// // // };
// // const verifyLessonOwnership = async (sectionId, userId, role) => {
// //   const section = await Section.findById(sectionId).populate('course', 'instructor');
// //   if (!section || !section.course) throw new AppError('Parent section or course not found', 404);

// //   if (section.course.instructor.toString() !== userId && role !== 'admin') {
// //     throw new AppError('You are not authorized to modify lessons in this course', 403);
// //   }
// //   return section;
// // };
// // /**
// //  * PRO FEATURE: Recalculates total duration and lesson count dynamically
// //  * This fixes the "Ghost Duration" bug caused by updates and deletes.
// //  */
// // const recalculateTotals = async (courseId, sectionId) => {
// //   // 1. Calculate Section Totals
// //   const sectionStats = await Lesson.aggregate([
// //     { $match: { section: sectionId, isDeleted: false } },
// //     { $group: { _id: '$section', totalDuration: { $sum: '$duration' }, totalLessons: { $sum: 1 } } }
// //   ]);

// //   if (sectionStats.length > 0) {
// //     await Section.findByIdAndUpdate(sectionId, {
// //       totalDuration: sectionStats[0].totalDuration,
// //       totalLessons: sectionStats[0].totalLessons
// //     });
// //   } else {
// //     await Section.findByIdAndUpdate(sectionId, { totalDuration: 0, totalLessons: 0 });
// //   }

// //   // 2. Calculate Course Totals
// //   const courseStats = await Section.aggregate([
// //     { $match: { course: courseId, isDeleted: false } },
// //     { $group: { _id: '$course', totalDuration: { $sum: '$totalDuration' }, totalLessons: { $sum: '$totalLessons' } } }
// //   ]);

// //   if (courseStats.length > 0) {
// //     await Course.findByIdAndUpdate(courseId, {
// //       totalDuration: courseStats[0].totalDuration,
// //       totalLessons: courseStats[0].totalLessons
// //     });
// //   } else {
// //     await Course.findByIdAndUpdate(courseId, { totalDuration: 0, totalLessons: 0 });
// //   }
// // };

// // // ==========================================
// // // CORE CRUD & DURATIONS
// // // ==========================================

// // exports.createLesson = catchAsync(async (req, res, next) => {
// //   const section = await verifyLessonOwnership(req.body.section, req.user.id, req.user.role, next);
  
// //   req.body.course = section.course._id;

// //   const lastLesson = await Lesson.findOne({ section: req.body.section, isDeleted: false }).sort('-order');
// //   req.body.order = lastLesson ? lastLesson.order + 1 : 1;

// //   const lesson = await Lesson.create(req.body);

// //   // Sync totals
// //   await recalculateTotals(section.course._id, section._id);

// //   res.status(201).json({ status: 'success', data: { lesson } });
// // });

// // exports.updateLesson = catchAsync(async (req, res, next) => {
// //   const lessonToUpdate = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
// //   if (!lessonToUpdate) return next(new AppError('Lesson not found', 404));

// //   const section = await verifyLessonOwnership(lessonToUpdate.section, req.user.id, req.user.role, next);

// //   const updatedLesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

// //   // Sync totals if duration changed
// //   if (req.body.duration !== undefined) {
// //     await recalculateTotals(section.course._id, section._id);
// //   }

// //   res.status(200).json({ status: 'success', data: { lesson: updatedLesson } });
// // });

// // exports.deleteLesson = catchAsync(async (req, res, next) => {
// //   const lessonToDelete = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
// //   if (!lessonToDelete) return next(new AppError('Lesson not found', 404));

// //   const section = await verifyLessonOwnership(lessonToDelete.section, req.user.id, req.user.role, next);

// //   await Lesson.findByIdAndUpdate(req.params.id, { isDeleted: true, isPublished: false });

// //   // Sync totals
// //   await recalculateTotals(section.course._id, section._id);

// //   res.status(200).json({ status: 'success', data: null });
// // });

// // // ==========================================
// // // BULK REORDER
// // // ==========================================
// // exports.reorderLessons = catchAsync(async (req, res, next) => {
// //   const { lessons } = req.body;
// //   if (!Array.isArray(lessons)) return next(new AppError('Lessons array is required', 400));

// //   await verifyLessonOwnership(req.params.sectionId, req.user.id, req.user.role, next);

// //   const bulkOperations = lessons.map(les => ({
// //     updateOne: {
// //       filter: { _id: les.id, section: req.params.sectionId },
// //       update: { $set: { order: les.order } }
// //     }
// //   }));

// //   if (bulkOperations.length > 0) {
// //     await Lesson.bulkWrite(bulkOperations);
// //   }

// //   res.status(200).json({ status: 'success', message: 'Lessons reordered successfully' });
// // });

// // // ==========================================
// // // ACCESS & PAYWALL
// // // ==========================================

// // exports.getLessonWithDetails = catchAsync(async (req, res, next) => {
// //   const lesson = await Lesson.findOne({ _id: req.params.id, isDeleted: false, isPublished: true })
// //     .populate('section', 'title course')
// //     .populate('content.quiz')
// //     .populate('content.assignment')
// //     .populate('content.codingExercise');

// //   if (!lesson) return next(new AppError('No published lesson found with that ID', 404));

// //   // Determine Access
// //   let hasAccess = false;
// //   if (lesson.isFree) {
// //     hasAccess = true;
// //   } else if (req.user.role === 'admin') {
// //     hasAccess = true;
// //   } else {
// //     const course = await Course.findById(lesson.course).select('instructor');
// //     if (course && course.instructor.toString() === req.user.id) {
// //       hasAccess = true; // Instructor owns it
// //     } else {
// //       const enrollment = await Enrollment.findOne({ student: req.user.id, course: lesson.course, isActive: true });
// //       hasAccess = !!enrollment; // Enrolled student
// //     }
// //   }

// //   if (!hasAccess) return next(new AppError('You do not have access to this premium lesson. Please enroll.', 403));

// //   res.status(200).json({ status: 'success', data: { lesson } });
// // });

// // // ==========================================
// // // STUDENT PROGRESS
// // // ==========================================

// // exports.markAsCompleted = catchAsync(async (req, res, next) => {
// //   const lesson = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
// //   if (!lesson) return next(new AppError('Lesson not found', 404));

// //   // Find or create progress tracking document
// //   let progress = await ProgressTracking.findOne({ student: req.user.id, course: lesson.course });
  
// //   if (!progress) {
// //     // Check if enrolled before creating progress
// //     const enrollment = await Enrollment.findOne({ student: req.user.id, course: lesson.course, isActive: true });
// //     if (!enrollment && !lesson.isFree) return next(new AppError('You are not enrolled in this course', 403));

// //     progress = await ProgressTracking.create({
// //       student: req.user.id,
// //       course: lesson.course,
// //       completedLessons: []
// //     });
// //   }

// //   // Check if already completed
// //   const isAlreadyCompleted = progress.completedLessons.some(cl => cl.lesson.toString() === lesson._id.toString());
  
// //   if (!isAlreadyCompleted) {
// //     progress.completedLessons.push({ lesson: lesson._id, completedAt: Date.now() });
    
// //     // Recalculate percentage
// //     const course = await Course.findById(lesson.course);
// //     if (course && course.totalLessons > 0) {
// //       progress.courseProgressPercentage = Math.min(100, Math.round((progress.completedLessons.length / course.totalLessons) * 100));
      
// //       if (progress.courseProgressPercentage === 100) {
// //         progress.isCompleted = true;
// //         progress.completedAt = Date.now();
// //       }
// //     }
    
// //     await progress.save();
// //   }

// //   res.status(200).json({
// //     status: 'success',
// //     data: { 
// //       lessonId: lesson._id, 
// //       completed: true, 
// //       courseProgressPercentage: progress.courseProgressPercentage 
// //     }
// //   });
// // });

// // exports.getLessonProgress = catchAsync(async (req, res, next) => {
// //   const lesson = await Lesson.findOne({ _id: req.params.id });
// //   if (!lesson) return next(new AppError('Lesson not found', 404));

// //   const progress = await ProgressTracking.findOne({ student: req.user.id, course: lesson.course });
  
// //   const isCompleted = progress ? progress.completedLessons.some(cl => cl.lesson.toString() === lesson._id.toString()) : false;

// //   res.status(200).json({ status: 'success', data: { lessonId: lesson._id, completed: isCompleted } });
// // });

// // // ==========================================
// // // STATE MANAGEMENT & UPLOADS
// // // ==========================================

// // exports.publishLesson = catchAsync(async (req, res, next) => {
// //   const lesson = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
// //   if (!lesson) return next(new AppError('Lesson not found', 404));
  
// //   await verifyLessonOwnership(lesson.section, req.user.id, req.user.role, next);

// //   lesson.isPublished = true;
// //   await lesson.save();

// //   res.status(200).json({ status: 'success', data: { lesson } });
// // });

// // exports.unpublishLesson = catchAsync(async (req, res, next) => {
// //   const lesson = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
// //   if (!lesson) return next(new AppError('Lesson not found', 404));
  
// //   await verifyLessonOwnership(lesson.section, req.user.id, req.user.role, next);

// //   lesson.isPublished = false;
// //   await lesson.save();

// //   res.status(200).json({ status: 'success', data: { lesson } });
// // });

// // // Placeholder controllers for file uploads
// // exports.uploadVideo = catchAsync(async (req, res, next) => {
// //   // Logic to handle AWS S3 / Cloudinary upload goes here
// //   res.status(200).json({ status: 'success', message: 'Video upload endpoint ready' });
// // });

// // exports.uploadAttachment = catchAsync(async (req, res, next) => {
// //   res.status(200).json({ status: 'success', message: 'Attachment upload endpoint ready' });
// // });

// // // Standard Factory Gets
// // exports.getAllLessons = factory.getAll(Lesson);
// // exports.getLesson = factory.getOne(Lesson);
