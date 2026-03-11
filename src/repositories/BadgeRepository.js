'use strict';
const BaseRepository = require('./BaseRepository');
const { Badge } = require('../models');

class BadgeRepository extends BaseRepository {
  constructor() { super(Badge); }
}
module.exports = new BadgeRepository();