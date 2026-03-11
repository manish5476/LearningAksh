'use strict';
const BaseRepository = require('./BaseRepository');
const { Assignment } = require('../models');

class AssignmentRepository extends BaseRepository {
  constructor() { 
    super(Assignment); 
  }
}

module.exports = new AssignmentRepository();