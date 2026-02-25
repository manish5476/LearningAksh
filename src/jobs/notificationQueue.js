const Queue = require('bull');
const notificationService = require('../services/notificationService');

const notificationQueue = new Queue('notification', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

// Process notification jobs
notificationQueue.process(async (job) => {
  const { type, data } = job.data;

  console.log(`Processing notification job: ${type}`, { jobId: job.id });

  switch(type) {
    case 'single':
      await notificationService.send(data.notification);
      break;

    case 'bulk':
      await notificationService.sendBulk(data.notifications);
      break;

    case 'courseUpdate':
      await notificationService.notifyCourseStudents(
        data.courseId,
        data.title,
        data.message
      );
      break;

    case 'roleAnnouncement':
      await notificationService.announceToRole(
        data.role,
        data.title,
        data.message
      );
      break;

    case 'markAsRead':
      await notificationService.markAsRead(data.userId, data.notificationIds);
      break;

    case 'cleanup':
      await notificationService.cleanupOldNotifications(data.days);
      break;

    default:
      throw new Error(`Unknown notification type: ${type}`);
  }

  console.log(`Notification job completed: ${type}`, { jobId: job.id });
});

// Event handlers
notificationQueue.on('completed', (job) => {
  console.log(`Notification job completed successfully: ${job.id}`);
});

notificationQueue.on('failed', (job, err) => {
  console.error(`Notification job failed: ${job.id}`, err);
});

// Schedule recurring jobs
notificationQueue.add(
  { type: 'cleanup', data: { days: 30 } },
  { repeat: { cron: '0 2 * * 0' } } // Run at 2 AM every Sunday
);

module.exports = notificationQueue;