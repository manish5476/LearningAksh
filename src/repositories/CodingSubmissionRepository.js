'use strict';
const BaseRepository = require('./BaseRepository');
const { CodingSubmission } = require('../models');

class CodingSubmissionRepository extends BaseRepository {
  constructor() { super(CodingSubmission); }
}
module.exports = new CodingSubmissionRepository();