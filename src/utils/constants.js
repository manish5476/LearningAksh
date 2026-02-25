// utils/constants.js
module.exports = {
    USER_ROLES: {
      STUDENT: 'student',
      INSTRUCTOR: 'instructor',
      ADMIN: 'admin'
    },
    
    COURSE_LEVELS: {
      BEGINNER: 'beginner',
      INTERMEDIATE: 'intermediate',
      ADVANCED: 'advanced',
      ALL_LEVELS: 'all-levels'
    },
    
    LESSON_TYPES: {
      VIDEO: 'video',
      ARTICLE: 'article',
      QUIZ: 'quiz',
      ASSIGNMENT: 'assignment',
      CODING: 'coding-exercise'
    },
    
    PAYMENT_STATUS: {
      PENDING: 'pending',
      SUCCESS: 'success',
      FAILED: 'failed',
      REFUNDED: 'refunded'
    },
    
    DISCOUNT_TYPES: {
      PERCENTAGE: 'percentage',
      FIXED: 'fixed_amount',
      FREE: 'free'
    }
  };
  
  // utils/validators.js
  const validator = require('validator');
  
  exports.isValidEmail = (email) => {
    return validator.isEmail(email);
  };
  
  exports.isStrongPassword = (password) => {
    return validator.isStrongPassword(password, {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    });
  };
  
  exports.isValidPhoneNumber = (phone) => {
    return validator.isMobilePhone(phone);
  };
  
  exports.isValidURL = (url) => {
    return validator.isURL(url);
  };
  
  exports.isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
  };