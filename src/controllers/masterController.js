// controllers/masterController.js
const { Master } = require('../models');
const factory = require('../utils/handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// ==================== MASTER MANAGEMENT (CRUD) ====================

// Create new master record
exports.createMaster = catchAsync(async (req, res, next) => {
  // Ensure type and code are formatted correctly
  if (req.body.type) req.body.type = req.body.type.toLowerCase();
  if (req.body.code) req.body.code = req.body.code.toUpperCase();
  
  // Check if master already exists (using the compound index logic)
  const existingMaster = await Master.findOne({ 
    type: req.body.type, 
    code: req.body.code 
  });

  if (existingMaster) {
    return next(new AppError(`A master record with type '${req.body.type}' and code '${req.body.code}' already exists`, 400));
  }
  
  const master = await Master.create(req.body);
  
  res.status(201).json({
    status: 'success',
    data: master
  });
});

// Get all master records (Admin view)
exports.getAllMasters = catchAsync(async (req, res, next) => {
  const { type, isActive, search } = req.query;
  
  let filter = {};
  
  if (type) filter.type = type.toLowerCase();
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  
  if (search) {
    filter.$or = [
      { type: new RegExp(search, 'i') },
      { name: new RegExp(search, 'i') },
      { code: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') }
    ];
  }
  
  const masters = await Master.find(filter).sort('type metadata.sortOrder name');
  
  res.status(200).json({
    status: 'success',
    results: masters.length,
    data: masters
  });
});

// Get all distinct master types (Useful for admin dropdowns to filter the table)
// controllers/masterController.js

exports.getMasterTypes = catchAsync(async (req, res, next) => {
  // 1. Get distinct types, ensuring the type field actually exists and isn't null
  const rawTypes = await Master.find({ 
    type: { $ne: null, $exists: true } 
  }).distinct('type');
  
  // 2. Map them into Label / Value pairs for the frontend dropdown
  const formattedTypes = rawTypes
    .filter(type => type !== '') // Extra safety check to remove empty strings
    .map(type => {
      // Convert 'course_category' into 'Course Category'
      const label = type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
        
      return { label, value: type };
    });

  // 3. Sort them alphabetically by label so they look nice in the UI
  formattedTypes.sort((a, b) => a.label.localeCompare(b.label));
  
  res.status(200).json({
    status: 'success',
    results: formattedTypes.length,
    data: formattedTypes
  });
});

// Get single master record
exports.getMaster = catchAsync(async (req, res, next) => {
  // Can search by MongoDB _id or the generated slug
  const isObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
  const filter = isObjectId ? { _id: req.params.id } : { slug: req.params.id.toLowerCase() };

  const master = await Master.findOne(filter).populate('parentId', 'name code type slug');
  
  if (!master) {
    return next(new AppError('Master record not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: master
  });
});

// Update master record
exports.updateMaster = catchAsync(async (req, res, next) => {
  if (req.body.type) req.body.type = req.body.type.toLowerCase();
  if (req.body.code) req.body.code = req.body.code.toUpperCase();

  const updatedMaster = await Master.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  
  if (!updatedMaster) {
    return next(new AppError('Master record not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: updatedMaster
  });
});

// Toggle Active Status (Replaces publish/unpublish)
exports.toggleActiveStatus = catchAsync(async (req, res, next) => {
  const master = await Master.findById(req.params.id);
  
  if (!master) {
    return next(new AppError('Master record not found', 404));
  }
  
  master.isActive = !master.isActive;
  await master.save();
  
  res.status(200).json({
    status: 'success',
    data: master
  });
});


// ==================== PUBLIC / UTILITY ENDPOINTS ====================

// Get all values for a specific type (Main endpoint for frontend dropdowns)
exports.getValuesByType = catchAsync(async (req, res, next) => {
  const { type } = req.params;
  const { activeOnly } = req.query;
  
  let filter = { type: type.toLowerCase() };
  if (activeOnly !== 'false') {
    filter.isActive = true;
  }
  
  const values = await Master.find(filter)
    .sort('metadata.sortOrder name')
    .select('-__v -createdAt -updatedAt'); // Exclude system noise
  
  res.status(200).json({
    status: 'success',
    results: values.length,
    data: values
  });
});

// Get hierarchical values for a type (e.g., Categories)
exports.getHierarchicalValues = catchAsync(async (req, res, next) => {
  const { type } = req.params;
  
  // Fetch all active records of this type
  const masters = await Master.find({ 
    type: type.toLowerCase(), 
    isActive: true 
  }).lean().sort('metadata.sortOrder name');
  
  if (!masters.length) {
    return res.status(200).json({ status: 'success', data: [] });
  }
  
  // Build the tree
  const map = {};
  const roots = [];
  
  masters.forEach(node => {
    map[node._id] = { ...node, children: [] };
  });
  
  masters.forEach(node => {
    if (node.parentId && map[node.parentId]) {
      map[node.parentId].children.push(map[node._id]);
    } else {
      roots.push(map[node._id]);
    }
  });
  
  res.status(200).json({
    status: 'success',
    data: roots
  });
});

// Validate value against master (Used internally or by frontend validation)
exports.validateMasterValue = catchAsync(async (req, res, next) => {
  const { type, value } = req.params;
  
  const isValid = await Master.validateValue(type, value);
  
  res.status(200).json({
    status: 'success',
    data: {
      type,
      value,
      isValid
    }
  });
});


// ==================== BULK OPERATIONS ====================

// Import values from JSON array
exports.importValues = catchAsync(async (req, res, next) => {
  const { values, type } = req.body;
  
  if (!Array.isArray(values) || !type) {
    return next(new AppError('Please provide an array of values and a target type', 400));
  }
  
  const importedValues = [];
  
  for (const v of values) {
    const code = v.code ? v.code.toUpperCase() : null;
    
    // Check if it exists
    const existing = await Master.findOne({ type: type.toLowerCase(), code });
    
    if (!existing) {
      importedValues.push({
        type: type.toLowerCase(),
        code,
        name: v.name,
        description: v.description,
        isActive: v.isActive !== false,
        metadata: v.metadata || {}
      });
    }
  }
  
  let created = [];
  if (importedValues.length > 0) {
    created = await Master.insertMany(importedValues);
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      imported: created.length,
      skipped: values.length - created.length
    }
  });
});

// Export values to CSV
exports.exportValues = catchAsync(async (req, res, next) => {
  const { type } = req.params;
  const { activeOnly = 'true' } = req.query;
  
  let filter = { type: type.toLowerCase() };
  if (activeOnly === 'true') filter.isActive = true;
  
  const values = await Master.find(filter).sort('metadata.sortOrder name');
  
  if (!values.length) {
    return next(new AppError('No records found for this type to export', 404));
  }
  
  // Convert to CSV
  const headers = ['type', 'code', 'name', 'slug', 'description', 'isActive', 'sortOrder'];
  const csvRows = [headers.join(',')];
  
  values.forEach(v => {
    const row = [
      v.type,
      v.code,
      v.name,
      v.slug,
      v.description || '',
      v.isActive,
      v.metadata?.sortOrder || 0
    ].map(val => `"${val.toString().replace(/"/g, '""')}"`);
    
    csvRows.push(row.join(','));
  });
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${type}_master_data.csv`);
  res.send(csvRows.join('\n'));
});

// Standard CRUD operations (Admin only) using your handler factory
exports.deleteMaster = factory.deleteOne(Master);
exports.bulkCreateMasters = factory.bulkCreate(Master);
exports.bulkUpdateMasters = factory.bulkUpdate(Master);
exports.bulkDeleteMasters = factory.bulkDelete(Master);
exports.countMasters = factory.count(Master);


// // controllers/masterController.js
// // const Master = require('../models/Master');
// const {Master } = require('../models');

// const factory = require('../utils/handlerFactory');
// const catchAsync = require('../utils/catchAsync');
// const AppError = require('../utils/appError');
// const mongoose = require('mongoose');

// // ==================== MASTER MANAGEMENT ====================

// // Create new master type
// exports.createMaster = catchAsync(async (req, res, next) => {
//   // Ensure masterName is uppercase
//   req.body.masterName = req.body.masterName.toUpperCase();
  
//   // Check if master already exists
//   const existingMaster = await Master.findOne({ masterName: req.body.masterName });
//   if (existingMaster) {
//     return next(new AppError(`Master '${req.body.masterName}' already exists`, 400));
//   }
  
//   // Set audit fields
//   req.body.createdBy = req.user.id;
  
//   const master = await Master.create(req.body);
  
//   res.status(201).json({
//     status: 'success',
//     data: master
//   });
// });

// // Get all masters with filtering
// exports.getAllMasters = catchAsync(async (req, res, next) => {
//   const { category, isActive, isPublished, search } = req.query;
  
//   let filter = { isDeleted: { $ne: true } };
  
//   if (category) filter.category = category;
//   if (isActive !== undefined) filter.isActive = isActive === 'true';
//   if (isPublished !== undefined) filter.isPublished = isPublished === 'true';
//   if (search) {
//     filter.$or = [
//       { masterName: new RegExp(search, 'i') },
//       { displayName: new RegExp(search, 'i') },
//       { description: new RegExp(search, 'i') }
//     ];
//   }
  
//   const masters = await Master.find(filter)
//     .populate('createdBy', 'name email')
//     .populate('updatedBy', 'name email')
//     .populate('publishedBy', 'name email')
//     .sort('-createdAt');
  
//   res.status(200).json({
//     status: 'success',
//     results: masters.length,
//     data: masters
//   });
// });

// // Get single master
// exports.getMaster = catchAsync(async (req, res, next) => {
//   const master = await Master.findOne({
//     $or: [
//       { _id: req.params.id },
//       { masterName: req.params.id.toUpperCase() }
//     ],
//     isDeleted: { $ne: true }
//   })
//   .populate('createdBy', 'name email')
//   .populate('updatedBy', 'name email')
//   .populate('publishedBy', 'name email')
//   .populate('values.createdBy', 'name email')
//   .populate('values.updatedBy', 'name email');
  
//   if (!master) {
//     return next(new AppError('Master not found', 404));
//   }
  
//   res.status(200).json({
//     status: 'success',
//     data: master
//   });
// });

// // Update master
// exports.updateMaster = catchAsync(async (req, res, next) => {
//   // Prevent updating masterName if it's a system master
//   const master = await Master.findById(req.params.id);
  
//   if (!master) {
//     return next(new AppError('Master not found', 404));
//   }
  
//   if (master.isSystem && req.body.masterName) {
//     return next(new AppError('Cannot update masterName of system master', 400));
//   }
  
//   req.body.updatedBy = req.user.id;
  
//   const updatedMaster = await Master.findByIdAndUpdate(
//     req.params.id,
//     req.body,
//     { new: true, runValidators: true }
//   );
  
//   res.status(200).json({
//     status: 'success',
//     data: updatedMaster
//   });
// });

// // Publish master
// exports.publishMaster = catchAsync(async (req, res, next) => {
//   const master = await Master.findByIdAndUpdate(
//     req.params.id,
//     {
//       isPublished: true,
//       publishedBy: req.user.id,
//       publishedAt: new Date()
//     },
//     { new: true }
//   );
  
//   if (!master) {
//     return next(new AppError('Master not found', 404));
//   }
  
//   res.status(200).json({
//     status: 'success',
//     data: master
//   });
// });

// // Unpublish master
// exports.unpublishMaster = catchAsync(async (req, res, next) => {
//   const master = await Master.findByIdAndUpdate(
//     req.params.id,
//     {
//       isPublished: false,
//       publishedBy: null,
//       publishedAt: null
//     },
//     { new: true }
//   );
  
//   if (!master) {
//     return next(new AppError('Master not found', 404));
//   }
  
//   res.status(200).json({
//     status: 'success',
//     data: master
//   });
// });

// // ==================== MASTER VALUES MANAGEMENT ====================

// // Add value to master
// exports.addValue = catchAsync(async (req, res, next) => {
//   const master = await Master.findById(req.params.id);
  
//   if (!master) {
//     return next(new AppError('Master not found', 404));
//   }
  
//   if (master.isLocked) {
//     return next(new AppError('Cannot modify locked master', 400));
//   }
  
//   // Check if value already exists
//   const valueExists = master.values.some(v => v.value === req.body.value);
//   if (valueExists) {
//     return next(new AppError(`Value '${req.body.value}' already exists in this master`, 400));
//   }
  
//   // Add audit fields
//   req.body.createdBy = req.user.id;
//   req.body.updatedBy = req.user.id;
  
//   master.values.push(req.body);
//   master.updatedBy = req.user.id;
  
//   await master.save();
  
//   res.status(201).json({
//     status: 'success',
//     data: master
//   });
// });

// // Bulk add values
// exports.bulkAddValues = catchAsync(async (req, res, next) => {
//   const { values } = req.body;
  
//   if (!Array.isArray(values)) {
//     return next(new AppError('Values must be an array', 400));
//   }
  
//   const master = await Master.findById(req.params.id);
  
//   if (!master) {
//     return next(new AppError('Master not found', 404));
//   }
  
//   if (master.isLocked) {
//     return next(new AppError('Cannot modify locked master', 400));
//   }
  
//   // Add audit fields and check for duplicates
//   const existingValues = new Set(master.values.map(v => v.value));
//   const newValues = [];
  
//   values.forEach(v => {
//     if (!existingValues.has(v.value)) {
//       newValues.push({
//         ...v,
//         createdBy: req.user.id,
//         updatedBy: req.user.id
//       });
//     }
//   });
  
//   master.values.push(...newValues);
//   master.updatedBy = req.user.id;
  
//   await master.save();
  
//   res.status(201).json({
//     status: 'success',
//     data: {
//       added: newValues.length,
//       skipped: values.length - newValues.length,
//       master
//     }
//   });
// });

// // Update value
// exports.updateValue = catchAsync(async (req, res, next) => {
//   const { valueId } = req.params;
  
//   const master = await Master.findById(req.params.id);
  
//   if (!master) {
//     return next(new AppError('Master not found', 404));
//   }
  
//   if (master.isLocked) {
//     return next(new AppError('Cannot modify locked master', 400));
//   }
  
//   const value = master.values.id(valueId);
  
//   if (!value) {
//     return next(new AppError('Value not found', 404));
//   }
  
//   // Prevent updating value of system master
//   if (master.isSystem && value.isSystem) {
//     return next(new AppError('Cannot update system value', 400));
//   }
  
//   // Update fields
//   Object.keys(req.body).forEach(key => {
//     if (key !== '_id' && key !== 'isSystem') {
//       value[key] = req.body[key];
//     }
//   });
  
//   value.updatedBy = req.user.id;
//   master.updatedBy = req.user.id;
  
//   await master.save();
  
//   res.status(200).json({
//     status: 'success',
//     data: master
//   });
// });

// // Publish value
// exports.publishValue = catchAsync(async (req, res, next) => {
//   const { valueId } = req.params;
  
//   const master = await Master.findById(req.params.id);
  
//   if (!master) {
//     return next(new AppError('Master not found', 404));
//   }
  
//   const value = master.values.id(valueId);
  
//   if (!value) {
//     return next(new AppError('Value not found', 404));
//   }
  
//   value.isPublished = true;
//   value.publishedBy = req.user.id;
//   value.publishedAt = new Date();
//   value.updatedBy = req.user.id;
//   master.updatedBy = req.user.id;
  
//   await master.save();
  
//   res.status(200).json({
//     status: 'success',
//     data: master
//   });
// });

// // Unpublish value
// exports.unpublishValue = catchAsync(async (req, res, next) => {
//   const { valueId } = req.params;
  
//   const master = await Master.findById(req.params.id);
  
//   if (!master) {
//     return next(new AppError('Master not found', 404));
//   }
  
//   const value = master.values.id(valueId);
  
//   if (!value) {
//     return next(new AppError('Value not found', 404));
//   }
  
//   value.isPublished = false;
//   value.publishedBy = null;
//   value.publishedAt = null;
//   value.updatedBy = req.user.id;
//   master.updatedBy = req.user.id;
  
//   await master.save();
  
//   res.status(200).json({
//     status: 'success',
//     data: master
//   });
// });

// // Delete value (soft delete)
// exports.deleteValue = catchAsync(async (req, res, next) => {
//   const { valueId } = req.params;
  
//   const master = await Master.findById(req.params.id);
  
//   if (!master) {
//     return next(new AppError('Master not found', 404));
//   }
  
//   const value = master.values.id(valueId);
  
//   if (!value) {
//     return next(new AppError('Value not found', 404));
//   }
  
//   if (master.isSystem && value.isSystem) {
//     return next(new AppError('Cannot delete system value', 400));
//   }
  
//   value.isDeleted = true;
//   value.deletedAt = new Date();
//   value.deletedBy = req.user.id;
//   master.updatedBy = req.user.id;
  
//   await master.save();
  
//   res.status(204).json({
//     status: 'success',
//     data: null
//   });
// });

// // ==================== PUBLIC API ENDPOINTS ====================

// // Get master values by master name (public)
// exports.getMasterValues = catchAsync(async (req, res, next) => {
//   const { masterName } = req.params;
//   const { includeMetadata, activeOnly, publishedOnly } = req.query;
  
//   const values = await Master.getMasterValues(masterName, {
//     activeOnly: activeOnly !== 'false',
//     publishedOnly: publishedOnly !== 'false',
//     includeMetadata: includeMetadata === 'true'
//   });
  
//   res.status(200).json({
//     status: 'success',
//     results: values.length,
//     data: values
//   });
// });

// // Get hierarchical values
// exports.getHierarchicalValues = catchAsync(async (req, res, next) => {
//   const master = await Master.findOne({
//     masterName: req.params.masterName.toUpperCase(),
//     isActive: true,
//     isPublished: true,
//     'config.isHierarchical': true
//   });
  
//   if (!master) {
//     return next(new AppError('Master not found or not hierarchical', 404));
//   }
  
//   res.status(200).json({
//     status: 'success',
//     data: master.hierarchy
//   });
// });

// // Validate value against master
// exports.validateMasterValue = catchAsync(async (req, res, next) => {
//   const { masterName, value } = req.params;
  
//   const isValid = await Master.validateValue(masterName, value);
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       masterName,
//       value,
//       isValid
//     }
//   });
// });

// // ==================== BULK OPERATIONS ====================

// // Bulk update values
// exports.bulkUpdateValues = catchAsync(async (req, res, next) => {
//   const { updates } = req.body;
  
//   if (!Array.isArray(updates)) {
//     return next(new AppError('Updates must be an array', 400));
//   }
  
//   const master = await Master.findById(req.params.id);
  
//   if (!master) {
//     return next(new AppError('Master not found', 404));
//   }
  
//   if (master.isLocked) {
//     return next(new AppError('Cannot modify locked master', 400));
//   }
  
//   let updatedCount = 0;
  
//   updates.forEach(update => {
//     const value = master.values.id(update.valueId);
//     if (value) {
//       Object.keys(update.data).forEach(key => {
//         if (key !== '_id' && key !== 'isSystem') {
//           value[key] = update.data[key];
//         }
//       });
//       value.updatedBy = req.user.id;
//       updatedCount++;
//     }
//   });
  
//   master.updatedBy = req.user.id;
//   await master.save();
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       updated: updatedCount,
//       total: updates.length,
//       master
//     }
//   });
// });

// // Import values from CSV/JSON
// exports.importValues = catchAsync(async (req, res, next) => {
//   const { values, replaceExisting = false } = req.body;
  
//   if (!Array.isArray(values)) {
//     return next(new AppError('Values must be an array', 400));
//   }
  
//   const master = await Master.findById(req.params.id);
  
//   if (!master) {
//     return next(new AppError('Master not found', 404));
//   }
  
//   if (master.isLocked) {
//     return next(new AppError('Cannot modify locked master', 400));
//   }
  
//   const existingValues = new Map(master.values.map(v => [v.value, v]));
//   const importedValues = [];
//   const updatedValues = [];
  
//   values.forEach(v => {
//     if (existingValues.has(v.value)) {
//       if (replaceExisting) {
//         const existing = existingValues.get(v.value);
//         Object.keys(v).forEach(key => {
//           if (key !== '_id' && key !== 'isSystem') {
//             existing[key] = v[key];
//           }
//         });
//         existing.updatedBy = req.user.id;
//         updatedValues.push(v.value);
//       }
//     } else {
//       importedValues.push({
//         ...v,
//         createdBy: req.user.id,
//         updatedBy: req.user.id
//       });
//     }
//   });
  
//   if (importedValues.length > 0) {
//     master.values.push(...importedValues);
//   }
  
//   master.updatedBy = req.user.id;
//   await master.save();
  
//   res.status(200).json({
//     status: 'success',
//     data: {
//       imported: importedValues.length,
//       updated: updatedValues.length,
//       total: master.values.length
//     }
//   });
// });

// // Export values
// exports.exportValues = catchAsync(async (req, res, next) => {
//   const master = await Master.findById(req.params.id);
  
//   if (!master) {
//     return next(new AppError('Master not found', 404));
//   }
  
//   const { format = 'json', activeOnly = true, publishedOnly = true } = req.query;
  
//   let values = master.values;
  
//   if (activeOnly === 'true') {
//     values = values.filter(v => v.isActive);
//   }
  
//   if (publishedOnly === 'true') {
//     values = values.filter(v => v.isPublished);
//   }
  
//   if (format === 'csv') {
//     // Convert to CSV
//     const headers = ['value', 'label', 'description', 'isActive', 'isPublished'];
//     const csvRows = [];
//     csvRows.push(headers.join(','));
    
//     values.forEach(v => {
//       const row = headers.map(h => {
//         const val = v[h] || '';
//         return `"${val.toString().replace(/"/g, '""')}"`;
//       });
//       csvRows.push(row.join(','));
//     });
    
//     res.setHeader('Content-Type', 'text/csv');
//     res.setHeader('Content-Disposition', `attachment; filename=${master.masterName}_values.csv`);
//     return res.send(csvRows.join('\n'));
//   }
  
//   // Default JSON
//   res.status(200).json({
//     status: 'success',
//     data: values
//   });
// });

// // Standard CRUD operations (admin only)
// exports.deleteMaster = factory.deleteOne(Master);
// exports.restoreMaster = factory.restoreOne(Master);
// exports.bulkCreateMasters = factory.bulkCreate(Master);
// exports.bulkUpdateMasters = factory.bulkUpdate(Master);
// exports.bulkDeleteMasters = factory.bulkDelete(Master);
// exports.countMasters = factory.count(Master);