'use strict';

const mongoose = require("mongoose");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

/**
 * Get dropdown options for any model
 * Usage: GET /api/v1/dropdown/:modelName
 * Example: /api/v1/dropdown/course
 * 
 * Query params:
 * - labelField: field to use as label (default: 'name' or 'title')
 * - valueField: field to use as value (default: '_id')
 * - filter: additional filter (e.g., ?filter[isActive]=true)
 * - search: search term for label field
 * - sort: sort field (default: 'name' or 'title')
 */
exports.getDropdown = (Model, defaultLabelField = 'name') => 
  catchAsync(async (req, res, next) => {
    const { 
      labelField = defaultLabelField, 
      valueField = '_id',
      search = '',
      sort = labelField,
      limit = 100,
      ...queryParams
    } = req.query;

    // Build filter
    let filter = { ...(req.filter || {}) };

    // Add soft delete filter if exists
    if (Model.schema.path("isDeleted")) {
      filter.isDeleted = { $ne: true };
    }

    // Add additional filters from query params (excluding special params)
    Object.keys(queryParams).forEach(key => {
      if (!['labelField', 'valueField', 'search', 'sort', 'limit', 'page'].includes(key)) {
        filter[key] = queryParams[key];
      }
    });

    // Add search functionality
    if (search) {
      filter[labelField] = { $regex: search, $options: 'i' };
    }

    // Get documents
    const items = await Model.find(filter)
      .select(`${labelField} ${valueField}`)
      .sort(sort)
      .limit(parseInt(limit))
      .lean();

    // Format for dropdown
    const dropdownOptions = items.map(item => ({
      label: item[labelField],
      value: item[valueField]
    }));

    res.status(200).json({
      status: "success",
      results: dropdownOptions.length,
      data: dropdownOptions
    });
  });

/**
 * Get key-value map for any model
 * Usage: GET /api/v1/dropdown/:modelName/map
 * Example: /api/v1/dropdown/course/map?keyField=slug&valueField=title
 * 
 * Returns: { "course-slug": "Course Title", ... }
 */
exports.getKeyValueMap = (Model) =>
  catchAsync(async (req, res, next) => {
    const { 
      keyField = '_id',
      valueField = 'name',
      filter = {}
    } = req.query;

    // Parse filter if it's a string
    let parsedFilter = {};
    if (typeof filter === 'string') {
      try {
        parsedFilter = JSON.parse(filter);
      } catch (e) {
        parsedFilter = {};
      }
    }

    // Build filter
    let finalFilter = { ...parsedFilter, ...(req.filter || {}) };

    // Add soft delete filter if exists
    if (Model.schema.path("isDeleted")) {
      finalFilter.isDeleted = { $ne: true };
    }

    // Get documents
    const items = await Model.find(finalFilter)
      .select(`${keyField} ${valueField}`)
      .lean();

    // Create key-value map
    const keyValueMap = {};
    items.forEach(item => {
      keyValueMap[item[keyField]] = item[valueField];
    });

    res.status(200).json({
      status: "success",
      count: items.length,
      data: keyValueMap
    });
  });

/**
 * Get dropdown with additional metadata
 * Usage: GET /api/v1/dropdown/:modelName/enhanced
 * Example: /api/v1/dropdown/course/enhanced
 */
exports.getEnhancedDropdown = (Model, defaultLabelField = 'name') =>
  catchAsync(async (req, res, next) => {
    const { 
      labelField = defaultLabelField, 
      valueField = '_id',
      includeFields = [],
      search = '',
      ...queryParams
    } = req.query;

    // Build filter
    let filter = { ...(req.filter || {}) };

    if (Model.schema.path("isDeleted")) {
      filter.isDeleted = { $ne: true };
    }

    // Add additional filters
    Object.keys(queryParams).forEach(key => {
      if (!['labelField', 'valueField', 'includeFields', 'search'].includes(key)) {
        filter[key] = queryParams[key];
      }
    });

    // Add search
    if (search) {
      filter[labelField] = { $regex: search, $options: 'i' };
    }

    // Build select fields
    let selectFields = `${labelField} ${valueField}`;
    if (includeFields) {
      const fields = Array.isArray(includeFields) 
        ? includeFields 
        : includeFields.split(',');
      selectFields += ' ' + fields.join(' ');
    }

    const items = await Model.find(filter)
      .select(selectFields)
      .sort(labelField)
      .lean();

    // Enhanced dropdown with original data
    const dropdownOptions = items.map(item => {
      const option = {
        label: item[labelField],
        value: item[valueField]
      };

      // Add any additional fields as metadata
      if (includeFields) {
        option.metadata = {};
        const fields = Array.isArray(includeFields) 
          ? includeFields 
          : includeFields.split(',');
        
        fields.forEach(field => {
          if (item[field] !== undefined) {
            option.metadata[field] = item[field];
          }
        });
      }

      return option;
    });

    res.status(200).json({
      status: "success",
      results: dropdownOptions.length,
      data: dropdownOptions
    });
  });