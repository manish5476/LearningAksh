
const express = require('express');
const certificateController = require('../controllers/certificateController');
const authController = require('../controllers/authController');

const router = express.Router();

// Public Route
router.get('/verify/:certificateNumber', certificateController.verifyCertificate);

// Protected Routes
router.use(authController.protect);

router.get('/my-certificates', certificateController.getMyCertificates);
router.post('/claim/:courseId', certificateController.claimCertificate);
router.get('/download/:id', certificateController.generatePDF);

// Admin Only
router.use(authController.restrictTo('admin'));
router.patch('/:id/revoke', certificateController.revokeCertificate);
router.get('/', certificateController.getAllCertificates);

module.exports = router;
