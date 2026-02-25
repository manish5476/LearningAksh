const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const apiRoutes = require('./routes');

const app = express();

// 1. Global Middlewares
app.use(helmet()); // Security headers
app.use(cors()); // Cross-Origin Resource Sharing
app.use(express.json()); // Parse incoming JSON payloads
app.use(express.urlencoded({ extended: true }));

// 2. Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 3. Mount Routes
app.use('/api/v1', apiRoutes);

// 4. Global 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// 5. Global Error Handler (Add your custom error middleware here later)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;