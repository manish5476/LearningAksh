'use strict';
const BaseRepository = require('./BaseRepository');
const { Discussion } = require('../models');

class DiscussionRepository extends BaseRepository {
  constructor() { super(Discussion); }
  
  async incrementReplyCount(discussionId) {
    return await this.model.findByIdAndUpdate(
      discussionId,
      { $inc: { totalReplies: 1 } }
    );
  }
}
module.exports = new DiscussionRepository();