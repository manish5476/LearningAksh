'use strict';
const BaseRepository = require('./BaseRepository');
const { LessonProgress } = require('../models');

class LessonProgressRepository extends BaseRepository {
  constructor() { super(LessonProgress); }
}
module.exports = new LessonProgressRepository();