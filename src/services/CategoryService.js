'use strict';
const slugify = require('slugify');
const AppError = require('../utils/appError');
const CategoryRepository = require('../repositories/CategoryRepository');
const CourseRepository = require('../repositories/CourseRepository');

class CategoryService {

  async createCategory(data) {
    if (data.name && !data.slug) {
      data.slug = slugify(data.name, { lower: true, strict: true });
    }
    return await CategoryRepository.create(data);
  }

  async updateCategory(id, data) {
    if (data.name && !data.slug) {
      data.slug = slugify(data.name, { lower: true, strict: true });
    }
    const category = await CategoryRepository.updateById(id, data);
    if (!category) throw new AppError('No category found with that ID', 404);
    return category;
  }

  async deleteCategory(id) {
    const success = await CategoryRepository.deleteById(id);
    if (!success) throw new AppError('No category found with that ID', 404);
    return true;
  }

  async restoreCategory(id) {
    const category = await CategoryRepository.model.findOneAndUpdate(
      { _id: id, isDeleted: true },
      { isDeleted: false, isActive: true },
      { new: true }
    );
    if (!category) throw new AppError('No deleted category found with that ID', 404);
    return category;
  }

  // ==========================================
  // TREES & HIERARCHIES
  // ==========================================

  async getCategoryTree() {
    const categories = await CategoryRepository.findActiveCategories();

    // Recursive tree builder
    const buildTree = (parentId = null) => {
      return categories
        .filter(cat => (cat.parentCategory ? cat.parentCategory.toString() : null) === (parentId ? parentId.toString() : null))
        .map(cat => ({
          ...cat,
          children: buildTree(cat._id)
        }));
    };

    return buildTree();
  }

  async getBreadcrumbs(categoryId) {
    const breadcrumbs = [];
    let currentCategory = await CategoryRepository.findById(categoryId);
    
    if (!currentCategory) throw new AppError('Category not found', 404);

    breadcrumbs.unshift({ 
      _id: currentCategory._id, 
      name: currentCategory.name, 
      slug: currentCategory.slug 
    });

    // Walk up the tree (safety cap at depth 5 to prevent infinite loops from bad data)
    let depth = 0;
    while (currentCategory.parentCategory && depth < 5) {
      currentCategory = await CategoryRepository.findById(currentCategory.parentCategory);
      if (currentCategory) {
        breadcrumbs.unshift({ 
          _id: currentCategory._id, 
          name: currentCategory.name, 
          slug: currentCategory.slug 
        });
      }
      depth++;
    }

    return breadcrumbs;
  }

  // ==========================================
  // CROSS-DOMAIN AGGREGATIONS
  // ==========================================

  async getCategoryWithCourses(categoryId) {
    const category = await CategoryRepository.findById(categoryId);
    if (!category) throw new AppError('No category found with that ID', 404);

    // Notice we use the CourseRepository here, not Mongoose directly
    const coursesResult = await CourseRepository.findMany(
      {}, // no query string
      { category: category._id, isPublished: true, isApproved: true }, // custom filter
      { path: 'instructor', select: 'firstName lastName profilePicture' }
    );

    return { category, courses: coursesResult.data };
  }

  async getPopularCategories(limit = 6) {
    // This heavy aggregation belongs in the CourseRepository, not the controller
    return await CourseRepository.aggregatePopularCategories(limit);
  }
}

module.exports = new CategoryService();