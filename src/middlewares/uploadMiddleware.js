const multer = require('multer');
const AppError = require('../utils/appError');

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/assignments');
  },
  filename: (req, file, cb) => {
    // format: user-id-timestamp.extension
    const ext = file.mimetype.split('/')[1];
    cb(null, `student-${req.user.id}-${Date.now()}.${ext}`);
  }
});

const multerFilter = (req, file, cb) => {
  // Allow PDFs, ZIPs, and Images
  if (file.mimetype === 'application/pdf' || 
      file.mimetype === 'application/zip' || 
      file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type! Please upload PDF, ZIP, or Images only.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB Limit
});

exports.uploadAssignmentFile = upload.single('submissionFile');

// // src/middlewares/uploadMiddleware.js
// const multer = require('multer');
// const sharp = require('sharp');
// const AppError = require('../utils/appError');

// const multerStorage = multer.memoryStorage();

// const multerFilter = (req, file, cb) => {
//   if (file.mimetype.startsWith('image')) {
//     cb(null, true);
//   } else {
//     cb(new AppError('Not an image! Please upload only images.', 400), false);
//   }
// };

// const upload = multer({
//   storage: multerStorage,
//   fileFilter: multerFilter,
//   limits: { fileSize: 5 * 1024 * 1024 } // 5MB
// });

// exports.uploadPhoto = upload.single('photo');

// exports.resizePhoto = (folderName) => async (req, res, next) => {
//   if (!req.file) return next();

//   req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

//   await sharp(req.file.buffer)
//     .resize(500, 500)
//     .toFormat('jpeg')
//     .jpeg({ quality: 90 })
//     .toFile(`public/img/${folderName}/${req.file.filename}`);

//   next();
// };
