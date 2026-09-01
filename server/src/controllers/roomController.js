
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const Room = require('../models/Room');
const User = require('../models/User');
const CoupleProfile = require('../models/CoupleProfile');

const { generateRoomCode } = require('../utils/generateCode');
const {
  isCloudinaryConfigured: checkCloudinary,
  cloudinary,
} = require('../config/cloudinary');
const UploadSession = require('../models/UploadSession');
const { getSignedGetUrl, deleteS3Object } = require('./uploadController');

// ─────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────

const createRoomValidation = [
  body('roomName')
    .trim()
    .notEmpty()
    .withMessage('Room name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage(
      'Room name must be between 3 and 100 characters'
    ),

  body('password')
    .notEmpty()
    .withMessage('Room password is required')
    .isLength({ min: 4 })
    .withMessage(
      'Password must be at least 4 characters'
    ),
];

const joinRoomValidation = [
  body('roomCode')
    .trim()
    .notEmpty()
    .withMessage('Room code is required'),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const generateUniqueRoomCode = async () => {
  let code;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 10) {
    code = generateRoomCode();

    exists = await Room.exists({
      roomCode: code,
    });

    attempts++;
  }

  if (exists) {
    throw new Error(
      'Could not generate unique room code'
    );
  }

  return code;
};

// ─────────────────────────────────────────────────────────────
// GET UPLOAD SIGNATURE
// GET /api/rooms/upload-signature
// ─────────────────────────────────────────────────────────────

const getUploadSignature = async (req, res) => {
  try {
    if (!checkCloudinary()) {
      return res.status(500).json({
        success: false,
        message: 'Cloudinary is not configured. Please check settings.',
      });
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = 'ldrs/movies';
    
    const paramsToSign = {
      timestamp,
      folder,
    };
    
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );
    
    return res.json({
      success: true,
      timestamp,
      signature,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder
    });
  } catch (error) {
    console.error('[getUploadSignature]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate upload signature',
    });
  }
};

// ─────────────────────────────────────────────────────────────
// CREATE ROOM
// POST /api/rooms/create
// ─────────────────────────────────────────────────────────────

const createRoom = async (req, res) => {
  try {
    console.log(
      '[createRoom] Starting room creation...'
    );

    // ─────────────────────────────────────────────
    // VALIDATION
    // ─────────────────────────────────────────────

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    // ─────────────────────────────────────────────
    // CHECK AUTHENTICATION
    // ─────────────────────────────────────────────

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // ─────────────────────────────────────────────
    // GET FORM DATA
    // ─────────────────────────────────────────────

    const { 
      roomName, 
      password,
      movieUrl,
      moviePublicId,
      movieName,
      movieSize 
    } = req.body;

    if (!movieUrl) {
      return res.status(400).json({
        success: false,
        message: 'Movie URL is required (movie must be uploaded first)',
      });
    }

    const userId = req.user._id;

    // Validate S3 UploadSession
    const uploadSession = await UploadSession.findOne({
      movieObjectKey: moviePublicId,
      ownerId: userId,
      status: 'completed',
    });

    if (!uploadSession) {
      return res.status(400).json({
        success: false,
        message: 'Invalid movie upload or unauthorized session. Please upload the movie again.',
      });
    }

    // ─────────────────────────────────────────────
    // HASH PASSWORD
    // ─────────────────────────────────────────────

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    // ─────────────────────────────────────────────
    // GENERATE ROOM CODE
    // ─────────────────────────────────────────────

    const roomCode =
      await generateUniqueRoomCode();

    console.log(
      `[createRoom] Generated room code: ${roomCode}`
    );

    // ─────────────────────────────────────────────
    // CREATE ROOM WITH MOVIE URL
    // ─────────────────────────────────────────────

    const room = await Room.create({
      roomName,
      passwordHash,
      roomCode,
      creatorId: userId,

      movieUrl,
      moviePublicId,
      movieName,
      movieSize,
    });

    // Link the UploadSession to this Room
    uploadSession.roomId = room._id;
    await uploadSession.save();

    console.log(
      `[createRoom] Room created successfully: ${roomCode}`
    );

    console.log(
      '[createRoom] Saved movieUrl:',
      room.movieUrl
    );

    // Generate short-lived S3 signed GET URL for client playback
    const signedMovieUrl = await getSignedGetUrl(room.moviePublicId);

    // ─────────────────────────────────────────────
    // RESPONSE
    // ─────────────────────────────────────────────

    return res.status(201).json({
      success: true,
      message: 'Movie date room created!',
      room: {
        _id: room._id,
        roomName: room.roomName,
        roomCode: room.roomCode,
        status: room.status,
        isLocked: room.isLocked,

        movieName: room.movieName,
        movieSize: room.movieSize,

        // Return the signed temporary URL for playback
        movieUrl: signedMovieUrl || room.movieUrl,

        playbackPosition:
          room.playbackPosition || 0,

        isPlaying:
          Boolean(room.isPlaying),

        createdAt: room.createdAt,
      },
    });
  } catch (error) {
    console.error(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );

    console.error(
      '[createRoom] ERROR'
    );

    console.error(error);

    console.error(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          'Error creating room',
      });
    }
  }
};

