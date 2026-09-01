const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { isCloudinaryConfigured, cloudinary } = require('../config/cloudinary');

// ============================================================
// FILE LIMITS
// ============================================================

const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_SUBTITLE_SIZE = 5 * 1024 * 1024; // 5 MB

// ============================================================
// ALLOWED FILE TYPES
// ============================================================

const ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/x-matroska',
    'video/x-msvideo',
    'video/avi',
    'video/quicktime',
];

const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
];

const ALLOWED_SUBTITLE_TYPES = [
    'text/vtt',
    'application/x-subrip',
    'text/plain',
];

// ============================================================
// TEMP DIRECTORY
// ============================================================

const uploadDir = path.join(os.tmpdir(), 'ldrs-uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {
        recursive: true,
    });
}

// ============================================================
// VIDEO FILTER
// ============================================================

const videoFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    const validExts = [
        '.mp4',
        '.mkv',
        '.avi',
        '.mov',
    ];

    if (
        ALLOWED_VIDEO_TYPES.includes(file.mimetype) ||
        validExts.includes(ext)
    ) {
        cb(null, true);
    } else {
        cb(
            new Error(
                `Invalid video type. Allowed: MP4, MKV, AVI, MOV. Got: ${file.mimetype}`
            ),
            false
        );
    }
};

// ============================================================
// IMAGE FILTER
// ============================================================

const imageFilter = (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error(
                'Invalid image type. Allowed: JPEG, PNG, GIF, WebP'
            ),
            false
        );
    }
};

// ============================================================
// SUBTITLE FILTER
// ============================================================

const subtitleFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    const validExts = [
        '.vtt',
        '.srt',
        '.ass',
        '.ssa',
    ];

    if (
        ALLOWED_SUBTITLE_TYPES.includes(file.mimetype) ||
        validExts.includes(ext)
    ) {
        cb(null, true);
    } else {
        cb(
            new Error(
                'Invalid subtitle type. Allowed: VTT, SRT, ASS, SSA'
            ),
            false
        );
    }
};

// ============================================================
// DISK STORAGE
// ============================================================

const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);

        const safeName =
            `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

        cb(null, safeName);
    },
});

// ============================================================
// MULTER INSTANCES
// ============================================================

const uploadVideo = multer({
    storage: diskStorage,

    limits: {
        fileSize: 2 * 1024 * 1024 * 1024, // 2GB in bytes
    },

    fileFilter: videoFilter,
});

const uploadImage = multer({
    storage: diskStorage,

    limits: {
        fileSize: MAX_IMAGE_SIZE,
    },

    fileFilter: imageFilter,
});

const uploadSubtitle = multer({
    storage: diskStorage,

    limits: {
        fileSize: MAX_SUBTITLE_SIZE,
    },

    fileFilter: subtitleFilter,
});

// ============================================================
// CLOUDINARY UPLOAD
// ============================================================

const uploadToCloudinary = async (
    filePath,
    options = {}
) => {
    if (!isCloudinaryConfigured()) {
        throw new Error(
            'Cloudinary not configured. Set CLOUDINARY_* environment variables.'
        );
    }

    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload(
            filePath,
            {
                resource_type: 'video',
                folder: 'ldrs/movies',
                ...options,
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );
    });
};

// ============================================================
// DELETE TEMPORARY FILE
// ============================================================

const deleteTempFile = (filePath) => {
    if (!filePath) {
        return;
    }

    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);

            console.log(
                '[upload] Temporary file deleted:',
                filePath
            );
        }
    } catch (error) {
        console.error(
            '[upload] Failed to delete temporary file:',
            error.message
        );
    }
};

// ============================================================
// MULTER ERROR HANDLER
// ============================================================

const handleMulterError = (
    err,
    req,
    res,
    next
) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                success: false,
                message: 'Movie file is larger than 2 GB.',
            });
        }

        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }

    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }

    next();
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    uploadVideo,
    uploadImage,
    uploadSubtitle,
    uploadToCloudinary,
    deleteTempFile,
    handleMulterError,
};