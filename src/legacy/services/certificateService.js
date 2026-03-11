const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { Certificate, Course, User } = require('../models');
const storageService = require('./storageService');
const AppError = require('../utils/appError');
const path = require('path');
const fs = require('fs');

class CertificateService {
  constructor() {
    this.tempDir = path.join(__dirname, '../../temp/certificates');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Generate certificate for completed course
   * @param {Object} data - Certificate data
   */
  async generateCertificate(data) {
    const {
      studentId,
      courseId,
      studentName,
      courseName,
      grade,
      percentage,
      instructorName,
      issueDate = new Date()
    } = data;

    // Generate unique certificate number
    const certificateNumber = await this.generateCertificateNumber();

    // Create PDF
    const pdfPath = await this.createCertificatePDF({
      certificateNumber,
      studentName,
      courseName,
      grade,
      percentage,
      instructorName,
      issueDate
    });

    // Upload to storage
    const pdfBuffer = await fs.promises.readFile(pdfPath);
    const certificateUrl = await storageService.uploadFile({
      buffer: pdfBuffer,
      originalname: `certificate-${certificateNumber}.pdf`,
      mimetype: 'application/pdf'
    }, 'certificates');

    // Generate verification URL
    const verificationUrl = `${process.env.BASE_URL}/verify/certificate/${certificateNumber}`;

    // Create certificate record
    const certificate = await Certificate.create({
      student: studentId,
      course: courseId,
      certificateNumber,
      studentName,
      courseName,
      issueDate,
      grade,
      percentage,
      instructor: data.instructorId,
      instructorName,
      certificateUrl,
      verificationUrl,
      isValid: true
    });

    // Cleanup temp file
    await fs.promises.unlink(pdfPath);

    return certificate;
  }

  /**
   * Create certificate PDF
   * @private
   */
  async createCertificatePDF(data) {
    const {
      certificateNumber,
      studentName,
      courseName,
      grade,
      percentage,
      instructorName,
      issueDate
    } = data;

    const pdfPath = path.join(this.tempDir, `certificate-${certificateNumber}.pdf`);
    const doc = new PDFDocument({
      layout: 'landscape',
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Add border
    doc.rect(30, 30, 750, 520).stroke();

    // Add decorative elements
    doc.rect(40, 40, 730, 500).stroke();

    // Add logo or header
    doc.fontSize(40)
       .font('Helvetica-Bold')
       .fillColor('#333')
       .text('EdTech Platform', 100, 120, { align: 'center' });

    // Certificate title
    doc.fontSize(30)
       .fillColor('#667eea')
       .text('Certificate of Completion', 100, 180, { align: 'center' });

    // Certificate body
    doc.fontSize(16)
       .fillColor('#333')
       .text('This is to certify that', 100, 240, { align: 'center' });

    // Student name
    doc.fontSize(36)
       .font('Helvetica-Bold')
       .fillColor('#000')
       .text(studentName, 100, 270, { align: 'center' });

    // Course completion text
    doc.fontSize(16)
       .font('Helvetica')
       .fillColor('#333')
       .text('has successfully completed the course', 100, 320, { align: 'center' });

    // Course name
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#667eea')
       .text(courseName, 100, 350, { align: 'center' });

    // Grade and percentage
    if (grade || percentage) {
      doc.fontSize(14)
         .fillColor('#333')
         .text(`with grade: ${grade || 'Passed'} (${percentage || 100}%)`, 100, 390, { align: 'center' });
    }

    // Instructor and date
    doc.fontSize(12)
       .fillColor('#666')
       .text(`Instructor: ${instructorName}`, 100, 430, { align: 'center' });

    const formattedDate = new Date(issueDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Issued on: ${formattedDate}`, 100, 450, { align: 'center' });

    // Certificate number
    doc.fontSize(10)
       .fillColor('#999')
       .text(`Certificate No: ${certificateNumber}`, 100, 480, { align: 'center' });

    // Generate QR code for verification
    const verificationUrl = `${process.env.BASE_URL}/verify/certificate/${certificateNumber}`;
    const qrBuffer = await QRCode.toBuffer(verificationUrl);

    // Add QR code
    doc.image(qrBuffer, 350, 500, { width: 80, height: 80 });

    doc.end();

    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve(pdfPath));
      writeStream.on('error', reject);
    });
  }

  /**
   * Generate unique certificate number
   * @private
   */
  async generateCertificateNumber() {
    const prefix = 'CERT';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    let certificateNumber = `${prefix}-${timestamp}-${random}`;
    
    // Ensure uniqueness
    const existing = await Certificate.findOne({ certificateNumber });
    if (existing) {
      return this.generateCertificateNumber();
    }
    
    return certificateNumber;
  }

  /**
   * Verify certificate
   * @param {String} certificateNumber - Certificate number
   */
  async verifyCertificate(certificateNumber) {
    const certificate = await Certificate.findOne({ 
      certificateNumber,
      isValid: true 
    })
    .populate('student', 'firstName lastName')
    .populate('course', 'title')
    .populate('instructor', 'firstName lastName');

    if (!certificate) {
      return {
        isValid: false,
        message: 'Certificate not found or has been revoked'
      };
    }

    return {
      isValid: true,
      certificate: {
        studentName: certificate.studentName,
        courseName: certificate.courseName,
        issueDate: certificate.issueDate,
        grade: certificate.grade,
        percentage: certificate.percentage,
        instructorName: certificate.instructorName,
        verificationUrl: certificate.verificationUrl
      }
    };
  }

  /**
   * Revoke certificate
   * @param {String} certificateId - Certificate ID
   * @param {String} reason - Revocation reason
   */
  async revokeCertificate(certificateId, reason) {
    const certificate = await Certificate.findByIdAndUpdate(
      certificateId,
      {
        isValid: false,
        revokedAt: new Date(),
        revocationReason: reason
      },
      { new: true }
    );

    return certificate;
  }

  /**
   * Get user certificates
   * @param {String} userId - User ID
   */
  async getUserCertificates(userId) {
    const certificates = await Certificate.find({ 
      student: userId,
      isValid: true 
    })
    .populate('course', 'title thumbnail')
    .sort('-issueDate');

    return certificates;
  }

  /**
   * Get certificate by ID
   * @param {String} certificateId - Certificate ID
   */
  async getCertificate(certificateId) {
    const certificate = await Certificate.findById(certificateId)
      .populate('student', 'firstName lastName email')
      .populate('course', 'title description')
      .populate('instructor', 'firstName lastName');

    return certificate;
  }

  /**
   * Bulk generate certificates
   * @param {Array} completions - Array of completion data
   */
  async bulkGenerateCertificates(completions) {
    const results = {
      successful: [],
      failed: []
    };

    for (const completion of completions) {
      try {
        const certificate = await this.generateCertificate(completion);
        results.successful.push(certificate);
      } catch (error) {
        results.failed.push({
          data: completion,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Send certificate by email
   * @param {String} certificateId - Certificate ID
   * @param {String} email - Recipient email
   */
  async sendCertificateByEmail(certificateId, email) {
    const certificate = await this.getCertificate(certificateId);
    if (!certificate) {
      throw new AppError('Certificate not found', 404);
    }

    // Queue email with certificate attachment
    const emailQueue = require('../jobs/emailQueue');
    await emailQueue.add({
      type: 'certificate',
      data: {
        to: email,
        studentName: certificate.studentName,
        courseName: certificate.courseName,
        certificateUrl: certificate.certificateUrl,
        verificationUrl: certificate.verificationUrl
      }
    });

    return true;
  }
}

module.exports = new CertificateService();