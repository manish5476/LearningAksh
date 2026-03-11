'use strict';
const BaseRepository = require('./BaseRepository');
const { StudentNote } = require('../models');

class StudentNoteRepository extends BaseRepository {
  constructor() { super(StudentNote); }
}
module.exports = new StudentNoteRepository();