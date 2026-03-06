const { Section, Lesson, Course } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');

// Middleware to map nested courseId to the request body/filter
exports.setCourseId = (req, res, next) => {
  if (!req.body.course) req.body.course = req.params.courseId;
  if (!req.filter) req.filter = {};
  if (req.params.courseId) req.filter.course = req.params.courseId;
  next();
};

/**
 * Helper function to strictly verify if the logged-in user owns the parent course.
 * This prevents the "Ownership Bypass" vulnerability.
 */
const verifyCourseOwnership = async (courseId, userId, role, next) => {
  const course = await Course.findById(courseId);
  if (!course) return next(new AppError('No course found with that ID', 404));
  
  if (course.instructor.toString() !== userId && role !== 'admin') {
    return next(new AppError('You are not authorized to modify sections for this course', 403));
  }
  return course;
};

// ==========================================
// CORE SECTION CREATION & MODIFICATION
// ==========================================

exports.createSection = catchAsync(async (req, res, next) => {
  // 1. Verify Ownership
  await verifyCourseOwnership(req.body.course, req.user.id, req.user.role, next);

  // 2. Auto-calculate the next logical order position
  const lastSection = await Section.findOne({ course: req.body.course, isDeleted: false }).sort('-order');
  req.body.order = lastSection ? lastSection.order + 1 : 1;

  // 3. Create the section
  const section = await Section.create(req.body);

  // 4. Safely increment the Course's total section counter
  await Course.findByIdAndUpdate(req.body.course, { $inc: { totalSections: 1 } });

  res.status(201).json({ status: 'success', data: { section } });
});

exports.updateSection = catchAsync(async (req, res, next) => {
  // 1. Find section to get the course ID
  const sectionToUpdate = await Section.findOne({ _id: req.params.id, isDeleted: false });
  if (!sectionToUpdate) return next(new AppError('Section not found', 404));

  // 2. Verify Ownership via the parent course
  await verifyCourseOwnership(sectionToUpdate.course, req.user.id, req.user.role, next);

  // 3. Update the section
  const updatedSection = await Section.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({ status: 'success', data: { section: updatedSection } });
});

exports.deleteSection = catchAsync(async (req, res, next) => {
  // 1. Find section strictly by its own ID (ignore req.filter.course for a moment)
  const sectionToDelete = await Section.findById(req.params.id);
  
  if (!sectionToDelete || sectionToDelete.isDeleted) {
    return next(new AppError('Section not found', 404));
  }

  // 2. Verify Ownership using the course attached to the document, NOT the URL param
  await verifyCourseOwnership(sectionToDelete.course, req.user.id, req.user.role, next);

  // 3. Soft Delete the section
  sectionToDelete.isDeleted = true;
  sectionToDelete.isActive = false;
  await sectionToDelete.save(); // Using .save() triggers any Mongoose hooks you might have!

  // 4. Safely decrement the Course's total section counter
  await Course.findByIdAndUpdate(sectionToDelete.course, { $inc: { totalSections: -1 } });

  // 5. Soft delete all nested lessons
  await Lesson.updateMany({ section: req.params.id }, { isDeleted: true, isPublished: false });

  res.status(204).json({ status: 'success', data: null });
});

// exports.deleteSection = catchAsync(async (req, res, next) => {
//   // 1. Find section
//   const sectionToDelete = await Section.findOne({ _id: req.params.id, isDeleted: false });
//   if (!sectionToDelete) return next(new AppError('Section not found', 404));

//   // 2. Verify Ownership
//   await verifyCourseOwnership(sectionToDelete.course, req.user.id, req.user.role, next);

//   // 3. Soft Delete the section
//   await Section.findByIdAndUpdate(req.params.id, { isDeleted: true, isActive: false });

//   // 4. Safely decrement the Course's total section counter
//   await Course.findByIdAndUpdate(sectionToDelete.course, { $inc: { totalSections: -1 } });

//   // 5. (Optional but recommended) Soft delete all nested lessons to hide them from the syllabus
//   await Lesson.updateMany({ section: req.params.id }, { isDeleted: true, isPublished: false });

//   res.status(204).json({ status: 'success', data: null });
// });

// ==========================================
// BULK OPERATIONS
// ==========================================

exports.reorderSections = catchAsync(async (req, res, next) => {
  const { sections } = req.body; // Expects: [{ id: "...", order: 1 }, { id: "...", order: 2 }]

  if (!Array.isArray(sections)) {
    return next(new AppError('Sections array is required', 400));
  }

  await verifyCourseOwnership(req.params.courseId, req.user.id, req.user.role, next);

  // PRO FEATURE: Use bulkWrite for massive performance improvements over Promise.all
  const bulkOperations = sections.map(sec => ({
    updateOne: {
      filter: { _id: sec.id, course: req.params.courseId },
      update: { $set: { order: sec.order } }
    }
  }));

  if (bulkOperations.length > 0) {
    await Section.bulkWrite(bulkOperations);
  }

  res.status(200).json({ status: 'success', message: 'Sections reordered successfully' });
});

