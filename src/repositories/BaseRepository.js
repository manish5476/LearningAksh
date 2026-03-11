'use strict';
const ApiFeatures = require('../utils/ApiFeatures');
const AppError = require('../utils/appError');

class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  // 1. CREATE
  async create(data) {
    return await this.model.create(data);
  }

  // 2. READ (Single)
  async findById(id, populateOptions = null) {
    let query = this.model.findOne({ _id: id, isDeleted: { $ne: true } });
    
    if (populateOptions) {
      query = query.populate(populateOptions);
    }
    
    return await query.lean().exec(); // .lean() converts Mongoose doc to plain JS object for massive performance boost
  }

  async findOne(filter, populateOptions = null) {
    let query = this.model.findOne({ ...filter, isDeleted: { $ne: true } });
    
    if (populateOptions) query = query.populate(populateOptions);
    
    return await query.lean().exec();
  }

  // 3. READ (Many - integrating your ApiFeatures)
  async findMany(queryString, customFilter = {}, populateOptions = null) {
    const baseFilter = { ...customFilter, isDeleted: { $ne: true } };
    
    const features = new ApiFeatures(this.model.find(baseFilter), queryString)
      .filter()
      .search(["title", "name", "description", "email"]) // Defaults, can be overridden
      .sort()
      .limitFields()
      .paginate();

    if (populateOptions) {
      features.query = features.query.populate(populateOptions);
    }

    // Execute will return { data, results, pagination } based on your utility
    return await features.execute(); 
  }

  // 4. UPDATE
  async updateById(id, updateData) {
    const doc = await this.model.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      updateData,
      { new: true, runValidators: true }
    ).lean().exec();

    if (!doc) throw new AppError('Document not found', 404);
    return doc;
  }

  // 5. DELETE (Soft Delete by default)
  async deleteById(id, hardDelete = false) {
    if (hardDelete) {
      return await this.model.findByIdAndDelete(id);
    }

    const doc = await this.model.findOneAndUpdate(
      { _id: id },
      { isDeleted: true, isActive: false, deletedAt: new Date() },
      { new: true }
    );

    if (!doc) throw new AppError('Document not found', 404);
    return true;
  }

  // 6. UTILITY
  async count(filter = {}) {
    return await this.model.countDocuments({ ...filter, isDeleted: { $ne: true } });
  }
}

module.exports = BaseRepository;