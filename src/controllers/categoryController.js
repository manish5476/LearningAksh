const { Category, Course } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');
const slugify = require('slugify');

exports.createCategory = catchAsync(async (req, res, next) => {
  // Generate slug from name, strict strips out weird special characters
  if (req.body.name && !req.body.slug) {
    req.body.slug = slugify(req.body.name, { lower: true, strict: true });
  }
  
  const category = await Category.create(req.body);
  
  res.status(201).json({
    status: 'success',
    data: { category }
  });
});

exports.getCategoryTree = catchAsync(async (req, res, next) => {
  // Fetch only active categories
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
  const category = await Category.findOne({ _id: req.params.id, isDeleted: false });
  
  if (!category) {
    return next(new AppError('No category found with that ID', 404));
  }
  
  const courses = await Course.find({ 
    category: category._id,
    isPublished: true,
    isApproved: true,
    isDeleted: false
  }).populate('instructor', 'firstName lastName profilePicture');
  
  res.status(200).json({
    status: 'success',
    results: courses.length,
    data: {
      category,
      courses
    }
  });
});

// Custom Update to handle Slugs safely
exports.updateCategory = catchAsync(async (req, res, next) => {
  if (req.body.name && !req.body.slug) {
    req.body.slug = slugify(req.body.name, { lower: true, strict: true });
  }

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

// Custom Delete to handle Soft Deletes
exports.deleteCategory = catchAsync(async (req, res, next) => {
  // Soft delete the category instead of permanently deleting it
  const category = await Category.findByIdAndUpdate(req.params.id, { 
    isDeleted: true,
    isActive: false 
  });

  if (!category) {
    return next(new AppError('No category found with that ID', 404));
  }

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
      $limit: req.query.limit ? parseInt(req.query.limit) : 6 // Default to top 6
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
exports.getCategory = factory.getOne(Category);



// const { Category } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');
// const slugify = require('slugify');

// exports.createCategory = catchAsync(async (req, res, next) => {
//   // Generate slug from name
//   if (req.body.name && !req.body.slug) {
//     req.body.slug = slugify(req.body.name, { lower: true });
//   }
//   const category = await Category.create(req.body);
//   res.status(201).json({
//     status: 'success',
//     data: { category }
//   });
// });

// exports.getCategoryTree = catchAsync(async (req, res, next) => {
//   const categories = await Category.find({ isDeleted: { $ne: true } }).lean();
//   const buildTree = (parentId = null) => {
//     return categories
//       .filter(cat => (cat.parentCategory ? cat.parentCategory.toString() : null) === (parentId ? parentId.toString() : null))
//       .map(cat => ({
//         ...cat,
//         children: buildTree(cat._id)
//       }));
//   };
//   const categoryTree = buildTree();
//   res.status(200).json({
//     status: 'success',
//     results: categoryTree.length,
//     data: { categories: categoryTree }
//   });
// });

// exports.getCategoryWithCourses = catchAsync(async (req, res, next) => {
//   const { Course } = require('../models');
//   const category = await Category.findById(req.params.id);
//   if (!category) {
//     return next(new AppError('No category found with that ID', 404));
//   }
//   const courses = await Course.find({ 
//     category: category._id,
//     isPublished: true,
//     isApproved: true,
//     isDeleted: { $ne: true }
//   }).populate('instructor', 'firstName lastName');
//   res.status(200).json({
//     status: 'success',
//     data: {
//       category,
//       courses
//     }
//   });
// });

// // CRUD operations
// exports.getAllCategories = factory.getAll(Category);
// exports.getCategory = factory.getOne(Category);
// exports.updateCategory = factory.updateOne(Category);
// exports.deleteCategory = factory.deleteOne(Category);