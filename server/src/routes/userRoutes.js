const express = require('express');
const router = express.Router();
const {
  createProfile,
  login,
  getMyProfile,
  getUserById,
  updatePreferences,
  registerValidation,
  loginValidation,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { profileCreationLimiter } = require('../middleware/rateLimiter');

// Public routes
router.post('/register', profileCreationLimiter, registerValidation, createProfile);
router.post('/login', loginValidation, login);

// Protected routes
router.get('/me', protect, getMyProfile);
router.get('/:id', protect, getUserById);
router.put('/preferences', protect, updatePreferences);

module.exports = router;
