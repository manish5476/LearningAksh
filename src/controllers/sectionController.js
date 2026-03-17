// controllers/sectionController.js (Complete with Publish/Unpublish)
const { Section, Course, Lesson, Master } = require('../models');
const factory = require('../utils/handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');

// ==================== MIDDLEWARE ====================

// Set course ID from params
exports.setCourseUserIds = (req, res, next) => {
  // Allow nested routes
  if (req.params.courseId) {
    req.body.course = req.params.courseId;
  }
  
  // For creating sections, ensure course exists
  if (req.body.course) {
    req.filter = { course: req.body.course };
  }
  
  next();
};

// Get max order for new section
exports.getMaxOrder = catchAsync(async (req, res, next) => {
  if (req.method === 'POST' && !req.body.order) {
    const lastSection = await Section.findOne({ 
      course: req.body.course || req.params.courseId,
      isDeleted: { $ne: true }
    }).sort('-order');
    
    req.body.order = lastSection ? lastSection.order + 1 : 0;
  }
  next();
});

// Validate section data
exports.validateSectionData = catchAsync(async (req, res, next) => {
  const { title } = req.body;
  
  if (!title || title.trim().length === 0) {
    return next(new AppError('Section title is required', 400));
  }
  
  if (title.length > 200) {
    return next(new AppError('Section title cannot exceed 200 characters', 400));
  }
  
  next();
});

// Check if user can modify this section
exports.checkSectionPermission = catchAsync(async (req, res, next) => {
  const section = await Section.findById(req.params.id).populate({
    path: 'course',
    select: 'instructors primaryInstructor'
  });
  
  if (!section) {
    return next(new AppError('Section not found', 404));
  }
  
  // Check if user is admin
  if (req.user.role === 'admin') {
    return next();
  }
  
  const course = section.course;
  
  // Find instructor info
  const instructor = course.instructors.find(
    inst => inst.instructor.toString() === req.user.id && inst.isActive
  );
  
  if (!instructor) {
    return next(new AppError('You are not an instructor of this course', 403));
  }
  
  // Check specific permissions
  if (!instructor.permissions.canManageSections && instructor.role !== 'primary') {
    return next(new AppError('You do not have permission to manage sections', 403));
  }
  
  // Store instructor info for later use
  req.instructorInfo = instructor;
  
  next();
});

// Check if user can publish/unpublish section
exports.checkPublishPermission = catchAsync(async (req, res, next) => {
  const section = await Section.findById(req.params.id).populate({
    path: 'course',
    select: 'instructors primaryInstructor'
  });
  
  if (!section) {
    return next(new AppError('Section not found', 404));
  }
  
  // Admin can always publish/unpublish
  if (req.user.role === 'admin') {
    return next();
  }
  
  const course = section.course;
  
  // Only primary instructor or instructors with canManageSections permission can publish
  const instructor = course.instructors.find(
    inst => inst.instructor.toString() === req.user.id && inst.isActive
  );
  
  if (!instructor) {
    return next(new AppError('You are not an instructor of this course', 403));
  }
  
  if (!instructor.permissions.canManageSections && instructor.role !== 'primary') {
    return next(new AppError('You do not have permission to publish sections', 403));
  }
  
  next();
});

// ==================== PUBLISH/UNPUBLISH FUNCTIONS ====================

// Publish section
exports.publishSection = catchAsync(async (req, res, next) => {
  const section = await Section.findById(req.params.id);
  
  if (!section) {
    return next(new AppError('Section not found', 404));
  }
  
  // Check if section has lessons
  const lessonsCount = await Lesson.countDocuments({ 
    section: section._id, 
    isDeleted: { $ne: true } 
  });
  
  if (lessonsCount === 0) {
    return next(new AppError('Cannot publish section with no lessons', 400));
  }
  
  section.isPublished = true;
  await section.save();
  
  // Update course last updated
  await Course.findByIdAndUpdate(section.course, { updatedAt: new Date() });
  
  res.status(200).json({
    status: 'success',
    message: 'Section published successfully',
    data: section
  });
});

