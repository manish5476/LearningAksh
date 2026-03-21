// routes/dropdown.js (Add this before other routes)
const express = require('express');
const dropdownController = require('../controllers/dropdownController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const catchAsync = require("../utils/catchAsync");
const { Course, Category, User, Master, TestSeries, MockTest, Section, Lesson, Quiz, Post } = require('../models');
const router = express.Router();
// ==========================================
// 0. MASTER DATA ROUTES (BEFORE OTHERS)
// ==========================================
// Get master data by type - returns formatted dropdown options
router.get('/master/:type', catchAsync(async (req, res, next) => {
  const { type } = req.params;
  const { search = '' } = req.query;

  let filter = {
    type: type.toLowerCase(),
    isActive: true
  };

  // Add search filter
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } }
    ];
  }

  const items = await Master.find(filter)
    .select('_id name code')
    .sort({ 'metadata.sortOrder': 1, name: 1 })
    .limit(100)
    .lean();

  // Format dropdown options - Return BOTH id and code for flexibility
  const dropdownOptions = items.map(item => ({
    label: item.name,
    value: item._id,  // Store ID for database reference
    code: item.code,   // Store code for validation
    metadata: {
      code: item.code,
      name: item.name
    }
  }));

  res.status(200).json({
    status: "success",
    results: dropdownOptions.length,
    data: dropdownOptions
  });
}));

// Get master data by type but return code as value (for validation compatibility)
router.get('/master/:type/code', catchAsync(async (req, res, next) => {
  const { type } = req.params;
  const { search = '' } = req.query;

  let filter = {
    type: type.toLowerCase(),
    isActive: true
  };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } }
    ];
  }

  const items = await Master.find(filter)
    .select('_id name code')
    .sort({ 'metadata.sortOrder': 1, name: 1 })
    .lean();

  // Return code as value for validation compatibility
  const dropdownOptions = items.map(item => ({
    label: item.name,
    value: item.code.toLowerCase(), // Use code as value (matches validation)
    id: item._id,
    metadata: item
  }));

  res.status(200).json({
    status: "success",
    results: dropdownOptions.length,
    data: dropdownOptions
  });
}));

// ==========================================
// 1. PUBLIC ROUTES
// ==========================================
router.get('/course', dropdownController.getDropdown(Course, 'title'));
router.get('/category', dropdownController.getDropdown(Category, 'name'));
router.get('/user', dropdownController.getDropdown(User, 'email'));

// Exam Models
router.get('/test-series', dropdownController.getDropdown(TestSeries, 'title'));
router.get('/mock-test', dropdownController.getDropdown(MockTest, 'title'));
router.get('/section', dropdownController.getDropdown(Section, 'title'));
router.get('/lesson', dropdownController.getDropdown(Lesson, 'title'));
router.get('/quiz', dropdownController.getDropdown(Quiz, 'title'));

// CMS Models
router.get('/post', dropdownController.getDropdown(Post, 'title'));

// ==========================================
// 2. PROTECTED ROUTES (Require Authentication)
// ==========================================
router.use(protect);

router.get('/course/enhanced', dropdownController.getEnhancedDropdown(Course, 'title'));
router.get('/category/enhanced', dropdownController.getEnhancedDropdown(Category, 'name'));
router.get('/test-series/enhanced', dropdownController.getEnhancedDropdown(TestSeries, 'title'));
router.get('/mock-test/enhanced', dropdownController.getEnhancedDropdown(MockTest, 'title'));
router.get('/post/enhanced', dropdownController.getEnhancedDropdown(Post, 'title'));

// Key-value maps
router.get('/course/map', dropdownController.getKeyValueMap(Course));
router.get('/category/map', dropdownController.getKeyValueMap(Category));
router.get('/post/map', dropdownController.getKeyValueMap(Post));

// ==========================================
// 3. BULK DROPDOWN ROUTE
// ==========================================
router.get('/bulk', catchAsync(async (req, res, next) => {
  const { models } = req.query;
  if (!models) {
    return res.status(200).json({ status: "success", data: {} });
  }

  const modelList = models.split(',');
  const results = {};

  // Parallelize all model fetches
  await Promise.all(modelList.map(async (modelName) => {
    switch(modelName.trim()) {
      case 'course':
        results.courses = await Course.find({ isDeleted: { $ne: true } })
          .select('title _id')
          .lean()
          .then(items => items.map(i => ({ label: i.title, value: i._id })));
        break;
      case 'category':
        results.categories = await Category.find({ isDeleted: { $ne: true } })
          .select('name _id')
          .lean()
          .then(items => items.map(i => ({ label: i.name, value: i._id })));
        break;
      case 'user':
        results.users = await User.find({ isActive: true })
          .select('email _id firstName lastName')
          .lean()
          .then(items => items.map(i => ({ label: i.email, value: i._id })));
        break;
      case 'post_type':
        results.postTypes = await Master.find({ type: 'post_type', isActive: true })
          .select('name code _id')
          .sort({ 'metadata.sortOrder': 1 })
          .lean()
          .then(items => items.map(i => ({ 
            label: i.name, 
            value: i.code.toLowerCase(), // Use code for validation
            id: i._id 
          })));
        break;
      case 'post_status':
        results.postStatuses = await Master.find({ type: 'post_status', isActive: true })
          .select('name code _id')
          .sort({ 'metadata.sortOrder': 1 })
          .lean()
          .then(items => items.map(i => ({ 
            label: i.name, 
            value: i.code.toLowerCase(),
            id: i._id 
          })));
        break;
      case 'language':
        results.languages = await Master.find({ type: 'language', isActive: true })
          .select('name code _id')
          .sort({ 'metadata.sortOrder': 1 })
          .lean()
          .then(items => items.map(i => ({ 
            label: i.name, 
            value: i.code.toLowerCase(),
            id: i._id 
          })));
        break;
    }
  }));

  res.status(200).json({
    status: "success",
    data: results
  });
}));

module.exports = router;