// ─────────────────────────────────────────────────────────────
// JOIN ROOM
// POST /api/rooms/join
// ─────────────────────────────────────────────────────────────

const joinRoom = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    const { roomCode, password } = req.body;

    const userId =
      req.user._id.toString();

    // ─────────────────────────────────────────────
    // FIND ROOM
    // ─────────────────────────────────────────────

    const room = await Room.findOne({
      roomCode:
        roomCode.toUpperCase(),
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message:
          'Room not found. Check the code.',
      });
    }

    // ─────────────────────────────────────────────
    // CHECK STATUS
    // ─────────────────────────────────────────────

    if (room.status === 'ended') {
      return res.status(400).json({
        success: false,
        message:
          'This movie date has ended.',
      });
    }

    // ─────────────────────────────────────────────
    // CHECK PASSWORD
    // ─────────────────────────────────────────────

    const isPasswordValid =
      await bcrypt.compare(
        password,
        room.passwordHash
      );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message:
          'Incorrect password.',
      });
    }

    // ─────────────────────────────────────────────
    // CHECK MOVIE URL
    // ─────────────────────────────────────────────

    if (!room.movieUrl) {
      return res.status(400).json({
        success: false,
        message:
          'The movie is still being uploaded or is unavailable. Please try again.',
      });
    }

    const creatorId =
      room.creatorId.toString();

    // ─────────────────────────────────────────────
    // CREATOR REJOINING
    // ─────────────────────────────────────────────

    if (userId === creatorId) {
      const signedMovieUrl = await getSignedGetUrl(room.moviePublicId);
      return res.json({
        success: true,
        message:
          'Welcome back to your room!',

        room: {
          _id: room._id,
          roomName: room.roomName,
          roomCode: room.roomCode,
          status: room.status,
          isLocked: room.isLocked,

          movieUrl: signedMovieUrl || room.movieUrl,
          movieName: room.movieName,
          movieSize: room.movieSize,

          playbackPosition:
            room.playbackPosition || 0,

          isPlaying:
            Boolean(room.isPlaying),
        },

        role: 'creator',
      });
    }

    // ─────────────────────────────────────────────
    // CHECK ROOM CAPACITY
    // ─────────────────────────────────────────────

    if (
      room.isLocked &&
      room.partnerId &&
      room.partnerId.toString() !== userId
    ) {
      return res.status(403).json({
        success: false,
        message:
          'This room is full. Only two people can watch together.',
      });
    }

    // ─────────────────────────────────────────────
    // SECOND USER JOINS
    // ─────────────────────────────────────────────

    const updatedRoom =
      await Room.findByIdAndUpdate(
        room._id,
        {
          $set: {
            partnerId: userId,
            isLocked: true,
            status: 'active',
          },
        },
        {
          new: true,
        }
      );

    // ─────────────────────────────────────────────
    // FIND COUPLE PROFILE
    // ─────────────────────────────────────────────

    let coupleProfile =
      await CoupleProfile.findOne({
        $or: [
          {
            user1Id: creatorId,
            user2Id: userId,
          },
          {
            user1Id: userId,
            user2Id: creatorId,
          },
        ],
      });

    // ─────────────────────────────────────────────
    // CREATE COUPLE PROFILE
    // ─────────────────────────────────────────────

    if (!coupleProfile) {
      coupleProfile =
        await CoupleProfile.create({
          user1Id: creatorId,
          user2Id: userId,
        });

      // Link couple profile to both users
      await User.updateMany(
        {
          _id: {
            $in: [
              creatorId,
              userId,
            ],
          },
        },
        {
          $set: {
            coupleProfileId:
              coupleProfile._id,
          },
        }
      );

      // Set partner IDs
      await User.findByIdAndUpdate(
        creatorId,
        {
          partnerId: userId,
        }
      );

      await User.findByIdAndUpdate(
        userId,
        {
          partnerId: creatorId,
        }
      );
    }

    // ─────────────────────────────────────────────
    // LINK COUPLE PROFILE TO ROOM
    // ─────────────────────────────────────────────

    await Room.findByIdAndUpdate(
      room._id,
      {
        coupleProfileId:
          coupleProfile._id,
      }
    );

    const signedMovieUrl = await getSignedGetUrl(updatedRoom.moviePublicId);

    // ─────────────────────────────────────────────
    // RESPONSE
    // ─────────────────────────────────────────────

    return res.json({
      success: true,
      message:
        "You've joined the movie date! 🎬",

      room: {
        _id: updatedRoom._id,
        roomName:
          updatedRoom.roomName,

        roomCode:
          updatedRoom.roomCode,

        status:
          updatedRoom.status,

        isLocked:
          updatedRoom.isLocked,

        movieUrl:
          signedMovieUrl || updatedRoom.movieUrl,

        movieName:
          updatedRoom.movieName,

        movieSize:
          updatedRoom.movieSize,

        playbackPosition:
          updatedRoom.playbackPosition || 0,

        isPlaying:
          Boolean(updatedRoom.isPlaying),
      },

      coupleProfileId:
        coupleProfile._id,

      role: 'partner',
    });
  } catch (error) {
    console.error(
      '[joinRoom]',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Error joining room',
    });
  }
};

