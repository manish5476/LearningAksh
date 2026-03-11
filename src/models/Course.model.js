    const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  level: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'all-levels'], default: 'beginner' },
  language: { type: String, default: 'English' },
  
  // Media
  thumbnailUrl: String,
  previewVideoUrl: String,
  
  // Pricing
  price: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'USD' },
  
  // Stats (Eventually Consistent via BullMQ/Cron)
  totalDuration: { type: Number, default: 0 }, // in seconds
  totalLessons: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  totalEnrollments: { type: Number, default: 0 },
  
  // Status
  status: { type: String, enum: ['draft', 'in-review', 'published', 'archived'], default: 'draft' },
  
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// Text index for fast searching. Compound indexes for filtering.
courseSchema.index({ title: 'text', description: 'text' });
courseSchema.index({ category: 1, status: 1, isDeleted: 1 });
courseSchema.index({ instructor: 1, isDeleted: 1 });

module.exports = mongoose.model('Course', courseSchema);