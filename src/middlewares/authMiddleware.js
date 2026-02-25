const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const AppError = require('../utils/appError');

exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(new AppError('You are not logged in. Please log in to access this resource.', 401));
    }

    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    const currentUser = await User.findById(decoded.id).select('-password');
    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    if (currentUser.changedPasswordAfter && currentUser.changedPasswordAfter(decoded.iat)) {
      return next(new AppError('User recently changed password. Please log in again.', 401));
    }

    if (!currentUser.isActive || currentUser.isDeleted) {
      return next(new AppError('Your account has been deactivated. Please contact support.', 401));
    }

    req.user = currentUser;
    res.locals.user = currentUser;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again.', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired. Please log in again.', 401));
    }
    next(error);
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You are not logged in.', 401));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    
    next();
  };
};

exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
      const currentUser = await User.findById(decoded.id).select('-password');
      if (currentUser && currentUser.isActive && !currentUser.isDeleted) {
        req.user = currentUser;
        res.locals.user = currentUser;
      }
    }
    next();
  } catch (error) {
    // Ignore token errors for optional auth
    next();
  }
};

exports.checkOwnership = (Model, ownerField = 'user') => {
  return async (req, res, next) => {
    try {
      const document = await Model.findById(req.params.id);
      
      if (!document) {
        return next(new AppError('Document not found', 404));
      }

      const ownerId = document[ownerField]?.toString();
      
      if (req.user.role === 'admin' || ownerId === req.user.id) {
        req.document = document;
        return next();
      }

      return next(new AppError('You do not own this resource', 403));
    } catch (error) {
      next(error);
    }
  };
};