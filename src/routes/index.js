const express = require('express');
const router = express.Router();

// Health Check Route
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'success', 
    message: 'Ed-Tech API is running smoothly!',
    timestamp: new Date()
  });
});

// Future routes will be mounted here:
// router.use('/users', require('./userRoutes'));
// router.use('/courses', require('./courseRoutes'));

module.exports = router;