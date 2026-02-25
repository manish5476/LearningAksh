const { Discussion, DiscussionReply, Course } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

exports.createDiscussion = catchAsync(async (req, res, next) => {
  const { courseId, lessonId } = req.params;
  
  req.body.user = req.user.id;
  req.body.course = courseId;
  if (lessonId) req.body.lesson = lessonId;
  
  const discussion = await Discussion.create(req.body);
  
  res.status(201).json({
    status: 'success',
    data: { discussion }
  });
});

exports.replyToDiscussion = catchAsync(async (req, res, next) => {
  const discussionId = req.params.discussionId;
  
  const reply = await DiscussionReply.create({
    discussion: discussionId,
    user: req.user.id,
    content: req.body.content
  });
  
  // Update total replies count
  await Discussion.findByIdAndUpdate(discussionId, {
    $inc: { totalReplies: 1 }
  });
  
  const populatedReply = await DiscussionReply.findById(reply._id)
    .populate('user', 'firstName lastName profilePicture');
  
  res.status(201).json({
    status: 'success',
    data: { reply: populatedReply }
  });
});

exports.toggleLike = catchAsync(async (req, res, next) => {
  const { type, id } = req.params; // type: 'discussion' or 'reply'
  
  let doc;
  if (type === 'discussion') {
    doc = await Discussion.findById(id);
  } else {
    doc = await DiscussionReply.findById(id);
  }
  
  if (!doc) {
    return next(new AppError('No document found with that ID', 404));
  }
  
  const likeIndex = doc.likes.indexOf(req.user.id);
  
  if (likeIndex === -1) {
    doc.likes.push(req.user.id);
  } else {
    doc.likes.splice(likeIndex, 1);
  }
  
  await doc.save();
  
  res.status(200).json({
    status: 'success',
    data: { likes: doc.likes.length }
  });
});

exports.getCourseDiscussions = catchAsync(async (req, res, next) => {
  const { courseId, lessonId } = req.params;
  
  let filter = { course: courseId };
  if (lessonId) filter.lesson = lessonId;
  
  const discussions = await Discussion.find(filter)
    .populate('user', 'firstName lastName profilePicture')
    .populate({
      path: 'replies',
      options: { sort: { createdAt: 1 } },
      populate: {
        path: 'user',
        select: 'firstName lastName profilePicture'
      }
    })
    .sort('-isPinned -createdAt');
  
  res.status(200).json({
    status: 'success',
    results: discussions.length,
    data: { discussions }
  });
});

exports.pinDiscussion = catchAsync(async (req, res, next) => {
  const discussion = await Discussion.findById(req.params.id);
  
  if (!discussion) {
    return next(new AppError('No discussion found with that ID', 404));
  }
  
  discussion.isPinned = !discussion.isPinned;
  await discussion.save();
  
  res.status(200).json({
    status: 'success',
    data: { discussion }
  });
});

exports.markResolved = catchAsync(async (req, res, next) => {
  const discussion = await Discussion.findById(req.params.id);
  
  if (!discussion) {
    return next(new AppError('No discussion found with that ID', 404));
  }
  
  // Only discussion creator or instructor can mark as resolved
  const course = await Course.findById(discussion.course);
  
  if (discussion.user.toString() !== req.user.id && 
      course.instructor.toString() !== req.user.id && 
      req.user.role !== 'admin') {
    return next(new AppError('Unauthorized to mark this discussion as resolved', 403));
  }
  
  discussion.isResolved = !discussion.isResolved;
  await discussion.save();
  
  res.status(200).json({
    status: 'success',
    data: { discussion }
  });
});

// CRUD operations
exports.getAllDiscussions = factory.getAll(Discussion);
exports.getDiscussion = factory.getOne(Discussion);
exports.updateDiscussion = factory.updateOne(Discussion);
exports.deleteDiscussion = factory.deleteOne(Discussion);