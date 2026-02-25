const express = require('express');
const certificateController = require('../controllers/certificateController');
const authController = require('../controllers/authController');

const router = express.Router();

// Public route for verification
router.get('/verify/:certificateNumber', certificateController.verifyCertificate);

// Protect all routes after this middleware
router.use(authController.protect);

router.get('/my-certificates', certificateController.getMyCertificates);
router.get('/:id/pdf', certificateController.generatePDF);

// Admin routes
router.use(authController.restrictTo('admin'));
router.patch('/:id/revoke', certificateController.revokeCertificate);

// CRUD operations
router.route('/')
  .get(certificateController.getAllCertificates);

router.route('/:id')
  .get(certificateController.getCertificate);

module.exports = router;