// Unpublish section
exports.unpublishSection = catchAsync(async (req, res, next) => {
  const section = await Section.findByIdAndUpdate(
    req.params.id,
    { isPublished: false },
    { new: true, runValidators: true }
  );
  
  if (!section) {
    return next(new AppError('Section not found', 404));
  }
  
  // Update course last updated
  await Course.findByIdAndUpdate(section.course, { updatedAt: new Date() });
  
  res.status(200).json({
    status: 'success',
    message: 'Section unpublished successfully',
    data: section
  });
});

// Toggle publish status
exports.togglePublishStatus = catchAsync(async (req, res, next) => {
  const section = await Section.findById(req.params.id);
  
  if (!section) {
    return next(new AppError('Section not found', 404));
  }
  
  if (section.isPublished) {
    return exports.unpublishSection(req, res, next);
  } else {
    return exports.publishSection(req, res, next);
  }
});

// ==================== SECTION MANAGEMENT ====================

// Get all sections for a specific course
exports.getCourseSections = catchAsync(async (req, res, next) => {
  const { publishedOnly } = req.query;
  
  let filter = { 
    course: req.params.courseId,
    isDeleted: { $ne: true }
  };
  
  if (publishedOnly === 'true') {
    filter.isPublished = true;
  }
  
  const sections = await Section.find(filter)
    .sort('order')
    .lean();
  
  // Get lesson counts for each section
  const sectionsWithStats = await Promise.all(
    sections.map(async (section) => {
      const lessons = await Lesson.find({ 
        section: section._id,
        isDeleted: { $ne: true }
      })
      .select('title duration isFree isPublished type order')
      .sort('order')
      .lean();
      
      return {
        ...section,
        lessons,
        lessonCount: lessons.length,
        publishedLessonCount: lessons.filter(l => l.isPublished).length,
        freeLessonCount: lessons.filter(l => l.isFree).length,
        totalDuration: lessons.reduce((sum, l) => sum + (l.duration || 0), 0)
      };
    })
  );
  
  res.status(200).json({
    status: 'success',
    results: sectionsWithStats.length,
    data: sectionsWithStats
  });
});

// Get section with its lessons
exports.getSectionWithLessons = catchAsync(async (req, res, next) => {
  const section = await Section.findOne({ 
    _id: req.params.id,
    isDeleted: { $ne: true }
  }).lean();
  
  if (!section) {
    return next(new AppError('Section not found', 404));
  }
  
  const lessons = await Lesson.find({ 
    section: section._id,
    isDeleted: { $ne: true }
  })
  .populate('createdBy', 'name email')
  .populate('lastModifiedBy', 'name email')
  .sort('order')
  .lean();
  
  // Get lesson types from master for metadata
  const lessonTypes = await Master.getMasterMap('LESSON_TYPE');
  
  const lessonsWithTypeInfo = lessons.map(lesson => ({
    ...lesson,
    typeInfo: lessonTypes[lesson.type] || lesson.type
  }));
  
  res.status(200).json({
    status: 'success',
    data: {
      section,
      lessons: lessonsWithTypeInfo,
      totalLessons: lessons.length,
      totalDuration: lessons.reduce((sum, l) => sum + (l.duration || 0), 0),
      freeLessons: lessons.filter(l => l.isFree).length
    }
  });
});

