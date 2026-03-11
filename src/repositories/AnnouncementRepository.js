'use strict';
const BaseRepository = require('./BaseRepository');
const { Announcement } = require('../models');

class AnnouncementRepository extends BaseRepository {
  constructor() { super(Announcement); }
}
module.exports = new AnnouncementRepository();