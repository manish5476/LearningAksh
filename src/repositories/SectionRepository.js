'use strict';
const BaseRepository = require('./BaseRepository');
const { Section } = require('../models');

class SectionRepository extends BaseRepository {
  constructor() { super(Section); }
}

module.exports = new SectionRepository();