// Reorder sections
exports.reorderSections = catchAsync(async (req, res, next) => {
  const { sectionOrders } = req.body; // Array of { id, order }
  const courseId = req.params.courseId;
  
  if (!Array.isArray(sectionOrders)) {
    return next(new AppError('sectionOrders array required', 400));
  }
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const updatePromises = sectionOrders.map(({ id, order }) => 
      Section.findByIdAndUpdate(id, { order }, { session })
    );
    
    await Promise.all(updatePromises);
    
    // Update course last modified
    await Course.findByIdAndUpdate(
      courseId,
      { updatedAt: new Date() },
      { session }
    );
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      status: 'success',
      message: 'Sections reordered successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// Duplicate section
exports.duplicateSection = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const sourceSection = await Section.findById(req.params.id)
      .populate('course')
      .session(session);
    
    if (!sourceSection) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Section not found', 404));
    }
    
    // Get max order for new section
    const lastSection = await Section.findOne({ 
      course: sourceSection.course._id,
      isDeleted: { $ne: true }
    }).sort('-order').session(session);
    
    const newOrder = lastSection ? lastSection.order + 1 : sourceSection.order + 1;
    
    // Create duplicate section
    const [newSection] = await Section.create([{
      course: sourceSection.course._id,
      title: `${sourceSection.title} (Copy)`,
      description: sourceSection.description,
      order: newOrder,
      isPublished: false, // Default to unpublished
      createdBy: req.user.id
    }], { session });
    
    // Duplicate all lessons
    const sourceLessons = await Lesson.find({ 
      section: sourceSection._id,
      isDeleted: { $ne: true }
    }).session(session);
    
    if (sourceLessons.length > 0) {
      const newLessons = sourceLessons.map(lesson => ({
        section: newSection._id,
        course: sourceSection.course._id,
        title: lesson.title,
        description: lesson.description,
        type: lesson.type,
        content: lesson.content,
        order: lesson.order,
        duration: lesson.duration,
        isFree: lesson.isFree,
        isPublished: false, // Default to unpublished
        resources: lesson.resources,
        createdBy: req.user.id,
        lastModifiedBy: req.user.id
      }));
      
      await Lesson.insertMany(newLessons, { session });
    }
    
    await session.commitTransaction();
    session.endSession();
    
    // Fetch complete section with lessons
    const result = await Section.findById(newSection._id).lean();
    const lessons = await Lesson.find({ section: newSection._id }).lean();
    
    res.status(201).json({
      status: 'success',
      message: 'Section duplicated successfully',
      data: {
        ...result,
        lessons,
        lessonCount: lessons.length
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// ==================== BULK OPERATIONS ====================

// Bulk publish sections
exports.bulkPublishSections = catchAsync(async (req, res, next) => {
  const { ids } = req.body;
  const courseId = req.params.courseId;
  
  if (!Array.isArray(ids)) {
    return next(new AppError('ids array required', 400));
  }
  
  // Verify all sections belong to the course
  const sections = await Section.find({ 
    _id: { $in: ids },
    course: courseId,
    isDeleted: { $ne: true }
  });
  
  if (sections.length !== ids.length) {
    return next(new AppError('One or more sections not found or do not belong to this course', 400));
  }
  
  // Check each section has lessons
  for (const section of sections) {
    const lessonsCount = await Lesson.countDocuments({ 
      section: section._id,
      isDeleted: { $ne: true }
    });
    
    if (lessonsCount === 0) {
      return next(new AppError(`Section "${section.title}" has no lessons and cannot be published`, 400));
    }
  }
  
  const result = await Section.updateMany(
    { _id: { $in: ids } },
    { isPublished: true }
  );
  
  // Update course last modified
  await Course.findByIdAndUpdate(courseId, { updatedAt: new Date() });
  
  res.status(200).json({
    status: 'success',
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount
    }
  });
});

// Bulk unpublish sections
exports.bulkUnpublishSections = catchAsync(async (req, res, next) => {
  const { ids } = req.body;
  const courseId = req.params.courseId;
  
  if (!Array.isArray(ids)) {
    return next(new AppError('ids array required', 400));
  }
  
  const result = await Section.updateMany(
    { _id: { $in: ids }, course: courseId },
    { isPublished: false }
  );
  
  // Update course last modified
  await Course.findByIdAndUpdate(courseId, { updatedAt: new Date() });
  
  res.status(200).json({
    status: 'success',
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount
    }
  });
});

// ==================== DELETE/RESTORE ====================

// Delete section with cascade
exports.deleteSection = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const section = await Section.findById(req.params.id).session(session);
    
    if (!section) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Section not found', 404));
    }
    
    // Soft delete all lessons in this section
    await Lesson.updateMany(
      { section: section._id },
      { 
        isDeleted: true, 
        deletedAt: new Date(),
        deletedBy: req.user.id
      },
      { session }
    );
    
    // Soft delete the section
    section.isDeleted = true;
    section.deletedAt = new Date();
    section.deletedBy = req.user.id;
    await section.save({ session });
    
    // Update course totals
    await updateCourseTotals(section.course, session);
    
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

// Restore section with lessons
exports.restoreSection = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const section = await Section.findOneAndUpdate(
      { _id: req.params.id, isDeleted: true },
      { 
        isDeleted: false, 
        deletedAt: null,
        deletedBy: null
      },
      { new: true, session }
    );
    
    if (!section) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('No deleted section found', 404));
    }
    
    // Restore all lessons in this section
    await Lesson.updateMany(
      { section: section._id, isDeleted: true },
      { 
        isDeleted: false, 
        deletedAt: null,
        deletedBy: null
      },
      { session }
    );
    
    // Update course totals
    await updateCourseTotals(section.course, session);
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      status: 'success',
      data: section
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
});

