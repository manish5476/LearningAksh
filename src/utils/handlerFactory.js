'use strict';

const AppError = require("../utils/appError");
const ApiFeatures = require("./ApiFeatures");
const catchAsync = require("../utils/catchAsync");

/**
 * Helper to determine ownership scope based on Ed-Tech Schemas.
 * Prevents students from updating other students' data, or instructors modifying other courses.
 */
const getOwnershipFilter = (Model, req) => {
  const filter = {};
  
  // If no user exists on request, or user is an Admin, skip ownership locks
  if (!req.user || req.user.role === 'admin') return filter;

  // Dynamically lock queries to the current user's ID based on the Schema structure
  if (Model.schema.path("instructor")) filter.instructor = req.user.id;
  else if (Model.schema.path("student")) filter.student = req.user.id;
  else if (Model.schema.path("user")) filter.user = req.user.id;
  
  return filter;
};

exports.getAll = (Model, options = {}) =>
  catchAsync(async (req, res, next) => {
    // 1. Base Filter (Allows nested routes like GET /courses/:courseId/reviews)
    let filter = { ...req.filter }; 

    // 2. Automated status & soft-delete management
    if (Model.schema.path("isDeleted")) filter.isDeleted = { $ne: true };
    if (Model.schema.path("isActive") && !options.includeInactive) {
      filter.isActive = { $ne: false };
    }

    // 3. Build Features
    const features = new ApiFeatures(Model.find(filter), req.query)
      .filter()
      .search(options.searchFields || ["name", "title", "description"])
      .sort()
      .limitFields()
      .paginate();

    if (options.populate) {
      features.query = features.query.populate(options.populate);
    }

    const result = await features.execute();

    res.status(200).json({
      status: "success",
      results: result.results,
      pagination: result.pagination,
      data: { data: result.data },
    });
  });

exports.getOne = (Model, options = {}) =>
  catchAsync(async (req, res, next) => {
    let query = Model.findOne({ _id: req.params.id });

    // Ensure soft-deleted items aren't fetched by ID
    if (Model.schema.path("isDeleted")) query = query.where({ isDeleted: { $ne: true } });

    if (options.populate) query = query.populate(options.populate);
    const doc = await query.lean();

    if (!doc) return next(new AppError("Document not found", 404));

    res.status(200).json({ status: "success", data: { data: doc } });
  });

exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    // Zero-Trust: Auto-assign ownership based on the currently logged-in user
    if (req.user) {
      if (Model.schema.path("instructor") && !req.body.instructor) req.body.instructor = req.user.id;
      if (Model.schema.path("student") && !req.body.student) req.body.student = req.user.id;
      if (Model.schema.path("user") && !req.body.user) req.body.user = req.user.id;
    }

    const doc = await Model.create(req.body);
    res.status(201).json({ status: "success", data: { data: doc } });
  });

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    // Determine if the user is authorized to update this specific document
    const filter = { _id: req.params.id, ...getOwnershipFilter(Model, req) };

    const doc = await Model.findOneAndUpdate(
      filter,
      req.body,
      { new: true, runValidators: true }
    );

    if (!doc) return next(new AppError("Document not found or you are not authorized to update it", 404));
    res.status(200).json({ status: "success", data: { data: doc } });
  });

exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    // Only the owner or an admin can delete
    const filter = { _id: req.params.id, ...getOwnershipFilter(Model, req) };
    const hasSoftDelete = !!Model.schema.path("isDeleted");
    let doc;

    if (hasSoftDelete) {
      doc = await Model.findOneAndUpdate(filter, {
        isDeleted: true,
        isActive: false,
        deletedAt: Date.now(),
      }, { new: true });
    } else {
      doc = await Model.findOneAndDelete(filter);
    }

    if (!doc) return next(new AppError("Document not found or you are not authorized", 404));
    res.status(204).json({ status: "success", data: null });
  });

exports.bulkCreate = (Model) =>
  catchAsync(async (req, res, next) => {
    if (!Array.isArray(req.body)) return next(new AppError("Request body must be an array", 400));

    const docs = req.body.map((item) => {
      const newItem = { ...item };
      // Auto-assign ownership if applicable
      if (req.user) {
        if (Model.schema.path("instructor") && !newItem.instructor) newItem.instructor = req.user.id;
        if (Model.schema.path("student") && !newItem.student) newItem.student = req.user.id;
        if (Model.schema.path("user") && !newItem.user) newItem.user = req.user.id;
      }
      return newItem;
    });

    const result = await Model.insertMany(docs);
    res.status(201).json({ status: "success", results: result.length, data: { data: result } });
  });

exports.bulkUpdate = (Model) =>
  catchAsync(async (req, res, next) => {
    const { ids, updates } = req.body;
    if (!Array.isArray(ids) || !updates) return next(new AppError("IDs and Updates required", 400));

    // Lock bulk updates to user's own documents unless Admin
    const filter = { _id: { $in: ids }, ...getOwnershipFilter(Model, req) };

    const result = await Model.updateMany(
      filter,
      updates,
      { runValidators: true }
    );

    res.status(200).json({ status: "success", data: { matched: result.matchedCount, modified: result.modifiedCount } });
  });

exports.bulkDelete = (Model) =>
  catchAsync(async (req, res, next) => {
    const { ids, hardDelete = false } = req.body;
    if (!Array.isArray(ids)) return next(new AppError("IDs array required", 400));

    // Lock bulk deletes to user's own documents unless Admin
    const filter = { _id: { $in: ids }, ...getOwnershipFilter(Model, req) };
    const hasSoftDelete = !!Model.schema.path("isDeleted");
    let result;

    if (!hardDelete && hasSoftDelete) {
      result = await Model.updateMany(filter, {
        isDeleted: true,
        isActive: false,
        deletedAt: Date.now()
      });
    } else {
      result = await Model.deleteMany(filter);
    }

    res.status(200).json({ status: "success", data: { deletedCount: result.deletedCount || result.modifiedCount } });
  });

exports.restoreOne = (Model) =>
  catchAsync(async (req, res, next) => {
    if (!Model.schema.path("isDeleted")) return next(new AppError("Model does not support restoration", 400));

    const filter = { _id: req.params.id, isDeleted: true, ...getOwnershipFilter(Model, req) };

    const doc = await Model.findOneAndUpdate(
      filter,
      { isDeleted: false, isActive: true, deletedAt: null },
      { new: true }
    );

    if (!doc) return next(new AppError("No deleted document found or unauthorized", 404));
    res.status(200).json({ status: "success", data: { data: doc } });
  });

exports.count = (Model) =>
  catchAsync(async (req, res, next) => {
    let filter = { ...req.filter };
    if (Model.schema.path("isDeleted")) filter.isDeleted = { $ne: true };

    const features = new ApiFeatures(Model.find(filter), req.query).filter();
    const count = await Model.countDocuments(features.query.getFilter());

    res.status(200).json({ status: "success", data: { count } });
  });