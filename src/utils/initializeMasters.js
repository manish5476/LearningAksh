// utils/initializeMasters.js
const { Master } = require('../models');
const { nanoid } = require('nanoid');

// Helper function to generate slug
const generateSlug = (name) => {
  const slugify = (text) => text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  
  return `${slugify(name)}-${nanoid(6)}`;
};

// A single, flat array of all master data records
const systemMasters = [
  // --- COURSE LEVELS ---
  { type: 'course_level', code: 'BEGINNER', name: 'Beginner', description: 'No prior knowledge needed', metadata: { sortOrder: 1 } },
  { type: 'course_level', code: 'INTERMEDIATE', name: 'Intermediate', description: 'Some basic knowledge required', metadata: { sortOrder: 2 } },
  { type: 'course_level', code: 'ADVANCED', name: 'Advanced', description: 'In-depth knowledge required', metadata: { sortOrder: 3 } },
  { type: 'course_level', code: 'ALL-LEVELS', name: 'All Levels', description: 'Suitable for everyone', metadata: { sortOrder: 4 } },

  // --- ASSIGNMENT SUBMISSION TYPES ---
  { type: 'assignment_submission_type', code: 'FILE-UPLOAD', name: 'File Upload', metadata: { sortOrder: 1 } },
  { type: 'assignment_submission_type', code: 'TEXT-ENTRY', name: 'Text Entry', metadata: { sortOrder: 2 } },
  { type: 'assignment_submission_type', code: 'BOTH', name: 'Both (File & Text)', metadata: { sortOrder: 3 } },

  // --- ASSIGNMENT STATUSES ---
  { type: 'assignment_status', code: 'SUBMITTED', name: 'Submitted', metadata: { sortOrder: 1 } },
  { type: 'assignment_status', code: 'GRADED', name: 'Graded', metadata: { sortOrder: 2 } },
  { type: 'assignment_status', code: 'LATE-SUBMITTED', name: 'Late Submitted', metadata: { sortOrder: 3 } },

  // --- PROGRAMMING LANGUAGES ---
  { type: 'programming_language', code: 'JAVASCRIPT', name: 'JavaScript', metadata: { sortOrder: 1 } },
  { type: 'programming_language', code: 'PYTHON', name: 'Python', metadata: { sortOrder: 2 } },
  { type: 'programming_language', code: 'JAVA', name: 'Java', metadata: { sortOrder: 3 } },
  { type: 'programming_language', code: 'CPP', name: 'C++', metadata: { sortOrder: 4 } },
  { type: 'programming_language', code: 'CSHARP', name: 'C#', metadata: { sortOrder: 5 } },
  { type: 'programming_language', code: 'RUBY', name: 'Ruby', metadata: { sortOrder: 6 } },
  { type: 'programming_language', code: 'PHP', name: 'PHP', metadata: { sortOrder: 7 } },

  // --- DIFFICULTY LEVELS ---
  { type: 'difficulty_level', code: 'EASY', name: 'Easy', metadata: { sortOrder: 1 } },
  { type: 'difficulty_level', code: 'MEDIUM', name: 'Medium', metadata: { sortOrder: 2 } },
  { type: 'difficulty_level', code: 'HARD', name: 'Hard', metadata: { sortOrder: 3 } },

  // --- CODE SUBMISSION STATUSES ---
  { type: 'code_submission_status', code: 'PENDING', name: 'Pending', metadata: { sortOrder: 1 } },
  { type: 'code_submission_status', code: 'RUNNING', name: 'Running', metadata: { sortOrder: 2 } },
  { type: 'code_submission_status', code: 'COMPLETED', name: 'Completed', metadata: { sortOrder: 3 } },
  { type: 'code_submission_status', code: 'FAILED', name: 'Failed', metadata: { sortOrder: 4 } },
  
  // --- BADGE CRITERIA ---
  { type: 'badge_criteria', code: 'COMPLETE_COURSE', name: 'Course Completion', description: 'Awarded for completing 100% of a course', metadata: { sortOrder: 1 } },
  { type: 'badge_criteria', code: 'PERFECT_QUIZ', name: 'Perfect Quiz Score', description: 'Awarded for getting 100% on a quiz', metadata: { sortOrder: 2 } },
  { type: 'badge_criteria', code: 'FIRST_LOGIN', name: 'First Login', description: 'Awarded when the user logs in for the first time', metadata: { sortOrder: 3 } },
  { type: 'badge_criteria', code: '7_DAY_STREAK', name: '7 Day Streak', description: 'Awarded for logging in 7 days in a row', metadata: { sortOrder: 4 } },
  { type: 'badge_criteria', code: '100_HOURS_WATCHED', name: '100 Hours Watched', description: 'Awarded after consuming 100 hours of video content', metadata: { sortOrder: 5 } },
  
  // --- USER GENDERS ---
  { type: 'user_gender', code: 'MALE', name: 'Male', metadata: { sortOrder: 1 } },
  { type: 'user_gender', code: 'FEMALE', name: 'Female', metadata: { sortOrder: 2 } },
  { type: 'user_gender', code: 'OTHER', name: 'Other', metadata: { sortOrder: 3 } },
  { type: 'user_gender', code: 'PREFER-NOT-TO-SAY', name: 'Prefer Not to Say', metadata: { sortOrder: 4 } },

  // --- UI THEMES ---
  { type: 'ui_theme', code: 'LIGHT', name: 'Light Mode', metadata: { sortOrder: 1 } },
  { type: 'ui_theme', code: 'DARK', name: 'Dark Mode', metadata: { sortOrder: 2 } },

  // --- TOPIC AREAS (Used for both Expertise and Interests) ---
  { type: 'topic_area', code: 'WEB-DEVELOPMENT', name: 'Web Development', metadata: { sortOrder: 1 } },
  { type: 'topic_area', code: 'DATA-SCIENCE', name: 'Data Science', metadata: { sortOrder: 2 } },
  { type: 'topic_area', code: 'MOBILE-DEVELOPMENT', name: 'Mobile Development', metadata: { sortOrder: 3 } },
  { type: 'topic_area', code: 'DEVOPS', name: 'DevOps', metadata: { sortOrder: 4 } },
  { type: 'topic_area', code: 'CLOUD-COMPUTING', name: 'Cloud Computing', metadata: { sortOrder: 5 } },
  { type: 'topic_area', code: 'AI-ML', name: 'AI/ML', metadata: { sortOrder: 6 } },
  { type: 'topic_area', code: 'CYBERSECURITY', name: 'Cybersecurity', metadata: { sortOrder: 7 } },
  { type: 'topic_area', code: 'DATABASE', name: 'Database', metadata: { sortOrder: 8 } },
  { type: 'topic_area', code: 'PROGRAMMING', name: 'Programming Languages', metadata: { sortOrder: 9 } },
  { type: 'topic_area', code: 'DESIGN', name: 'Design', metadata: { sortOrder: 10 } },
  
  // --- LANGUAGES ---
  { type: 'language', code: 'EN', name: 'English', metadata: { sortOrder: 1 } },
  { type: 'language', code: 'ES', name: 'Spanish', metadata: { sortOrder: 2 } },
  { type: 'language', code: 'FR', name: 'French', metadata: { sortOrder: 3 } },
  { type: 'language', code: 'DE', name: 'German', metadata: { sortOrder: 4 } },
  { type: 'language', code: 'ZH', name: 'Chinese', metadata: { sortOrder: 5 } },
  { type: 'language', code: 'JA', name: 'Japanese', metadata: { sortOrder: 6 } },
  { type: 'language', code: 'HI', name: 'Hindi', metadata: { sortOrder: 7 } },
  { type: 'language', code: 'BN', name: 'Bengali', metadata: { sortOrder: 8 } },
  { type: 'language', code: 'TE', name: 'Telugu', metadata: { sortOrder: 9 } },
  { type: 'language', code: 'TA', name: 'Tamil', metadata: { sortOrder: 10 } },

  // --- CURRENCIES ---
  { type: 'currency', code: 'USD', name: 'US Dollar', metadata: { sortOrder: 1 } },
  { type: 'currency', code: 'EUR', name: 'Euro', metadata: { sortOrder: 2 } },
  { type: 'currency', code: 'GBP', name: 'British Pound', metadata: { sortOrder: 3 } },
  { type: 'currency', code: 'INR', name: 'Indian Rupee', metadata: { sortOrder: 4 } },
  { type: 'currency', code: 'JPY', name: 'Japanese Yen', metadata: { sortOrder: 5 } },
  { type: 'currency', code: 'CNY', name: 'Chinese Yuan', metadata: { sortOrder: 6 } },

  // --- COURSE CATEGORIES ---
  { type: 'course_category', code: 'DEVELOPMENT', name: 'Development', description: 'Software development courses', metadata: { sortOrder: 1 } },
  { type: 'course_category', code: 'BUSINESS', name: 'Business', description: 'Business and entrepreneurship', metadata: { sortOrder: 2 } },
  { type: 'course_category', code: 'FINANCE', name: 'Finance & Accounting', description: 'Finance and accounting courses', metadata: { sortOrder: 3 } },
  { type: 'course_category', code: 'IT', name: 'IT & Software', description: 'Information technology courses', metadata: { sortOrder: 4 } },
  { type: 'course_category', code: 'DESIGN', name: 'Design', description: 'Design and creative courses', metadata: { sortOrder: 5 } },
  { type: 'course_category', code: 'MARKETING', name: 'Marketing', description: 'Marketing courses', metadata: { sortOrder: 6 } },
  { type: 'course_category', code: 'HEALTH', name: 'Health & Fitness', description: 'Health and fitness courses', metadata: { sortOrder: 7 } },
  { type: 'course_category', code: 'MUSIC', name: 'Music', description: 'Music courses', metadata: { sortOrder: 8 } },
  { type: 'course_category', code: 'ACADEMICS', name: 'Academics', description: 'Academic courses', metadata: { sortOrder: 9 } },
  { type: 'course_category', code: 'LANGUAGE', name: 'Language Learning', description: 'Language learning courses', metadata: { sortOrder: 10 } },
  { type: 'course_category', code: 'GOVT_EXAMS', name: 'Government Exams', description: 'Government exam preparation courses', metadata: { sortOrder: 11 } },

  // --- LESSON TYPES ---
  { type: 'lesson_type', code: 'VIDEO', name: 'Video Lesson', metadata: { sortOrder: 1 } },
  { type: 'lesson_type', code: 'ARTICLE', name: 'Article', metadata: { sortOrder: 2 } },
  { type: 'lesson_type', code: 'QUIZ', name: 'Quiz', metadata: { sortOrder: 3 } },
  { type: 'lesson_type', code: 'ASSIGNMENT', name: 'Assignment', metadata: { sortOrder: 4 } },
  { type: 'lesson_type', code: 'CODING-EXERCISE', name: 'Coding Exercise', metadata: { sortOrder: 5 } },

  // --- RESOURCE TYPES ---
  { type: 'resource_type', code: 'PDF', name: 'PDF Document', metadata: { sortOrder: 1 } },
  { type: 'resource_type', code: 'CODE', name: 'Code File', metadata: { sortOrder: 2 } },
  { type: 'resource_type', code: 'LINK', name: 'External Link', metadata: { sortOrder: 3 } },
  { type: 'resource_type', code: 'IMAGE', name: 'Image', metadata: { sortOrder: 4 } },
  { type: 'resource_type', code: 'VIDEO', name: 'Video', metadata: { sortOrder: 5 } },
  { type: 'resource_type', code: 'AUDIO', name: 'Audio', metadata: { sortOrder: 6 } },

  // --- VIDEO PROVIDERS ---
  { type: 'video_provider', code: 'YOUTUBE', name: 'YouTube', metadata: { sortOrder: 1 } },
  { type: 'video_provider', code: 'VIMEO', name: 'Vimeo', metadata: { sortOrder: 2 } },
  { type: 'video_provider', code: 'LOCAL', name: 'Local Storage', metadata: { sortOrder: 3 } },

  // --- PAYMENT METHODS ---
  { type: 'payment_method', code: 'CREDIT_CARD', name: 'Credit Card', metadata: { sortOrder: 1 } },
  { type: 'payment_method', code: 'DEBIT_CARD', name: 'Debit Card', metadata: { sortOrder: 2 } },
  { type: 'payment_method', code: 'PAYPAL', name: 'PayPal', metadata: { sortOrder: 3 } },
  { type: 'payment_method', code: 'BANK_TRANSFER', name: 'Bank Transfer', metadata: { sortOrder: 4 } },
  { type: 'payment_method', code: 'UPI', name: 'UPI', metadata: { sortOrder: 5 } },
  { type: 'payment_method', code: 'RAZORPAY', name: 'Razorpay', metadata: { sortOrder: 6 } },
  { type: 'payment_method', code: 'STRIPE', name: 'Stripe', metadata: { sortOrder: 7 } },

  // --- PAYMENT STATUSES ---
  { type: 'payment_status', code: 'PENDING', name: 'Pending', metadata: { sortOrder: 1 } },
  { type: 'payment_status', code: 'SUCCESS', name: 'Success', metadata: { sortOrder: 2 } },
  { type: 'payment_status', code: 'FAILED', name: 'Failed', metadata: { sortOrder: 3 } },
  { type: 'payment_status', code: 'REFUNDED', name: 'Refunded', metadata: { sortOrder: 4 } },

  // --- INSTRUCTOR ROLES ---
  { type: 'instructor_role', code: 'PRIMARY', name: 'Primary Instructor', description: 'Main instructor with full control', metadata: { sortOrder: 1 } },
  { type: 'instructor_role', code: 'CO-INSTRUCTOR', name: 'Co-Instructor', description: 'Can assist with teaching', metadata: { sortOrder: 2 } },
  { type: 'instructor_role', code: 'TEACHING-ASSISTANT', name: 'Teaching Assistant', description: 'Helps with student support', metadata: { sortOrder: 3 } },

  // --- INVITATION STATUSES ---
  { type: 'invitation_status', code: 'PENDING', name: 'Pending', metadata: { sortOrder: 1 } },
  { type: 'invitation_status', code: 'ACCEPTED', name: 'Accepted', metadata: { sortOrder: 2 } },
  { type: 'invitation_status', code: 'EXPIRED', name: 'Expired', metadata: { sortOrder: 3 } },
  { type: 'invitation_status', code: 'REVOKED', name: 'Revoked', metadata: { sortOrder: 4 } }
];

