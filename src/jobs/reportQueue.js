const Queue = require('bull');
const analyticsService = require('../services/analyticsService');
const storageService = require('../services/storageService');
const emailQueue = require('./emailQueue');
const fs = require('fs');
const path = require('path');

const reportQueue = new Queue('report', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    timeout: 10 * 60 * 1000, // 10 minutes
    removeOnComplete: true,
    removeOnFail: false
  }
});

// Process report jobs
reportQueue.process(async (job) => {
  const { type, data, format = 'pdf', recipientEmail } = job.data;

  console.log(`Processing report job: ${type}`, { jobId: job.id });

  // Generate report data
  let reportData;
  switch(type) {
    case 'platform':
      reportData = await analyticsService.getPlatformOverview();
      break;

    case 'instructor':
      reportData = await analyticsService.getInstructorAnalytics(data.instructorId, data.dateRange);
      break;

    case 'student':
      reportData = await analyticsService.getStudentAnalytics(data.studentId);
      break;

    case 'revenue':
      reportData = await analyticsService.getRevenueAnalytics(data.filters);
      break;

    case 'engagement':
      reportData = await analyticsService.getEngagementAnalytics(data.filters);
      break;

    case 'custom':
      reportData = await analyticsService.generateReport(data.reportType, data.filters);
      break;

    default:
      throw new Error(`Unknown report type: ${type}`);
  }

  job.progress(50);

  // Generate file based on format
  let filePath;
  let fileName = `${type}-report-${Date.now()}`;

  if (format === 'pdf') {
    // PDF generation logic would go here
    filePath = path.join(__dirname, '../../temp/reports', `${fileName}.pdf`);
    // await generatePDF(reportData, filePath);
  } else if (format === 'excel') {
    filePath = path.join(__dirname, '../../temp/reports', `${fileName}.xlsx`);
    // await generateExcel(reportData, filePath);
  } else if (format === 'csv') {
    filePath = path.join(__dirname, '../../temp/reports', `${fileName}.csv`);
    // await generateCSV(reportData, filePath);
  } else {
    filePath = path.join(__dirname, '../../temp/reports', `${fileName}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(reportData, null, 2));
  }

  job.progress(75);

  // Upload to storage
  const fileBuffer = await fs.promises.readFile(filePath);
  const fileUrl = await storageService.uploadFile({
    buffer: fileBuffer,
    originalname: path.basename(filePath),
    mimetype: format === 'pdf' ? 'application/pdf' : 
              format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
              format === 'csv' ? 'text/csv' : 'application/json'
  }, 'reports');

  // Cleanup temp file
  await fs.promises.unlink(filePath);

  job.progress(90);

  // Send email with report if recipient provided
  if (recipientEmail) {
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

// Event handlers
reportQueue.on('completed', (job, result) => {
  console.log(`Report job completed successfully: ${job.id}`);
  console.log(`Report available at: ${result.reportUrl}`);
});

reportQueue.on('failed', (job, err) => {
  console.error(`Report job failed: ${job.id}`, err);
});

module.exports = reportQueue;