// ==================== HELPER FUNCTIONS ====================

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

exports.createSection = factory.createOne(Section);
exports.updateSection = factory.updateOne(Section);
exports.getSection = factory.getOne(Section, {
  populate: [
    { path: 'course', select: 'title slug instructors primaryInstructor' }
  ]
});

exports.getAllSections = factory.getAll(Section, {
  searchFields: ['title', 'description'],
  populate: [
    { path: 'course', select: 'title slug' }
  ]
});

exports.bulkCreateSections = factory.bulkCreate(Section);
exports.bulkUpdateSections = factory.bulkUpdate(Section);
exports.bulkDeleteSections = factory.bulkDelete(Section);
exports.countSections = factory.count(Section);




// const { Section, Lesson, Course } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');

// exports.setCourseId = (req, res, next) => {
//   if (!req.body.course) req.body.course = req.params.courseId;
  
//   if (!req.query.course && req.params.courseId) {
//     req.query.course = req.params.courseId;
//   }
  
//   if (!req.filter) req.filter = {};
//   if (req.params.courseId) req.filter.course = req.params.courseId;
  
//   next();
// };

// const verifyCourseOwnership = async (courseId, userId, role) => {
//   const course = await Course.findById(courseId);
//   if (!course) throw new AppError('No course found with that ID', 404);

//   if (course.instructor.toString() !== userId && role !== 'admin') {
//     throw new AppError('You are not authorized to modify sections for this course', 403);
//   }
//   return course;
// };

// // ==========================================
// // CORE SECTION CREATION & MODIFICATION
// // ==========================================

// exports.createSection = catchAsync(async (req, res, next) => {
//   await verifyCourseOwnership(req.body.course, req.user.id, req.user.role);

//   const lastSection = await Section.findOne({ course: req.body.course, isDeleted: false }).sort('-order');
//   req.body.order = lastSection ? lastSection.order + 1 : 1;
  
//   const section = await Section.create(req.body);
  
//   await Course.findByIdAndUpdate(req.body.course, { $inc: { totalSections: 1 } });
  
//   res.status(201).json({ status: 'success', data: { section } });
// });

// exports.updateSection = catchAsync(async (req, res, next) => {
//   const sectionToUpdate = await Section.findOne({ _id: req.params.id, isDeleted: false });
//   if (!sectionToUpdate) return next(new AppError('Section not found', 404));
  
//   await verifyCourseOwnership(sectionToUpdate.course, req.user.id, req.user.role);

//   const updatedSection = await Section.findByIdAndUpdate(req.params.id, req.body, {
//     new: true,
//     runValidators: true
//   });

//   res.status(200).json({ status: 'success', data: { section: updatedSection } });
// });

