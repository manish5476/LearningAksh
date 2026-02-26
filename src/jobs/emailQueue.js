const Queue = require('bull');
const emailService = require('../services/emailService');

let emailQueue;

if (process.env.REDIS_ENABLED === 'false') {
    console.log("🟡 Bull Queue: Redis is disabled. Mocking emailQueue.");
    
    // Create a robust mock object
    emailQueue = {
        add: () => Promise.resolve({ id: 'mock-id' }),
        process: (fn) => { 
            console.log("🟡 Email Queue: Mock processor registered (No-op)");
            // In dev, you could even execute the function immediately if you wanted to test logic
        },
        on: (event, callback) => {
            // Silence the event listeners
        },
        clean: () => Promise.resolve(),
        // Add a dummy status for health checks
        status: 'mocked' 
    };
} else {
    emailQueue = new Queue('email', {
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD
        },
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
            removeOnFail: false
        }
    });
}

// Process email jobs
emailQueue.process(async (job) => {
  const { type, data } = job.data;

  console.log(`Processing email job: ${type}`, { jobId: job.id });

  switch(type) {
    case 'welcome':
      await emailService.sendWelcomeEmail(data.user);
      break;

    case 'passwordReset':
      await emailService.sendPasswordResetEmail(data.user, data.resetToken);
      break;

    case 'courseCompletion':
      await emailService.sendCourseCompletionEmail(data.user, data.course, data.certificate);
      break;

    case 'enrollment':
      await emailService.sendEnrollmentConfirmation(data.user, data.course, data.payment);
      break;

    case 'announcement':
      await emailService.sendAnnouncement(data.user, data.announcement);
      break;

    case 'paymentReceipt':
      await emailService.sendPaymentReceipt(data.user, data.payment, data.items);
      break;

    case 'instructorPayout':
      await emailService.sendInstructorPayout(data.instructor, data.amount, data.period);
      break;

    case 'assignmentGraded':
      await emailService.sendGradeNotification(data.user, data.submission);
      break;

    case 'newsletter':
      await emailService.sendNewsletter(data.subscribers, data.content);
      break;

    case 'verification':
      await emailService.sendVerificationEmail(data.user, data.token);
      break;

    case 'newDevice':
      await emailService.sendNewDeviceNotification(data.user, data.deviceInfo);
      break;

    case 'accountDeactivated':
      await emailService.sendAccountDeactivationConfirmation(data.user);
      break;

    case 'reminder':
      await emailService.sendReminderEmail(data.user, data.reminder);
      break;

    case 'bulk':
      await emailService.sendBulkEmails(data.emails);
      break;

    default:
      throw new Error(`Unknown email type: ${type}`);
  }

  console.log(`Email job completed: ${type}`, { jobId: job.id });
});

// Event handlers
emailQueue.on('completed', (job) => {
  console.log(`Email job completed successfully: ${job.id}`);
});

emailQueue.on('failed', (job, err) => {
  console.error(`Email job failed: ${job.id}`, err);
});

emailQueue.on('stalled', (job) => {
  console.warn(`Email job stalled: ${job.id}`);
});

// Clean up old jobs periodically
setInterval(async () => {
  await emailQueue.clean(24 * 3600 * 1000, 'completed'); // Remove completed jobs older than 24 hours
  await emailQueue.clean(7 * 24 * 3600 * 1000, 'failed'); // Remove failed jobs older than 7 days
}, 12 * 3600 * 1000); // Run every 12 hours

module.exports = emailQueue;