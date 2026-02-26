const { Certificate, Course, User } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('../utils/handlerFactory');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

exports.getMyCertificates = catchAsync(async (req, res, next) => {
  const certificates = await Certificate.find({ 
    student: req.user.id,
    isValid: true
  })
  .populate('course', 'title instructor')
  .populate('instructor', 'firstName lastName')
  .sort('-issueDate');
  
  res.status(200).json({
    status: 'success',
    results: certificates.length,
    data: { certificates }
  });
});

exports.verifyCertificate = catchAsync(async (req, res, next) => {
  const { certificateNumber } = req.params;
  
  const certificate = await Certificate.findOne({ 
    certificateNumber,
    isValid: true 
  })
  .populate('student', 'firstName lastName')
  .populate('course', 'title')
  .populate('instructor', 'firstName lastName');
  
  if (!certificate) {
    return next(new AppError('Invalid or revoked certificate', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      certificate: {
        studentName: certificate.studentName,
        courseName: certificate.courseName,
        issueDate: certificate.issueDate,
        grade: certificate.grade,
        percentage: certificate.percentage,
        instructorName: certificate.instructorName
      },
      isValid: true
    }
  });
});

exports.generatePDF = catchAsync(async (req, res, next) => {
  const certificate = await Certificate.findById(req.params.id)
    .populate('student', 'firstName lastName')
    .populate('course', 'title')
    .populate('instructor', 'firstName lastName');
  
  if (!certificate) {
    return next(new AppError('No certificate found with that ID', 404));
  }
  
  if (certificate.student.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('Unauthorized to access this certificate', 403));
  }
  
  // Create PDF
  const doc = new PDFDocument({
    layout: 'landscape',
    size: 'A4'
  });
  
  // Set response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=certificate-${certificate.certificateNumber}.pdf`);
  
  doc.pipe(res);
  
  // Add certificate design
  doc.rect(50, 50, 700, 450).stroke();
  
  doc.fontSize(30)
     .text('Certificate of Completion', 100, 150, { align: 'center' });
  
  doc.fontSize(20)
     .text('This is to certify that', 100, 250, { align: 'center' });
  
  doc.fontSize(25)
     .text(certificate.studentName, 100, 300, { align: 'center' });
  
  doc.fontSize(16)
     .text(`has successfully completed the course`, 100, 350, { align: 'center' });
  
  doc.fontSize(20)
     .text(certificate.courseName, 100, 380, { align: 'center' });
  
  doc.fontSize(12)
     .text(`Certificate Number: ${certificate.certificateNumber}`, 100, 450);
  
  doc.fontSize(12)
     .text(`Issue Date: ${new Date(certificate.issueDate).toLocaleDateString()}`, 100, 470);
  
  doc.fontSize(12)
     .text(`Grade: ${certificate.grade || 'Passed'}`, 100, 490);
  
  doc.fontSize(12)
     .text(`Instructor: ${certificate.instructorName}`, 500, 450);
  
  doc.end();
});

exports.revokeCertificate = catchAsync(async (req, res, next) => {
  const certificate = await Certificate.findById(req.params.id);
  
  if (!certificate) {
    return next(new AppError('No certificate found with that ID', 404));
  }
  
  certificate.isValid = false;
  await certificate.save();
  
  res.status(200).json({
    status: 'success',
    message: 'Certificate revoked successfully'
  });
});

// CRUD operations
exports.getAllCertificates = factory.getAll(Certificate);
exports.getCertificate = factory.getOne(Certificate);