'use strict';
const BaseRepository = require('./BaseRepository');
const { MockTest } = require('../models');

class MockTestRepository extends BaseRepository {
  constructor() { super(MockTest); }
}
module.exports = new MockTestRepository();