const mongoose = require('mongoose');
const dotenv = require('dotenv');

// 1. Handle uncaught exceptions synchronously BEFORE loading the app
process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  console.log(err.stack);
  process.exit(1);
});

// Load env vars
dotenv.config({ path: './.env' });

const app = require('./app');
const connectDB = require('./config/db');
const queues = require('./jobs'); // Import the queues

// Connect to database
connectDB();

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${port}`);
});

// 2. Handle unhandled promise rejections (async issues like DB connection failures)
process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
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

    // Only close queues if Redis is enabled, otherwise mock queues will crash
    if (process.env.REDIS_ENABLED !== 'false') {
      console.log('Shutting down message queues...');
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
        console.error('Error shutting down queues:', err);
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
