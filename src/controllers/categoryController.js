const { Category, Course } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');
const slugify = require('slugify');

exports.createCategory = catchAsync(async (req, res, next) => {
  // Slug is now handled by model pre-save hook
  const category = await Category.create(req.body);
  res.status(201).json({
    status: 'success',
    data: { category }
  });
});

exports.bulkCreateCategories = catchAsync(async (req, res, next) => {
  if (!req.body.categories || !Array.isArray(req.body.categories)) {
    return next(new AppError('Please send categories as an array in "categories" field', 400));
  }
  const results = [];
  const errors = [];
  for (const cat of req.body.categories) {
    try {
      const created = await Category.create(cat);
      results.push(created);
    } catch (err) {
      errors.push({
        name: cat.name || 'unnamed',
        error: err.message || 'Failed to create category'
      });
    }
  }

  res.status(201).json({
    status: 'partial-success', // or 'success' if you prefer
    created: results.length,
    failed: errors.length,
    data: { categories: results },
    errors: errors.length > 0 ? errors : undefined
  });
});

exports.getCategoryTree = catchAsync(async (req, res, next) => {
  const categories = await Category.find({ isDeleted: false, isActive: true }).lean();
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
  const { status } = req.query;
  const category = await Category.findOne({ _id: req.params.id, isDeleted: false }).lean();

  if (!category) {
    return next(new AppError('No category found with that ID', 404));
  }

  // 1. Find all subcategories recursively to include their courses
  const allCategoryIds = [category._id];
  const getAllSubCategoryIds = async (parentId) => {
    const subs = await Category.find({ parentCategory: parentId, isDeleted: false }).select('_id').lean();
    for (const sub of subs) {
      allCategoryIds.push(sub._id);
      await getAllSubCategoryIds(sub._id);
    }
  };
  await getAllSubCategoryIds(category._id);

  // 2. Build filter (Include drafts only if status=all is passed)
  let courseFilter = {
    category: { $in: allCategoryIds },
    isDeleted: false
  };

  if (status !== 'all') {
    courseFilter.isPublished = true;
    courseFilter.isApproved = true;
  }

  // 3. Find courses with correct population (primaryInstructor)
  const courses = await Course.find(courseFilter)
    .populate('primaryInstructor', 'firstName lastName profilePicture email')
    .sort('-createdAt')
    .lean();

  res.status(200).json({
    status: 'success',
    results: courses.length,
    data: {
      category,
      courseCount: courses.length,
      courses
    }
  });
});

exports.updateCategory = catchAsync(async (req, res, next) => {
  // 1. Prevent circular parenting (Self as parent)
  if (req.body.parentCategory && req.body.parentCategory.toString() === req.params.id) {
    return next(new AppError('A category cannot be its own parent.', 400));
  }

  // Note: Slug is handled by pre-save hook IF name changes
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!category) {
    return next(new AppError('No category found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { category }
  });
});

exports.deleteCategory = catchAsync(async (req, res, next) => {
  // 1. Soft delete the category
  const category = await Category.findByIdAndUpdate(req.params.id, {
    isDeleted: true,
    isActive: false
  });

  if (!category) {
    return next(new AppError('No category found with that ID', 404));
  }

  // 2. RECUSRIVE CASCADE: Soft-delete all subcategories
  const softDeleteChildren = async (parentId) => {
    const children = await Category.find({ parentCategory: parentId, isDeleted: false });
    if (children.length > 0) {
      await Category.updateMany(
        { parentCategory: parentId },
        { isDeleted: true, isActive: false }
      );
      // Recursively delete their children too
      for (const child of children) {
        await softDeleteChildren(child._id);
      }
    }
  };
  await softDeleteChildren(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// ==========================================
// ADVANCED CATEGORY FUNCTIONS
// ==========================================

exports.getPopularCategories = catchAsync(async (req, res, next) => {
  // Find categories with the most published courses
  const popularCategories = await Course.aggregate([
    {
      $match: { isPublished: true, isApproved: true, isDeleted: false }
    },
    {
      $group: {
        _id: '$category',
        courseCount: { $sum: 1 }
      }
    },
    {
      $sort: { courseCount: -1 }
    },
    {
      $limit: req.query.limit ? parseInt(req.query.limit) : 6
    },
    {
      $lookup: {
        from: 'categories', // Mongoose usually pluralizes the collection name
        localField: '_id',
        foreignField: '_id',
        as: 'categoryDetails'
      }
    },
    {
      $unwind: '$categoryDetails'
    },
    {
      $project: {
        _id: 1,
        courseCount: 1,
        name: '$categoryDetails.name',
        slug: '$categoryDetails.slug',
        icon: '$categoryDetails.icon',
        image: '$categoryDetails.image'
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    results: popularCategories.length,
    data: { categories: popularCategories }
  });
});

exports.restoreCategory = catchAsync(async (req, res, next) => {
  // Find a soft-deleted category and restore it
  const category = await Category.findOneAndUpdate(
    { _id: req.params.id, isDeleted: true },
    { isDeleted: false, isActive: true },
    { new: true }
  );

  if (!category) {
    return next(new AppError('No deleted category found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Category successfully restored.',
    data: { category }
  });
});

exports.getCategoryBreadcrumbs = catchAsync(async (req, res, next) => {
  const categoryId = req.params.id;
  const breadcrumbs = [];

  // Start with the current category
  let currentCategory = await Category.findById(categoryId).lean();

  if (!currentCategory) {
    return next(new AppError('Category not found', 404));
  }

  breadcrumbs.unshift({ _id: currentCategory._id, name: currentCategory.name, slug: currentCategory.slug });

  // Loop upwards to find all parents (Assuming max depth is usually 3-4 levels to prevent infinite loops)
  let safetyCounter = 0;
  while (currentCategory.parentCategory && safetyCounter < 5) {
    currentCategory = await Category.findById(currentCategory.parentCategory).lean();
    if (currentCategory) {
      breadcrumbs.unshift({ _id: currentCategory._id, name: currentCategory.name, slug: currentCategory.slug });
    }
    safetyCounter++;
  }

  res.status(200).json({
    status: 'success',
    data: { breadcrumbs }
  });
});

// Standard Factory routes for simple gets
exports.getAllCategories = factory.getAll(Category);
exports.getCategory = factory.getOne(Category, {
  populate: [
    { path: 'parentCategory', select: 'name slug' },
    { path: 'subCategories', select: 'name slug' }
  ]
});
