'use strict';
const BaseRepository = require('./BaseRepository');
const { Coupon } = require('../models');

class CouponRepository extends BaseRepository {
  constructor() { super(Coupon); }

  async findValidCoupon(code) {
    return await this.model.findOne({
      code: code.toUpperCase(),
      isActive: true,
      expiryDate: { $gt: new Date() }
    }).lean().exec();
  }
  
  async incrementUsage(couponId) {
    return await this.model.findByIdAndUpdate(
      couponId,
      { $inc: { usedCount: 1 } },
      { new: true }
    );
  }
}
module.exports = new CouponRepository();