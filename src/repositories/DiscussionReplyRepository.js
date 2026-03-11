'use strict';
const BaseRepository = require('./BaseRepository');
const { DiscussionReply } = require('../models');

class DiscussionReplyRepository extends BaseRepository {
  constructor() { super(DiscussionReply); }
}
module.exports = new DiscussionReplyRepository();