// ─────────────────────────────────────────────────────────────
// GET ROOM BY CODE
// GET /api/rooms/:code
// ─────────────────────────────────────────────────────────────

const getRoomByCode = async (
  req,
  res
) => {
  try {
    const room =
      await Room.findOne({
        roomCode:
          req.params.code.toUpperCase(),
      })
        .populate(
          'creatorId',
          'name gender'
        )
        .populate(
          'partnerId',
          'name gender'
        )
        .select(
          '-passwordHash -__v'
        );

    if (!room) {
      return res.status(404).json({
        success: false,
        message:
          'Room not found',
      });
    }

    // Verify authorization: must be creator or partner
    const userIdStr = req.user._id.toString();
    const isCreator = room.creatorId && (room.creatorId._id || room.creatorId).toString() === userIdStr;
    const isPartner = room.partnerId && (room.partnerId._id || room.partnerId).toString() === userIdStr;

    if (!isCreator && !isPartner) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this room',
      });
    }

    // Generate short-lived S3 signed GET URL
    const signedMovieUrl = await getSignedGetUrl(room.moviePublicId);

    const roomJSON = room.toJSON();
    roomJSON.movieUrl = signedMovieUrl || room.movieUrl;

    return res.json({
      success: true,
      room: roomJSON,
    });
  } catch (error) {
    console.error(
      '[getRoomByCode]',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Error fetching room',
    });
  }
};

// ─────────────────────────────────────────────────────────────
// LEAVE ROOM
// POST /api/rooms/:id/leave
// ─────────────────────────────────────────────────────────────

const leaveRoom = async (
  req,
  res
) => {
  try {
    const room =
      await Room.findById(
        req.params.id
      );

    if (!room) {
      return res.status(404).json({
        success: false,
        message:
          'Room not found',
      });
    }

    return res.json({
      success: true,
      message:
        'Left the room',
    });
  } catch (error) {
    console.error(
      '[leaveRoom]',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Error leaving room',
    });
  }
};

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

module.exports = {
  getUploadSignature,
  createRoom,
  joinRoom,
  getRoomByCode,
  leaveRoom,

  createRoomValidation,
  joinRoomValidation,
};