// exports.deleteSection = catchAsync(async (req, res, next) => {
//   const sectionToDelete = await Section.findById(req.params.id);
//   if (!sectionToDelete || sectionToDelete.isDeleted) return next(new AppError('Section not found', 404));

//   await verifyCourseOwnership(sectionToDelete.course, req.user.id, req.user.role);

//   await Promise.all([
//     Section.findByIdAndUpdate(req.params.id, { isDeleted: true, isActive: false }),
//     Course.findByIdAndUpdate(sectionToDelete.course, { $inc: { totalSections: -1 } }),
//     Lesson.updateMany({ section: req.params.id }, { isDeleted: true, isPublished: false })
//   ]);

//   res.status(200).json({ status: 'success', data: null });
// });

// // ==========================================
// // BULK OPERATIONS
// // ==========================================

// exports.reorderSections = catchAsync(async (req, res, next) => {
//   const { sections } = req.body; 

//   if (!Array.isArray(sections)) return next(new AppError('Sections array is required', 400));
  
//   await verifyCourseOwnership(req.params.courseId, req.user.id, req.user.role);

//   const bulkOperations = sections.map(sec => ({
//     updateOne: {
//       filter: { _id: sec.id, course: req.params.courseId },
//       update: { $set: { order: sec.order } }
//     }
//   }));

//   if (bulkOperations.length > 0) {
//     await Section.bulkWrite(bulkOperations);
//   }

//   res.status(200).json({ status: 'success', message: 'Sections reordered successfully' });
// });

// // ==========================================
// // ADVANCED UTILITIES (State & Cloning)
// // ==========================================

// exports.publishSection = catchAsync(async (req, res, next) => {
//   const section = await Section.findOne({ _id: req.params.id, isDeleted: false });
//   if (!section) return next(new AppError('Section not found', 404));
  
//   await verifyCourseOwnership(section.course, req.user.id, req.user.role);

//   section.isPublished = true;
//   await section.save();

//   res.status(200).json({ status: 'success', data: { section } });
// });

// exports.unpublishSection = catchAsync(async (req, res, next) => {
//   const section = await Section.findOne({ _id: req.params.id, isDeleted: false });
//   if (!section) return next(new AppError('Section not found', 404));
  
//   await verifyCourseOwnership(section.course, req.user.id, req.user.role);

//   section.isPublished = false;
//   await section.save();

//   res.status(200).json({ status: 'success', data: { section } });
// });

// exports.cloneSection = catchAsync(async (req, res, next) => {
//   const originalSection = await Section.findOne({ _id: req.params.id, isDeleted: false }).lean();
//   if (!originalSection) return next(new AppError('Section not found', 404));
  
//   await verifyCourseOwnership(originalSection.course, req.user.id, req.user.role);

//   const newSectionData = { ...originalSection };
//   delete newSectionData._id;
//   newSectionData.title = `${originalSection.title} (Copy)`;
//   newSectionData.isPublished = false; 

//   const lastSection = await Section.findOne({ course: originalSection.course, isDeleted: false }).sort('-order');
//   newSectionData.order = lastSection ? lastSection.order + 1 : 1;

//   const clonedSection = await Section.create(newSectionData);
//   const originalLessons = await Lesson.find({ section: req.params.id, isDeleted: false }).lean();

//   if (originalLessons.length > 0) {
//     const clonedLessons = originalLessons.map(lesson => {
//       const newLesson = { ...lesson };
//       delete newLesson._id;
//       newLesson.section = clonedSection._id; 
//       newLesson.isPublished = false;
//       return newLesson;
//     });
//     await Lesson.insertMany(clonedLessons);
//   }

//   await Course.findByIdAndUpdate(originalSection.course, { $inc: { totalSections: 1 } });

//   res.status(201).json({ status: 'success', message: 'Section and lessons cloned successfully', data: { section: clonedSection } });
// });

// exports.getAllSections = factory.getAll(Section);
// exports.getSection = factory.getOne(Section, { populate: { path: 'course', select: 'title slug instructor' }});


