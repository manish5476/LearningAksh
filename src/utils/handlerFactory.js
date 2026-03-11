'use strict';

const mongoose = require("mongoose");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const ApiFeatures = require("../utils/ApiFeatures");

/*
=========================================================
ENTERPRISE HANDLE FACTORY
Reusable CRUD handlers for large scale systems

Features
- Works with ApiFeatures query system
- Supports nested routes
- Soft delete compatible
- Bulk operations
- Cursor pagination support
- Lean read optimization
=========================================================
*/


/* =======================================================
GET ALL DOCUMENTS
======================================================= */

exports.getAll = (Model, options = {}) =>
  catchAsync(async (req, res, next) => {

    let baseFilter = { ...(req.filter || {}) };

    if (Model.schema.path("isDeleted"))
      baseFilter.isDeleted = { $ne: true };

    if (Model.schema.path("isActive") && !options.includeInactive)
      baseFilter.isActive = { $ne: false };

    const features = new ApiFeatures(
      Model.find(baseFilter),
      req.query
    )
      .filter()
      .search(options.searchFields || [])
      .sort()
      .limitFields();

    if (req.query.cursor) {
      features.cursorPaginate();
    } else {
      features.paginate();
    }

    if (options.populate)
      features.populate(options.populate);

    const result = await features.execute(Model);

    res.status(200).json({
      status: "success",
      results: result.results,
      pagination: result.pagination,
      data: result.data
    });
  });


/* =======================================================
GET SINGLE DOCUMENT
======================================================= */

exports.getOne = (Model, options = {}) =>
  catchAsync(async (req, res, next) => {

    let filter = {
      _id: req.params.id,
      ...(req.filter || {})
    };

    if (Model.schema.path("isDeleted"))
      filter.isDeleted = { $ne: true };

    let query = Model.findOne(filter);

    if (options.populate)
      options.populate.forEach(pop => {
        query = query.populate(pop);
      });

    if (options.lean !== false)
      query = query.lean();

    const doc = await query;

    if (!doc)
      return next(new AppError("Document not found", 404));

    res.status(200).json({
      status: "success",
      data: doc
    });
  });


/* =======================================================
CREATE ONE
======================================================= */

exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {

    const payload = {
      ...req.body,
      ...(req.filter || {})
    };

    const doc = await Model.create(payload);

    res.status(201).json({
      status: "success",
      data: doc
    });
  });


/* =======================================================
UPDATE ONE
======================================================= */

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {

    const filter = {
      _id: req.params.id
    };

    const doc = await Model.findOneAndUpdate(
      filter,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!doc)
      return next(new AppError("Document not found", 404));

    res.status(200).json({
      status: "success",
      data: doc
    });
  });


/* =======================================================
DELETE ONE
SOFT DELETE IF AVAILABLE
======================================================= */

exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const filter = { _id: req.params.id };
    const hasSoftDelete = !!Model.schema.path("isDeleted");
    let doc;
    if (hasSoftDelete) {
      doc = await Model.findOneAndUpdate(
        filter,
        {
          isDeleted: true,
          isActive: false,
          deletedAt: new Date()
        },
        { new: true }
      );
    } else {
      doc = await Model.findOneAndDelete(filter);
    }
    if (!doc)
      return next(new AppError("Document not found", 404));
    res.status(204).json({
      status: "success",
      data: null
    });
  });


/* =======================================================
BULK CREATE
======================================================= */

exports.bulkCreate = (Model) =>
  catchAsync(async (req, res, next) => {
    if (!Array.isArray(req.body))
      return next(new AppError("Body must be an array", 400));
    const docs = req.body.map(item => ({
      ...item,
      ...(req.filter || {})
    }));
    const result = await Model.insertMany(docs, {
      ordered: false
    });
    res.status(201).json({
      status: "success",
      results: result.length,
      data: result
    });
  });

/* =======================================================
BULK UPDATE
======================================================= */

exports.bulkUpdate = (Model) =>
  catchAsync(async (req, res, next) => {
    const { ids, updates } = req.body;
    if (!Array.isArray(ids) || !updates) return next(new AppError("ids and updates required", 400));
    const result = await Model.updateMany(
      { _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) } },
      updates,
      { runValidators: true }
    );
    res.status(200).json({
      status: "success",
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount
      }
    });
  });


/* =======================================================
BULK DELETE
======================================================= */

