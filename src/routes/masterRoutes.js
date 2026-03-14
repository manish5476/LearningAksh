// routes/masterRoutes.js
const express = require('express');
const masterController = require('../controllers/masterController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
// These can be accessed without authentication
// Note: Changed :masterName to :type to match the new schema

router.get('/public/:type/values', masterController.getValuesByType);
router.get('/public/:type/hierarchy', masterController.getHierarchicalValues);
router.get('/public/:type/validate/:value', masterController.validateMasterValue);

// ==================== PROTECTED ROUTES ====================
// All routes below require authentication
router.use(protect);

// ==================== ADMIN ONLY ROUTES ====================

// Get all distinct master types (Great for populating admin filter dropdowns)
router.get('/types', 
  restrictTo('admin'),
  masterController.getMasterTypes
);

// Basic CRUD for Master records
router.post('/', 
  restrictTo('admin'),
  masterController.createMaster
);

router.get('/', 
  restrictTo('admin'),
  masterController.getAllMasters
);

router.get('/:id', 
  restrictTo('admin'),
  masterController.getMaster
);

router.patch('/:id', 
  restrictTo('admin'),
  masterController.updateMaster
);

router.delete('/:id', 
  restrictTo('admin'),
  masterController.deleteMaster
);

// Toggle active status (Replaces publish/unpublish)
router.patch('/:id/toggle-active', 
  restrictTo('admin'),
  masterController.toggleActiveStatus
);


// ==================== IMPORT / EXPORT ====================

// Import values (Body must contain { type: '...', values: [...] })
router.post('/import', 
  restrictTo('admin'),
  masterController.importValues
);

// Export values by type
router.get('/export/:type', 
  restrictTo('admin'),
  masterController.exportValues
);


// ==================== BULK OPERATIONS ====================

router.post('/bulk/create', 
  restrictTo('admin'),
  masterController.bulkCreateMasters
);

router.patch('/bulk/update', 
  restrictTo('admin'),
  masterController.bulkUpdateMasters
);

router.delete('/bulk/delete', 
  restrictTo('admin'),
  masterController.bulkDeleteMasters
);

router.get('/count/total', 
  restrictTo('admin'),
  masterController.countMasters
);

module.exports = router;


// // routes/masterRoutes.js
// const express = require('express');
// const masterController = require('../controllers/masterController');
// const { protect, restrictTo } = require('../middlewares/authMiddleware');

// const router = express.Router();

// // ==================== PUBLIC ROUTES ====================
// // These can be accessed without authentication
// router.get('/public/:masterName/values', masterController.getMasterValues);
// router.get('/public/:masterName/hierarchy', masterController.getHierarchicalValues);
// router.get('/public/:masterName/validate/:value', masterController.validateMasterValue);

// // ==================== PROTECTED ROUTES ====================
// // All routes below require authentication
// router.use(protect);

// // ==================== ADMIN ONLY ROUTES ====================
// // Master management (admin only)
// router.post('/', 
//   restrictTo('admin'),
//   masterController.createMaster
// );

// router.get('/', 
//   restrictTo('admin'),
//   masterController.getAllMasters
// );

// router.get('/:id', 
//   restrictTo('admin'),
//   masterController.getMaster
// );

// router.patch('/:id', 
//   restrictTo('admin'),
//   masterController.updateMaster
// );

// router.patch('/:id/publish', 
//   restrictTo('admin'),
//   masterController.publishMaster
// );

// router.patch('/:id/unpublish', 
//   restrictTo('admin'),
//   masterController.unpublishMaster
// );

// router.delete('/:id', 
//   restrictTo('admin'),
//   masterController.deleteMaster
// );

// router.patch('/:id/restore', 
//   restrictTo('admin'),
//   masterController.restoreMaster
// );

// // Master values management (admin only)
// router.post('/:id/values', 
//   restrictTo('admin'),
//   masterController.addValue
// );

// router.post('/:id/values/bulk', 
//   restrictTo('admin'),
//   masterController.bulkAddValues
// );

// router.patch('/:id/values/bulk', 
//   restrictTo('admin'),
//   masterController.bulkUpdateValues
// );

// router.post('/:id/values/import', 
//   restrictTo('admin'),
//   masterController.importValues
// );

// router.get('/:id/values/export', 
//   restrictTo('admin'),
//   masterController.exportValues
// );

// router.patch('/:id/values/:valueId', 
//   restrictTo('admin'),
//   masterController.updateValue
// );

// router.patch('/:id/values/:valueId/publish', 
//   restrictTo('admin'),
//   masterController.publishValue
// );

// router.patch('/:id/values/:valueId/unpublish', 
//   restrictTo('admin'),
//   masterController.unpublishValue
// );

// router.delete('/:id/values/:valueId', 
//   restrictTo('admin'),
//   masterController.deleteValue
// );

// // Bulk operations (admin only)
// router.post('/bulk/create', 
//   restrictTo('admin'),
//   masterController.bulkCreateMasters
// );

// router.patch('/bulk/update', 
//   restrictTo('admin'),
//   masterController.bulkUpdateMasters
// );

// router.delete('/bulk/delete', 
//   restrictTo('admin'),
//   masterController.bulkDeleteMasters
// );

// router.get('/count/total', 
//   restrictTo('admin'),
//   masterController.countMasters
// );

// module.exports = router;