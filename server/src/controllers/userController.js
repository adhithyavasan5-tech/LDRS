const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken } = require('../utils/generateToken');

// ─── Validation Rules ─────────────────────────────────────────────────────────

const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('gender')
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('age')
    .isInt({ min: 18, max: 120 })
    .withMessage('You must be at least 18 years old'),
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * POST /api/users/register
 * Creates a new user profile and returns a JWT
 */
const createProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    const { email, password, gender, name, age } = req.body;

    // Ensure email uniqueness
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email already in use',
      });
    }

    const user = await User.create({ email, password, gender, name, age });
    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: `Welcome, ${user.name}! Your profile has been created.`,
      token,
      user: {
        _id: user._id,
        email: user.email,
        gender: user.gender,
        name: user.name,
        age: user.age,
        partnerId: user.partnerId || null,
        coupleProfileId: user.coupleProfileId || null,
        preferences: user.preferences,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[createProfile] ERROR', error);
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development' ? error.message : 'Error creating profile',
    });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * POST /api/users/login
 * Authenticates a user and returns a JWT
 */
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);
    return res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        gender: user.gender,
        age: user.age,
        partnerId: user.partnerId || null,
        coupleProfileId: user.coupleProfileId || null,
        preferences: user.preferences,
      },
    });
  } catch (err) {
    console.error('[login] ERROR', err);
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development' ? err.message : 'Login failed',
    });
  }
};

// ─── Get My Profile ───────────────────────────────────────────────────────────

/**
 * GET /api/users/me
 * Returns the current user's profile
 */
const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('partnerId', 'name gender age')
      .populate('coupleProfileId')
      .select('-__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('[getMyProfile]', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching profile',
    });
  }
};

// ─── Get User By ID ───────────────────────────────────────────────────────────

/**
 * GET /api/users/:id
 * Returns a user by ID (public, limited fields)
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('name gender age createdAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('[getUserById]', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching user',
    });
  }
};

// ─── Update Preferences ───────────────────────────────────────────────────────

/**
 * PUT /api/users/preferences
 * Update theme, notifications and FCM token
 */
const updatePreferences = async (req, res) => {
  try {
    const { theme, notifications, fcmToken } = req.body;
    const update = {};

    if (theme !== undefined) {
      if (!['dark', 'light', 'system'].includes(theme)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid theme. Use dark, light, or system.',
        });
      }
      update['preferences.theme'] = theme;
    }

    if (notifications !== undefined) {
      if (typeof notifications !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Notifications must be true or false.',
        });
      }
      update['preferences.notifications'] = notifications;
    }

    if (fcmToken !== undefined) {
      update.fcmToken = fcmToken;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid preferences provided.',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: update },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      message: 'Preferences updated successfully',
      user,
    });
  } catch (error) {
    console.error('[updatePreferences]', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating preferences',
    });
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  createProfile,
  login,
  getMyProfile,
  getUserById,
  updatePreferences,
  registerValidation,
  loginValidation,
};