exports.bulkDelete = (Model) =>
  catchAsync(async (req, res, next) => {

    const { ids, hardDelete = false } = req.body;

    if (!Array.isArray(ids))
      return next(new AppError("ids array required", 400));
    const objectIds = ids.map(id =>
      new mongoose.Types.ObjectId(id)
    );
    const hasSoftDelete = !!Model.schema.path("isDeleted");
    let result;
    if (!hardDelete && hasSoftDelete) {
      result = await Model.updateMany(
        { _id: { $in: objectIds } },
        {
          isDeleted: true,
          isActive: false,
          deletedAt: new Date()
        }
      );
    } else {
      result = await Model.deleteMany({
        _id: { $in: objectIds }
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        affected: result.modifiedCount || result.deletedCount
      }
    });
  });


/* =======================================================
RESTORE SOFT DELETED DOCUMENT
======================================================= */

exports.restoreOne = (Model) =>
  catchAsync(async (req, res, next) => {

    if (!Model.schema.path("isDeleted"))
      return next(new AppError("Soft delete not supported", 400));

    const doc = await Model.findOneAndUpdate(
      {
        _id: req.params.id,
        isDeleted: true
      },
      {
        isDeleted: false,
        isActive: true,
        deletedAt: null
      },
      { new: true }
    );

    if (!doc)
      return next(new AppError("No deleted document found", 404));

    res.status(200).json({
      status: "success",
      data: doc
    });
  });


/* =======================================================
COUNT DOCUMENTS
======================================================= */

exports.count = (Model) =>
  catchAsync(async (req, res, next) => {

    let filter = { ...(req.filter || {}) };

    if (Model.schema.path("isDeleted"))
      filter.isDeleted = { $ne: true };

    const count = await Model.countDocuments(filter);

    res.status(200).json({
      status: "success",
      data: { count }
    });
  });
  
  
  
  // 'use strict';

// const AppError = require("../utils/appError");
// const ApiFeatures = require("./ApiFeatures"); // Make sure this file exists!
// const catchAsync = require("../utils/catchAsync");

// /* ========================================================================
// OWNERSHIP FILTER COMMENTED OUT 
// Reason: Single company/tuition center architecture. All authorized users 
// can view and interact with shared data (like categories).
// ========================================================================

// const getOwnershipFilter = (Model, req) => {
//   const filter = {};
//   if (!req.user || req.user.role === 'admin') return filter;
//   if (Model.schema.path("instructor")) filter.instructor = req.user.id;
//   else if (Model.schema.path("student")) filter.student = req.user.id;
//   else if (Model.schema.path("user")) filter.user = req.user.id;
//   return filter;
// };
// */

// exports.getAll = (Model, options = {}) =>
//   catchAsync(async (req, res, next) => {
//     // Merge req.filter (for nested routes). Ownership filter removed.
//     let filter = { ...req.filter }; 

//     if (Model.schema.path("isDeleted")) filter.isDeleted = { $ne: true };
//     if (Model.schema.path("isActive") && !options.includeInactive) {
//       filter.isActive = { $ne: false };
//     }

//     const features = new ApiFeatures(Model.find(filter), req.query)
//       .filter()
//       .search(options.searchFields || ["name", "title", "description"])
//       .sort()
//       .limitFields()
//       .paginate();

//     if (options.populate) {
//       features.query = features.query.populate(options.populate);
//     }

//     const result = await features.execute();

//     res.status(200).json({
//       status: "success",
//       results: result.results,
//       pagination: result.pagination,
//       data: { data: result.data },
//     });
//   });

// exports.getOne = (Model, options = {}) =>
//   catchAsync(async (req, res, next) => {
//     let filter = { _id: req.params.id, ...req.filter };

//     /* Ownership filter on GET removed:
//     if (options.requireOwnership) {
//         filter = { ...filter, ...getOwnershipFilter(Model, req) };
//     }
//     */

//     if (Model.schema.path("isDeleted")) filter.isDeleted = { $ne: true };

//     let query = Model.findOne(filter);
//     if (options.populate) query = query.populate(options.populate);

//     const doc = await query.lean();

//     if (!doc) return next(new AppError("Document not found", 404));

//     res.status(200).json({ status: "success", data: { data: doc } });
//   });

// exports.createOne = (Model) =>
//   catchAsync(async (req, res, next) => {
//     /*
//     Automatic ownership assignment removed for single-company architecture:
//     if (req.user) {
//       if (Model.schema.path("instructor") && !req.body.instructor) req.body.instructor = req.user.id;
//       if (Model.schema.path("student") && !req.body.student) req.body.student = req.user.id;
//       if (Model.schema.path("user") && !req.body.user) req.body.user = req.user.id;
//     }
//     */

