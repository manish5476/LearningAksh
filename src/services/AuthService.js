'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const AppError = require('../utils/appError');
const UserRepository = require('../repositories/UserRepository');
const InstructorProfileRepository = require('../repositories/InstructorProfileRepository');
const { signAccessToken } = require('../utils/authUtils');
const EventDispatcher = require('../events/EventDispatcher'); // For sending emails

class AuthService {
  
  async register(userData) {
    if (userData.password !== userData.confirmPassword) {
      throw new AppError('Passwords do not match!', 400);
    }

    const existingUser = await UserRepository.findOne({ email: userData.email });
    if (existingUser) throw new AppError('User already exists with this email', 400);

    const allowedRoles = ['student', 'instructor'];
    const assignedRole = allowedRoles.includes(userData.role) ? userData.role : 'student';

    // Hash password here, not in Mongoose
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    const newUser = await UserRepository.create({
      ...userData,
      password: hashedPassword,
      role: assignedRole
    });

    try {
      if (newUser.role === 'instructor') {
        await InstructorProfileRepository.create({
          user: newUser._id,
          expertise: userData.expertise || [],
          bio: userData.bio || ''
        });
      } else {
        // Assuming you make a StudentProfileRepository
        // await StudentProfileRepository.create({ user: newUser._id, ... });
      }
    } catch (err) {
      // Rollback
      await UserRepository.deleteById(newUser._id, true); // Hard delete
      throw new AppError('Failed to create user profile. Please try again.', 500);
    }

    const token = signAccessToken(newUser);
    newUser.password = undefined; // Hide from output
    
    return { user: newUser, token };
  }

  async login(email, password) {
    if (!email || !password) throw new AppError('Please provide email and password!', 400);

    const user = await UserRepository.findByEmailWithPassword(email);
    if (!user) throw new AppError('Incorrect email or password', 401);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AppError('Incorrect email or password', 401);

    if (!user.isActive || user.isDeleted) throw new AppError('Your account has been deactivated', 401);

    // Fire and forget update
    UserRepository.updateById(user._id, { lastLogin: Date.now() }).catch(() => {});

    const token = signAccessToken(user);
    user.password = undefined;

    return { user, token };
  }

  async forgotPassword(email, resetUrlBase) {
    const user = await UserRepository.findOne({ email });
    if (!user) throw new AppError('There is no user with that email address.', 404);

    // Generate token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    await UserRepository.updateById(user._id, {
      passwordResetToken: hashedToken,
      passwordResetExpires: Date.now() + 10 * 60 * 1000 // 10 mins
    });

    const resetURL = `${resetUrlBase}/${resetToken}`;

    // FIRE EVENT: Let BullMQ/Background worker send the email so the API is fast
    EventDispatcher.emit('auth.forgotPassword', { email: user.email, resetURL });

    return true;
  }

  async resetPassword(resetToken, newPassword, confirmPassword) {
    if (newPassword !== confirmPassword) throw new AppError('Passwords do not match!', 400);

    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    const user = await UserRepository.model.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) throw new AppError('Token is invalid or has expired', 400);

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = Date.now();
    await user.save(); // Using save here safely because we need the document updated directly

    const token = signAccessToken(user);
    user.password = undefined;

    return { user, token };
  }
}

module.exports = new AuthService();


// 'use strict';
// const bcrypt = require('bcryptjs');
// const AppError = require('../utils/appError');
// const UserRepository = require('../repositories/UserRepository');
// const StudentProfileRepository = require('../repositories/StudentProfileRepository'); // Or your equivalent
// const { signAccessToken, signRefreshToken } = require('../utils/jwt');

// class AuthService {
  
//   async registerStudent(userData) {
//     // 1. Check if user exists
//     const existingUser = await UserRepository.findOne({ email: userData.email });
//     if (existingUser) throw new AppError('Email is already in use', 400);

//     // 2. Hash password HERE, not in Mongoose
//     const hashedPassword = await bcrypt.hash(userData.password, 12);

//     // 3. Create the Base User
//     const newUser = await UserRepository.create({
//       ...userData,
//       password: hashedPassword,
//       role: 'student'
//     });

//     // 4. Create the linked Student Profile
//     await StudentProfileRepository.create({ user: newUser._id });

//     // 5. Generate Tokens
//     const accessToken = signAccessToken(newUser);
//     const refreshToken = signRefreshToken(newUser);

//     // Remove password from returned object
//     newUser.password = undefined;

//     return { user: newUser, accessToken, refreshToken };
//   }

//   async login(email, password) {
//     // 1. Fetch user WITH password (we created this custom repo method earlier)
//     const user = await UserRepository.findByEmailWithPassword(email);
//     if (!user) throw new AppError('Invalid email or password', 401);

//     // 2. Compare Passwords
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) throw new AppError('Invalid email or password', 401);

//     // 3. Update last login asynchronously (fire and forget)
//     UserRepository.updateById(user._id, { lastLogin: new Date() }).catch(err => console.error(err));

//     // 4. Generate Tokens
//     const accessToken = signAccessToken(user);
//     const refreshToken = signRefreshToken(user);

//     user.password = undefined; // Don't send hash to client
//     return { user, accessToken, refreshToken };
//   }
// }

// module.exports = new AuthService();