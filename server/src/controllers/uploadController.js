const {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');
const UploadSession = require('../models/UploadSession');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',

  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy',
  },

  ...(process.env.AWS_S3_ENDPOINT && {
    endpoint: process.env.AWS_S3_ENDPOINT,
    forcePathStyle: true,
  }),

  // Backblaze B2 S3-compatible API:
  // prevent AWS SDK from automatically adding checksum
  // parameters to presigned multipart UploadPart URLs.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'ldrs-movies';
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB Maximum

// Allowed extensions (lowercase). Extension is the authoritative check.
// Browser MIME type is unreliable for .mkv, .mov, and some .mp4 files.
const ALLOWED_EXTENSIONS = ['.mp4', '.webm', '.mov', '.mkv'];

const generateUniqueFilename = (originalName) => {
  const ext = path.extname(originalName);
  const hash = crypto.randomBytes(16).toString('hex');
  return `ldrs/movies/${hash}${ext}`;
};

/**
 * 1. Start Multipart Upload
 */
exports.startMultipartUpload = async (req, res) => {
  try {
    const { filename, fileType, fileSize } = req.body;

    // ── Diagnostic logging (no credentials ever logged) ────────────
    console.log('[startMultipartUpload] Received:', {
      filename,
      fileType,
      fileSize,
      fileSizeType: typeof fileSize,
      bucket: BUCKET_NAME,
      region: process.env.AWS_REGION || 'us-east-1',
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    });

    // Security Validations
    if (!filename || !fileSize) {
      console.log('[startMultipartUpload] REJECTED: missing filename or fileSize');
      return res.status(400).json({ success: false, message: 'Missing file details (filename or fileSize)' });
    }

    const fileSizeNum = Number(fileSize);

    if (isNaN(fileSizeNum) || fileSizeNum <= 0) {
      console.log('[startMultipartUpload] REJECTED: fileSize is not a valid number:', fileSize);
      return res.status(400).json({ success: false, message: 'Invalid file size' });
    }

    if (fileSizeNum > MAX_FILE_SIZE) {
      console.log(`[startMultipartUpload] REJECTED: fileSize ${fileSizeNum} > MAX ${MAX_FILE_SIZE}`);
      return res.status(400).json({ success: false, message: 'Movie is too large. Maximum allowed size is 2 GB.' });
    }

    // Extension-based validation (authoritative). MIME type is unreliable across browsers.
    const ext = path.extname(filename).toLowerCase();
    console.log('[startMultipartUpload] ext:', ext, '| allowed:', ALLOWED_EXTENSIONS);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      console.log('[startMultipartUpload] REJECTED: extension not allowed:', ext);
      return res.status(400).json({
        success: false,
        message: `Unsupported video format "${ext}". Allowed: .mp4, .webm, .mov, .mkv`,
      });
    }

    // Map extension → reliable MIME (browser fileType can be empty for .mkv/.mov)
    const EXT_TO_MIME = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska',
    };
    const contentType = fileType || EXT_TO_MIME[ext] || 'video/mp4';

    const key = generateUniqueFilename(filename);

    const command = new CreateMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const response = await s3Client.send(command);

    // Track upload session in DB
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    await UploadSession.create({
      uploadId: response.UploadId,
      movieObjectKey: response.Key,
      movieName: filename,
      movieSize: fileSizeNum,
      ownerId: req.user._id,
      status: 'uploading',
      expiresAt,
    });

    return res.json({
      success: true,
      uploadId: response.UploadId,
      key: response.Key,
    });
  } catch (error) {
    console.error('[startMultipartUpload] AWS/Server Error:', {
      name: error.name,
      code: error.Code,
      message: error.message,
      statusCode: error.$metadata?.httpStatusCode,
    });

    // Return specific AWS error codes to frontend for easy diagnosis
    const awsCode = error.name || error.Code || 'UnknownError';
    let userMessage = 'Failed to initiate upload';

    if (awsCode === 'InvalidClientTokenId' || awsCode === 'InvalidAccessKeyId') {
      userMessage = 'S3 upload failed: Invalid AWS access key. Check AWS_ACCESS_KEY_ID in server .env';
    } else if (awsCode === 'SignatureDoesNotMatch') {
      userMessage = 'S3 upload failed: Invalid AWS secret key. Check AWS_SECRET_ACCESS_KEY in server .env';
    } else if (awsCode === 'NoSuchBucket') {
      userMessage = `S3 upload failed: Bucket "${BUCKET_NAME}" does not exist. Check AWS_S3_BUCKET_NAME in server .env`;
    } else if (awsCode === 'AccessDenied') {
      userMessage = `S3 upload failed: Access denied on bucket "${BUCKET_NAME}". Check IAM permissions (s3:CreateMultipartUpload)`;
    } else if (awsCode === 'AuthFailure') {
      userMessage = 'S3 upload failed: Authentication failed. Verify AWS credentials in server .env';
    } else if (error.message) {
      userMessage = `S3 upload failed: ${error.message}`;
    }

    return res.status(500).json({ success: false, message: userMessage });
  }
};

