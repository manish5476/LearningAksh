'use strict';
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const AppError = require('../utils/appError');
const CertificateRepository = require('../repositories/CertificateRepository');
const CourseRepository = require('../repositories/CourseRepository');
// Using Enrollment to check completion status based on our earlier architecture updates
const EnrollmentRepository = require('../repositories/EnrollmentRepository'); 

class CertificateService {

  async claimCertificate(student, courseId, protocol, host) {
    // 1. Verify 100% Completion via Enrollment or LessonProgress
    const enrollment = await EnrollmentRepository.findOne({ 
      student: student.id, 
      course: courseId 
    });

    // Adapt this check to wherever you store the final "100% complete" flag
    if (!enrollment || !enrollment.isCompleted) {
      throw new AppError('You must complete 100% of the course to claim a certificate', 400);
    }

    // 2. Check if already exists
    let certificate = await CertificateRepository.findOne({ student: student.id, course: courseId });
    
    if (!certificate) {
      const course = await CourseRepository.findById(courseId, ['instructor']);
      const serial = `CERT-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${Date.now().toString().slice(-4)}`;

      certificate = await CertificateRepository.create({
        certificateNumber: serial,
        student: student.id,
        course: courseId,
        studentName: `${student.firstName} ${student.lastName}`,
        courseName: course.title,
        instructor: course.instructor._id,
        instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`,
        percentage: 100, // Hardcoded to 100 since they must finish to claim
        verificationUrl: `${protocol}://${host}/verify/${serial}`
      });
    }

    return certificate;
  }

  async buildCertificatePDF(certificateId, user, writeStream) {
    const certificate = await CertificateRepository.findById(certificateId);
    
    if (!certificate || !certificate.isValid) {
      throw new AppError('No valid certificate found', 404);
    }

    // Authorization check
    if (certificate.student.toString() !== user.id && user.role !== 'admin') {
      throw new AppError('Unauthorized to view this certificate', 403);
    }

    // Initialize PDF
    const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 0 });
    
    // Pipe the PDF directly to the provided stream (e.g., the HTTP Response)
    doc.pipe(writeStream);

    // --- Professional Design ---
    const width = doc.page.width;
    const height = doc.page.height;

    // 1. Background Borders
    doc.rect(20, 20, width - 40, height - 40).lineWidth(10).stroke('#1a237e');
    doc.rect(35, 35, width - 70, height - 70).lineWidth(2).stroke('#c5a059');

    // 2. Main Content
    doc.moveDown(4);
    doc.font('Helvetica-Bold').fontSize(40).fillColor('#1a237e').text('CERTIFICATE OF COMPLETION', { align: 'center' });
    
    doc.moveDown(1.5);
    doc.font('Helvetica').fontSize(18).fillColor('#333').text('This is to certify that', { align: 'center' });
    
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(35).fillColor('#000').text(certificate.studentName, { align: 'center' });
    
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(16).text('has successfully completed the professional course', { align: 'center' });
    
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(28).fillColor('#1a237e').text(certificate.courseName, { align: 'center' });

    // 3. Metadata & Signature Area
    const bottomY = 420;
    
    // Left Side: Details
    doc.font('Helvetica').fontSize(10).fillColor('#666');
    doc.text(`Certificate No: ${certificate.certificateNumber}`, 70, bottomY);
    doc.text(`Issue Date: ${new Date(certificate.issueDate).toLocaleDateString()}`, 70, bottomY + 15);
    doc.text(`Verification: ${certificate.verificationUrl}`, 70, bottomY + 30);

    // Right Side: Signature
    doc.strokeColor('#000').lineWidth(1).moveTo(530, bottomY + 10).lineTo(730, bottomY + 10).stroke();
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000').text(certificate.instructorName, 530, bottomY + 15, { width: 200, align: 'center' });
    doc.font('Helvetica').fontSize(10).text('Course Instructor', 530, bottomY + 30, { width: 200, align: 'center' });

    // Finalize the PDF file
    doc.end();
  }

  async verifyCertificate(certificateNumber) {
    const certificate = await CertificateRepository.findOne({ 
      certificateNumber, 
      isValid: true 
    });
    
    if (!certificate) throw new AppError('Invalid certificate ID', 404);
    
    // Strip sensitive data before returning to a public route
    return {
      studentName: certificate.studentName,
      courseName: certificate.courseName,
      issueDate: certificate.issueDate,
      percentage: certificate.percentage,
      instructorName: certificate.instructorName,
      verificationUrl: certificate.verificationUrl
    };
  }
}

module.exports = new CertificateService();


// 'use strict';
// const crypto = require('crypto');
// const AppError = require('../utils/appError');
// const CertificateRepository = require('../repositories/CertificateRepository');
// const EnrollmentRepository = require('../repositories/EnrollmentRepository');

// class CertificateService {
  
//   async generateCertificate(studentId, courseId) {
//     // 1. Verify they actually completed it
//     const enrollment = await EnrollmentRepository.findOne({ student: studentId, course: courseId });
//     if (!enrollment || !enrollment.isCompleted) {
//       throw new AppError('Course must be fully completed to earn a certificate.', 400);
//     }

//     // 2. Check if already generated
//     let certificate = await CertificateRepository.findOne({ student: studentId, course: courseId });
//     if (certificate) return certificate;

//     // 3. Generate secure, unique verification number (e.g., CERT-A1B2C3D4)
//     const certNumber = `CERT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

//     // 4. Create record
//     certificate = await CertificateRepository.create({
//       student: studentId,
//       course: courseId,
//       certificateNumber: certNumber,
//       verificationUrl: `${process.env.FRONTEND_URL}/verify/${certNumber}`
//     });

//     // 5. Trigger background PDF generation queue (BullMQ)
//     // Queue.add('generate-pdf', { certificateId: certificate._id });

//     return certificate;
//   }

//   async verifyCertificate(certificateNumber) {
//     const certificate = await CertificateRepository.findByVerificationNumber(certificateNumber);
//     if (!certificate) throw new AppError('Invalid certificate number.', 404);
//     return certificate;
//   }
// }

// module.exports = new CertificateService();