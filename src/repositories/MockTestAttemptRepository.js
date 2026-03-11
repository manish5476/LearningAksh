'use strict';
const BaseRepository = require('./BaseRepository');
const { MockTestAttempt } = require('../models');

class MockTestAttemptRepository extends BaseRepository {
  constructor() { super(MockTestAttempt); }

  async findAttemptsByStudent(studentId) {
    return await this.model.find({ student: studentId }).sort('-startedAt').lean().exec();
  }
}
module.exports = new MockTestAttemptRepository();