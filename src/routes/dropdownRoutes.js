const express = require('express');
const dropdownController = require('../controllers/dropdownController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const catchAsync = require("../utils/catchAsync");

// Import your models
const { Course, Category, User, Master } = require('../models');

const router = express.Router();

// Public dropdown routes
router.get('/course', dropdownController.getDropdown(Course, 'title'));
// router.get('/category', dropdownController.getDropdown(Category));
router.get('/user', dropdownController.getDropdown(User, 'email'));
router.get('/master/:type', async (req, res, next) => {
  // Custom handler for master data filtered by type
  req.filter = { type: req.params.type };
  return dropdownController.getDropdown(Master)(req, res, next);
});

// Protected routes (require authentication)
router.use(protect);

// Enhanced dropdowns with metadata
router.get('/course/enhanced', dropdownController.getEnhancedDropdown(Course, 'title'));
router.get('/category/enhanced', dropdownController.getEnhancedDropdown(Category));

// Key-value maps
router.get('/course/map', dropdownController.getKeyValueMap(Course));
router.get('/category/map', dropdownController.getKeyValueMap(Category));

// Bulk dropdown for multiple models at once
router.get('/bulk', catchAsync(async (req, res, next) => {
  const { models } = req.query;
  const modelList = models.split(',');
  
  const results = {};
  
  for (const modelName of modelList) {
    switch(modelName) {
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
          .select('email _id')
          .then(items => items.map(i => ({ label: i.email, value: i._id })));
        break;
    }
  }
  
  res.status(200).json({
    status: "success",
    data: results
  });
}));

module.exports = router;