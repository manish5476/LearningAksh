'use strict';
const catchAsync = require('../utils/catchAsync');
const CertificateService = require('../services/CertificateService');
const CertificateRepository = require('../repositories/CertificateRepository');
const AppError = require('../utils/appError');

// ==========================================
// STUDENT ACTIONS
// ==========================================
exports.getMyCertificates = catchAsync(async (req, res, next) => {
  const result = await CertificateRepository.findMany(
    req.query,
    { student: req.user.id, isValid: true },
    { path: 'course', select: 'title thumbnail' }
  );

  res.status(200).json({ 
    status: 'success', 
    results: result.results, 
    data: { certificates: result.data } 
  });
});

exports.claimCertificate = catchAsync(async (req, res, next) => {
  const certificate = await CertificateService.claimCertificate(
    req.user, 
    req.params.courseId, 
    req.protocol, 
    req.get('host')
  );

  res.status(201).json({ status: 'success', data: { certificate } });
});

exports.generatePDF = catchAsync(async (req, res, next) => {
  // 1. We must fetch the certificate briefly just to get the number for the filename
  const cert = await CertificateRepository.findById(req.params.id);
  if (!cert) return next(new AppError('Certificate not found', 404));

  // 2. Set the HTTP headers for a PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Cert-${cert.certificateNumber}.pdf`);

  // 3. Hand the Express Response stream to the Service to pipe the PDF directly into it
  await CertificateService.buildCertificatePDF(req.params.id, req.user, res);
});

// ==========================================
// PUBLIC ACTIONS
// ==========================================
exports.verifyCertificate = catchAsync(async (req, res, next) => {
  const certificate = await CertificateService.verifyCertificate(req.params.certificateNumber);
  res.status(200).json({ status: 'success', data: { certificate } });
});

// ==========================================
// ADMIN ACTIONS
// ==========================================
exports.revokeCertificate = catchAsync(async (req, res, next) => {
  const certificate = await CertificateRepository.updateById(req.params.id, { isValid: false });
  if (!certificate) return next(new AppError('Not found', 404));
  res.status(200).json({ status: 'success', message: 'Certificate revoked' });
});

exports.getAllCertificates = catchAsync(async (req, res, next) => {
  const result = await CertificateRepository.findMany(req.query);
  res.status(200).json({ status: 'success', results: result.results, data: { certificates: result.data } });
});

exports.getCertificate = catchAsync(async (req, res, next) => {
  const certificate = await CertificateRepository.findById(req.params.id);
  if (!certificate) return next(new AppError('Not found', 404));
  res.status(200).json({ status: 'success', data: { certificate } });
});




// const { Certificate, Course, ProgressTracking } = require('../models');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');
// const factory = require('../utils/handlerFactory');
// const PDFDocument = require('pdfkit');
// const crypto = require('crypto');

// exports.getMyCertificates = catchAsync(async (req, res, next) => {
//   const certificates = await Certificate.find({ 
//     student: req.user.id,
//     isValid: true
//   })
//   .populate('course', 'title thumbnail')
//   .sort('-issueDate');
  
//   res.status(200).json({
//     status: 'success',
//     results: certificates.length,
//     data: { certificates }
//   });
// });

// /**
//  * PRO FEATURE: Automated Certificate Claim
//  * Validates progress before creating the certificate record
//  */
// exports.claimCertificate = catchAsync(async (req, res, next) => {
//   const { courseId } = req.params;

//   // 1. Verify 100% Completion
//   const progress = await ProgressTracking.findOne({ 
//     student: req.user.id, 
//     course: courseId 
//   });

//   if (!progress || !progress.isCompleted) {
//     return next(new AppError('You must complete 100% of the course to claim a certificate', 400));
//   }

//   // 2. Check if already exists
//   let certificate = await Certificate.findOne({ student: req.user.id, course: courseId });
  
//   if (!certificate) {
//     const course = await Course.findById(courseId).populate('instructor');
//     const serial = `CERT-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${Date.now().toString().slice(-4)}`;

