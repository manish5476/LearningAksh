const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars FIRST (before anything else)
dotenv.config({ path: './.env' });

// Now import other modules after env is loaded
const app = require('./app');
const connectDB = require('./config/db');
const queues = require('./jobs'); // Import the queues

// Import initializers
const initializeMasters = require('./utils/initializeMasters');

// 1. Handle uncaught exceptions synchronously BEFORE loading the app
process.on('uncaughtException', err => {
  console.log('💥 UNCAUGHT EXCEPTION! Shutting down...');
  console.log('Error:', err.name, err.message);
  console.log('Stack:', err.stack);
  process.exit(1);
});

// Connect to database
connectDB();

const port = process.env.PORT || 3000;
const server = app.listen(port, async () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${port}`);
  
  // Initialize master data after server starts
  // This doesn't block the server from accepting requests
  try {
    await initializeMasters();
    // Run in development or when explicitly enabled
    if (process.env.NODE_ENV === 'development' || process.env.RUN_MASTER_INIT === 'true') {
      console.log('📦 Checking master data initialization...');
      console.log('✅ Master data initialization complete');
    } else {
      console.log('⏭️  Skipping master data initialization (production mode)');
    }
  } catch (error) {
    console.error('❌ Failed to initialize master data:', error);
    // Don't crash the server, just log the error
  }
});

// 2. Handle unhandled promise rejections
process.on('unhandledRejection', err => {
  console.log('💥 UNHANDLED REJECTION! Shutting down...');
  console.log('Error:', err.name, err.message);
  // Close server gracefully before exiting
  server.close(() => {
    process.exit(1);
  });
});

// Centralized graceful shutdown function
const gracefulShutdown = (signal) => {
  console.log(`👋 ${signal} RECEIVED. Shutting down gracefully...`);

  server.close(async () => {
    console.log('✅ HTTP server closed.');

    // Only close queues if Redis is enabled
    if (process.env.REDIS_ENABLED !== 'false') {
      console.log('🔄 Shutting down message queues...');
      try {
        await Promise.all(
          Object.values(queues).map(queue => {
            if (queue && typeof queue.close === 'function') {
              return queue.close();
            }
            return Promise.resolve();
          })
        );
        console.log('✅ All queues shut down.');
      } catch (err) {
        console.error('❌ Error shutting down queues:', err);
      }
    }

    console.log('💥 Process terminated!');
    process.exit(0);
  });
};

// 3. Graceful shutdown for SIGTERM (from Render/Docker)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// 4. Graceful shutdown for SIGINT (from Ctrl+C)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 5. Optional: Health check endpoint (you can add this to your routes)
// GET /health - Returns server status including master data stats
// 

// const mongoose = require('mongoose');
// const dotenv = require('dotenv');
// const initializeMasters = require('./utils/initializeMasters');
//     await initializeMasters();

// // 1. Handle uncaught exceptions synchronously BEFORE loading the app
// process.on('uncaughtException', err => {
//   console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
//   console.log(err.name, err.message);
//   console.log(err.stack);
//   process.exit(1);
// });

// // Load env vars
// dotenv.config({ path: './.env' });

// const app = require('./app');
// const connectDB = require('./config/db');
// const queues = require('./jobs'); // Import the queues

// // Connect to database
// connectDB();

// const port = process.env.PORT || 3000;
// const server = app.listen(port, () => {
//   console.log(`Server running in ${process.env.NODE_ENV} mode on port ${port}`);
// });

// // 2. Handle unhandled promise rejections (async issues like DB connection failures)
// process.on('unhandledRejection', err => {
//   console.log('UNHANDLED REJECTION! 💥 Shutting down...');
//   console.log(err.name, err.message);
//   // Close server gracefully before exiting
//   server.close(() => {
//     process.exit(1);
//   });
// });

// // Centralized graceful shutdown function
// const gracefulShutdown = (signal) => {
//   console.log(`👋 ${signal} RECEIVED. Shutting down gracefully...`);

//   server.close(async () => {
//     console.log('✅ HTTP server closed.');

//     // Only close queues if Redis is enabled, otherwise mock queues will crash
//     if (process.env.REDIS_ENABLED !== 'false') {
//       console.log('Shutting down message queues...');
//       try {
//         await Promise.all(
//           Object.values(queues).map(queue => {
//             if (queue && typeof queue.close === 'function') {
//               return queue.close();
//             }
//             return Promise.resolve();
//           })
//         );
//         console.log('✅ All queues shut down.');
//       } catch (err) {
//         console.error('Error shutting down queues:', err);
//       }
//     }

//     console.log('💥 Process terminated!');
//     process.exit(0);
//   });
// };

// // 3. Graceful shutdown for SIGTERM (from Render/Docker)
// process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// // 4. Graceful shutdown for SIGINT (from Ctrl+C)
// process.on('SIGINT', () => gracefulShutdown('SIGINT'));
