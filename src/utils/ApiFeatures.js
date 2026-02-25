'use strict';

const mongoose = require("mongoose");

/**
 * ApiFeatures
 * Standardized query builder for Mongoose and Aggregation frameworks.
 * Handles: Sorting, Filtering, Searching, Field Limiting, and Intelligent Pagination.
 */
class ApiFeatures {
  constructor(query, queryString, isAggregate = false) {
    this.query = query;
    this.queryString = queryString;
    this.isAggregate = isAggregate;
    this.pagination = {};
  }

  static coerceValue(value) {
    if (typeof value !== "string") return value;

    const lowerVal = value.toLowerCase().trim();
    if (lowerVal === "true") return true;
    if (lowerVal === "false") return false;
    if (lowerVal === "null") return null;

    if (!isNaN(value) && value.length < 12 && !value.startsWith('0x')) {
      return Number(value);
    }

    if (/^[0-9a-fA-F]{24}$/.test(value)) {
      return new mongoose.Types.ObjectId(value);
    }

    const d = new Date(value);
    if (!isNaN(d.getTime()) && value.includes('-')) return d;

    return value;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ["page", "sort", "limit", "fields", "search", "populate", "lastId", "lastDate"];
    excludedFields.forEach((el) => delete queryObj[el]);

    let filterConditions = {};
    const orConditions = [];

    for (const key in queryObj) {
      const value = queryObj[key];

      if (key.endsWith("[or]")) {
        const field = key.replace("[or]", "");
        const values = String(value).split(",").map(v => ApiFeatures.coerceValue(v.trim()));
        orConditions.push({ [field]: { $in: values } });
        continue;
      }

      if (typeof value === "string" && value.includes("|")) {
        filterConditions[key] = { $in: value.split("|").map(v => ApiFeatures.coerceValue(v.trim())) };
        continue;
      }

      if (typeof value === "object" && value !== null) {
        filterConditions[key] = {};
        for (const op in value) {
          filterConditions[key][`$${op}`] = ApiFeatures.coerceValue(value[op]);
        }
        continue;
      }

      filterConditions[key] = ApiFeatures.coerceValue(value);
    }

    if (this.isAggregate) {
      if (Object.keys(filterConditions).length) this.query.pipeline().push({ $match: filterConditions });
      if (orConditions.length) this.query.pipeline().push({ $match: { $or: orConditions } });
    } else {
      this.query = this.query.find(filterConditions);
      if (orConditions.length) this.query = this.query.find({ $or: orConditions });
    }

    return this;
  }

  search(fields = []) {
    const searchTerm = this.queryString.search;
    if (!searchTerm || fields.length === 0) return this;

    const regex = { $regex: searchTerm, $options: "i" };
    const searchConditions = fields.map((field) => ({ [field]: regex }));

    if (this.isAggregate) {
      this.query.pipeline().push({ $match: { $or: searchConditions } });
    } else {
      this.query = this.query.find({ $or: searchConditions });
    }

    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort("-createdAt -_id");
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select("-__v");
    }
    return this;
  }

  paginate() {
    const page = Math.abs(parseInt(this.queryString.page, 10)) || 1;
    const limit = Math.abs(parseInt(this.queryString.limit, 10)) || 50;
    const skip = (page - 1) * limit;

    this.pagination = { page, limit, skip };
    this.query = this.query.skip(skip).limit(limit);

    return this;
  }

  populate() {
    if (this.queryString.populate) {
      const paths = this.queryString.populate.split(",");
      paths.forEach(p => {
        this.query = this.query.populate(p.trim());
      });
    }
    return this;
  }

  async execute() {
    if (this.isAggregate) {
      const data = await this.query.exec();
      return { data, results: data.length };
    }

    const currentFilter = this.query.getFilter();
    const totalCount = await this.query.model.countDocuments(currentFilter);
    
    const docs = await this.query.lean();
    const totalPages = Math.ceil(totalCount / this.pagination.limit);

    return {
      data: docs,
      results: docs.length,
      pagination: {
        page: this.pagination.page,
        limit: this.pagination.limit,
        totalResults: totalCount,
        totalPages,
        hasNextPage: this.pagination.page < totalPages,
        hasPrevPage: this.pagination.page > 1
      }
    };
  }
}

module.exports = ApiFeatures;