const emailQueue = require('./emailQueue');
const notificationQueue = require('./notificationQueue');
const videoQueue = require('./videoQueue');
const certificateQueue = require('./certificateQueue');
const reportQueue = require('./reportQueue');
const cleanupQueue = require('./cleanupQueue');

// Initialize all queues
const queues = {
  email: emailQueue,
  notification: notificationQueue,
  video: videoQueue,
  certificate: certificateQueue,
  report: reportQueue,
  cleanup: cleanupQueue
};

module.exports = queues;