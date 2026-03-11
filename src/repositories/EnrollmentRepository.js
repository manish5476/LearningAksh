'use strict';
const BaseRepository = require('./BaseRepository');
const { Enrollment } = require('../models');

class EnrollmentRepository extends BaseRepository {
  constructor() { super(Enrollment); }
}
module.exports = new EnrollmentRepository();