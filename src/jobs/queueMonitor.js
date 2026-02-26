const queues = require('./index'); // This pulls in your email, video, certificate queues
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');

class QueueMonitor {
  constructor() {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');

    // Only initialize the Bull Board UI if Redis is actually enabled
    // This prevents the "non-Bull queue" crash in development
    if (process.env.REDIS_ENABLED !== 'false') {
      try {
        createBullBoard({
          queues: Object.values(queues)
            .filter(queue => queue && typeof queue.getJob === 'function') // Only adapt real queues
            .map(queue => new BullAdapter(queue)),
          serverAdapter: this.serverAdapter
        });
        console.log("✅ Queue Monitor Board initialized at /admin/queues");
      } catch (error) {
        console.log("🟡 Queue Monitor: Failed to initialize board UI, skipping.");
      }
    } else {
      console.log("🟡 Queue Monitor: Redis disabled. Board UI is inactive.");
    }
  }

  /**
   * Returns the router for Express middleware
   */
  getRouter() {
    return this.serverAdapter.getRouter();
  }

  /**
   * Safe method to get stats. Returns 0s if Redis/Queues are mocked.
   */
  async getQueueStats() {
    const stats = {};

    for (const [name, queue] of Object.entries(queues)) {
      try {
        // If the queue is a mock, these methods might not exist or return dummy data
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount ? queue.getWaitingCount() : 0,
          queue.getActiveCount ? queue.getActiveCount() : 0,
          queue.getCompletedCount ? queue.getCompletedCount() : 0,
          queue.getFailedCount ? queue.getFailedCount() : 0,
          queue.getDelayedCount ? queue.getDelayedCount() : 0
        ]);

        stats[name] = {
          waiting,
          active,
          completed,
          failed,
          delayed,
          total: (waiting || 0) + (active || 0) + (completed || 0) + (failed || 0) + (delayed || 0)
        };
      } catch (err) {
        stats[name] = { error: 'Queue metrics unavailable' };
      }
    }

    return stats;
  }

  /**
   * Helper to verify if a queue is functional (not a mock)
   */
  _isQueueActive(queue) {
    return queue && process.env.REDIS_ENABLED !== 'false';
  }

  async retryFailed(queueName, jobId) {
    const queue = queues[queueName];
    if (!this._isQueueActive(queue)) return false;

    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    await job.retry();
    return true;
  }

  async removeJob(queueName, jobId) {
    const queue = queues[queueName];
    if (!this._isQueueActive(queue)) return false;

    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    await job.remove();
    return true;
  }

  async pauseQueue(queueName) {
    const queue = queues[queueName];
    if (!this._isQueueActive(queue)) return false;

    await queue.pause();
    return true;
  }

  async resumeQueue(queueName) {
    const queue = queues[queueName];
    if (!this._isQueueActive(queue)) return false;

    await queue.resume();
    return true;
  }

  async emptyQueue(queueName) {
    const queue = queues[queueName];
    if (!this._isQueueActive(queue)) return false;

    await queue.empty();
    return true;
  }
}

module.exports = new QueueMonitor();