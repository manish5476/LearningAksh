const Queue = require('bull');
const queues = require('./index');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');

class QueueMonitor {
  constructor() {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: Object.values(queues).map(queue => new BullAdapter(queue)),
      serverAdapter: this.serverAdapter
    });
  }

  getRouter() {
    return this.serverAdapter.getRouter();
  }

  async getQueueStats() {
    const stats = {};

    for (const [name, queue] of Object.entries(queues)) {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount()
      ]);

      stats[name] = {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed
      };
    }

    return stats;
  }

  async retryFailed(queueName, jobId) {
    const queue = queues[queueName];
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    await job.retry();
    return true;
  }

  async removeJob(queueName, jobId) {
    const queue = queues[queueName];
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    await job.remove();
    return true;
  }

  async pauseQueue(queueName) {
    const queue = queues[queueName];
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    await queue.pause();
    return true;
  }

  async resumeQueue(queueName) {
    const queue = queues[queueName];
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    await queue.resume();
    return true;
  }

  async emptyQueue(queueName) {
    const queue = queues[queueName];
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    await queue.empty();
    return true;
  }
}

module.exports = new QueueMonitor();