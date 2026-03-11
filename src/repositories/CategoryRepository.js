'use strict';
const BaseRepository = require('./BaseRepository');
const { Category } = require('../models');

class CategoryRepository extends BaseRepository {
  constructor() { super(Category); }

  async findActiveCategories() {
    return await this.model.find({ isActive: true }).lean().exec();
  }
}
module.exports = new CategoryRepository();