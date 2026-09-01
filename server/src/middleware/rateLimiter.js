const rateLimit = require('express-rate-limit');

const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});

// Stricter limiter for auth-like profile creation
const profileCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Too many profile creation attempts. Please try again in an hour.',
  },
});

// Room operations limiter
const roomLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  message: {
    success: false,
    message: 'Too many room requests. Please wait a few minutes.',
  },
});

// Stricter limiter for starting upload sessions (prevents spamming S3 multipart uploads)
const uploadStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20, // Max 20 new upload sessions per 15 min per IP
  message: {
    success: false,
    message: 'Too many upload sessions initiated. Please wait a few minutes.',
  },
});

// Dedicated high-throughput limiter for signing chunks during active uploads
// 2 GB file = ~82 chunks. 300 requests allows multiple large uploads per 15 min per IP.
const uploadChunkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  message: {
    success: false,
    message: 'Too many chunk signing requests. Please wait a few minutes.',
  },
});

module.exports = { rateLimiter, profileCreationLimiter, roomLimiter, uploadStartLimiter, uploadChunkLimiter };
