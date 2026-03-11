'use strict';
const BaseRepository = require('./BaseRepository');
const { UserBadge } = require('../models');

class UserBadgeRepository extends BaseRepository {
  constructor() { super(UserBadge); }
}
module.exports = new UserBadgeRepository();