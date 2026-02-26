const Queue = require('bull');
const videoService = require('../services/videoService');
const storageService = require('../services/storageService');
const { Lesson } = require('../models');

let videoQueue;

if (process.env.REDIS_ENABLED === 'false') {
    console.log("🟡 Bull Queue: Redis is disabled. Mocking videoQueue.");
    
    // The mock must include all methods called later in the file
    videoQueue = {
        add: () => Promise.resolve({ id: 'mock-id' }),
        process: (fn) => console.log("🟡 Video Queue: Mock processor registered"),
        on: (event, callback) => {},
        status: 'mocked'
    };
} else {
    videoQueue = new Queue('video', {
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD
        },
        defaultJobOptions: {
            attempts: 2,
            backoff: { type: 'exponential', delay: 10000 },
            timeout: 30 * 60 * 1000,
            removeOnComplete: true,
            removeOnFail: false
        }
    });
}

videoQueue.process(async (job) => {
  const { type, data } = job.data;

  console.log(`Processing video job: ${type}`, { jobId: job.id });

  switch(type) {
    case 'process':
      // Process uploaded video
      const result = await videoService.processVideo(
        data.videoBuffer,
        data.filename,
        data.options
      );

      // Update lesson with video URLs
      await Lesson.findByIdAndUpdate(data.lessonId, {
        'content.video': {
          url: result.url,
          thumbnail: result.thumbnail,
          duration: result.duration,
          provider: 'local'
        }
      });

      job.progress(100);
      return result;

    case 'transcode':
      // Transcode to different qualities
      const transcoded = await videoService.createAdaptiveStreaming(
        data.inputPath,
        data.outputDir
      );
      return transcoded;

    case 'thumbnail':
      // Generate thumbnail
      const thumbnail = await videoService.generateThumbnail(
        data.videoPath,
        data.thumbnailPath,
        data.timestamp
      );

      // Upload thumbnail
      const thumbnailBuffer = await fs.promises.readFile(thumbnail);
      const thumbnailUrl = await storageService.uploadFile({
        buffer: thumbnailBuffer,
        originalname: `thumb-${Date.now()}.jpg`,
        mimetype: 'image/jpeg'
      }, 'thumbnails');

      return thumbnailUrl;

    case 'metadata':
      // Extract video metadata
      const metadata = await videoService.getVideoMetadata(data.videoPath);
      return metadata;

    case 'cleanup':
      // Clean up temporary files
      await videoService.cleanup(data.files);
      break;

    default:
      throw new Error(`Unknown video type: ${type}`);
  }
});

// Event handlers
videoQueue.on('completed', (job, result) => {
  console.log(`Video job completed successfully: ${job.id}`);
  
  // Emit socket event for real-time updates
  if (global.io) {
    global.io.to(`job-${job.id}`).emit('videoJobCompleted', {
      jobId: job.id,
      result
    });
  }
});

videoQueue.on('failed', (job, err) => {
  console.error(`Video job failed: ${job.id}`, err);
  
  if (global.io) {
    global.io.to(`job-${job.id}`).emit('videoJobFailed', {
      jobId: job.id,
      error: err.message
    });
  }
});

videoQueue.on('progress', (job, progress) => {
  console.log(`Video job progress: ${job.id} - ${progress}%`);
  
  if (global.io) {
    global.io.to(`job-${job.id}`).emit('videoJobProgress', {
      jobId: job.id,
      progress
    });
  }
});

module.exports = videoQueue;