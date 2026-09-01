const jwt = require('jsonwebtoken');

/**
 * Generate a JWT token for a user
 * @param {string} userId - MongoDB user _id
 * @returns {string} JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev_secret_change_me', {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

/**
 * Verify a JWT token
 * @param {string} token
 * @returns {{ userId: string } | null}
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me');
  } catch {
    return null;
  }
};

module.exports = { generateToken, verifyToken };
