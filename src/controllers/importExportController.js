const { Course, User, Enrollment, Quiz, Assignment } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const csv = require('csv-parser');
const fastcsv = require('fast-csv');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { Readable } = require('stream');

exports.exportData = catchAsync(async (req, res, next) => {
  const { type, format = 'csv', fields } = req.body;

  let Model;
  let data;

  switch(type) {
    case 'users':
      Model = User;
      data = await User.find({ isDeleted: { $ne: true } })
        .select(fields?.join(' ') || '-password -__v');
      break;
    case 'courses':
      Model = Course;
      data = await Course.find({ isDeleted: { $ne: true } })
        .populate('instructor', 'firstName lastName email')
        .populate('category', 'name');
      break;
    case 'enrollments':
      Model = Enrollment;
      data = await Enrollment.find({})
        .populate('student', 'firstName lastName email')
        .populate('course', 'title price');
      break;
    default:
      return next(new AppError('Invalid export type', 400));
  }

  if (format === 'csv') {
    await exportToCSV(data, type, fields, res);
  } else if (format === 'excel') {
    await exportToExcel(data, type, fields, res);
  } else if (format === 'json') {
    exportToJSON(data, type, res);
  }
});

const exportToCSV = async (data, type, fields, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${type}-export-${Date.now()}.csv`);

  const csvStream = fastcsv.format({ headers: true });
  csvStream.pipe(res);

  data.forEach(item => {
    const row = {};
    if (fields) {
      fields.forEach(field => {
        if (field.includes('.')) {
          const [parent, child] = field.split('.');
          row[field] = item[parent]?.[child] || '';
        } else {
          row[field] = item[field] || '';
        }
      });
    } else {
      // Flatten object for CSV
      Object.keys(item.toObject()).forEach(key => {
        if (typeof item[key] !== 'object' || item[key] === null) {
          row[key] = item[key];
        }
      });
    }
    csvStream.write(row);
  });

  csvStream.end();
};

const exportToExcel = async (data, type, fields, res) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(type);

  // Add headers
  const headers = fields || Object.keys(data[0]?.toObject() || {}).filter(k => 
    typeof data[0][k] !== 'object' || data[0][k] === null
  );
  worksheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));

  // Add data
  data.forEach(item => {
    const row = {};
    headers.forEach(header => {
      if (header.includes('.')) {
        const [parent, child] = header.split('.');
        row[header] = item[parent]?.[child] || '';
      } else {
        row[header] = item[header] || '';
      }
    });
    worksheet.addRow(row);
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${type}-export-${Date.now()}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
};

const exportToJSON = (data, type, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=${type}-export-${Date.now()}.json`);
  res.status(200).json(data);
};

exports.importData = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload a file', 400));
  }

  const { type } = req.body;
  const results = [];

  const stream = Readable.from(req.file.buffer.toString());
  
  if (req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv')) {
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });
  } else if (req.file.mimetype.includes('spreadsheet') || req.file.originalname.endsWith('.xlsx')) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet(1);
    
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const header = worksheet.getRow(1).getCell(colNumber).value;
        rowData[header] = cell.value;
      });
      results.push(rowData);
    });
  }

  // Process import based on type
  let Model;
  switch(type) {
    case 'users':
      Model = User;
      // Hash passwords before import
      results.forEach(user => {
        if (user.password) {
          // Password will be hashed by pre-save hook
        }
      });
      break;
    case 'courses':
      Model = Course;
      break;
    case 'questions':
      Model = QuizQuestion;
      break;
    default:
      return next(new AppError('Invalid import type', 400));
  }

  // Validate and insert data
  const imported = [];
  const errors = [];

  for (const [index, item] of results.entries()) {
    try {
      // Add metadata
      if (type === 'courses' && !item.instructor) {
        item.instructor = req.user.id;
      }

      const doc = await Model.create(item);
      imported.push(doc._id);
    } catch (error) {
      errors.push({
        row: index + 2, // +2 because of 0-index and header row
        error: error.message
      });
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      total: results.length,
      imported: imported.length,
      failed: errors.length,
      errors
    }
  });
});

exports.exportTemplate = catchAsync(async (req, res, next) => {
  const { type } = req.params;

  let template = [];

  switch(type) {
    case 'users':
      template = [{
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'student',
        phoneNumber: '+1234567890',
        dateOfBirth: '1990-01-01'
      }];
      break;
    case 'courses':
      template = [{
        title: 'Sample Course',
        description: 'Course description here',
        category: 'category-id',
        level: 'beginner',
        price: 49.99,
        language: 'English'
      }];
      break;
    case 'questions':
      template = [{
        question: 'What is 2+2?',
        type: 'multiple-choice',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        points: 1
      }];
      break;
    default:
      return next(new AppError('Invalid template type', 400));
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=${type}-template.json`);
  res.status(200).json(template);
});

exports.bulkOperation = catchAsync(async (req, res, next) => {
  const { operation, type, data } = req.body;

  let Model;
  switch(type) {
    case 'users':
      Model = User;
      break;
    case 'courses':
      Model = Course;
      break;
    case 'enrollments':
      Model = Enrollment;
      break;
    default:
      return next(new AppError('Invalid type for bulk operation', 400));
  }

  let result;

  switch(operation) {
    case 'create':
      result = await Model.insertMany(data);
      break;
    case 'update':
      const operations = data.map(item => ({
        updateOne: {
          filter: { _id: item.id },
          update: { $set: item.updates }
        }
      }));
      result = await Model.bulkWrite(operations);
      break;
    case 'delete':
      const ids = data.map(item => item.id);
      if (Model.schema.path('isDeleted')) {
        // Soft delete
        result = await Model.updateMany(
          { _id: { $in: ids } },
          { isDeleted: true, deletedAt: Date.now() }
        );
      } else {
        result = await Model.deleteMany({ _id: { $in: ids } });
      }
      break;
    default:
      return next(new AppError('Invalid operation', 400));
  }

  res.status(200).json({
    status: 'success',
    data: { result }
  });
});