/**
 * 2. Get Presigned URL for a Chunk
 */
exports.getUploadPartUrl = async (req, res) => {
  try {
    const { uploadId, key, partNumber } = req.body;

    if (!uploadId || !key || !partNumber) {
      return res.status(400).json({ success: false, message: 'Missing upload details' });
    }

    // Security check: Ensure caller owns the upload session
    const session = await UploadSession.findOne({
      uploadId,
      movieObjectKey: key,
      ownerId: req.user._id,
      status: 'uploading',
    });

    if (!session) {
      return res.status(403).json({ success: false, message: 'Unauthorized or invalid upload session' });
    }

    const command = new UploadPartCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    // Generate presigned URL valid for 15 minutes
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return res.json({
      success: true,
      signedUrl,
    });
  } catch (error) {
    console.error('[getUploadPartUrl] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate signed URL' });
  }
};

/**
 * 3. Complete Multipart Upload
 */
exports.completeMultipartUpload = async (req, res) => {
  try {
    const { uploadId, key, parts } = req.body;

    if (!uploadId || !key || !parts || !Array.isArray(parts)) {
      return res.status(400).json({ success: false, message: 'Missing upload details or parts' });
    }

    // Security check: Ensure caller owns the upload session
    const session = await UploadSession.findOne({
      uploadId,
      movieObjectKey: key,
      ownerId: req.user._id,
      status: 'uploading',
    });

    if (!session) {
      return res.status(403).json({ success: false, message: 'Unauthorized or invalid upload session' });
    }

    const sortedParts = parts.sort((a, b) => a.PartNumber - b.PartNumber);

    const command = new CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts,
      },
    });

    const response = await s3Client.send(command);

    // Update UploadSession status in DB
    await UploadSession.findOneAndUpdate(
      { uploadId },
      { status: 'completed' }
    );

    // Build the object URL. B2 may not return Location, so construct it using path-style.
    const endpoint = process.env.AWS_S3_ENDPOINT;
    const region = process.env.AWS_REGION || 'us-east-1';
    const secureUrl = response.Location
      || (endpoint
        ? `${endpoint}/${BUCKET_NAME}/${key}`   // B2 / R2 path-style
        : `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`);

    return res.json({
      success: true,
      secure_url: secureUrl,
      public_id: key,
    });
  } catch (error) {
    console.error('[completeMultipartUpload] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to complete upload' });
  }
};

/**
 * 4. Abort Multipart Upload
 */
exports.abortMultipartUpload = async (req, res) => {
  try {
    const { uploadId, key } = req.body;

    if (!uploadId || !key) {
      return res.status(400).json({ success: false, message: 'Missing upload details' });
    }

    // Security check: Ensure caller owns the upload session
    const session = await UploadSession.findOne({
      uploadId,
      movieObjectKey: key,
      ownerId: req.user._id,
    });

    if (!session) {
      return res.status(403).json({ success: false, message: 'Unauthorized or invalid upload session' });
    }

    const command = new AbortMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
    });

    await s3Client.send(command);

    // Delete UploadSession from DB
    await UploadSession.deleteOne({ uploadId });

    return res.json({
      success: true,
      message: 'Upload aborted and cleaned up',
    });
  } catch (error) {
    console.error('[abortMultipartUpload] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to abort upload' });
  }
};

