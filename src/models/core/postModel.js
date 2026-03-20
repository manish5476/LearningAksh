// postModel.js
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const slugify = (text) => text.toString().toLowerCase()
  .replace(/\s+/g, '-')           
  .replace(/[^\w\-]+/g, '')       
  .replace(/\-\-+/g, '-')         
  .replace(/^-+/, '')             
  .replace(/-+$/, '');            

const postSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, lowercase: true, index: true },
  
  // ✅ DYNAMIC POST TYPE (e.g., blog, current_affairs, announcement)
  type: { 
    type: String, 
    required: true,
    lowercase: true,
    trim: true,
    index: true,
    validate: {
      validator: async function(value) {
        if (!value) return true;
        const Master = mongoose.model('Master');
        return await Master.validateValue('post_type', value);
      },
      message: 'Invalid post type. Must be defined in Master data.'
    }
  },
  
  // ✅ DYNAMIC LANGUAGE
  language: { 
    type: String,
    default: 'en',
    lowercase: true,
    validate: {
      validator: async function(value) {
        if (!value) return true;
        const Master = mongoose.model('Master');
        return await Master.validateValue('language', value);
      },
      message: 'Invalid language selection'
    }
  },

  // Content
  excerpt: { type: String, required: true, maxLength: 500 },
  content: { type: String, required: true }, 
  thumbnail: { type: String }, 
  
  // Citations for Current Affairs
  sourceName: { type: String, trim: true }, 
  sourceUrl: { type: String, trim: true },
  
  // Attachments (For Monthly PDF downloads)
  attachmentUrl: { type: String }, 
  attachmentName: { type: String },

  // Relations
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true },
  tags: [String],
  
  // Metrics
  readTime: { type: Number, default: 5 }, 
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  
  // SEO Meta Data
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  },

  // Publishing Workflow
  isFeatured: { type: Boolean, default: false, index: true }, 
  eventDate: { type: Date, index: true }, 
  
  // ✅ DYNAMIC STATUS (e.g., draft, published, scheduled, under_review)
  status: { 
    type: String, 
    default: 'draft',
    lowercase: true,
    trim: true,
    index: true,
    validate: {
      validator: async function(value) {
        if (!value) return true;
        const Master = mongoose.model('Master');
        return await Master.validateValue('post_status', value);
      },
      message: 'Invalid post status. Must be defined in Master data.'
    }
  },
  
  publishedAt: { type: Date },
  isDeleted: { type: Boolean, default: false }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true } 
});

// ==================== SMART PRE-SAVE HOOKS ====================
postSchema.pre('save', function(next) {
  // 1. Auto-generate Slug
  if (this.isModified('title') && !this.slug) {
    this.slug = `${slugify(this.title)}-${nanoid(6)}`;
  }
  
  // 2. Auto-set Published Date (Relies on Master code being exactly 'published')
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  // 3. Auto-calculate Read Time (Assuming 200 words per minute)
  if (this.isModified('content') && this.content) {
    const plainText = this.content.replace(/<[^>]*>?/gm, '');
    const wordCount = plainText.split(/\s+/).length;
    this.readTime = Math.max(1, Math.ceil(wordCount / 200));
  }

  next();
});

postSchema.index({ type: 1, status: 1, publishedAt: -1 });
postSchema.index({ title: 'text', content: 'text', tags: 'text' });

module.exports = mongoose.models.Post || mongoose.model('Post', postSchema);