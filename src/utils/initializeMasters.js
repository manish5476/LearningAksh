// utils/initializeMasters.js
const { Master } = require('../models');

const systemMasters = [
  {
    masterName: 'USER_ROLE',
    displayName: 'User Roles',
    description: 'System user roles',
    category: 'SYSTEM',
    isSystem: true,
    isPublished: true,
    config: {
      isHierarchical: false,
      allowMultiple: false,
      hasMetadata: true
    },
    values: [
      { 
        value: 'user', 
        label: 'User', 
        description: 'Regular platform user',
        metadata: { level: 1, color: 'blue' },
        isSystem: true, 
        isPublished: true 
      },
      { 
        value: 'instructor', 
        label: 'Instructor', 
        description: 'Can create and manage courses',
        metadata: { level: 2, color: 'green' },
        isSystem: true, 
        isPublished: true 
      },
      { 
        value: 'admin', 
        label: 'Administrator', 
        description: 'Full system access',
        metadata: { level: 3, color: 'red' },
        isSystem: true, 
        isPublished: true 
      }
    ]
  },
  {
    masterName: 'COURSE_LEVEL',
    displayName: 'Course Levels',
    description: 'Level of difficulty for courses',
    category: 'EDUCATION',
    isSystem: true,
    isPublished: true,
    config: {
      isHierarchical: false,
      allowMultiple: false,
      hasMetadata: true
    },
    values: [
      { value: 'beginner', label: 'Beginner', description: 'No prior knowledge needed', metadata: { color: 'green', level: 1 }, isSystem: true, isPublished: true },
      { value: 'intermediate', label: 'Intermediate', description: 'Some basic knowledge required', metadata: { color: 'blue', level: 2 }, isSystem: true, isPublished: true },
      { value: 'advanced', label: 'Advanced', description: 'In-depth knowledge required', metadata: { color: 'orange', level: 3 }, isSystem: true, isPublished: true },
      { value: 'all-levels', label: 'All Levels', description: 'Suitable for everyone', metadata: { color: 'purple', level: 0 }, isSystem: true, isPublished: true }
    ]
  },
  {
    masterName: 'LANGUAGE',
    displayName: 'Languages',
    description: 'Available course languages',
    category: 'SYSTEM',
    isSystem: true,
    isPublished: true,
    config: {
      isHierarchical: false,
      allowMultiple: false,
      hasMetadata: true
    },
    values: [
      { value: 'English', label: 'English', metadata: { code: 'en', flag: '🇬🇧' }, isSystem: true, isPublished: true },
      { value: 'Spanish', label: 'Spanish', metadata: { code: 'es', flag: '🇪🇸' }, isSystem: true, isPublished: true },
      { value: 'French', label: 'French', metadata: { code: 'fr', flag: '🇫🇷' }, isSystem: true, isPublished: true },
      { value: 'German', label: 'German', metadata: { code: 'de', flag: '🇩🇪' }, isSystem: true, isPublished: true },
      { value: 'Chinese', label: 'Chinese', metadata: { code: 'zh', flag: '🇨🇳' }, isSystem: true, isPublished: true },
      { value: 'Japanese', label: 'Japanese', metadata: { code: 'ja', flag: '🇯🇵' }, isSystem: true, isPublished: true },
      { value: 'Arabic', label: 'Arabic', metadata: { code: 'ar', flag: '🇸🇦' }, isSystem: true, isPublished: true },
      { value: 'Hindi', label: 'Hindi', metadata: { code: 'hi', flag: '🇮🇳' }, isSystem: true, isPublished: true },
      { value: 'Portuguese', label: 'Portuguese', metadata: { code: 'pt', flag: '🇵🇹' }, isSystem: true, isPublished: true },
      { value: 'Russian', label: 'Russian', metadata: { code: 'ru', flag: '🇷🇺' }, isSystem: true, isPublished: true }
    ]
  },
  {
    masterName: 'CURRENCY',
    displayName: 'Currencies',
    description: 'Available currencies for pricing',
    category: 'SYSTEM',
    isSystem: true,
    isPublished: true,
    config: {
      isHierarchical: false,
      allowMultiple: false,
      hasMetadata: true
    },
    values: [
      { value: 'USD', label: 'US Dollar', metadata: { symbol: '$', code: 'USD' }, isSystem: true, isPublished: true },
      { value: 'EUR', label: 'Euro', metadata: { symbol: '€', code: 'EUR' }, isSystem: true, isPublished: true },
      { value: 'GBP', label: 'British Pound', metadata: { symbol: '£', code: 'GBP' }, isSystem: true, isPublished: true },
      { value: 'JPY', label: 'Japanese Yen', metadata: { symbol: '¥', code: 'JPY' }, isSystem: true, isPublished: true },
      { value: 'INR', label: 'Indian Rupee', metadata: { symbol: '₹', code: 'INR' }, isSystem: true, isPublished: true },
      { value: 'CNY', label: 'Chinese Yuan', metadata: { symbol: '¥', code: 'CNY' }, isSystem: true, isPublished: true }
    ]
  },
  {
    masterName: 'COURSE_CATEGORY',
    displayName: 'Course Categories',
    description: 'Categories for organizing courses',
    category: 'EDUCATION',
    isSystem: false,
    isPublished: true,
    config: {
      isHierarchical: true,
      allowMultiple: false,
      hasMetadata: true
    },
    values: [
      { 
        value: 'development', 
        label: 'Development', 
        description: 'Software development courses',
        metadata: { icon: '💻', color: 'blue' },
        isPublished: true
      },
      { 
        value: 'business', 
        label: 'Business', 
        description: 'Business and entrepreneurship',
        metadata: { icon: '💼', color: 'green' },
        isPublished: true
      },
      { 
        value: 'finance', 
        label: 'Finance & Accounting', 
        description: 'Finance and accounting courses',
        metadata: { icon: '💰', color: 'yellow' },
        isPublished: true
      },
      { 
        value: 'it', 
        label: 'IT & Software', 
        description: 'Information technology courses',
        metadata: { icon: '🖥️', color: 'purple' },
        isPublished: true
      },
      { 
        value: 'design', 
        label: 'Design', 
        description: 'Design and creative courses',
        metadata: { icon: '🎨', color: 'pink' },
        isPublished: true
      },
      { 
        value: 'marketing', 
        label: 'Marketing', 
        description: 'Marketing courses',
        metadata: { icon: '📢', color: 'orange' },
        isPublished: true
      },
      { 
        value: 'lifestyle', 
        label: 'Lifestyle', 
        description: 'Lifestyle and personal development',
        metadata: { icon: '🧘', color: 'teal' },
        isPublished: true
      },
      { 
        value: 'photography', 
        label: 'Photography', 
        description: 'Photography and video',
        metadata: { icon: '📷', color: 'indigo' },
        isPublished: true
      },
      { 
        value: 'health', 
        label: 'Health & Fitness', 
        description: 'Health and fitness courses',
        metadata: { icon: '🏋️', color: 'red' },
        isPublished: true
      },
      { 
        value: 'music', 
        label: 'Music', 
        description: 'Music courses',
        metadata: { icon: '🎵', color: 'violet' },
        isPublished: true
      }
    ]
  },
  {
    masterName: 'LESSON_TYPE',
    displayName: 'Lesson Types',
    description: 'Types of lessons available',
    category: 'EDUCATION',
    isSystem: true,
    isPublished: true,
    config: {
      isHierarchical: false,
      allowMultiple: false,
      hasMetadata: true
    },
    values: [
      { value: 'video', label: 'Video Lesson', metadata: { icon: '🎥' }, isSystem: true, isPublished: true },
      { value: 'article', label: 'Article', metadata: { icon: '📄' }, isSystem: true, isPublished: true },
      { value: 'quiz', label: 'Quiz', metadata: { icon: '❓' }, isSystem: true, isPublished: true },
      { value: 'assignment', label: 'Assignment', metadata: { icon: '📝' }, isSystem: true, isPublished: true },
      { value: 'coding-exercise', label: 'Coding Exercise', metadata: { icon: '💻' }, isSystem: true, isPublished: true }
    ]
  },
  {
    masterName: 'RESOURCE_TYPE',
    displayName: 'Resource Types',
    description: 'Types of resources available in lessons',
    category: 'CONTENT',
    isSystem: true,
    isPublished: true,
    config: {
      isHierarchical: false,
      allowMultiple: false,
      hasMetadata: true
    },
    values: [
      { value: 'pdf', label: 'PDF Document', metadata: { icon: '📕' }, isSystem: true, isPublished: true },
      { value: 'code', label: 'Code File', metadata: { icon: '📄' }, isSystem: true, isPublished: true },
      { value: 'link', label: 'External Link', metadata: { icon: '🔗' }, isSystem: true, isPublished: true },
      { value: 'image', label: 'Image', metadata: { icon: '🖼️' }, isSystem: true, isPublished: true },
      { value: 'video', label: 'Video', metadata: { icon: '🎥' }, isSystem: true, isPublished: true },
      { value: 'audio', label: 'Audio', metadata: { icon: '🎵' }, isSystem: true, isPublished: true },
      { value: 'archive', label: 'Archive', metadata: { icon: '📦' }, isSystem: true, isPublished: true }
    ]
  },
  {
    masterName: 'VIDEO_PROVIDER',
    displayName: 'Video Providers',
    description: 'Video hosting providers',
    category: 'CONTENT',
    isSystem: true,
    isPublished: true,
    config: {
      isHierarchical: false,
      allowMultiple: false,
      hasMetadata: true
    },
    values: [
      { value: 'youtube', label: 'YouTube', metadata: { icon: '▶️' }, isSystem: true, isPublished: true },
      { value: 'vimeo', label: 'Vimeo', metadata: { icon: '🎬' }, isSystem: true, isPublished: true },
      { value: 'wistia', label: 'Wistia', metadata: { icon: '🎥' }, isSystem: true, isPublished: true },
      { value: 'local', label: 'Local Storage', metadata: { icon: '💾' }, isSystem: true, isPublished: true }
    ]
  },
  {
    masterName: 'INSTRUCTOR_ROLE',
    displayName: 'Instructor Roles',
    description: 'Roles for course instructors',
    category: 'USER',
    isSystem: true,
    isPublished: true,
    config: {
      isHierarchical: false,
      allowMultiple: false,
      hasMetadata: true
    },
    values: [
      { 
        value: 'primary', 
        label: 'Primary Instructor', 
        description: 'Main instructor with full control',
        metadata: { level: 1, color: 'gold' },
        isSystem: true, 
        isPublished: true 
      },
      { 
        value: 'co-instructor', 
        label: 'Co-Instructor', 
        description: 'Can assist with teaching',
        metadata: { level: 2, color: 'silver' },
        isSystem: true, 
        isPublished: true 
      },
      { 
        value: 'teaching-assistant', 
        label: 'Teaching Assistant', 
        description: 'Helps with student support',
        metadata: { level: 3, color: 'bronze' },
        isSystem: true, 
        isPublished: true 
      }
    ]
  },
  {
    masterName: 'INVITATION_STATUS',
    displayName: 'Invitation Statuses',
    description: 'Status options for instructor invitations',
    category: 'SYSTEM',
    isSystem: true,
    isPublished: true,
    config: {
      isHierarchical: false,
      allowMultiple: false,
      hasMetadata: true
    },
    values: [
      { value: 'pending', label: 'Pending', metadata: { color: 'yellow' }, isSystem: true, isPublished: true },
      { value: 'accepted', label: 'Accepted', metadata: { color: 'green' }, isSystem: true, isPublished: true },
      { value: 'expired', label: 'Expired', metadata: { color: 'red' }, isSystem: true, isPublished: true },
      { value: 'revoked', label: 'Revoked', metadata: { color: 'gray' }, isSystem: true, isPublished: true }
    ]
  }
];

const initializeMasters = async () => {
  try {
    console.log('🚀 Starting masters initialization...');
    
    for (const masterData of systemMasters) {
      const existing = await Master.findOne({ masterName: masterData.masterName });
      
      if (!existing) {
        await Master.create(masterData);
        console.log(`✅ Created master: ${masterData.masterName}`);
      } else {
        console.log(`⏭️  Master already exists: ${masterData.masterName}`);
      }
    }
    
    console.log('🎉 Masters initialization completed successfully!');
  } catch (error) {
    console.error('❌ Error initializing masters:', error);
  }
};

module.exports = initializeMasters;
