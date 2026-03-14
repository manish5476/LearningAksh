'use strict';

const mongoose = require("mongoose");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const ApiFeatures = require("../utils/ApiFeatures");

/* =======================================================
GET ALL DOCUMENTS (No ID check needed here)
======================================================= */
exports.getAll = (Model, options = {}) =>
  catchAsync(async (req, res, next) => {
    let baseFilter = { ...(req.filter || {}) };

    if (Model.schema.path("isDeleted")) baseFilter.isDeleted = { $ne: true };

    const features = new ApiFeatures(Model.find(baseFilter), req.query)
      .filter()
      .search(options.searchFields || [])
      .sort()
      .limitFields();

    if (req.query.cursor) features.cursorPaginate();
    else features.paginate();

    if (options.populate) features.populate(options.populate);

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
    // 🛡️ SAFEGUARD ADDED
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(new AppError("Invalid document ID format", 400));
    }

    let filter = { _id: req.params.id, ...(req.filter || {}) };
    if (Model.schema.path("isDeleted")) filter.isDeleted = { $ne: true };

    let query = Model.findOne(filter);
    if (options.populate) options.populate.forEach(pop => { query = query.populate(pop); });
    if (options.lean !== false) query = query.lean();

    const doc = await query;
    if (!doc) return next(new AppError("Document not found", 404));

    res.status(200).json({ status: "success", data: doc });
  });

/* =======================================================
CREATE ONE
======================================================= */
exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const payload = { ...req.body, ...(req.filter || {}) };
    const doc = await Model.create(payload);
    res.status(201).json({ status: "success", data: doc });
  });

/* =======================================================
UPDATE ONE
======================================================= */
exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    // 🛡️ SAFEGUARD ADDED
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(new AppError("Invalid document ID format", 400));
    }

    const doc = await Model.findOneAndUpdate(
      { _id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!doc) return next(new AppError("Document not found", 404));
    res.status(200).json({ status: "success", data: doc });
  });

/* =======================================================
DELETE ONE
======================================================= */
exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    // 🛡️ SAFEGUARD ADDED
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(new AppError("Invalid document ID format", 400));
    }

    const filter = { _id: req.params.id };
    const hasSoftDelete = !!Model.schema.path("isDeleted");
    let doc;

    if (hasSoftDelete) {
      doc = await Model.findOneAndUpdate(
        filter,
        { isDeleted: true, isActive: false, deletedAt: new Date() },
        { new: true }
      );
    } else {
      doc = await Model.findOneAndDelete(filter);
    }

    if (!doc) return next(new AppError("Document not found", 404));
    res.status(204).json({ status: "success", data: null });
  });

/* =======================================================
BULK CREATE
======================================================= */
// exports.bulkCreate = (Model) =>
//   catchAsync(async (req, res, next) => {
//     if (!Array.isArray(req.body)) return next(new AppError("Body must be an array", 400));
//     const docs = req.body.map(item => ({ ...item, ...(req.filter || {}) }));
//     const result = await Model.insertMany(docs, { ordered: false });
//     res.status(201).json({ status: "success", results: result.length, data: result });
//   });
exports.bulkCreate = (Model) =>
  catchAsync(async (req, res, next) => {
    if (!Array.isArray(req.body)) return next(new AppError("Body must be an array", 400));
    
    const docs = req.body.map(item => ({ 
      ...item, 
      primaryInstructor: req.user._id,  // Add this!
      ...(req.filter || {}) 
    }));
    
    // CHANGE THIS: ordered: true will STOP at first error and throw
    const result = await Model.insertMany(docs, { ordered: true });
    
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

    // 🛡️ SAFEGUARD ADDED: Filter out any bad IDs before mapping
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) return next(new AppError("No valid IDs provided in array", 400));

    const result = await Model.updateMany(
      { _id: { $in: validIds.map(id => new mongoose.Types.ObjectId(id)) } },
      updates,
      { runValidators: true }
    );
    res.status(200).json({
      status: "success",
      data: { matched: result.matchedCount, modified: result.modifiedCount }
    });
  });

/* =======================================================
BULK DELETE
======================================================= */
exports.bulkDelete = (Model) =>
  catchAsync(async (req, res, next) => {
    const { ids, hardDelete = false } = req.body;
    if (!Array.isArray(ids)) return next(new AppError("ids array required", 400));

    // 🛡️ SAFEGUARD ADDED: Filter out bad IDs
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) return next(new AppError("No valid IDs provided in array", 400));

    const objectIds = validIds.map(id => new mongoose.Types.ObjectId(id));
    const hasSoftDelete = !!Model.schema.path("isDeleted");
    let result;

    if (!hardDelete && hasSoftDelete) {
      result = await Model.updateMany(
        { _id: { $in: objectIds } },
        { isDeleted: true, isActive: false, deletedAt: new Date() }
      );
    } else {
      result = await Model.deleteMany({ _id: { $in: objectIds } });
    }

    res.status(200).json({
      status: "success",
      data: { affected: result.modifiedCount || result.deletedCount }
    });
  });

/* =======================================================
RESTORE SOFT DELETED DOCUMENT
======================================================= */
exports.restoreOne = (Model) =>
  catchAsync(async (req, res, next) => {
    if (!Model.schema.path("isDeleted")) return next(new AppError("Soft delete not supported", 400));

    // 🛡️ SAFEGUARD ADDED
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(new AppError("Invalid document ID format", 400));
    }

    const doc = await Model.findOneAndUpdate(
      { _id: req.params.id, isDeleted: true },
      { isDeleted: false, isActive: true, deletedAt: null },
      { new: true }
    );

    if (!doc) return next(new AppError("No deleted document found", 404));
    res.status(200).json({ status: "success", data: doc });
  });

/* =======================================================
COUNT DOCUMENTS
======================================================= */
exports.count = (Model) =>
  catchAsync(async (req, res, next) => {
    let filter = { ...(req.filter || {}) };
    if (Model.schema.path("isDeleted")) filter.isDeleted = { $ne: true };
    const count = await Model.countDocuments(filter);
    res.status(200).json({ status: "success", data: { count } });
  });

/* =======================================================
GET SINGLE DOCUMENT BY SLUG (For Public/SEO Routes)
======================================================= */
exports.getOneBySlug = (Model, options = {}) =>
  catchAsync(async (req, res, next) => {
    // 1. Build the filter using the slug from the URL parameters
    let filter = { slug: req.params.slug, ...(req.filter || {}) };

    // 2. Exclude soft-deleted documents if the schema supports it
    if (Model.schema.path("isDeleted")) filter.isDeleted = { $ne: true };

    // 3. Build the query
    let query = Model.findOne(filter);

    // 4. Apply population and lean options
    if (options.populate) {
      options.populate.forEach(pop => { query = query.populate(pop); });
    }
    if (options.lean !== false) query = query.lean();

    // 5. Execute query
    const doc = await query;
    if (!doc) return next(new AppError("No document found with that slug", 404));

    // 6. Send response
    res.status(200).json({ status: "success", data: doc });
  });