// // const { Section, Lesson, Course } = require('../models');
// // const AppError = require('../utils/appError');
// // const catchAsync = require('../utils/catchAsync');
// // const factory = require('../utils/handlerFactory');

// // exports.setCourseId = (req, res, next) => {
// //   // 1. For POST requests (creating)
// //   if (!req.body.course) req.body.course = req.params.courseId;

// //   // 2. THE MISSING FIX: For GET requests (factory.getAll)
// //   if (!req.query.course && req.params.courseId) {
// //     req.query.course = req.params.courseId;
// //   }

// //   // 3. Keep for fallback
// //   if (!req.filter) req.filter = {};
// //   if (req.params.courseId) req.filter.course = req.params.courseId;

// //   next();
// // };

// // const verifyCourseOwnership = async (courseId, userId, role) => {
// //   const course = await Course.findById(courseId);
// //   if (!course) throw new AppError('No course found with that ID', 404);

// //   if (course.instructor.toString() !== userId && role !== 'admin') {
// //     throw new AppError('You are not authorized to modify sections for this course', 403);
// //   }
// //   return course;
// // };
// // // ==========================================
// // // CORE SECTION CREATION & MODIFICATION
// // // ==========================================

// // expor  await verifyCourseOwnership(req.body.course, req.user.id, req.user.role);
// // ts.createSection = catchAsync(async (req, res, next) => {
// //   // await verifyCourseOwnership(req.body.course, req.user.id, req.user.role);
// //   const lastSection = await Section.findOne({ course: req.body.course, isDeleted: false }).sort('-order');
// //   req.body.order = lastSection ? lastSection.order + 1 : 1;
// //   const section = await Section.create(req.body);
// //   await Course.findByIdAndUpdate(req.body.course, { $inc: { totalSections: 1 } });
// //   res.status(201).json({ status: 'success', data: { section } });
// // });

// // exports.updateSection = catchAsync(async (req, res, next) => {
// //   const sectionToUpdate = await Section.findOne({ _id: req.params.id, isDeleted: false });
// //   if (!sectionToUpdate) return next(new AppError('Section not found', 404));
// //   await verifyCourseOwnership(req.body.course, req.user.id, req.user.role);

// //   // await verifyCourseOwnership(sectionToUpdate.course, req.user.id, req.user.role, next);

// //   // 3. Update the section
// //   const updatedSection = await Section.findByIdAndUpdate(req.params.id, req.body, {
// //     new: true,
// //     runValidators: true
// //   });

// //   res.status(200).json({ status: 'success', data: { section: updatedSection } });
// // });
// // exports.deleteSection = catchAsync(async (req, res, next) => {
// //   // 1. Find section
// //   const sectionToDelete = await Section.findById(req.params.id);
// //   if (!sectionToDelete || sectionToDelete.isDeleted) return next(new AppError('Section not found', 404));

// //   //   await verifyCourseOwnership(req.body.course, req.user.id, req.user.role);
// // 2. Verify Ownership
// //   // await verifyCourseOwnership(sectionToDelete.course, req.user.id, req.user.role, next);

// //   // ⚡️ 3. RUN ALL DATABASE UPDATES IN PARALLEL (Makes it 3x faster!)
// //   await Promise.all([
// //     Section.findByIdAndUpdate(req.params.id, { isDeleted: true, isActive: false }),
// //     Course.findByIdAndUpdate(sectionToDelete.course, { $inc: { totalSections: -1 } }),
// //     Lesson.updateMany({ section: req.params.id }, { isDeleted: true, isPublished: false })
// //   ]);

// //   res.status(200).json({ status: 'success', data: null });
// // });

// // // ==========================================
// // // BULK OPERATIONS
// // // ==========================================

// // exports.reorderSections = catchAsync(async (req, res, next) => {
// //   const { sections } = req.body; // Expects: [{ id: "...", order: 1 }, { id: "...", order: 2 }]

