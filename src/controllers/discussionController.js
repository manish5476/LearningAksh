'use strict';
const catchAsync = require('../utils/catchAsync');
const DiscussionService = require('../services/DiscussionService');
const DiscussionRepository = require('../repositories/DiscussionRepository');

// ==========================================
// CORE Q&A ACTIONS
// ==========================================

exports.createDiscussion = catchAsync(async (req, res, next) => {
  const discussion = await DiscussionService.createDiscussion(req.user.id, req.body);
  res.status(201).json({ status: 'success', data: { discussion } });
});

exports.getCourseDiscussions = catchAsync(async (req, res, next) => {
  const discussions = await DiscussionService.getCourseDiscussions(req.query.courseId, req.query.lessonId);
  res.status(200).json({ status: 'success', results: discussions.length, data: { discussions } });
});

exports.replyToDiscussion = catchAsync(async (req, res, next) => {
  const reply = await DiscussionService.replyToDiscussion(req.user.id, req.params.discussionId, req.body.content);
  res.status(201).json({ status: 'success', data: { reply } });
});

exports.toggleLike = catchAsync(async (req, res, next) => {
  const likesCount = await DiscussionService.toggleLike(req.user.id, req.params.type, req.params.id);
  res.status(200).json({ status: 'success', data: { likes: likesCount } });
});

// ==========================================
// MODERATION ACTIONS
// ==========================================

exports.pinDiscussion = catchAsync(async (req, res, next) => {
  const discussion = await DiscussionService.pinDiscussion(req.user.id, req.user.role, req.params.id);
  res.status(200).json({ status: 'success', data: { discussion } });
});

exports.markResolved = catchAsync(async (req, res, next) => {
  const discussion = await DiscussionService.markResolved(req.user.id, req.user.role, req.params.id);
  res.status(200).json({ status: 'success', data: { discussion } });
});

// ==========================================
// STANDARD CRUD REPLACEMENTS
// ==========================================

exports.getAllDiscussions = catchAsync(async (req, res, next) => {
  const result = await DiscussionRepository.findMany(req.query);
  res.status(200).json({ status: 'success', results: result.results, data: { discussions: result.data } });
});

exports.getDiscussion = catchAsync(async (req, res, next) => {
  const discussion = await DiscussionRepository.findById(req.params.id);
  res.status(200).json({ status: 'success', data: { discussion } });
});

exports.updateDiscussion = catchAsync(async (req, res, next) => {
  const discussion = await DiscussionRepository.updateById(req.params.id, req.body);
  res.status(200).json({ status: 'success', data: { discussion } });
});

exports.deleteDiscussion = catchAsync(async (req, res, next) => {
  await DiscussionRepository.deleteById(req.params.id);
  res.status(204).json({ status: 'success', data: null });
});



// const { Discussion, DiscussionReply, Course } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');

// exports.createDiscussion = catchAsync(async (req, res, next) => {
//   // ✅ Changed: We now extract course and lesson from req.body instead of req.params
//   if (!req.body.course) {
//     return next(new AppError('A course ID must be provided to create a discussion.', 400));
//   }
  
//   req.body.user = req.user.id;
  
//   const discussion = await Discussion.create(req.body);
  
//   res.status(201).json({
//     status: 'success',
//     data: { discussion }
//   });
// });

// exports.getCourseDiscussions = catchAsync(async (req, res, next) => {
//   // ✅ Changed: We now look for courseId and lessonId in the Query Parameters (?courseId=...)
//   const { courseId, lessonId } = req.query;
  
//   if (!courseId) {
//     return next(new AppError('Please provide a courseId query parameter to fetch discussions.', 400));
//   }
  
//   let filter = { course: courseId };
//   if (lessonId) filter.lesson = lessonId;
  
//   const discussions = await Discussion.find(filter)
//     .populate('user', 'firstName lastName profilePicture')
//     .populate({
//       path: 'replies',
//       options: { sort: { createdAt: 1 } },
//       populate: {
//         path: 'user',
//         select: 'firstName lastName profilePicture role' // Good idea to include role for instructor badges
//       }
//     })
//     .sort('-isPinned -createdAt');
  
//   res.status(200).json({
//     status: 'success',
//     results: discussions.length,
//     data: { discussions }
//   });
// });

// exports.replyToDiscussion = catchAsync(async (req, res, next) => {
//   const discussionId = req.params.discussionId;
  
//   if (!req.body.content) {
//     return next(new AppError('Reply content cannot be empty.', 400));
//   }

//   const reply = await DiscussionReply.create({
//     discussion: discussionId,
//     user: req.user.id,
//     content: req.body.content
//   });
  
//   // Update total replies count on the parent discussion
//   await Discussion.findByIdAndUpdate(discussionId, {
//     $inc: { totalReplies: 1 }
//   });
  
//   const populatedReply = await DiscussionReply.findById(reply._id)
//     .populate('user', 'firstName lastName profilePicture role');
  
//   res.status(201).json({
//     status: 'success',
//     data: { reply: populatedReply }
//   });
// });

// exports.toggleLike = catchAsync(async (req, res, next) => {
//   const { type, id } = req.params; // type: 'discussion' or 'reply'
  
//   let doc;
//   if (type === 'discussion') {
//     doc = await Discussion.findById(id);
//   } else {
//     doc = await DiscussionReply.findById(id);
//   }
  
//   if (!doc) {
//     return next(new AppError('No document found with that ID', 404));
//   }
  
//   const likeIndex = doc.likes.indexOf(req.user.id);
  
//   if (likeIndex === -1) {
//     doc.likes.push(req.user.id); // Add Like
//   } else {
//     doc.likes.splice(likeIndex, 1); // Remove Like
//   }
  
//   await doc.save();
  
//   res.status(200).json({
//     status: 'success',
//     data: { likes: doc.likes.length }
//   });
// });

// exports.pinDiscussion = catchAsync(async (req, res, next) => {
//   const discussion = await Discussion.findById(req.params.id);
  
//   if (!discussion) {
//     return next(new AppError('No discussion found with that ID', 404));
//   }
  
//   // Optional security check: Ensure user is the instructor or admin
  
//   discussion.isPinned = !discussion.isPinned;
//   await discussion.save();
  
//   res.status(200).json({
//     status: 'success',
//     data: { discussion }
//   });
// });

// exports.markResolved = catchAsync(async (req, res, next) => {
//   const discussion = await Discussion.findById(req.params.id);
  
//   if (!discussion) {
//     return next(new AppError('No discussion found with that ID', 404));
//   }
  
//   // Only discussion creator or instructor can mark as resolved
//   const course = await Course.findById(discussion.course);
  
//   if (discussion.user.toString() !== req.user.id && 
//       course.instructor.toString() !== req.user.id && 
//       req.user.role !== 'admin') {
//     return next(new AppError('Unauthorized to mark this discussion as resolved', 403));
//   }
  
//   discussion.isResolved = !discussion.isResolved;
//   await discussion.save();
  
//   res.status(200).json({
//     status: 'success',
//     data: { discussion }
//   });
// });

// // CRUD operations
// exports.getAllDiscussions = factory.getAll(Discussion);
// exports.getDiscussion = factory.getOne(Discussion);
// exports.updateDiscussion = factory.updateOne(Discussion);
// exports.deleteDiscussion = factory.deleteOne(Discussion);
