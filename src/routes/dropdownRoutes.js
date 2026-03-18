const express = require('express');
const dropdownController = require('../controllers/dropdownController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const catchAsync = require("../utils/catchAsync");

// ✅ FIX: Imported all the new LMS and Exam models
const { 
  Course, 
  Category, 
  User, 
  Master, 
  TestSeries, 
  MockTest, 
  Section, 
  Lesson, 
  Quiz 
} = require('../models');

const router = express.Router();

// ==========================================
// 1. PUBLIC ROUTES
// ==========================================
router.get('/course', dropdownController.getDropdown(Course, 'title'));
// ✅ FIX: Uncommented and properly mapped the Category route
router.get('/category', dropdownController.getDropdown(Category, 'name'));
router.get('/user', dropdownController.getDropdown(User, 'email'));

// New Models
router.get('/test-series', dropdownController.getDropdown(TestSeries, 'title'));
router.get('/mock-test', dropdownController.getDropdown(MockTest, 'title'));
router.get('/section', dropdownController.getDropdown(Section, 'title'));
router.get('/lesson', dropdownController.getDropdown(Lesson, 'title'));
router.get('/quiz', dropdownController.getDropdown(Quiz, 'title'));

router.get('/master/:type', async (req, res, next) => {
  // Custom handler for master data filtered by type
  req.filter = { type: req.params.type };
  return dropdownController.getDropdown(Master, 'name')(req, res, next);
});

// ==========================================
// 2. PROTECTED ROUTES (Require Authentication)
// ==========================================
router.use(protect);

// Enhanced dropdowns with metadata (Great for PrimeNG custom templates)
router.get('/course/enhanced', dropdownController.getEnhancedDropdown(Course, 'title'));
router.get('/category/enhanced', dropdownController.getEnhancedDropdown(Category, 'name'));
router.get('/test-series/enhanced', dropdownController.getEnhancedDropdown(TestSeries, 'title'));
router.get('/mock-test/enhanced', dropdownController.getEnhancedDropdown(MockTest, 'title'));

// Key-value maps
router.get('/course/map', dropdownController.getKeyValueMap(Course));
router.get('/category/map', dropdownController.getKeyValueMap(Category));

// ==========================================
// 3. BULK DROPDOWN ROUTE
// ==========================================
// Usage: /api/dropdowns/bulk?models=course,category,testSeries
router.get('/bulk', catchAsync(async (req, res, next) => {
  const { models } = req.query;
  if (!models) {
    return res.status(200).json({ status: "success", data: {} });
  }

  const modelList = models.split(',');
  const results = {};
  
  for (const modelName of modelList) {
    switch(modelName.trim()) {
      case 'course':
        results.courses = await Course.find({ isDeleted: { $ne: true } })
          .select('title _id')
          .then(items => items.map(i => ({ label: i.title, value: i._id })));
        break;
      case 'category':
        results.categories = await Category.find({ isDeleted: { $ne: true } })
          .select('name _id')
          .then(items => items.map(i => ({ label: i.name, value: i._id })));
        break;
      case 'user':
        results.users = await User.find({ isActive: true })
          .select('email _id firstName lastName') // Added names just in case you want to change the label later
          .then(items => items.map(i => ({ label: i.email, value: i._id })));
        break;
      case 'testSeries':
        results.testSeries = await TestSeries.find({ isDeleted: { $ne: true } })
          .select('title _id')
          .then(items => items.map(i => ({ label: i.title, value: i._id })));
        break;
      case 'mockTest':
        results.mockTests = await MockTest.find({ isDeleted: { $ne: true } })
          .select('title _id')
          .then(items => items.map(i => ({ label: i.title, value: i._id })));
        break;
      case 'section':
        results.sections = await Section.find({ isDeleted: { $ne: true } })
          .select('title _id')
          .then(items => items.map(i => ({ label: i.title, value: i._id })));
        break;
      case 'lesson':
        results.lessons = await Lesson.find({ isDeleted: { $ne: true } })
          .select('title _id')
          .then(items => items.map(i => ({ label: i.title, value: i._id })));
        break;
    }
  }
  
  res.status(200).json({
    status: "success",
    data: results
  });
}));

module.exports = router;