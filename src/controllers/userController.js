const { User, InstructorProfile, StudentProfile } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');
const ApiFeatures = require('../utils/ApiFeatures');

// Filter allowed fields for update
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(new AppError('This route is not for password updates. Please use /updateMyPassword.', 400));
  }

  // 2) Filter out unwanted fields for the Base User Model
  const filteredBody = filterObj(
    req.body,
    'firstName',
    'lastName',
    'email',
    'phoneNumber',
    'dateOfBirth',
    'gender',
    'address',
    'profilePicture'
  );

  // 3) Update User document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  // 4) Update role-specific profiles with all safe fields
  if (req.user.role === 'instructor') {
    const instructorFields = filterObj(
      req.body, 
      'bio', 'qualifications', 'expertise', 'experience', 'socialLinks', 'paymentDetails'
    );
    
    // Only query DB if there is actually profile data to update
    if (Object.keys(instructorFields).length > 0) {
        await InstructorProfile.findOneAndUpdate(
        { user: req.user.id },
        instructorFields,
        { new: true, upsert: true, runValidators: true }
        );
    }

  } else if (req.user.role === 'student') {
    const studentFields = filterObj(
      req.body, 
      'education', 'interests', 'preferences'
    );

    if (Object.keys(studentFields).length > 0) {
        await StudentProfile.findOneAndUpdate(
        { user: req.user.id },
        studentFields,
        { new: true, upsert: true, runValidators: true }
        );
    }
  }

  res.status(200).json({
    status: 'success',
    data: { user: updatedUser }
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { isActive: false, isDeleted: true, deletedAt: Date.now() });
  res.status(204).json({ status: 'success', data: null });
});

exports.getUserProfile = catchAsync(async (req, res, next) => {
  let profile;
  
  if (req.user.role === 'instructor') {
    profile = await InstructorProfile.findOne({ user: req.user.id })
      .populate('user', '-password -__v');
  } else if (req.user.role === 'student') {
    profile = await StudentProfile.findOne({ user: req.user.id })
      .populate('user', '-password -__v')
      .populate('enrollments')
      .populate('wishlist');
  } else {
    profile = await User.findById(req.user.id).select('-password -__v');
  }

  // Handle edge case where profile document doesn't exist
  if (!profile) {
    return next(new AppError('Profile not found for this user.', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { profile }
  });
});

// Admin only operations
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const baseFilter = { isActive: true }; // Explicitly filter for active users

  const features = new ApiFeatures(User.find(baseFilter), req.query)
    .filter()
    .search(['firstName', 'lastName', 'email'])
    .sort()
    .limitFields()
    .paginate();

  const result = await features.execute(User);

  res.status(200).json({
    status: 'success',
    results: result.results,
    pagination: result.pagination,
    data: result.data
  });
});

exports.getUser = factory.getOne(User);
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);
