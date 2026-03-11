const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const AppError = require('../utils/appError');

class StorageService {
  constructor() {
    // Initialize S3 if credentials exist
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      });
      this.bucket = process.env.AWS_S3_BUCKET;
      this.useS3 = true;
    } else {
      this.useS3 = false;
      this.localPath = path.join(__dirname, '../../public/uploads');
      // Ensure local upload directory exists
      if (!fs.existsSync(this.localPath)) {
        fs.mkdirSync(this.localPath, { recursive: true });
      }
    }
  }

  /**
   * Upload a file to storage
   * @param {Object} file - File object from multer
   * @param {String} folder - Folder to store in
   * @param {Object} options - Additional options (resize, quality, etc.)
   * @returns {Promise<String>} - URL of uploaded file
   */
  async uploadFile(file, folder = 'general', options = {}) {
    try {
      const fileName = this.generateFileName(file.originalname);
      const key = `${folder}/${fileName}`;

      // Process image if it's an image and resize options provided
      let processedBuffer = file.buffer;
      if (file.mimetype.startsWith('image/') && options.resize) {
        processedBuffer = await this.processImage(file.buffer, options.resize);
      }

      if (this.useS3) {
        return await this.uploadToS3(processedBuffer, key, file.mimetype);
      } else {
        return await this.uploadToLocal(processedBuffer, key, file.mimetype);
      }
    } catch (error) {
      console.error('File upload error:', error);
      throw new AppError('Failed to upload file', 500);
    }
  }

  /**
   * Upload multiple files
   * @param {Array} files - Array of file objects
   * @param {String} folder - Folder to store in
   * @returns {Promise<Array>} - Array of file URLs
   */
  async uploadMultipleFiles(files, folder = 'general') {
    const uploadPromises = files.map(file => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  /**
   * Upload to S3
   * @private
   */
  async uploadToS3(buffer, key, mimetype) {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      ACL: 'public-read'
    };

    // Add caching for static assets
    if (mimetype.startsWith('image/')) {
      params.CacheControl = 'max-age=31536000'; // 1 year cache for images
    }

    const result = await this.s3.upload(params).promise();
    return result.Location;
  }

  /**
   * Upload to local filesystem
   * @private
   */
  async uploadToLocal(buffer, key, mimetype) {
    const filePath = path.join(this.localPath, key);
    const fileDir = path.dirname(filePath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    await fs.promises.writeFile(filePath, buffer);
    
    // Return URL path
    return `/uploads/${key}`;
  }

  /**
   * Process image (resize, optimize, etc.)
   * @private
   */
  async processImage(buffer, options = {}) {
    let sharpInstance = sharp(buffer);

    // Resize if dimensions provided
    if (options.width || options.height) {
      sharpInstance = sharpInstance.resize(options.width, options.height, {
        fit: options.fit || 'cover',
        withoutEnlargement: true
      });
    }

    // Set quality for JPEG
    if (options.quality) {
      sharpInstance = sharpInstance.jpeg({ quality: options.quality });
    }

    // Convert to webp for better compression
    if (options.format === 'webp') {
      sharpInstance = sharpInstance.webp({ quality: options.quality || 80 });
    }

    return await sharpInstance.toBuffer();
  }

  /**
   * Generate unique filename
   * @private
   */
  generateFileName(originalName) {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const sanitizedName = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    return `${sanitizedName}-${uuidv4()}${ext}`;
  }

  /**
   * Delete a file
   * @param {String} fileUrl - URL of file to delete
   */
  async deleteFile(fileUrl) {
    try {
      if (this.useS3) {
        const key = this.getKeyFromUrl(fileUrl);
        const params = {
          Bucket: this.bucket,
          Key: key
        };
        await this.s3.deleteObject(params).promise();
      } else {
        const filePath = path.join(__dirname, '../../public', fileUrl);
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      }
      return true;
    } catch (error) {
      console.error('File delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple files
   * @param {Array} fileUrls - Array of file URLs
   */
  async deleteMultipleFiles(fileUrls) {
    const deletePromises = fileUrls.map(url => this.deleteFile(url));
    return Promise.all(deletePromises);
  }

  /**
   * Get signed URL for private files
   * @param {String} key - S3 key
   * @param {Number} expiresIn - Expiry in seconds
   */
  getSignedUrl(key, expiresIn = 3600) {
    if (!this.useS3) {
      return `/uploads/${key}`; // Local files are public
    }

    const params = {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresIn
    };

    return this.s3.getSignedUrl('getObject', params);
  }

  /**
   * Extract key from S3 URL
   * @private
   */
  getKeyFromUrl(url) {
    if (this.useS3) {
      return url.split('.com/')[1];
    } else {
      return url.replace('/uploads/', '');
    }
  }

  /**
   * Get file metadata
   * @param {String} fileUrl - URL of file
   */
  async getFileMetadata(fileUrl) {
    try {
      if (this.useS3) {
        const key = this.getKeyFromUrl(fileUrl);
        const params = {
          Bucket: this.bucket,
          Key: key
        };
        const head = await this.s3.headObject(params).promise();
        return {
          size: head.ContentLength,
          type: head.ContentType,
          lastModified: head.LastModified,
          etag: head.ETag
        };
      } else {
        const filePath = path.join(__dirname, '../../public', fileUrl);
        const stats = await fs.promises.stat(filePath);
        return {
          size: stats.size,
          created: stats.birthtime,
          lastModified: stats.mtime
        };
      }
    } catch (error) {
      console.error('Get metadata error:', error);
      return null;
    }
  }

  /**
   * Copy file
   * @param {String} sourceUrl - Source file URL
   * @param {String} destinationFolder - Destination folder
   */
  async copyFile(sourceUrl, destinationFolder) {
    try {
      if (this.useS3) {
        const sourceKey = this.getKeyFromUrl(sourceUrl);
        const fileName = path.basename(sourceKey);
        const destinationKey = `${destinationFolder}/${fileName}`;

        const params = {
          Bucket: this.bucket,
          CopySource: `${this.bucket}/${sourceKey}`,
          Key: destinationKey
        };

        await this.s3.copyObject(params).promise();
        return `https://${this.bucket}.s3.amazonaws.com/${destinationKey}`;
      } else {
        const sourcePath = path.join(__dirname, '../../public', sourceUrl);
        const fileName = path.basename(sourcePath);
        const destPath = path.join(this.localPath, destinationFolder, fileName);

        await fs.promises.copyFile(sourcePath, destPath);
        return `/uploads/${destinationFolder}/${fileName}`;
      }
    } catch (error) {
      console.error('File copy error:', error);
      throw new AppError('Failed to copy file', 500);
    }
  }
}

module.exports = new StorageService();
// // services/storageService.js
// const AWS = require('aws-sdk');
// const fs = require('fs');
// const path = require('path');

// class StorageService {
//   constructor() {
//     this.s3 = new AWS.S3({
//       accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//       secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//       region: process.env.AWS_REGION
//     });
//     this.bucket = process.env.AWS_S3_BUCKET;
//   }

//   async uploadFile(file, folder = 'uploads') {
//     const key = `${folder}/${Date.now()}-${file.originalname}`;
    
//     const params = {
//       Bucket: this.bucket,
//       Key: key,
//       Body: file.buffer,
//       ContentType: file.mimetype,
//       ACL: 'public-read'
//     };

//     const result = await this.s3.upload(params).promise();
//     return result.Location;
//   }

//   async uploadMultipleFiles(files, folder = 'uploads') {
//     const uploads = files.map(file => this.uploadFile(file, folder));
//     return Promise.all(uploads);
//   }

//   async deleteFile(fileUrl) {
//     const key = fileUrl.split('.com/')[1];
    
//     const params = {
//       Bucket: this.bucket,
//       Key: key
//     };

//     await this.s3.deleteObject(params).promise();
//     return true;
//   }

//   getSignedUrl(key, expiresIn = 3600) {
//     const params = {
//       Bucket: this.bucket,
//       Key: key,
//       Expires: expiresIn
//     };

//     return this.s3.getSignedUrl('getObject', params);
//   }
// }

// module.exports = new StorageService();

// // services/videoService.js
// const ffmpeg = require('fluent-ffmpeg');
// const path = require('path');
// const fs = require('fs');

// class VideoService {
//   async processVideo(inputPath, outputPath, options = {}) {
//     return new Promise((resolve, reject) => {
//       ffmpeg(inputPath)
//         .videoCodec('libx264')
//         .audioCodec('aac')
//         .size(options.size || '1280x720')
//         .autopad()
//         .aspect(options.aspect || '16:9')
//         .outputOptions([
//           '-preset fast',
//           '-crf 23',
//           '-movflags +faststart'
//         ])
//         .on('end', () => resolve(outputPath))
//         .on('error', (err) => reject(err))
//         .save(outputPath);
//     });
//   }

//   async generateThumbnail(videoPath, thumbnailPath, time = '00:00:01') {
//     return new Promise((resolve, reject) => {
//       ffmpeg(videoPath)
//         .screenshots({
//           timestamps: [time],
//           filename: path.basename(thumbnailPath),
//           folder: path.dirname(thumbnailPath),
//           size: '640x360'
//         })
//         .on('end', () => resolve(thumbnailPath))
//         .on('error', reject);
//     });
//   }

//   async getVideoDuration(videoPath) {
//     return new Promise((resolve, reject) => {
//       ffmpeg.ffprobe(videoPath, (err, metadata) => {
//         if (err) reject(err);
//         resolve(metadata.format.duration);
//       });
//     });
//   }
// }

// module.exports = new VideoService();