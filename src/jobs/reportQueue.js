const Bull = require('bull');
const analyticsService = require('../services/analyticsService');
const storageService = require('../services/storageService');
const emailQueue = require('./emailQueue');
const fs = require('fs');
const path = require('path');

const isRedisEnabled = process.env.REDIS_ENABLED !== 'false';

let reportQueue = null;

/**
 * Only initialize queue if Redis is enabled
 */
if (isRedisEnabled) {
  console.log('🔄 Initializing Report Queue...');

  reportQueue = new Bull('report', {
    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined
    },
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      timeout: 10 * 60 * 1000,
      removeOnComplete: true,
      removeOnFail: false
    }
  });

  /**
   * PROCESSOR
   */
  reportQueue.process(async (job) => {
    const { type, data, format = 'pdf', recipientEmail } = job.data;

    console.log(`📊 Processing report job: ${type}`, { jobId: job.id });

    let reportData;

    switch (type) {
      case 'platform':
        reportData = await analyticsService.getPlatformOverview();
        break;
      case 'instructor':
        reportData = await analyticsService.getInstructorAnalytics(
          data.instructorId,
          data.dateRange
        );
        break;
      case 'student':
        reportData = await analyticsService.getStudentAnalytics(
          data.studentId
        );
        break;
      case 'revenue':
        reportData = await analyticsService.getRevenueAnalytics(
          data.filters
        );
        break;
      case 'engagement':
        reportData = await analyticsService.getEngagementAnalytics(
          data.filters
        );
        break;
      case 'custom':
        reportData = await analyticsService.generateReport(
          data.reportType,
          data.filters
        );
        break;
      default:
        throw new Error(`Unknown report type: ${type}`);
    }

    job.progress(50);

    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '../../temp/reports');
    await fs.promises.mkdir(tempDir, { recursive: true });

    const fileName = `${type}-report-${Date.now()}`;
    let filePath;

    if (format === 'json') {
      filePath = path.join(tempDir, `${fileName}.json`);
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(reportData, null, 2)
      );
    } else {
      // Placeholder for PDF/Excel/CSV generation
      filePath = path.join(tempDir, `${fileName}.${format}`);
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(reportData, null, 2)
      );
    }

    job.progress(75);

    const fileBuffer = await fs.promises.readFile(filePath);

    const mimeTypes = {
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      json: 'application/json'
    };

    const fileUrl = await storageService.uploadFile(
      {
        buffer: fileBuffer,
        originalname: path.basename(filePath),
        mimetype: mimeTypes[format] || 'application/octet-stream'
      },
      'reports'
    );

    await fs.promises.unlink(filePath);

    job.progress(90);

    if (recipientEmail && emailQueue) {
      await emailQueue.add({
        type: 'report',
        data: {
          to: recipientEmail,
          reportType: type,
          reportUrl: fileUrl,
          generatedAt: new Date()
        }
      });
    }

    job.progress(100);

    return {
      reportUrl: fileUrl,
      generatedAt: new Date(),
      reportData
    };
  });

  /**
   * EVENTS
   */
  reportQueue.on('completed', (job, result) => {
    console.log(`✅ Report job completed: ${job.id}`);
    console.log(`📎 Report URL: ${result.reportUrl}`);
  });

  reportQueue.on('failed', (job, err) => {
    console.error(`❌ Report job failed: ${job?.id}`, err.message);
  });

  reportQueue.on('error', (err) => {
    console.error('🚨 Report Queue Error:', err.message);
  });

} else {
  console.log('🟡 Report Queue disabled (REDIS_ENABLED=false)');
}

/**
 * Safe wrapper so app never crashes
 */
const addReportJob = async (jobData) => {
  if (!reportQueue) {
    console.log('⚠️ Redis disabled — processing report synchronously');
    return null; // or implement direct processing fallback
  }

  return await reportQueue.add(jobData);
};

module.exports = {
  reportQueue,
  addReportJob
};