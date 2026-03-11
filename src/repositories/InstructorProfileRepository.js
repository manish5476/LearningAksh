'use strict';
const BaseRepository = require('./BaseRepository');
const { InstructorProfile } = require('../models');

class InstructorProfileRepository extends BaseRepository {
  constructor() { super(InstructorProfile); }
  
  async findByUserId(userId) {
    return await this.model.findOne({ user: userId }).lean().exec();
  }
}
module.exports = new InstructorProfileRepository();