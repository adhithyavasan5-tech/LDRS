const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to protect routes — verifies JWT and attaches user to req
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Please create a profile first.',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me');
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please create a new profile.',
      });
    }

    const user = await User.findById(decoded.userId).select('-__v');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please create a new profile.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth Middleware]', error);
    res.status(500).json({ success: false, message: 'Server error during authentication' });
  }
};

module.exports = { protect };
