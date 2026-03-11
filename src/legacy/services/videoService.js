const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const storageService = require('./storageService');
const AppError = require('../utils/appError');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

class VideoService {
  constructor() {
    this.tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Process video for streaming
   * @param {Buffer} videoBuffer - Raw video buffer
   * @param {String} filename - Original filename
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Processed video info
   */
  async processVideo(videoBuffer, filename, options = {}) {
    const tempInputPath = path.join(this.tempDir, `input-${Date.now()}-${filename}`);
    const tempOutputPath = path.join(this.tempDir, `output-${Date.now()}.mp4`);
    const thumbnailPath = path.join(this.tempDir, `thumb-${Date.now()}.jpg`);

    try {
      // Save temp file
      await fs.promises.writeFile(tempInputPath, videoBuffer);

      // Get video metadata
      const metadata = await this.getVideoMetadata(tempInputPath);

      // Generate thumbnail
      await this.generateThumbnail(tempInputPath, thumbnailPath, options.thumbnailTime || '00:00:01');

      // Process video based on options
      await this.transcodeVideo(tempInputPath, tempOutputPath, {
        quality: options.quality || 'medium',
        format: options.format || 'mp4'
      });

      // Upload processed files
      const thumbnailBuffer = await fs.promises.readFile(thumbnailPath);
      const processedBuffer = await fs.promises.readFile(tempOutputPath);

      const [videoUrl, thumbnailUrl] = await Promise.all([
        storageService.uploadFile({
          buffer: processedBuffer,
          originalname: `video-${Date.now()}.mp4`,
          mimetype: 'video/mp4'
        }, 'videos'),
        storageService.uploadFile({
          buffer: thumbnailBuffer,
          originalname: `thumb-${Date.now()}.jpg`,
          mimetype: 'image/jpeg'
        }, 'thumbnails')
      ]);

      return {
        url: videoUrl,
        thumbnail: thumbnailUrl,
        duration: metadata.duration,
        size: metadata.size,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format
      };

    } finally {
      // Cleanup temp files
      await this.cleanup([tempInputPath, tempOutputPath, thumbnailPath]);
    }
  }

  /**
   * Transcode video to different formats/qualities
   * @param {String} inputPath - Input file path
   * @param {String} outputPath - Output file path
   * @param {Object} options - Transcoding options
   */
  async transcodeVideo(inputPath, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath);

      // Set quality presets
      const qualityPresets = {
        low: { videoBitrate: '500k', size: '640x360' },
        medium: { videoBitrate: '1000k', size: '854x480' },
        high: { videoBitrate: '2000k', size: '1280x720' },
        hd: { videoBitrate: '4000k', size: '1920x1080' }
      };

      const preset = qualityPresets[options.quality] || qualityPresets.medium;

      command
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(preset.size)
        .videoBitrate(preset.videoBitrate)
        .audioBitrate('128k')
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-movflags +faststart',
          '-pix_fmt yuv420p'
        ]);

      // Add HLS output for streaming
      if (options.format === 'hls') {
        const hlsPath = outputPath.replace('.mp4', '.m3u8');
        command
          .outputOptions([
            '-hls_time 10',
            '-hls_list_size 0',
            '-hls_segment_filename', path.join(path.dirname(outputPath), 'segment_%03d.ts')
          ])
          .output(hlsPath);
      }

      command
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .save(outputPath);
    });
  }

  /**
   * Generate thumbnail from video
   * @param {String} videoPath - Video file path
   * @param {String} thumbnailPath - Thumbnail output path
   * @param {String} timestamp - Timestamp to capture
   */
  async generateThumbnail(videoPath, thumbnailPath, timestamp = '00:00:01') {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(thumbnailPath),
          folder: path.dirname(thumbnailPath),
          size: '640x360'
        })
        .on('end', () => resolve(thumbnailPath))
        .on('error', reject);
    });
  }

  /**
   * Get video metadata
   * @param {String} videoPath - Video file path
   */
  async getVideoMetadata(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) return reject(err);

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          format: metadata.format.format_name,
          width: videoStream?.width,
          height: videoStream?.height,
          fps: eval(videoStream?.avg_frame_rate),
          videoCodec: videoStream?.codec_name,
          audioCodec: audioStream?.codec_name,
          hasAudio: !!audioStream
        });
      });
    });
  }

  /**
   * Extract audio from video
   * @param {String} videoPath - Video file path
   * @param {String} audioPath - Audio output path
   */
  async extractAudio(videoPath, audioPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .on('end', () => resolve(audioPath))
        .on('error', reject)
        .save(audioPath);
    });
  }

  /**
   * Create video segments for adaptive streaming
   * @param {String} videoPath - Video file path
   * @param {String} outputDir - Output directory
   */
  async createAdaptiveStreaming(videoPath, outputDir) {
    const qualities = [
      { name: '360p', size: '640x360', bitrate: '500k' },
      { name: '480p', size: '854x480', bitrate: '1000k' },
      { name: '720p', size: '1280x720', bitrate: '2000k' },
      { name: '1080p', size: '1920x1080', bitrate: '4000k' }
    ];

    const masterPlaylist = ['#EXTM3U', '#EXT-X-VERSION:3'];

    await Promise.all(qualities.map(async (quality) => {
      const qualityDir = path.join(outputDir, quality.name);
      if (!fs.existsSync(qualityDir)) {
        fs.mkdirSync(qualityDir, { recursive: true });
      }

      const outputPath = path.join(qualityDir, 'playlist.m3u8');

      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .size(quality.size)
          .videoBitrate(quality.bitrate)
          .outputOptions([
            '-preset fast',
            '-g 48',
            '-sc_threshold 0',
            '-hls_time 10',
            '-hls_list_size 0',
            '-hls_segment_filename', path.join(qualityDir, 'segment_%03d.ts')
          ])
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      // Add to master playlist
      masterPlaylist.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(quality.bitrate) * 1000},RESOLUTION=${quality.size}`,
        `${quality.name}/playlist.m3u8`
      );
    }));

    // Write master playlist
    const masterPath = path.join(outputDir, 'master.m3u8');
    await fs.promises.writeFile(masterPath, masterPlaylist.join('\n'));

    return masterPath;
  }

  /**
   * Clean up temporary files
   * @param {Array} files - Array of file paths to delete
   */
  async cleanup(files) {
    for (const file of files) {
      try {
        if (fs.existsSync(file)) {
          await fs.promises.unlink(file);
        }
      } catch (error) {
        console.error(`Failed to delete ${file}:`, error);
      }
    }
  }

  /**
   * Validate video file
   * @param {Buffer} buffer - Video buffer
   * @param {String} mimetype - File mimetype
   */
  validateVideo(buffer, mimetype) {
    const maxSize = 500 * 1024 * 1024; // 500MB
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

    if (!allowedTypes.includes(mimetype)) {
      throw new AppError('Invalid video format. Allowed: MP4, WebM, OGG, MOV', 400);
    }

    if (buffer.length > maxSize) {
      throw new AppError('Video too large. Maximum size is 500MB', 400);
    }

    return true;
  }
}

module.exports = new VideoService();