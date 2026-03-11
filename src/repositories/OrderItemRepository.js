'use strict';
const BaseRepository = require('./BaseRepository');
const { OrderItem } = require('../models');

class OrderItemRepository extends BaseRepository {
  constructor() { super(OrderItem); }
}
module.exports = new OrderItemRepository();