'use strict';
const BaseRepository = require('./BaseRepository');
const { AssignmentSubmission } = require('../models'); // Make sure this is exported in your models/index.js!

class AssignmentSubmissionRepository extends BaseRepository {
  constructor() { 
    super(AssignmentSubmission); 
  }
}

module.exports = new AssignmentSubmissionRepository();