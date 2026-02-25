const AppError = require('../utils/appError');

// Permission definitions
const permissions = {
  admin: {
    courses: ['create', 'read', 'update', 'delete', 'approve', 'publish'],
    users: ['create', 'read', 'update', 'delete', 'impersonate'],
    payments: ['read', 'refund'],
    reports: ['read', 'generate'],
    settings: ['read', 'update']
  },
  instructor: {
    courses: ['create', 'read', 'update', 'delete_own', 'publish_own'],
    students: ['read_enrolled'],
    payments: ['read_own'],
    reports: ['read_own']
  },
  student: {
    courses: ['read_enrolled', 'read_free'],
    profile: ['read_own', 'update_own'],
    payments: ['read_own', 'create']
  }
};

exports.checkPermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const userRole = req.user.role;
    const rolePermissions = permissions[userRole];

    if (!rolePermissions) {
      return next(new AppError('Invalid user role', 403));
    }

    const resourcePermissions = rolePermissions[resource];
    
    if (!resourcePermissions) {
      return next(new AppError(`No permissions defined for resource: ${resource}`, 403));
    }

    // Check if action is allowed
    const hasPermission = resourcePermissions.some(permission => {
      if (permission === action) return true;
      if (permission.endsWith('_own') && action.startsWith(permission.replace('_own', ''))) {
        // Handle ownership-based permissions
        return handleOwnership(resource, action, req);
      }
      return false;
    });

    if (!hasPermission) {
      return next(new AppError(`Permission denied: ${action} on ${resource}`, 403));
    }

    next();
  };
};

const handleOwnership = (resource, action, req) => {
  // Check if user owns the resource
  const resourceId = req.params.id;
  const userId = req.user.id;

  switch(resource) {
    case 'courses':
      // Check if course belongs to instructor
      return req.course?.instructor?.toString() === userId;
    case 'users':
      // Check if user is accessing their own profile
      return resourceId === userId;
    default:
      return false;
  }
};

exports.grantAccess = (action, resource) => {
  return (req, res, next) => {
    try {
      const permission = permissions[req.user.role];
      
      if (!permission) {
        return next(new AppError('Permission denied', 403));
      }

      const allowed = permission[resource]?.includes(action) || 
                     permission[resource]?.includes('*');

      if (!allowed) {
        return next(new AppError('Permission denied', 403));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Middleware to check if user can access specific course
exports.canAccessCourse = async (req, res, next) => {
  try {
    const { Course, Enrollment } = require('../models');
    const courseId = req.params.courseId || req.params.id;

    const course = await Course.findById(courseId);
    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    // Check if course is free or user is instructor/admin
    if (course.isFree || req.user.role === 'admin' || course.instructor.toString() === req.user.id) {
      req.course = course;
      return next();
    }

    // Check if user is enrolled
    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: courseId,
      isActive: true
    });

    if (!enrollment) {
      return next(new AppError('You are not enrolled in this course', 403));
    }

    req.course = course;
    req.enrollment = enrollment;
    next();
  } catch (error) {
    next(error);
  }
};