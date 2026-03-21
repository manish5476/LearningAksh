require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');

const checkPosts = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Require the models 
    require('./src/models/core/userDomain.model');
    require('./src/models/core/courseDomain.model');
    const Post = require('./src/models/core/postModel');
    
    const posts = await Post.find({}).select('title slug status isDeleted _id').lean();
    console.log('Total Posts:', posts.length);
    console.log('Posts:', JSON.stringify(posts, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
};

checkPosts();
