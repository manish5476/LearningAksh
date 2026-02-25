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

// Graceful shutdown handler
async function shutdown() {
  console.log('Shutting down queues...');
  await Promise.all(
    Object.values(queues).map(queue => queue.close())
  );
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = queues;