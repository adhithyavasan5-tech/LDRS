const multer = require('multer');
const path = require('path');
const { isCloudinaryConfigured } = require('../config/cloudinary');

// ─── File Type Validation ─────────────────────────────────────────────────────
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/x-matroska', 'video/x-msvideo', 'video/avi'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_SUBTITLE_TYPES = ['text/vtt', 'application/x-subrip', 'text/plain'];

const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_SUBTITLE_SIZE = 5 * 1024 * 1024; // 5MB

// ─── Memory Storage (temporary — Cloudinary handles persistence) ───────────────
const storage = multer.memoryStorage();

// ─── Video Upload ──────────────────────────────────────────────────────────────
const videoFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const validExts = ['.mp4', '.mkv', '.avi', '.mov'];

  if (ALLOWED_VIDEO_TYPES.includes(file.mimetype) || validExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: MP4, MKV, AVI. Got: ${file.mimetype}`), false);
  }
};

const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image type. Allowed: JPEG, PNG, GIF, WebP'), false);
  }
};

const subtitleFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const validExts = ['.vtt', '.srt', '.ass', '.ssa'];

  if (ALLOWED_SUBTITLE_TYPES.includes(file.mimetype) || validExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid subtitle type. Allowed: VTT, SRT'), false);
  }
};

// ─── Multer Instances ─────────────────────────────────────────────────────────
const uploadVideo = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB in bytes
  fileFilter: videoFilter,
});

const uploadImage = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: imageFilter,
});

const uploadSubtitle = multer({
  storage,
  limits: { fileSize: MAX_SUBTITLE_SIZE },
  fileFilter: subtitleFilter,
});

// ─── Cloudinary Upload Helper ─────────────────────────────────────────────────
const uploadToCloudinary = async (buffer, options = {}) => {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary not configured. Set CLOUDINARY_* environment variables.');
  }

  const { cloudinary } = require('../config/cloudinary');

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        folder: 'ldrs',
        timeout: 900000,
        ...options,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

// ─── Multer Error Handler ─────────────────────────────────────────────────────
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'File too large' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

module.exports = {
  uploadVideo,
  uploadImage,
  uploadSubtitle,
  uploadToCloudinary,
  handleMulterError,
};
