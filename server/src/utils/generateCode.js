const { v4: uuidv4 } = require('uuid');

/**
 * Generate a unique 6-character alphanumeric room code
 * Uses uppercase letters and digits, excluding ambiguous chars (0, O, I, 1)
 */
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Generate a unique user-facing ID (shorter UUID)
 */
const generateUserId = () => {
  return uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
};

module.exports = { generateRoomCode, generateUserId };
