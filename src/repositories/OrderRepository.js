'use strict';
const BaseRepository = require('./BaseRepository');
const { Order } = require('../models');

class OrderRepository extends BaseRepository {
  constructor() { super(Order); }
}
module.exports = new OrderRepository();