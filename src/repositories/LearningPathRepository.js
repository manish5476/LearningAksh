'use strict';
const BaseRepository = require('./BaseRepository');
const { LearningPath } = require('../models');

class LearningPathRepository extends BaseRepository {
  constructor() { 
    super(LearningPath); 
  }
}

module.exports = new LearningPathRepository();