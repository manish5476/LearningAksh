'use strict';
const BaseRepository = require('./BaseRepository');
const { Lesson } = require('../models');

class LessonRepository extends BaseRepository {
  constructor() { super(Lesson); }
}
module.exports = new LessonRepository();