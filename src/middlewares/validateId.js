const mongoose = require('mongoose');
const AppError = require('../utils/appError');

exports.validateMongoId = (req, res, next) => {
  // Check if there is an ID in the params and if it's valid
  if (req.params.id && !mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError(`Invalid ID format: ${req.params.id}`, 400));
  }
  next();
};

// Add this helper function
exports.checkValidId = (req, res, next) => {
    // If the route has an 'id' param, and it's not a valid Mongo ID
    if (req.params.id && !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(new AppError('Invalid Course ID format', 400));
    }
    next();
  };