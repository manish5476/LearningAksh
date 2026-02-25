// services/storageService.js
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

class StorageService {
  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });
    this.bucket = process.env.AWS_S3_BUCKET;
  }

  async uploadFile(file, folder = 'uploads') {
    const key = `${folder}/${Date.now()}-${file.originalname}`;
    
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read'
    };

    const result = await this.s3.upload(params).promise();
    return result.Location;
  }

  async uploadMultipleFiles(files, folder = 'uploads') {
    const uploads = files.map(file => this.uploadFile(file, folder));
    return Promise.all(uploads);
  }

  async deleteFile(fileUrl) {
    const key = fileUrl.split('.com/')[1];
    
    const params = {
      Bucket: this.bucket,
      Key: key
    };

    await this.s3.deleteObject(params).promise();
    return true;
  }

  getSignedUrl(key, expiresIn = 3600) {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresIn
    };

    return this.s3.getSignedUrl('getObject', params);
  }
}

module.exports = new StorageService();

// services/videoService.js
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

class VideoService {
  async processVideo(inputPath, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(options.size || '1280x720')
        .autopad()
        .aspect(options.aspect || '16:9')
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-movflags +faststart'
        ])
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err))
        .save(outputPath);
    });
  }

  async generateThumbnail(videoPath, thumbnailPath, time = '00:00:01') {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [time],
          filename: path.basename(thumbnailPath),
          folder: path.dirname(thumbnailPath),
          size: '640x360'
        })
        .on('end', () => resolve(thumbnailPath))
        .on('error', reject);
    });
  }

  async getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        resolve(metadata.format.duration);
      });
    });
  }
}

module.exports = new VideoService();