// ==========================================
// ADVANCED UTILITIES (State & Cloning)
// ==========================================

exports.publishSection = catchAsync(async (req, res, next) => {
  const section = await Section.findOne({ _id: req.params.id, isDeleted: false });
  if (!section) return next(new AppError('Section not found', 404));
  
  await verifyCourseOwnership(section.course, req.user.id, req.user.role, next);

  section.isPublished = true;
  await section.save();

  res.status(200).json({ status: 'success', data: { section } });
});

exports.unpublishSection = catchAsync(async (req, res, next) => {
  const section = await Section.findOne({ _id: req.params.id, isDeleted: false });
  if (!section) return next(new AppError('Section not found', 404));
  
  await verifyCourseOwnership(section.course, req.user.id, req.user.role, next);

  section.isPublished = false;
  await section.save();

  res.status(200).json({ status: 'success', data: { section } });
});

exports.cloneSection = catchAsync(async (req, res, next) => {
  // 1. Verify and fetch the original section
  const originalSection = await Section.findOne({ _id: req.params.id, isDeleted: false }).lean();
  if (!originalSection) return next(new AppError('Section not found', 404));
  
  await verifyCourseOwnership(originalSection.course, req.user.id, req.user.role, next);

  // 2. Create the clone
  const newSectionData = { ...originalSection };
  delete newSectionData._id;
  newSectionData.title = `${originalSection.title} (Copy)`;
  newSectionData.isPublished = false; // Draft by default
  
  // Put it at the end of the syllabus
  const lastSection = await Section.findOne({ course: originalSection.course, isDeleted: false }).sort('-order');
  newSectionData.order = lastSection ? lastSection.order + 1 : 1;

  const clonedSection = await Section.create(newSectionData);

  // 3. Clone all nested lessons associated with this section
  const originalLessons = await Lesson.find({ section: req.params.id, isDeleted: false }).lean();
  
  if (originalLessons.length > 0) {
    const clonedLessons = originalLessons.map(lesson => {
      const newLesson = { ...lesson };
      delete newLesson._id;
      newLesson.section = clonedSection._id; // Attach to new section
      newLesson.isPublished = false;
      return newLesson;
    });
    await Lesson.insertMany(clonedLessons);
  }

  // 4. Update Course stats
  await Course.findByIdAndUpdate(originalSection.course, { $inc: { totalSections: 1 } });

  res.status(201).json({ status: 'success', message: 'Section and lessons cloned successfully', data: { section: clonedSection } });
});

// ==========================================
// STANDARD READ OPERATIONS
// ==========================================
exports.getAllSections = factory.getAll(Section);
exports.getSection = factory.getOne(Section, {
  populate: { path: 'course', select: 'title slug instructor' }
});







// const { Section, Lesson, Course } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');

// exports.setCourseId = (req, res, next) => {
//   if (!req.body.course) req.body.course = req.params.courseId;
//   next();
// };

// exports.createSection = catchAsync(async (req, res, next) => {
//   // Check if course exists and user is instructor
//   const course = await Course.findById(req.body.course);
//   if (!course) {
//     return next(new AppError('No course found with that ID', 404));
//   }

//   if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
//     return next(new AppError('You are not authorized to add sections to this course', 403));
//   }

//   // Get max order for this course
//   const lastSection = await Section.findOne({ course: req.body.course })
//     .sort('-order');
  
//   req.body.order = lastSection ? lastSection.order + 1 : 1;

//   const section = await Section.create(req.body);

//   // Update course total sections
//   await Course.findByIdAndUpdate(req.body.course, {
//     $inc: { totalSections: 1 }
//   });

//   res.status(201).json({
//     status: 'success',
//     data: { section }
//   });
// });

// exports.reorderSections = catchAsync(async (req, res, next) => {
//   const { sections } = req.body; // Array of { id, order }

//   if (!Array.isArray(sections)) {
//     return next(new AppError('Sections array is required', 400));
//   }

//   const course = await Course.findById(req.params.courseId);
//   if (!course) {
//     return next(new AppError('No course found with that ID', 404));
//   }

//   if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
//     return next(new AppError('You are not authorized to reorder sections', 403));
//   }

//   // Update each section's order
//   await Promise.all(
//     sections.map(async ({ id, order }) => {
//       await Section.findByIdAndUpdate(id, { order });
//     })
//   );

//   res.status(200).json({
//     status: 'success',
//     message: 'Sections reordered successfully'
//   });
// });

// exports.getAllSections = factory.getAll(Section);
// exports.getSection = factory.getOne(Section, {
//   populate: {
//     path: 'course',
//     select: 'title slug'
//   }
// });
// exports.updateSection = factory.updateOne(Section);
// exports.deleteSection = factory.deleteOne(Section);