// ─── S3 Helpers for Video Streaming & Deletion ───────────────────────────────

const getSignedGetUrl = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    // Generate a signed URL valid for 1 hour (3600 seconds)
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  } catch (error) {
    console.error('[getSignedGetUrl] Error:', error);
    return null;
  }
};

const deleteS3Object = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(command);
    console.log(`[S3] Successfully deleted object: ${key}`);
    return true;
  } catch (error) {
    console.error(`[S3] Failed to delete object: ${key}`, error);
    return false;
  }
};

const mongoose = require('mongoose');

const runCleanupTask = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return;
    }
    // Find sessions that have expired
    const expiredSessions = await UploadSession.find({
      expiresAt: { $lt: new Date() },
    });

    if (expiredSessions.length > 0) {
      console.log(`[Upload Cleanup] Found ${expiredSessions.length} expired/abandoned upload sessions.`);
      for (const session of expiredSessions) {
        try {
          console.log(`[Upload Cleanup] Aborted/Cleaned expired S3 uploadId: ${session.uploadId}`);
          const command = new AbortMultipartUploadCommand({
            Bucket: BUCKET_NAME,
            Key: session.movieObjectKey,
            UploadId: session.uploadId,
          });
          await s3Client.send(command).catch((err) => {
            console.warn(`[Upload Cleanup] S3 abort failed (might be completed/already deleted):`, err.message);
          });

          // Also double check and delete the object
          const deleteCommand = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: session.movieObjectKey,
          });
          await s3Client.send(deleteCommand).catch(() => { });
        } catch (s3Err) {
          console.error(`[Upload Cleanup] S3 operations failed for session ${session.uploadId}:`, s3Err.message);
        }
        // Always delete the session record from DB
        await UploadSession.deleteOne({ _id: session._id });
      }
    }
  } catch (err) {
    console.error('[Upload Cleanup] Error running cleanup:', err);
  }
};

/**
 * Validate B2/S3 connection on startup (HeadBucket). Never logs credentials.
 */
const validateS3Connection = async () => {
  try {
    const endpoint = process.env.AWS_S3_ENDPOINT || '(default AWS)';
    const region = process.env.AWS_REGION || 'us-east-1';
    console.log(`[S3] Validating bucket "${BUCKET_NAME}" (region: ${region}, endpoint: ${endpoint})...`);
    console.log(`[S3] Has access key: ${!!process.env.AWS_ACCESS_KEY_ID} | Has secret key: ${!!process.env.AWS_SECRET_ACCESS_KEY}`);

    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`[S3] ✅ Bucket "${BUCKET_NAME}" is accessible. B2 connection OK.`);
  } catch (error) {
    console.error(`[S3] ❌ Bucket validation failed:`, {
      name: error.name,
      code: error.Code,
      message: error.message,
      statusCode: error.$metadata?.httpStatusCode,
    });
    console.error('[S3] ⚠️  Uploads will fail until this is resolved. Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME, and AWS_S3_ENDPOINT in .env');
  }
};

const startUploadCleanupInterval = () => {
  // Validate B2/S3 connection immediately
  validateS3Connection();
  // Run cleanup once on startup after 30 seconds
  setTimeout(runCleanupTask, 30000);
  // Run every 15 minutes
  setInterval(runCleanupTask, 15 * 60 * 1000);
  console.log('[Upload Cleanup] Initialized background cleanup interval (every 15 mins)');
};

exports.getSignedGetUrl = getSignedGetUrl;
exports.deleteS3Object = deleteS3Object;
exports.startUploadCleanupInterval = startUploadCleanupInterval;
