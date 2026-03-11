const mongoose = require('mongoose');

const codingExerciseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
  
  language: { type: String, enum: ['javascript', 'python', 'java', 'cpp', 'csharp', 'ruby', 'php'], required: true },
  
  initialCode: String,
  solutionCode: String,
  
  // Test cases embedded here is fine as they are usually small (< 20 items)
  testCases: [{ 
    input: String, 
    expectedOutput: String, 
    isHidden: { type: Boolean, default: false }, 
    points: { type: Number, default: 1 } 
  }],
  
  constraints: [String],
  hints: [String],
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  
  totalPoints: { type: Number, default: 10 },
  timeLimit: Number, // Execution time limit in ms
  memoryLimit: Number, // in MB
  
  isPublished: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

codingExerciseSchema.index({ course: 1, isDeleted: 1 });

module.exports = mongoose.model('CodingExercise', codingExerciseSchema);