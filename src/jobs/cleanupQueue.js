const Queue = require('bull');
const { User, Session, Notification, AuditLog } = require('../models');
const fs = require('fs').promises;
const path = require('path');
const storageService = require('../services/storageService');

const cleanupQueue = new Queue('cleanup', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: false
  }
});

// Process cleanup jobs
cleanupQueue.process(async (job) => {
  const { type, data } = job.data;

  console.log(`Processing cleanup job: ${type}`, { jobId: job.id });

  switch(type) {
    case 'inactiveUsers':
      // Soft delete inactive users
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (data.days || 365));

      const inactiveUsers = await User.find({
        lastLogin: { $lt: cutoffDate },
        isActive: true,
        isDeleted: false
      });

      for (const user of inactiveUsers) {
        user.isActive = false;
        user.isDeleted = true;
        user.deletedAt = new Date();
        await user.save();
      }

      return { deleted: inactiveUsers.length };

    case 'oldSessions':
      // Remove expired sessions
      const sessionResult = await Session.deleteMany({
        expiresAt: { $lt: new Date() }
      });

      return { deleted: sessionResult.deletedCount };

    case 'oldNotifications':
      // Remove old read notifications
      const notifCutoff = new Date();
      notifCutoff.setDate(notifCutoff.getDate() - (data.days || 30));

      const notifResult = await Notification.deleteMany({
        isRead: true,
        createdAt: { $lt: notifCutoff }
      });

      return { deleted: notifResult.deletedCount };

    case 'auditLogs':
      // Archive old audit logs
      const auditCutoff = new Date();
      auditCutoff.setDate(auditCutoff.getDate() - (data.days || 90));

      const oldLogs = await AuditLog.find({
        createdAt: { $lt: auditCutoff }
      });

      // Archive to file
      const archivePath = path.join(__dirname, '../../logs/audit', `audit-${Date.now()}.json`);
      await fs.writeFile(archivePath, JSON.stringify(oldLogs, null, 2));

      // Upload to storage
      const archiveBuffer = await fs.readFile(archivePath);
      await storageService.uploadFile({
        buffer: archiveBuffer,
        originalname: path.basename(archivePath),
        mimetype: 'application/json'
      }, 'audit-archives');

      // Delete from database
      const auditResult = await AuditLog.deleteMany({
        createdAt: { $lt: auditCutoff }
      });

      // Cleanup temp file
      await fs.unlink(archivePath);

      return { archived: oldLogs.length, deleted: auditResult.deletedCount };

    case 'tempFiles':
      // Clean up temporary files older than 24 hours
      const tempDir = path.join(__dirname, '../../temp');
      const files = await fs.readdir(tempDir);
      const now = Date.now();
      let deleted = 0;

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
          await fs.unlink(filePath);
          deleted++;
        }
      }

      return { deleted };

    case 'unverifiedUsers':
      // Delete unverified users after 7 days
      const unverifiedCutoff = new Date();
      unverifiedCutoff.setDate(unverifiedCutoff.getDate() - 7);

      const unverifiedResult = await User.deleteMany({
        isEmailVerified: false,
        createdAt: { $lt: unverifiedCutoff },
        role: 'student'
      });

      return { deleted: unverifiedResult.deletedCount };

    default:
      throw new Error(`Unknown cleanup type: ${type}`);
  }
});

// Event handlers
cleanupQueue.on('completed', (job, result) => {
  console.log(`Cleanup job completed: ${job.id}`, result);
});

cleanupQueue.on('failed', (job, err) => {
  console.error(`Cleanup job failed: ${job.id}`, err);
});

// Schedule recurring cleanup jobs
cleanupQueue.add(
  { type: 'oldSessions' },
  { repeat: { cron: '0 */6 * * *' } } // Every 6 hours
);

cleanupQueue.add(
  { type: 'tempFiles' },
  { repeat: { cron: '0 3 * * *' } } // Daily at 3 AM
);

cleanupQueue.add(
  { type: 'oldNotifications', data: { days: 30 } },
  { repeat: { cron: '0 4 * * 0' } } // Weekly on Sunday at 4 AM
);

cleanupQueue.add(
  { type: 'auditLogs', data: { days: 90 } },
  { repeat: { cron: '0 2 1 * *' } } // Monthly on the 1st at 2 AM
);

cleanupQueue.add(
  { type: 'unverifiedUsers' },
  { repeat: { cron: '0 5 * * *' } } // Daily at 5 AM
);

module.exports = cleanupQueue;