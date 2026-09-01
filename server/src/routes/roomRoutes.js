const express = require('express');
const router = express.Router();
const {
  getUploadSignature,
  createRoom,
  joinRoom,
  getRoomByCode,
  leaveRoom,
  createRoomValidation,
  joinRoomValidation,
} = require('../controllers/roomController');
const {
  startMultipartUpload,
  getUploadPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
} = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const { roomLimiter, uploadStartLimiter, uploadChunkLimiter } = require('../middleware/rateLimiter');

// All room routes require authentication
router.use(protect);

router.get('/upload-signature', getUploadSignature);

// S3 Multipart Upload Routes with dedicated rate limiters
router.post('/upload/start', uploadStartLimiter, startMultipartUpload);
router.post('/upload/sign-chunk', uploadChunkLimiter, getUploadPartUrl);
router.post('/upload/complete', roomLimiter, completeMultipartUpload);
router.post('/upload/abort', roomLimiter, abortMultipartUpload);

router.post(
  '/create',
  roomLimiter,
  createRoomValidation,
  createRoom
);
router.post('/join', roomLimiter, joinRoomValidation, joinRoom);
router.get('/:code', getRoomByCode);
router.post('/:id/leave', leaveRoom);

module.exports = router;
