const { Certificate, Course, ProgressTracking } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');

exports.getMyCertificates = catchAsync(async (req, res, next) => {
  const certificates = await Certificate.find({ 
    student: req.user.id,
    isValid: true
  })
  .populate('course', 'title thumbnail')
  .sort('-issueDate');
  
  res.status(200).json({
    status: 'success',
    results: certificates.length,
    data: { certificates }
  });
});

/**
 * PRO FEATURE: Automated Certificate Claim
 * Validates progress before creating the certificate record
 */
exports.claimCertificate = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;

  // 1. Verify 100% Completion
  const progress = await ProgressTracking.findOne({ 
    student: req.user.id, 
    course: courseId 
  });

  if (!progress || !progress.isCompleted) {
    return next(new AppError('You must complete 100% of the course to claim a certificate', 400));
  }

  // 2. Check if already exists
  let certificate = await Certificate.findOne({ student: req.user.id, course: courseId });
  
  if (!certificate) {
    const course = await Course.findById(courseId).populate('instructor');
    const serial = `CERT-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${Date.now().toString().slice(-4)}`;

    certificate = await Certificate.create({
      certificateNumber: serial,
      student: req.user.id,
      course: courseId,
      studentName: `${req.user.firstName} ${req.user.lastName}`,
      courseName: course.title,
      instructor: course.instructor._id,
      instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`,
      percentage: progress.courseProgressPercentage,
      verificationUrl: `${req.protocol}://${req.get('host')}/verify/${serial}`
    });
  }

  res.status(201).json({
    status: 'success',
    data: { certificate }
  });
});

exports.generatePDF = catchAsync(async (req, res, next) => {
  const certificate = await Certificate.findById(req.params.id);
  
  if (!certificate || !certificate.isValid) {
    return next(new AppError('No valid certificate found', 404));
  }

  // Authorization check
  if (certificate.student.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('Unauthorized', 403));
  }

  const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 0 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Cert-${certificate.certificateNumber}.pdf`);
  
  doc.pipe(res);

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

  doc.end();
});

// Admin-only revoke
exports.revokeCertificate = catchAsync(async (req, res, next) => {
  const certificate = await Certificate.findByIdAndUpdate(req.params.id, { isValid: false }, { new: true });
  if (!certificate) return next(new AppError('Not found', 404));
  res.status(200).json({ status: 'success', message: 'Certificate revoked' });
});

// Public verification (No Login Required)
exports.verifyCertificate = catchAsync(async (req, res, next) => {
  const certificate = await Certificate.findOne({ 
    certificateNumber: req.params.certificateNumber,
    isValid: true 
  }).select('studentName courseName issueDate percentage instructorName');
  
  if (!certificate) return next(new AppError('Invalid certificate ID', 404));
  res.status(200).json({ status: 'success', data: { certificate } });
});

exports.getAllCertificates = factory.getAll(Certificate);
exports.getCertificate = factory.getOne(Certificate);


// const { Certificate, Course, User } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');
// const PDFDocument = require('pdfkit');
// const fs = require('fs');
// const path = require('path');

// exports.getMyCertificates = catchAsync(async (req, res, next) => {
//   const certificates = await Certificate.find({ 
//     student: req.user.id,
//     isValid: true
//   })
//   .populate('course', 'title instructor')
//   .populate('instructor', 'firstName lastName')
//   .sort('-issueDate');
  
//   res.status(200).json({
//     status: 'success',
//     results: certificates.length,
//     data: { certificates }
//   });
// });

// exports.verifyCertificate = catchAsync(async (req, res, next) => {
//   const { certificateNumber } = req.params;
  
//   const certificate = await Certificate.findOne({ 
//     certificateNumber,
//     isValid: true 
//   })
//   .populate('student', 'firstName lastName')
//   .populate('course', 'title')
//   .populate('instructor', 'firstName lastName');
  
//   if (!certificate) {
//     return next(new AppError('Invalid or revoked certificate', 404));
//   }
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       certificate: {
//         studentName: certificate.studentName,
//         courseName: certificate.courseName,
//         issueDate: certificate.issueDate,
//         grade: certificate.grade,
//         percentage: certificate.percentage,
//         instructorName: certificate.instructorName
//       },
//       isValid: true
//     }
//   });
// });

// exports.generatePDF = catchAsync(async (req, res, next) => {
//   const certificate = await Certificate.findById(req.params.id)
//     .populate('student', 'firstName lastName')
//     .populate('course', 'title')
//     .populate('instructor', 'firstName lastName');
  
//   if (!certificate) {
//     return next(new AppError('No certificate found with that ID', 404));
//   }
  
//   if (certificate.student.toString() !== req.user.id && req.user.role !== 'admin') {
//     return next(new AppError('Unauthorized to access this certificate', 403));
//   }
  
//   // Create PDF
//   const doc = new PDFDocument({
//     layout: 'landscape',
//     size: 'A4'
//   });
  
//   // Set response headers
//   res.setHeader('Content-Type', 'application/pdf');
//   res.setHeader('Content-Disposition', `attachment; filename=certificate-${certificate.certificateNumber}.pdf`);
  
//   doc.pipe(res);
  
//   // Add certificate design
//   doc.rect(50, 50, 700, 450).stroke();
  
//   doc.fontSize(30)
//      .text('Certificate of Completion', 100, 150, { align: 'center' });
  
//   doc.fontSize(20)
//      .text('This is to certify that', 100, 250, { align: 'center' });
  
//   doc.fontSize(25)
//      .text(certificate.studentName, 100, 300, { align: 'center' });
  
//   doc.fontSize(16)
//      .text(`has successfully completed the course`, 100, 350, { align: 'center' });
  
//   doc.fontSize(20)
//      .text(certificate.courseName, 100, 380, { align: 'center' });
  
//   doc.fontSize(12)
//      .text(`Certificate Number: ${certificate.certificateNumber}`, 100, 450);
  
//   doc.fontSize(12)
//      .text(`Issue Date: ${new Date(certificate.issueDate).toLocaleDateString()}`, 100, 470);
  
//   doc.fontSize(12)
//      .text(`Grade: ${certificate.grade || 'Passed'}`, 100, 490);
  
//   doc.fontSize(12)
//      .text(`Instructor: ${certificate.instructorName}`, 500, 450);
  
//   doc.end();
// });

// exports.revokeCertificate = catchAsync(async (req, res, next) => {
//   const certificate = await Certificate.findById(req.params.id);
  
//   if (!certificate) {
//     return next(new AppError('No certificate found with that ID', 404));
//   }
  
//   certificate.isValid = false;
//   await certificate.save();
  
//   res.status(200).json({
//     status: 'success',
//     message: 'Certificate revoked successfully'
//   });
// });

// // CRUD operations
// exports.getAllCertificates = factory.getAll(Certificate);
// exports.getCertificate = factory.getOne(Certificate);