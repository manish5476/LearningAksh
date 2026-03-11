'use strict';
const BaseRepository = require('./BaseRepository');
const { Quiz } = require('../models');

class QuizRepository extends BaseRepository {
  constructor() { 
    super(Quiz); 
  }
}

module.exports = new QuizRepository();