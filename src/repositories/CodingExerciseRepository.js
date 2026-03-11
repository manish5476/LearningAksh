'use strict';
const BaseRepository = require('./BaseRepository');
const { CodingExercise } = require('../models');

class CodingExerciseRepository extends BaseRepository {
  constructor() { super(CodingExercise); }
}
module.exports = new CodingExerciseRepository();