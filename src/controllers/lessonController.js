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
    req.sectionInfo = section;
  }
  next();
});

// Validate lesson data against master
exports.validateLessonData = catchAsync(async (req, res, next) => {
  const { type, content } = req.body;
  
  // Validate lesson type against master (using lowercase type for the new schema)
  if (type) {
    const isValidType = await Master.validateValue('lesson_type', String(type).trim());
    if (!isValidType) {
      return next(new AppError(`Invalid lesson type: ${type}`, 400));
    }
  }
  
  // Validate video provider if present
  if (content?.video?.provider) {
    const isValidProvider = await Master.validateValue('video_provider', String(content.video.provider).trim());
    if (!isValidProvider) {
      return next(new AppError(`Invalid video provider: ${content.video.provider}`, 400));
    }
  }
  
  // Validate resource types if present
  if (req.body.resources && Array.isArray(req.body.resources)) {
    for (const resource of req.body.resources) {
      if (resource.type) {
        const isValidResourceType = await Master.validateValue('resource_type', String(resource.type).trim());
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
  
  if (!lesson) return next(new AppError('Lesson not found', 404));
  if (req.user.role === 'admin') return next();
  
  const course = lesson.section.course;
  const instructor = course.instructors.find(inst => inst.instructor.toString() === req.user.id && inst.isActive);
  
  if (!instructor) return next(new AppError('You are not an instructor of this course', 403));
  if (!instructor.permissions.canManageLessons && instructor.role !== 'primary') {
    return next(new AppError('You do not have permission to manage lessons', 403));
  }
  
  next();
});

// Check if user can publish/unpublish lesson
exports.checkPublishPermission = catchAsync(async (req, res, next) => {
  const lesson = await Lesson.findById(req.params.id).populate({
    path: 'section',
    populate: { path: 'course', select: 'instructors primaryInstructor' }
  });
  
  if (!lesson) return next(new AppError('Lesson not found', 404));
  if (req.user.role === 'admin') return next();
  
  const course = lesson.section.course;
  const instructor = course.instructors.find(inst => inst.instructor.toString() === req.user.id && inst.isActive);
  
  if (!instructor) return next(new AppError('You are not an instructor of this course', 403));
  if (!instructor.permissions.canManageLessons && instructor.role !== 'primary') {
    return next(new AppError('You do not have permission to publish lessons', 403));
  }
  
  next();
});

// ==================== PUBLISH/UNPUBLISH FUNCTIONS ====================

exports.publishLesson = catchAsync(async (req, res, next) => {
  const lesson = await Lesson.findByIdAndUpdate(
    req.params.id,
    { isPublished: true, lastModifiedBy: req.user.id },
    { new: true, runValidators: true }
  );
  
  if (!lesson) return next(new AppError('Lesson not found', 404));
  
  await updateSectionTotals(lesson.section);
  
  res.status(200).json({ status: 'success', message: 'Lesson published successfully', data: lesson });
});

exports.unpublishLesson = catchAsync(async (req, res, next) => {
  const lesson = await Lesson.findByIdAndUpdate(
    req.params.id,
    { isPublished: false, lastModifiedBy: req.user.id },
    { new: true, runValidators: true }
  );
  
  if (!lesson) return next(new AppError('Lesson not found', 404));
  
  await updateSectionTotals(lesson.section);
  
  res.status(200).json({ status: 'success', message: 'Lesson unpublished successfully', data: lesson });
});

exports.togglePublishStatus = catchAsync(async (req, res, next) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) return next(new AppError('Lesson not found', 404));
  
  if (lesson.isPublished) return exports.unpublishLesson(req, res, next);
  else return exports.publishLesson(req, res, next);
});

// ==================== LESSON MANAGEMENT ====================

exports.createLesson = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    req.body.createdBy = req.user.id;
    req.body.lastModifiedBy = req.user.id;
    
    const [lesson] = await Lesson.create([req.body], { session });
    await updateSectionTotals(lesson.section, session);
    
    await session.commitTransaction();
    session.endSession();
    
    const completeLesson = await Lesson.findById(lesson._id)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email');
    
    res.status(201).json({ status: 'success', data: completeLesson });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

exports.updateLesson = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    req.body.lastModifiedBy = req.user.id;
    
    const lesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true, session });
    
    if (!lesson) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Lesson not found', 404));
    }
    
    if (req.body.duration !== undefined || req.body.section) {
      await updateSectionTotals(lesson.section, session);
      if (req.body.section && req.body.section !== lesson.section.toString()) {
        await updateSectionTotals(req.body.section, session);
      }
    }
    
    await session.commitTransaction();
    session.endSession();
    
    const updatedLesson = await Lesson.findById(lesson._id)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .populate('section', 'title course');
    
    res.status(200).json({ status: 'success', data: updatedLesson });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// Get lessons for a specific section (Fixed Master Mapping)
