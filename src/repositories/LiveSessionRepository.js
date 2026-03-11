'use strict';
const BaseRepository = require('./BaseRepository');
const { LiveSession } = require('../models');

class LiveSessionRepository extends BaseRepository {
  constructor() { 
    super(LiveSession); 
  }

  // We can add a custom method here to find sessions by instructor
  async findByInstructor(instructorId) {
    return await this.model.find({ instructor: instructorId, isDeleted: false });
  }
}

module.exports = new LiveSessionRepository();