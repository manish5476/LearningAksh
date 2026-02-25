
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Handle uncaught exceptions
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

// Connect to database
connectDB();

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${port}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown for SIGTERM
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});
// require('dotenv').config(); // Load environment variables first
// const app = require('./app');
// const connectDB = require('./config/db');

// const PORT = process.env.PORT || 5000;

// // Connect to Database, then start server
// connectDB().then(() => {
//   app.listen(PORT, () => {
//     console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
//     console.log(`Health Check: http://localhost:${PORT}/api/v1/health`);
//   });
// });

// // Handle unhandled promise rejections (e.g., failed DB connection after initial load)
// process.on('unhandledRejection', (err) => {
//   console.log('UNHANDLED REJECTION! 💥 Shutting down...');
//   console.log(err.name, err.message);
//   process.exit(1);
// });