exports.getSectionLessons = catchAsync(async (req, res, next) => {
  const { publishedOnly, freeOnly } = req.query;
  
  let filter = { 
    section: req.params.sectionId,
    isDeleted: { $ne: true }
  };
  
  if (publishedOnly === 'true') filter.isPublished = true;
  if (freeOnly === 'true') filter.isFree = true;
  
  const lessons = await Lesson.find(filter)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email')
    .sort('order');
  
  // Directly query the Master collection instead of the removed getMasterMap
  const [lessonTypes, resourceTypes] = await Promise.all([
    Master.find({ type: 'lesson_type', isActive: true }).lean(),
    Master.find({ type: 'resource_type', isActive: true }).lean()
  ]);
  
  const lessonTypeMap = Object.fromEntries(lessonTypes.map(m => [m.code, m]));
  const resourceTypeMap = Object.fromEntries(resourceTypes.map(m => [m.code, m]));
  
  const lessonsWithMetadata = lessons.map(lesson => {
    const lessonObj = lesson.toObject();
    return {
      ...lessonObj,
      typeInfo: lessonTypeMap[lesson.type?.toUpperCase()] || lesson.type,
      resources: lesson.resources?.map(r => ({
        ...r,
        typeInfo: resourceTypeMap[r.type?.toUpperCase()] || r.type
      }))
    };
  });
  
  res.status(200).json({
    status: 'success',
    results: lessonsWithMetadata.length,
    data: lessonsWithMetadata
  });
});

exports.getFreeLessons = catchAsync(async (req, res, next) => {
  const lessons = await Lesson.find({ 
    course: req.params.courseId,
    isFree: true,
    isPublished: true,
    isDeleted: { $ne: true }
  })
  .populate({ path: 'section', select: 'title order course' })
  .select('title description type duration section order')
  .sort('section order');
  
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
      id: lesson._id, title: lesson.title, description: lesson.description,
      type: lesson.type, duration: lesson.duration, order: lesson.order
    });
  });
  
  res.status(200).json({ status: 'success', data: Object.values(lessonsBySection) });
});

exports.getLessonsByInstructor = catchAsync(async (req, res, next) => {
  const lessons = await Lesson.find({ createdBy: req.params.instructorId, isDeleted: { $ne: true } })
    .populate('course', 'title slug')
    .populate('section', 'title')
    .sort('-createdAt');
  
  res.status(200).json({ status: 'success', results: lessons.length, data: lessons });
});

