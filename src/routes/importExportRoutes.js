const express = require('express');
const importExportController = require('../controllers/importExportController');
const authController = require('../controllers/authController');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Protect all routes
router.use(authController.protect);
router.use(authController.restrictTo('admin'));

// Export routes
router.post('/export', importExportController.exportData);

// Import routes
router.post('/import', upload.single('file'), importExportController.importData);

// Template routes
router.get('/template/:type', importExportController.exportTemplate);

// Bulk operations
router.post('/bulk', importExportController.bulkOperation);

module.exports = router;