// //   if (!Array.isArray(sections)) {
// //     return next(new AppError('Sections array is required', 400));
// //   }
// //   await verifyCourseOwnership(req.body.course, req.user.id, req.user.role);

// //   // await verifyCourseOwnership(req.params.courseId, req.user.id, req.user.role, next);

// //   // PRO FEATURE: Use bulkWrite for massive performance improvements over Promise.all
// //   const bulkOperations = sections.map(sec => ({
// //     updateOne: {
// //       filter: { _id: sec.id, course: req.params.courseId },
// //       update: { $set: { order: sec.order } }
// //     }
// //   }));

// //   if (bulkOperations.length > 0) {
// //     await Section.bulkWrite(bulkOperations);
// //   }

// //   res.status(200).json({ status: 'success', message: 'Sections reordered successfully' });
// // });

// // // ==========================================
// // // ADVANCED UTILITIES (State & Cloning)
// // // ==========================================

// // exports.publishSection = catchAsync(async (req, res, next) => {
// //   const section = await Section.findOne({ _id: req.params.id, isDeleted: false });
// //   if (!section) return next(new AppError('Section not found', 404));
// //   await verifyCourseOwnership(req.body.course, req.user.id, req.user.role);

// //   // await verifyCourseOwnership(section.course, req.user.id, req.user.role, next);

// //   section.isPublished = true;
// //   await section.save();

// //   res.status(200).json({ status: 'success', data: { section } });
// // });

// // exports.unpublishSection = catchAsync(async (req, res, next) => {
// //   const section = await Section.findOne({ _id: req.params.id, isDeleted: false });
// //   if (!section) return next(new AppError('Section not found', 404));
// //   await verifyCourseOwnership(req.body.course, req.user.id, req.user.role);

// //   // await verifyCourseOwnership(section.course, req.user.id, req.user.role, next);

// //   section.isPublished = false;
// //   await section.save();

// //   res.status(200).json({ status: 'success', data: { section } });
// // });

// // exports.cloneSection = catchAsync(async (req, res, next) => {
// //   // 1. Verify and fetch the original section
// //   const originalSection = await Section.findOne({ _id: req.params.id, isDeleted: false }).lean();
// //   if (!originalSection) return next(new AppError('Section not found', 404));
// //   await verifyCourseOwnership(req.body.course, req.user.id, req.user.role);

// //   // await verifyCourseOwnership(originalSection.course, req.user.id, req.user.role, next);

// //   // 2. Create the clone
// //   const newSectionData = { ...originalSection };
// //   delete newSectionData._id;
// //   newSectionData.title = `${originalSection.title} (Copy)`;
// //   newSectionData.isPublished = false; // Draft by default

// //   // Put it at the end of the syllabus
// //   const lastSection = await Section.findOne({ course: originalSection.course, isDeleted: false }).sort('-order');
// //   newSectionData.order = lastSection ? lastSection.order + 1 : 1;

// //   const clonedSection = await Section.create(newSectionData);

// //   // 3. Clone all nested lessons associated with this section
// //   const originalLessons = await Lesson.find({ section: req.params.id, isDeleted: false }).lean();

// //   if (originalLessons.length > 0) {
// //     const clonedLessons = originalLessons.map(lesson => {
// //       const newLesson = { ...lesson };
// //       delete newLesson._id;
// //       newLesson.section = clonedSection._id; // Attach to new section
// //       newLesson.isPublished = false;
// //       return newLesson;
// //     });
// //     await Lesson.insertMany(clonedLessons);
// //   }

// //   // 4. Update Course stats
// //   await Course.findByIdAndUpdate(originalSection.course, { $inc: { totalSections: 1 } });

// //   res.status(201).json({ status: 'success', message: 'Section and lessons cloned successfully', data: { section: clonedSection } });
// // });

// // // ==========================================
// // // STANDARD READ OPERATIONS
// // // ==========================================
// // exports.getAllSections = factory.getAll(Section);
// // exports.getSection = factory.getOne(Section, {
// //   populate: { path: 'course', select: 'title slug instructor' }
// // });


