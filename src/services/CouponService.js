'use strict';
const AppError = require('../utils/appError');
const CouponRepository = require('../repositories/CouponRepository');
const CourseRepository = require('../repositories/CourseRepository');
const OrderRepository = require('../repositories/OrderRepository'); // Replaced Payment with Order

class CouponService {

  generateCouponCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async createCoupon(user, data) {
    data.code = data.code ? data.code.toUpperCase() : this.generateCouponCode();
    
    // Assign ownership if an instructor is creating it
    if (user.role === 'instructor') {
      data.instructor = user.id;
    }
    
    return await CouponRepository.create(data);
  }

  async validateAndCalculateDiscount(code, courseId) {
    const coupon = await CouponRepository.model.findOne({ 
      code: code.toUpperCase(),
      isActive: true,
      startDate: { $lte: new Date() },
      expiryDate: { $gte: new Date() }
    });

    if (!coupon) throw new AppError('Invalid or expired coupon code', 400);

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new AppError('Coupon usage limit has been reached', 400);
    }

    // Check course restrictions
    if (coupon.validForCourses && coupon.validForCourses.length > 0) {
      const isValidForCourse = coupon.validForCourses.some(id => id.toString() === courseId.toString());
      if (!isValidForCourse) throw new AppError('This coupon is not valid for the selected course', 400);
    }

    // Calculate discount
    let discountAmount = 0;
    let finalPrice = 0;

    if (courseId) {
      const course = await CourseRepository.findById(courseId);
      if (!course) throw new AppError('Course not found', 404);

      const originalPrice = course.discountPrice || course.price;

      if (coupon.discountType === 'percentage') {
        discountAmount = (originalPrice * coupon.discountValue) / 100;
      } else if (coupon.discountType === 'fixed_amount') {
        discountAmount = Math.min(coupon.discountValue, originalPrice);
      } else if (coupon.discountType === 'free') {
        discountAmount = originalPrice;
      }
      
      finalPrice = Math.max(0, originalPrice - discountAmount); // Ensure price doesn't go below 0
    }

    return { coupon, discountAmount, finalPrice };
  }

  async applyCouponToOrder(code, orderId, discountAmount) {
    // Atomic update: only increment if usedCount is less than usageLimit
    const coupon = await CouponRepository.model.findOneAndUpdate(
      { 
        code: code.toUpperCase(),
        isActive: true,
        $expr: { $lt: ['$usedCount', { $ifNull: ['$usageLimit', 999999999] }] } // handles null limits
      },
      { $inc: { usedCount: 1 } },
      { new: true }
    );

    if (!coupon) throw new AppError('Coupon limit reached or invalid', 400);

    // Update the Order (Our new commerce schema)
    await OrderRepository.updateById(orderId, {
      coupon: coupon._id,
      discountAmount: discountAmount
    });

    return coupon;
  }

  async deactivateCoupon(couponId, instructorId) {
    const coupon = await CouponRepository.model.findOneAndUpdate(
      { 
        _id: couponId,
        $or: [
          { instructor: instructorId },
          { instructor: { $exists: false } } // Admins might create global coupons without an instructor
        ]
      },
      { isActive: false },
      { new: true }
    );

    if (!coupon) throw new AppError('No coupon found or unauthorized', 404);
    return coupon;
  }
}

module.exports = new CouponService();


// 'use strict';
// const AppError = require('../utils/appError');
// const CouponRepository = require('../repositories/CouponRepository');

// class CouponService {
  
//   async validateCouponForCourse(code, courseId) {
//     // 1. Find the coupon
//     const coupon = await CouponRepository.findValidCoupon(code);
//     if (!coupon) throw new AppError('Invalid or expired coupon code.', 400);

//     // 2. Check usage limits
//     if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
//       throw new AppError('This coupon has reached its maximum usage limit.', 400);
//     }

//     // 3. Check course restrictions (If validForCourses is not empty, it's restricted)
//     if (coupon.validForCourses && coupon.validForCourses.length > 0) {
//       const isApplicable = coupon.validForCourses.some(id => id.toString() === courseId.toString());
//       if (!isApplicable) throw new AppError('This coupon is not valid for this course.', 400);
//     }

//     return coupon;
//   }

//   calculateDiscount(price, coupon) {
//     if (coupon.discountType === 'free') return 0;
    
//     if (coupon.discountType === 'percentage') {
//       const discountAmount = price * (coupon.discountValue / 100);
//       return Math.max(0, price - discountAmount);
//     }

//     if (coupon.discountType === 'fixed_amount') {
//       return Math.max(0, price - coupon.discountValue);
//     }

//     return price;
//   }
// }

// module.exports = new CouponService();