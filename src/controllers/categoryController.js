const { Category } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');
const slugify = require('slugify');

exports.createCategory = catchAsync(async (req, res, next) => {
  // Generate slug from name
  if (req.body.name && !req.body.slug) {
    req.body.slug = slugify(req.body.name, { lower: true });
  }
  
  const category = await Category.create(req.body);
  
  res.status(201).json({
    status: 'success',
    data: { category }
  });
});

exports.getCategoryTree = catchAsync(async (req, res, next) => {
  // Build category tree structure
  const categories = await Category.find({ isDeleted: { $ne: true } }).lean();
  
  const buildTree = (parentId = null) => {
    return categories
      .filter(cat => (cat.parentCategory ? cat.parentCategory.toString() : null) === (parentId ? parentId.toString() : null))
      .map(cat => ({
        ...cat,
        children: buildTree(cat._id)
      }));
  };
  
  const categoryTree = buildTree();
  
  res.status(200).json({
    status: 'success',
    results: categoryTree.length,
    data: { categories: categoryTree }
  });
});

exports.getCategoryWithCourses = catchAsync(async (req, res, next) => {
  const { Course } = require('../models');
  
  const category = await Category.findById(req.params.id);
  if (!category) {
    return next(new AppError('No category found with that ID', 404));
  }
  
  const courses = await Course.find({ 
    category: category._id,
    isPublished: true,
    isApproved: true,
    isDeleted: { $ne: true }
  }).populate('instructor', 'firstName lastName');
  
  res.status(200).json({
    status: 'success',
    data: {
      category,
      courses
    }
  });
});

// CRUD operations
exports.getAllCategories = factory.getAll(Category);
exports.getCategory = factory.getOne(Category);
exports.updateCategory = factory.updateOne(Category);
exports.deleteCategory = factory.deleteOne(Category);