exports.reorderLessons = catchAsync(async (req, res, next) => {
  const { lessonOrders } = req.body; 
  const sectionId = req.params.sectionId;
  
  if (!Array.isArray(lessonOrders)) return next(new AppError('lessonOrders array required', 400));
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const updatePromises = lessonOrders.map(({ id, order }) => 
      Lesson.findByIdAndUpdate(id, { order, lastModifiedBy: req.user.id }, { session })
    );
    
    await Promise.all(updatePromises);
    
    if (lessonOrders.length > 0) {
      await Section.findByIdAndUpdate(sectionId, { updatedAt: new Date() }, { session });
    }
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({ status: 'success', message: 'Lessons reordered successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

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
    
    const lastLesson = await Lesson.findOne({ 
      section: sourceLesson.section, isDeleted: { $ne: true }
    }).sort('-order').session(session);
    
    const newOrder = lastLesson ? lastLesson.order + 1 : sourceLesson.order + 1;
    
    const [newLesson] = await Lesson.create([{
      section: sourceLesson.section, course: sourceLesson.course, title: `${sourceLesson.title} (Copy)`,
      description: sourceLesson.description, type: sourceLesson.type, content: sourceLesson.content,
      order: newOrder, duration: sourceLesson.duration, isFree: sourceLesson.isFree,
      isPublished: false, resources: sourceLesson.resources, createdBy: req.user.id, lastModifiedBy: req.user.id
    }], { session });
    
    await updateSectionTotals(sourceLesson.section, session);
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(201).json({ status: 'success', message: 'Lesson duplicated successfully', data: newLesson });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// ==================== BULK OPERATIONS ====================

exports.bulkPublishLessons = catchAsync(async (req, res, next) => {
  const { ids } = req.body;
  const sectionId = req.params.sectionId;
  
  if (!Array.isArray(ids)) return next(new AppError('ids array required', 400));
  
  const result = await Lesson.updateMany(
    { _id: { $in: ids }, section: sectionId },
    { isPublished: true, lastModifiedBy: req.user.id }
  );
  
  if (result.modifiedCount > 0) await updateSectionTotals(sectionId);
  
  res.status(200).json({ status: 'success', data: { matched: result.matchedCount, modified: result.modifiedCount } });
});

exports.bulkUnpublishLessons = catchAsync(async (req, res, next) => {
  const { ids } = req.body;
  const sectionId = req.params.sectionId;
  
  if (!Array.isArray(ids)) return next(new AppError('ids array required', 400));
  
  const result = await Lesson.updateMany(
    { _id: { $in: ids }, section: sectionId },
    { isPublished: false, lastModifiedBy: req.user.id }
  );
  
  if (result.modifiedCount > 0) await updateSectionTotals(sectionId);
  
  res.status(200).json({ status: 'success', data: { matched: result.matchedCount, modified: result.modifiedCount } });
});

exports.bulkUpdateDurations = catchAsync(async (req, res, next) => {
  const { updates } = req.body; 
  const sectionId = req.params.sectionId;
  
  if (!Array.isArray(updates)) return next(new AppError('updates array required', 400));
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const updatePromises = updates.map(({ id, duration }) => 
      Lesson.findByIdAndUpdate(id, { duration, lastModifiedBy: req.user.id }, { session })
    );
    
    await Promise.all(updatePromises);
    await updateSectionTotals(sectionId, session);
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({ status: 'success', message: 'Durations updated successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// ==================== DELETE/RESTORE ====================

exports.deleteLesson = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const lesson = await Lesson.findOneAndUpdate(
      { _id: req.params.id },
      { isDeleted: true, deletedAt: new Date(), deletedBy: req.user.id },
      { new: true, session }
    );
    
    if (!lesson) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Lesson not found', 404));
    }
    
    await updateSectionTotals(lesson.section, session);
    await session.commitTransaction();
    session.endSession();
    
    res.status(204).json({ status: 'success', data: null });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

exports.restoreLesson = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const lesson = await Lesson.findOneAndUpdate(
      { _id: req.params.id, isDeleted: true },
      { isDeleted: false, deletedAt: null, deletedBy: null },
      { new: true, session }
    );
    
    if (!lesson) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('No deleted lesson found', 404));
    }
    
    await updateSectionTotals(lesson.section, session);
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({ status: 'success', data: lesson });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// ==================== HELPER FUNCTIONS ====================

// Update section totals (Fixed ObjectId casting for Mongoose stability)
async function updateSectionTotals(sectionId, session) {
  const safeSectionId = new mongoose.Types.ObjectId(String(sectionId));
  
  const result = await Lesson.aggregate([
    { $match: { 
        section: safeSectionId, 
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
    totalLessons: 0, totalDuration: 0, publishedLessons: 0, freeLessons: 0 
  };
  
  const section = await Section.findByIdAndUpdate(
    sectionId,
    {
      totalLessons: totals.totalLessons,
      totalDuration: totals.totalDuration
    },
    { new: true, session }
  ).populate('course');
  
  if (section && section.course) {
    await updateCourseTotals(section.course._id, session);
  }
}

// Update course totals (Fixed ObjectId casting for Mongoose stability)
async function updateCourseTotals(courseId, session) {
  const safeCourseId = new mongoose.Types.ObjectId(String(courseId));

  const result = await Section.aggregate([
    { $match: { 
        course: safeCourseId, 
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
