'use strict';
const BaseRepository = require('./BaseRepository');
const { AuditLog } = require('../models');

class AuditLogRepository extends BaseRepository {
  constructor() { super(AuditLog); }
  
  // Custom method specifically for high-volume fire-and-forget logging
  async logAction(data) {
    // We don't await this in the controller to prevent event loop blocking
    this.model.create(data).catch(err => console.error('Audit Log Failed:', err.message));
  }
}
module.exports = new AuditLogRepository();