/**
 * Initializes master data into the simplified schema.
 * Uses upsert to avoid data loss
 */
const initializeMasters = async () => {
  try {
    console.log('🚀 Starting masters initialization...');
    
    // Sync indexes without dropping data
    try {
      await Master.init();
      console.log('✅ Synced master collection indexes');
    } catch (indexError) {
      console.log('ℹ️ Index sync issue:', indexError.message);
    }
    
    let createdCount = 0;
    let updatedCount = 0;
    
    for (const item of systemMasters) {
      // Generate a unique slug for each item
      const slug = generateSlug(item.name);
      
      // Use updateOne with upsert
      const result = await Master.updateOne(
        { 
          type: item.type, 
          code: item.code 
        },
        {
          type: item.type,
          code: item.code,
          name: item.name,
          slug: slug,  // Explicitly set slug to avoid null
          description: item.description || '',
          isActive: true,
          metadata: {
            isFeatured: item.metadata?.isFeatured || false,
            sortOrder: item.metadata?.sortOrder || 0
          }
        },
        { 
          upsert: true,
          setDefaultsOnInsert: true
        }
      );
      
      if (result.upsertedCount > 0) {
        createdCount++;
      } else if (result.modifiedCount > 0) {
        updatedCount++;
      }
    }
    
    console.log(`🎉 Masters initialization completed! Created: ${createdCount}, Updated: ${updatedCount}`);
    
    // Verify critical master data exists
    const currencyCount = await Master.countDocuments({ type: 'currency' });
    const languageCount = await Master.countDocuments({ type: 'language' });
    const levelCount = await Master.countDocuments({ type: 'course_level' });
    const categoryCount = await Master.countDocuments({ type: 'course_category' });
    
    console.log(`📊 Master stats:`);
    console.log(`   - Currencies: ${currencyCount}`);
    console.log(`   - Languages: ${languageCount}`);
    console.log(`   - Levels: ${levelCount}`);
    console.log(`   - Categories: ${categoryCount}`);
    
    // Show sample of what was created/updated
    const samples = await Master.find({ type: 'currency' }).limit(4);
    console.log('💰 Sample currencies:', samples.map(c => `${c.code}: ${c.name}`).join(', '));
    
  } catch (error) {
    console.error('❌ Error initializing masters:', error);
  }
};

module.exports = initializeMasters;