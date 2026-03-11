'use strict';
const AppError = require('../../utils/appError');
const CourseRepository = require('../../repositories/CourseRepository');
const OrderRepository = require('../repositories/OrderRepository');
const OrderItemRepository = require('../repositories/OrderItemRepository');
const EnrollmentRepository = require('../repositories/EnrollmentRepository');
const EventDispatcher = require('../events/EventDispatcher'); // For background jobs

class CheckoutService {
  
  /**
   * Processes a purchase for one or multiple courses
   */
  async processCheckout(studentId, courseIds, couponCode = null) {
    // 1. Fetch all requested courses
    const courses = await Promise.all(
      courseIds.map(id => CourseRepository.findById(id))
    );

    if (courses.some(c => !c || c.status !== 'published')) {
      throw new AppError('One or more courses are unavailable or do not exist.', 400);
    }

    // 2. Prevent double enrollment
    for (const course of courses) {
      const existing = await EnrollmentRepository.findOne({ student: studentId, course: course._id });
      if (existing && existing.isActive) {
        throw new AppError(`You are already enrolled in: ${course.title}`, 400);
      }
    }

    // 3. Calculate Pricing & Discounts (Business Logic)
    let totalAmount = courses.reduce((sum, course) => sum + course.price, 0);
    let appliedCouponId = null;

    if (couponCode) {
      const discount = await this.validateAndApplyCoupon(couponCode, totalAmount);
      totalAmount = discount.newTotal;
      appliedCouponId = discount.couponId;
    }

    // 4. Create the Order (Using a mock transaction flow)
    const order = await OrderRepository.create({
      student: studentId,
      totalAmount,
      status: totalAmount === 0 ? 'completed' : 'pending', // Free courses auto-complete
      paymentMethod: totalAmount === 0 ? 'none' : 'stripe'
    });

    // 5. Create Order Items & Enrollments
    const enrollments = [];
    for (const course of courses) {
      const orderItem = await OrderItemRepository.create({
        order: order._id,
        course: course._id,
        student: studentId,
        pricePaid: course.price, // In a real system, calculate proportional discount per item
        couponApplied: appliedCouponId
      });

      // If the order is fully paid or free, enroll them immediately
      if (order.status === 'completed') {
        const enrollment = await EnrollmentRepository.create({
          student: studentId,
          course: course._id,
          orderItem: orderItem._id
        });
        enrollments.push(enrollment);
      }
    }

    // 6. Dispatch Background Events (Replaces Mongoose Hooks)
    if (order.status === 'completed') {
      EventDispatcher.emit('enrollment.completed', { studentId, courses });
    }

    return { order, enrollments };
  }

  async validateAndApplyCoupon(code, currentTotal) {
    // Logic to fetch coupon from CouponRepository, check expiry, check usage limits,
    // and mathematically reduce the currentTotal.
    // Returning dummy data for illustration:
    return { newTotal: currentTotal * 0.8, couponId: 'mock_coupon_id' }; 
  }
}

module.exports = new CheckoutService();