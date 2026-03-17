// // models/Lesson.js (Updated to use Master data)
// const mongoose = require('mongoose');
// const Master = require('./Master');

// const lessonSchema = new mongoose.Schema({
//   section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
//   course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
//   title: { type: String, required: true },
//   description: String,
  
//   // Using Master for lesson type
//   type: { 
//     type: String,
//     required: true,
//     validate: {
//       validator: async function(value) {
//         const isValid = await Master.validateValue('LESSON_TYPE', value);
//         return isValid;
//       },
//       message: 'Invalid lesson type'
//     }
//   },
  
//   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
//   content: {
//     video: { 
//       url: String, 
//       duration: Number, 
//       thumbnail: String,
//       // Using Master for video provider
//       provider: {
//         type: String,
//         validate: {
//           validator: async function(value) {
//             if (!value) return true;
//             const isValid = await Master.validateValue('VIDEO_PROVIDER', value);
//             return isValid;
//           },
//           message: 'Invalid video provider'
//         }
//       }
//     },
//     article: { body: String, attachments: [String] },
//     quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
//     assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
//     codingExercise: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingExercise' }
//   },
//   order: { type: Number, required: true },
//   duration: { type: Number, default: 0 },
//   isFree: { type: Boolean, default: false },
//   isPublished: { type: Boolean, default: true },
  
//   // Using Master for resource type
//   resources: [{ 
//     title: String,
//     type: {
//       type: String,
//       validate: {
//         validator: async function(value) {
//           const isValid = await Master.validateValue('RESOURCE_TYPE', value);
//           return isValid;
//         },
//         message: 'Invalid resource type'
//       }
//     },
//     url: String,
//     uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
//   }],
  
//   isDeleted: { type: Boolean, default: false }
// }, { timestamps: true });

// module.exports = mongoose.model('Lesson', lessonSchema);