//     const finalData = { ...req.body, ...req.filter };
//     const doc = await Model.create(finalData);

//     res.status(201).json({ status: "success", data: { data: doc } });
//   });

// exports.updateOne = (Model) =>
//   catchAsync(async (req, res, next) => {
//     // Ownership filter removed
//     const filter = { _id: req.params.id };

//     const doc = await Model.findOneAndUpdate(
//       filter,
//       req.body,
//       { new: true, runValidators: true }
//     );

//     if (!doc) return next(new AppError("Document not found", 404));
//     res.status(200).json({ status: "success", data: { data: doc } });
//   });

// exports.deleteOne = (Model) =>
//   catchAsync(async (req, res, next) => {
//     // Ownership filter removed
//     const filter = { _id: req.params.id };
//     const hasSoftDelete = !!Model.schema.path("isDeleted");
//     let doc;

//     if (hasSoftDelete) {
//       doc = await Model.findOneAndUpdate(filter, {
//         isDeleted: true,
//         isActive: false,
//         deletedAt: Date.now(),
//       }, { new: true });
//     } else {
//       doc = await Model.findOneAndDelete(filter);
//     }

//     if (!doc) return next(new AppError("Document not found", 404));
//     res.status(204).json({ status: "success", data: null });
//   });

// exports.bulkCreate = (Model) =>
//   catchAsync(async (req, res, next) => {
//     if (!Array.isArray(req.body)) return next(new AppError("Request body must be an array", 400));

//     const docs = req.body.map((item) => {
//       const newItem = { ...item, ...req.filter }; 
      
//       /* Automatic ownership assignment removed:
//       if (req.user) {
//         if (Model.schema.path("instructor") && !newItem.instructor) newItem.instructor = req.user.id;
//         // ...
//       }
//       */
//       return newItem;
//     });

//     const result = await Model.insertMany(docs);
//     res.status(201).json({ status: "success", results: result.length, data: { data: result } });
//   });

// exports.bulkUpdate = (Model) =>
//   catchAsync(async (req, res, next) => {
//     const { ids, updates } = req.body;
//     if (!Array.isArray(ids) || !updates) return next(new AppError("IDs and Updates required", 400));

//     // Ownership filter removed
//     const filter = { _id: { $in: ids } };

//     const result = await Model.updateMany(
//       filter,
//       updates,
//       { runValidators: true }
//     );

//     res.status(200).json({ status: "success", data: { matched: result.matchedCount, modified: result.modifiedCount } });
//   });

// exports.bulkDelete = (Model) =>
//   catchAsync(async (req, res, next) => {
//     const { ids, hardDelete = false } = req.body;
//     if (!Array.isArray(ids)) return next(new AppError("IDs array required", 400));

//     // Ownership filter removed
//     const filter = { _id: { $in: ids } };
//     const hasSoftDelete = !!Model.schema.path("isDeleted");
//     let result;

//     if (!hardDelete && hasSoftDelete) {
//       result = await Model.updateMany(filter, {
//         isDeleted: true,
//         isActive: false,
//         deletedAt: Date.now()
//       });
//     } else {
//       result = await Model.deleteMany(filter);
//     }

//     res.status(200).json({ status: "success", data: { deletedCount: result.deletedCount || result.modifiedCount } });
//   });

// exports.restoreOne = (Model) =>
//   catchAsync(async (req, res, next) => {
//     if (!Model.schema.path("isDeleted")) return next(new AppError("Model does not support restoration", 400));

//     // Ownership filter removed
//     const filter = { _id: req.params.id, isDeleted: true };

//     const doc = await Model.findOneAndUpdate(
//       filter,
//       { isDeleted: false, isActive: true, deletedAt: null },
//       { new: true }
//     );

//     if (!doc) return next(new AppError("No deleted document found", 404));
//     res.status(200).json({ status: "success", data: { data: doc } });
//   });

// exports.count = (Model) =>
//   catchAsync(async (req, res, next) => {
//     // Ownership filter removed
//     let filter = { ...req.filter };
//     if (Model.schema.path("isDeleted")) filter.isDeleted = { $ne: true };

//     const count = await Model.countDocuments(filter);

//     res.status(200).json({ status: "success", data: { count } });
//   });
