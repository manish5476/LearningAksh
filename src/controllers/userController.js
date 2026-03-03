const { User, InstructorProfile, StudentProfile } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');

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
exports.getAllUsers = factory.getAll(User);
exports.getUser = factory.getOne(User);
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);

// const { User, InstructorProfile, StudentProfile } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');

// // Filter allowed fields for update
// const filterObj = (obj, ...allowedFields) => {
//   const newObj = {};
//   Object.keys(obj).forEach(el => {
//     if (allowedFields.includes(el)) newObj[el] = obj[el];
//   });
//   return newObj;
// };

// exports.getMe = (req, res, next) => {
//   req.params.id = req.user.id;
//   next();
// };

// exports.updateMe = catchAsync(async (req, res, next) => {
//   // Create error if user POSTs password data
//   if (req.body.password || req.body.passwordConfirm) {
//     return next(new AppError('This route is not for password updates. Please use /updateMyPassword.', 400));
//   }

//   // Filter out unwanted fields
//   const filteredBody = filterObj(
//     req.body,
//     'firstName',
//     'lastName',
//     'email',
//     'phoneNumber',
//     'dateOfBirth',
//     'gender',
//     'address',
//     'profilePicture'
//   );

//   const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
//     new: true,
//     runValidators: true
//   });

//   // Update role-specific profile if needed
//   if (req.user.role === 'instructor' && req.body.expertise) {
//     await InstructorProfile.findOneAndUpdate(
//       { user: req.user.id },
//       { expertise: req.body.expertise, bio: req.body.bio },
//       { new: true, upsert: true }
//     );
//   } else if (req.user.role === 'student' && req.body.interests) {
//     await StudentProfile.findOneAndUpdate(
//       { user: req.user.id },
//       { interests: req.body.interests, education: req.body.education },
//       { new: true, upsert: true }
//     );
//   }

//   res.status(200).json({
//     status: 'success',
//     data: { user: updatedUser }
//   });
// });

// exports.deleteMe = catchAsync(async (req, res, next) => {
//   await User.findByIdAndUpdate(req.user.id, { isActive: false, isDeleted: true, deletedAt: Date.now() });
//   res.status(204).json({ status: 'success', data: null });
// });

// exports.getUserProfile = catchAsync(async (req, res, next) => {
//   let profile;
  
//   if (req.user.role === 'instructor') {
//     profile = await InstructorProfile.findOne({ user: req.user.id })
//       .populate('user', '-password -__v');
//   } else if (req.user.role === 'student') {
//     profile = await StudentProfile.findOne({ user: req.user.id })
//       .populate('user', '-password -__v')
//       .populate('enrollments')
//       .populate('wishlist');
//   } else {
//     profile = await User.findById(req.user.id).select('-password -__v');
//   }

//   res.status(200).json({
//     status: 'success',
//     data: { profile }
//   });
// });

// // Admin only operations
// exports.getAllUsers = factory.getAll(User);
// exports.getUser = factory.getOne(User);
// exports.updateUser = factory.updateOne(User);
// exports.deleteUser = factory.deleteOne(User);