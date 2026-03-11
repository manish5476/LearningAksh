'use strict';
const BaseRepository = require('./BaseRepository');
const { User } = require('../models');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByEmailWithPassword(email) {
    // We need this specifically for login, as password has select: false
    return await this.model.findOne({ email, isDeleted: false }).select('+password').exec();
  }
}

module.exports = new UserRepository();