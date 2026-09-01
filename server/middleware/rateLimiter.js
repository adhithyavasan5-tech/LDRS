const rateLimit = require('express-rate-limit');

const profileCreationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: {
        success: false,
        message: 'Too many requests. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    profileCreationLimiter,
};