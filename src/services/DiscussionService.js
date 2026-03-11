'use strict';
const AppError = require('../utils/appError');
const DiscussionRepository = require('../repositories/DiscussionRepository');
const DiscussionReplyRepository = require('../repositories/DiscussionReplyRepository');
const CourseRepository = require('../repositories/CourseRepository');

class DiscussionService {

  async createDiscussion(userId, data) {
    if (!data.course) {
      throw new AppError('A course ID must be provided to create a discussion.', 400);
    }
    
    data.user = userId;
    return await DiscussionRepository.create(data);
  }

  async getCourseDiscussions(courseId, lessonId) {
    if (!courseId) {
      throw new AppError('Please provide a courseId query parameter to fetch discussions.', 400);
    }

    let filter = { course: courseId };
    if (lessonId) filter.lesson = lessonId;

    // We do this heavy population in the Service, keeping the controller clean
    return await DiscussionRepository.model.find(filter)
      .populate('user', 'firstName lastName profilePicture')
      .populate({
        path: 'replies',
        options: { sort: { createdAt: 1 } },
        populate: {
          path: 'user',
          select: 'firstName lastName profilePicture role'
        }
      })
      .sort('-isPinned -createdAt')
      .lean();
  }

  async replyToDiscussion(userId, discussionId, content) {
    if (!content) throw new AppError('Reply content cannot be empty.', 400);

    const reply = await DiscussionReplyRepository.create({
      discussion: discussionId,
      user: userId,
      content
    });

    // Atomic increment of the reply count
    await DiscussionRepository.updateById(discussionId, {
      $inc: { totalReplies: 1 }
    });

    return await DiscussionReplyRepository.model.findById(reply._id)
      .populate('user', 'firstName lastName profilePicture role')
      .lean();
  }

  async toggleLike(userId, type, targetId) {
    const Model = type === 'discussion' 
      ? DiscussionRepository.model 
      : DiscussionReplyRepository.model;

    const doc = await Model.findById(targetId);
    if (!doc) throw new AppError('No document found with that ID', 404);

    const hasLiked = doc.likes.includes(userId);

    // Enterprise Fix: Atomic updates prevent race conditions if 100 users like at once
    const updatedDoc = await Model.findByIdAndUpdate(
      targetId,
      hasLiked ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } },
      { new: true }
    );

    return updatedDoc.likes.length;
  }

  async pinDiscussion(userId, userRole, discussionId) {
    const discussion = await DiscussionRepository.findById(discussionId);
    if (!discussion) throw new AppError('No discussion found with that ID', 404);

    // Security Check: Only the course instructor or an admin can pin
    const course = await CourseRepository.findById(discussion.course);
    if (course.instructor.toString() !== userId.toString() && userRole !== 'admin') {
      throw new AppError('Only the instructor can pin discussions in this course', 403);
    }

    return await DiscussionRepository.updateById(discussionId, { 
      isPinned: !discussion.isPinned 
    });
  }

  async markResolved(userId, userRole, discussionId) {
    const discussion = await DiscussionRepository.findById(discussionId);
    if (!discussion) throw new AppError('No discussion found with that ID', 404);

    const course = await CourseRepository.findById(discussion.course);

    // Security: Only creator, instructor, or admin
    if (
      discussion.user.toString() !== userId.toString() && 
      course.instructor.toString() !== userId.toString() && 
      userRole !== 'admin'
    ) {
      throw new AppError('Unauthorized to mark this discussion as resolved', 403);
    }

    return await DiscussionRepository.updateById(discussionId, { 
      isResolved: !discussion.isResolved 
    });
  }
}

module.exports = new DiscussionService();


// 'use strict';
// const AppError = require('../utils/appError');
// const DiscussionRepository = require('../repositories/DiscussionRepository');
// const DiscussionReplyRepository = require('../repositories/DiscussionReplyRepository');
// const EnrollmentRepository = require('../repositories/EnrollmentRepository');

// class DiscussionService {
  
//   async createDiscussion(studentId, courseId, lessonId, data) {
//     // 1. Validate Enrollment
//     const enrollment = await EnrollmentRepository.findOne({ student: studentId, course: courseId });
//     if (!enrollment || !enrollment.isActive) {
//       throw new AppError('You must be enrolled to post a discussion.', 403);
//     }

//     return await DiscussionRepository.create({
//       user: studentId,
//       course: courseId,
//       lesson: lessonId,
//       title: data.title,
//       content: data.content
//     });
//   }

//   async addReply(userId, discussionId, content) {
//     const discussion = await DiscussionRepository.findById(discussionId);
//     if (!discussion) throw new AppError('Discussion not found.', 404);

//     const reply = await DiscussionReplyRepository.create({
//       discussion: discussionId,
//       user: userId,
//       content
//     });

//     // Increment reply count on parent async
//     DiscussionRepository.incrementReplyCount(discussionId).catch(err => console.error(err));

//     return reply;
//   }
// }

// module.exports = new DiscussionService();