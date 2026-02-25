const Queue = require('bull');
const certificateService = require('../services/certificateService');
const emailQueue = require('./emailQueue');

const certificateQueue = new Queue('certificate', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

// Process certificate jobs
certificateQueue.process(async (job) => {
  const { type, data } = job.data;

  console.log(`Processing certificate job: ${type}`, { jobId: job.id });

  switch(type) {
    case 'generate':
      // Generate single certificate
      const certificate = await certificateService.generateCertificate(data);
      
      // Queue email with certificate
      await emailQueue.add({
        type: 'courseCompletion',
        data: {
          user: data.user,
          course: { title: data.courseName },
          certificate
        }
      });

      return certificate;

    case 'bulk':
      // Generate multiple certificates
      const results = await certificateService.bulkGenerateCertificates(data.completions);
      
      // Queue emails for successful ones
      for (const cert of results.successful) {
        await emailQueue.add({
          type: 'courseCompletion',
          data: {
            user: { 
              email: cert.student.email,
              firstName: cert.student.firstName
            },
            course: { title: cert.course.title },
            certificate: cert
          }
        });
      }

      return results;

    case 'verify':
      // Verify certificate
      const verification = await certificateService.verifyCertificate(data.certificateNumber);
      return verification;

    case 'revoke':
      // Revoke certificate
      const revoked = await certificateService.revokeCertificate(data.certificateId, data.reason);
      return revoked;

    case 'sendEmail':
      // Send certificate by email
      await certificateService.sendCertificateByEmail(data.certificateId, data.email);
      break;

    default:
      throw new Error(`Unknown certificate type: ${type}`);
  }
});

// Event handlers
certificateQueue.on('completed', (job, result) => {
  console.log(`Certificate job completed successfully: ${job.id}`);
  
  if (result && result.certificateNumber) {
    console.log(`Certificate generated: ${result.certificateNumber}`);
  }
});

certificateQueue.on('failed', (job, err) => {
  console.error(`Certificate job failed: ${job.id}`, err);
});

module.exports = certificateQueue;