// src/utils/security.js
const crypto = require('crypto');

exports.generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

exports.sanitizeInput = (input) => {
  // Remove any potential malicious code
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

exports.encryptData = (text) => {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};