// src/jobs/emailQueue.js
const Queue = require('bull');
const EmailService = require('../services/emailService');

const emailQueue = new Queue('email', process.env.REDIS_URL);

emailQueue.process(async (job) => {
  const { type, data } = job.data;
  
  const emailService = new EmailService(data.user, data.url);
  
  switch(type) {
    case 'welcome':
      await emailService.sendWelcome();
      break;
    case 'passwordReset':
      await emailService.sendPasswordReset();
      break;
    case 'courseCompletion':
      await emailService.sendCourseCompletion(data.courseName, data.certificateUrl);
      break;
  }
});

module.exports = emailQueue;