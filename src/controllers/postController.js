const { Post, Category } = require('../models');
const factory = require('../utils/handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');

// ==========================================
// 1. ADMIN & INSTRUCTOR MIDDLEWARE
// ==========================================

// Automatically assign the logged-in user as the author before creating
exports.setAuthor = (req, res, next) => {
  if (!req.body.author) {
    req.body.author = req.user.id;
  }
  next();
};

// ==========================================
// 2. PUBLIC READER ENDPOINTS
// ==========================================

/**
 * Get Published Posts (Smart Filtering & Pagination)
 * Handles Blogs, Current Affairs, Announcements, etc.
 */
exports.getPublishedPosts = catchAsync(async (req, res, next) => {
  const { 
    type, 
    category, 
    language, 
    search, 
    isFeatured,
    sort,
    limit = 12, 
    page = 1 
  } = req.query;

  // Base filter: Only published & not deleted
  let filter = { 
    status: 'published', 
    isDeleted: { $ne: true } 
  };

  // Dynamic Filters
  if (type) filter.type = type.toLowerCase();
  if (language) filter.language = language.toLowerCase();
  if (isFeatured === 'true') filter.isFeatured = true;
  
  // Smart Category Handling (Accepts Object ID or String Slug)
  if (category) {
    if (mongoose.isValidObjectId(category)) {
      filter.category = category;
    } else {
      const catRecord = await Category.findOne({ slug: category.toLowerCase() });
      if (catRecord) filter.category = catRecord._id;
    }
  }

  // Full Text Search
  if (search) {
    filter.$text = { $search: search };
  }

  // Smart Sorting
  let sortOption = '-publishedAt'; // Default for blogs
  
  if (sort) {
    sortOption = sort; // User requested specific sort
  } else if (filter.type === 'current_affairs' || filter.type === 'current_affair') {
    sortOption = '-eventDate'; // Current affairs should default to the event date
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Execute Query & Count concurrently for performance
  const [posts, total] = await Promise.all([
    Post.find(filter)
      // Exclude heavy 'content' field for list views to save bandwidth
      .select('-content') 
      .populate('category', 'name slug')
      .populate('author', 'firstName lastName profilePicture')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Post.countDocuments(filter)
  ]);

  // Format exactly how your Angular BaseApiService expects it
  res.status(200).json({
    status: 'success',
    results: posts.length,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalResults: total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: (skip + posts.length) < total,
      hasPrevPage: page > 1
    },
    data: posts
  });
});

/**
 * Get Single Post (By Slug or ID) + Auto-Increment Views + Get Related
 */
exports.getPostSmart = catchAsync(async (req, res, next) => {
  const identifier = req.params.slug;
  const isId = mongoose.isValidObjectId(identifier);
  
  const query = isId ? { _id: identifier } : { slug: identifier.toLowerCase() };
  query.status = 'published';
  query.isDeleted = { $ne: true };

  // 1. Fetch and atomically increment views
  const post = await Post.findOneAndUpdate(
    query,
    { $inc: { views: 1 } }, // 🔥 Thread-safe view counter
    { new: true }
  )
  .populate('category', 'name slug')
  .populate('author', 'firstName lastName bio profilePicture')
  .lean();

  if (!post) {
    return next(new AppError('Post not found or has been removed.', 404));
  }

  // 2. Fetch Related Posts (Same category, excluding this post)
  let relatedPosts = [];
  if (post.category) {
    relatedPosts = await Post.find({
      category: post.category._id,
      _id: { $ne: post._id },
      status: 'published',
      isDeleted: { $ne: true }
    })
    .select('title slug thumbnail excerpt readTime publishedAt type')
    .sort('-publishedAt')
    .limit(3)
    .lean();
  }

  res.status(200).json({
    status: 'success',
    data: {
      post,
      relatedPosts
    }
  });
});

/**
 * Like a Post
 */
exports.likePost = catchAsync(async (req, res, next) => {
  const post = await Post.findByIdAndUpdate(
    req.params.id,
    { $inc: { likes: 1 } },
    { new: true }
  ).select('likes');

  if (!post) {
    return next(new AppError('Post not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { likes: post.likes }
  });
});

// ==========================================
// 3. ADMIN / INSTRUCTOR CRUD OPERATIONS
// ==========================================

// Standard factory methods (Handles the heavy lifting)
exports.createPost = factory.createOne(Post);
exports.updatePost = factory.updateOne(Post);

// Soft Delete
exports.deletePost = catchAsync(async (req, res, next) => {
  const post = await Post.findByIdAndUpdate(req.params.id, { 
    isDeleted: true,
    status: 'archived' // Automatically archive when deleted
  });
  
  if (!post) {
    return next(new AppError('No post found with that ID', 404));
  }
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Get all posts for admin table (includes drafts, scheduled, etc.)
exports.getAllPostsAdmin = factory.getAll(Post, {
  searchFields: ['title', 'excerpt'],
  populate: [
    { path: 'category', select: 'name slug' },
    { path: 'author', select: 'firstName lastName email' }
  ]
});