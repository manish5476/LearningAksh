'use strict';
const BaseRepository = require('./BaseRepository');
const { Course } = require('../models');

class CourseRepository extends BaseRepository {
  constructor() {
    super(Course);
  }

  // Custom DB operations specific to Courses live here!
  async findPublishedCoursesByInstructor(instructorId) {
    return await this.model.find({
      instructor: instructorId,
      status: 'published',
      isDeleted: false
    }).lean().exec();
  }

  // Example: Optimized aggregation that used to be a Mongoose hook
  async updateCourseStats(courseId) {
    // We will call this from the Service layer, NOT a pre-save hook
    // Logic to aggregate totals goes here
  }
}

module.exports = new CourseRepository();