//     certificate = await Certificate.create({
//       certificateNumber: serial,
//       student: req.user.id,
//       course: courseId,
//       studentName: `${req.user.firstName} ${req.user.lastName}`,
//       courseName: course.title,
//       instructor: course.instructor._id,
//       instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`,
//       percentage: progress.courseProgressPercentage,
//       verificationUrl: `${req.protocol}://${req.get('host')}/verify/${serial}`
//     });
//   }

//   res.status(201).json({
//     status: 'success',
//     data: { certificate }
//   });
// });

// exports.generatePDF = catchAsync(async (req, res, next) => {
//   const certificate = await Certificate.findById(req.params.id);
  
//   if (!certificate || !certificate.isValid) {
//     return next(new AppError('No valid certificate found', 404));
//   }

//   // Authorization check
//   if (certificate.student.toString() !== req.user.id && req.user.role !== 'admin') {
//     return next(new AppError('Unauthorized', 403));
//   }

//   const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 0 });

//   res.setHeader('Content-Type', 'application/pdf');
//   res.setHeader('Content-Disposition', `attachment; filename=Cert-${certificate.certificateNumber}.pdf`);
  
//   doc.pipe(res);

//   // --- Professional Design ---
//   const width = doc.page.width;
//   const height = doc.page.height;

//   // 1. Background Borders
//   doc.rect(20, 20, width - 40, height - 40).lineWidth(10).stroke('#1a237e');
//   doc.rect(35, 35, width - 70, height - 70).lineWidth(2).stroke('#c5a059');

//   // 2. Main Content
//   doc.moveDown(4);
//   doc.font('Helvetica-Bold').fontSize(40).fillColor('#1a237e').text('CERTIFICATE OF COMPLETION', { align: 'center' });
  
//   doc.moveDown(1.5);
//   doc.font('Helvetica').fontSize(18).fillColor('#333').text('This is to certify that', { align: 'center' });
  
//   doc.moveDown(0.5);
//   doc.font('Helvetica-Bold').fontSize(35).fillColor('#000').text(certificate.studentName, { align: 'center' });
  
//   doc.moveDown(0.5);
//   doc.font('Helvetica').fontSize(16).text('has successfully completed the professional course', { align: 'center' });
  
//   doc.moveDown(0.5);
//   doc.font('Helvetica-Bold').fontSize(28).fillColor('#1a237e').text(certificate.courseName, { align: 'center' });

//   // 3. Metadata & Signature Area
//   const bottomY = 420;
  
//   // Left Side: Details
//   doc.font('Helvetica').fontSize(10).fillColor('#666');
//   doc.text(`Certificate No: ${certificate.certificateNumber}`, 70, bottomY);
//   doc.text(`Issue Date: ${new Date(certificate.issueDate).toLocaleDateString()}`, 70, bottomY + 15);
//   doc.text(`Verification: ${certificate.verificationUrl}`, 70, bottomY + 30);

//   // Right Side: Signature
//   doc.strokeColor('#000').lineWidth(1).moveTo(530, bottomY + 10).lineTo(730, bottomY + 10).stroke();
//   doc.font('Helvetica-Bold').fontSize(12).fillColor('#000').text(certificate.instructorName, 530, bottomY + 15, { width: 200, align: 'center' });
//   doc.font('Helvetica').fontSize(10).text('Course Instructor', 530, bottomY + 30, { width: 200, align: 'center' });

//   doc.end();
// });

// // Admin-only revoke
// exports.revokeCertificate = catchAsync(async (req, res, next) => {
//   const certificate = await Certificate.findByIdAndUpdate(req.params.id, { isValid: false }, { new: true });
//   if (!certificate) return next(new AppError('Not found', 404));
//   res.status(200).json({ status: 'success', message: 'Certificate revoked' });
// });

// // Public verification (No Login Required)
// exports.verifyCertificate = catchAsync(async (req, res, next) => {
//   const certificate = await Certificate.findOne({ 
//     certificateNumber: req.params.certificateNumber,
//     isValid: true 
//   }).select('studentName courseName issueDate percentage instructorName');
  
//   if (!certificate) return next(new AppError('Invalid certificate ID', 404));
//   res.status(200).json({ status: 'success', data: { certificate } });
// });

// exports.getAllCertificates = factory.getAll(Certificate);
// exports.getCertificate = factory.getOne(Certificate);
