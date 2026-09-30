const { verifyToken } = require('../utils/generateToken');
const Room = require('../models/Room');
const User = require('../models/User');
const UploadSession = require('../models/UploadSession');
const { deleteS3Object } = require('../controllers/uploadController');

// ─────────────────────────────────────────────────────────────────────────────
// Active room tracking
// roomCode → Set of socketIds
// ─────────────────────────────────────────────────────────────────────────────
const activeRooms = new Map();

// roomCode → Timeout
const pendingDeletions = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// Schedule room + movie deletion
// ─────────────────────────────────────────────────────────────────────────────
const scheduleRoomDeletion = (roomCode, io) => {
  const code = roomCode?.toUpperCase();

  if (!code) return;

  // If a deletion is already scheduled, reset it.
  if (pendingDeletions.has(code)) {
    clearTimeout(pendingDeletions.get(code));
    pendingDeletions.delete(code);
  }

  console.log(
    `[Room Cleanup] Scheduling deletion for room ${code} in 3 minutes...`
  );

  const timeoutId = setTimeout(async () => {
    pendingDeletions.delete(code);

    try {
      // Double-check that nobody reconnected.
      const activeSet = activeRooms.get(code);

      if (activeSet && activeSet.size > 0) {
        console.log(
          `[Room Cleanup] Room ${code} is active again. Skipping deletion.`
        );
        return;
      }

      console.log(
        `[Room Cleanup] Grace period expired. Starting deletion for ${code}...`
      );

      const room = await Room.findOne({ roomCode: code });

      if (!room) {
        console.log(
          `[Room Cleanup] Room ${code} not found in database.`
        );
        return;
      }

      // ───────────────────────────────────────────────────────────────────────
      // Delete movie from S3
      // ───────────────────────────────────────────────────────────────────────
      if (room.moviePublicId) {
        try {
          console.log(
            `[Room Cleanup] Deleting S3 object: ${room.moviePublicId}`
          );

          await deleteS3Object(room.moviePublicId);

          console.log(
            `[Room Cleanup] S3 object deleted for room ${code}.`
          );
        } catch (s3Error) {
          console.error(
            `[Room Cleanup] Failed to delete S3 object for ${code}:`,
            s3Error
          );
        }
      }

      // ───────────────────────────────────────────────────────────────────────
      // Delete UploadSession records
      // ───────────────────────────────────────────────────────────────────────
      try {
        await UploadSession.deleteMany({
          $or: [
            { roomId: room._id },
            { movieObjectKey: room.moviePublicId }
          ]
        });

        console.log(
          `[Room Cleanup] UploadSession records cleaned for ${code}.`
        );
      } catch (uploadError) {
        console.error(
          `[Room Cleanup] Failed to clean UploadSession records for ${code}:`,
          uploadError
        );
      }

      // ───────────────────────────────────────────────────────────────────────
      // Delete room
      // ───────────────────────────────────────────────────────────────────────
      await Room.deleteOne({ _id: room._id });

      console.log(
        `[Room Cleanup] Successfully deleted room ${code}.`
      );

      // ───────────────────────────────────────────────────────────────────────
      // Notify anyone still connected
      // ───────────────────────────────────────────────────────────────────────
      io.to(code).emit('room:ended', {
        message:
          'Watch session has ended and the movie has been deleted.'
      });

      // Remove room from active map just in case
      activeRooms.delete(code);
    } catch (err) {
      console.error(
        `[Room Cleanup] Error deleting room ${code}:`,
        err
      );
    }
  }, 180000); // 3 minutes

  pendingDeletions.set(code, timeoutId);
};

// ─────────────────────────────────────────────────────────────────────────────
// Cancel pending deletion
// ─────────────────────────────────────────────────────────────────────────────
const cancelRoomDeletion = (roomCode) => {
  const code = roomCode?.toUpperCase();

  if (!code) return;

  if (pendingDeletions.has(code)) {
    clearTimeout(pendingDeletions.get(code));
    pendingDeletions.delete(code);

    console.log(
      `[Room Cleanup] Cancelled pending deletion for room ${code}.`
    );
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Remove socket from active room tracking
// ─────────────────────────────────────────────────────────────────────────────
const removeSocketFromRoom = (socket, code) => {
  if (!code) return false;

  const room = activeRooms.get(code);

  if (!room) {
    return false;
  }

  const existed = room.delete(socket.id);

  if (room.size === 0) {
    activeRooms.delete(code);
  }

  return existed;
};

// ─────────────────────────────────────────────────────────────────────────────
// Handle socket leaving a room
// ─────────────────────────────────────────────────────────────────────────────
const handleLeave = (socket, io, roomCode) => {
  const code = roomCode?.toUpperCase();

  if (!code) return;

  // Prevent duplicate leave/disconnect handling.
  if (socket.currentRoom !== code) {
    return;
  }

  console.log(
    `[Socket] ${socket.id} leaving room ${code}`
  );

  // Leave Socket.IO room
  socket.leave(code);

  // Remove from our active-room tracking
  const removed = removeSocketFromRoom(socket, code);

  // Clear current room before scheduling cleanup.
  socket.currentRoom = null;

  // Notify remaining participant
  if (removed) {
    io.to(code).emit('room:partner_left', {
      userId: socket.userId,
      name: socket.user?.name || 'Your partner',
      message: 'has left the movie date'
    });
  }

  // Check whether anybody remains.
  const remaining = activeRooms.get(code);

  if (!remaining || remaining.size === 0) {
    scheduleRoomDeletion(code, io);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Initialize Socket.IO handlers
// ─────────────────────────────────────────────────────────────────────────────
const initSocketHandlers = (io) => {
  // ───────────────────────────────────────────────────────────────────────────
  // Socket authentication middleware
  // ───────────────────────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      // Allow connection, but mark as unauthenticated.
      // Actual room access is blocked later.
      if (!token) {
        socket.userId = null;
        socket.user = null;

        return next();
      }

      const decoded = verifyToken(token);

      if (!decoded || !decoded.userId) {
        socket.userId = null;
        socket.user = null;

        return next();
      }

      const user = await User.findById(decoded.userId)
        .select('name gender');

      if (!user) {
        socket.userId = null;
        socket.user = null;

        return next();
      }

      socket.userId = decoded.userId;
      socket.user = user;

      next();
    } catch (err) {
      console.error('[Socket Auth]', err.message);

      socket.userId = null;
      socket.user = null;

      // Do not prevent connection.
      // room:join will require authentication.
      next();
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // New socket connection
  // ───────────────────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(
      `[Socket] Connected: ${socket.id} | User: ${
        socket.user?.name || 'Unknown'
      }`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Room: Join
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('room:join', async ({ roomCode } = {}, callback) => {
      try {
        if (!roomCode) {
          return callback?.({
            error: 'Room code required'
          });
        }

        // Room access requires authentication.
        if (!socket.userId) {
          return callback?.({
            error: 'Authentication required'
          });
        }

        const code = roomCode.toUpperCase().trim();

        const room = await Room.findOne({
          roomCode: code
        });

        if (!room) {
          return callback?.({
            error: 'Room not found'
          });
        }

        // ─────────────────────────────────────────────────────────────────────
        // Authorization
        // ─────────────────────────────────────────────────────────────────────
        const userIdStr = socket.userId.toString();

        const creatorId = room.creatorId
          ? room.creatorId.toString()
          : null;

        const partnerId = room.partnerId
          ? room.partnerId.toString()
          : null;

        const isCreator = creatorId === userIdStr;
        const isPartner = partnerId === userIdStr;

        if (!isCreator && !isPartner) {
          return callback?.({
            error: 'Not authorized to join this room'
          });
        }

        // ─────────────────────────────────────────────────────────────────────
        // Prevent socket from joining multiple rooms
        // ─────────────────────────────────────────────────────────────────────
        if (
          socket.currentRoom &&
          socket.currentRoom !== code
        ) {
          handleLeave(
            socket,
            io,
            socket.currentRoom
          );
        }

        // Cancel deletion because someone reconnected.
        cancelRoomDeletion(code);

        // ─────────────────────────────────────────────────────────────────────
        // Check room capacity
        // ─────────────────────────────────────────────────────────────────────
        if (!activeRooms.has(code)) {
          activeRooms.set(code, new Set());
        }

        const participants = activeRooms.get(code);

        // If this socket is already in the room, don't count it twice.
        if (!participants.has(socket.id)) {
          if (participants.size >= 2) {
            return callback?.({
              error: 'Room is full'
            });
          }

          participants.add(socket.id);
        }

        // Join Socket.IO room.
        socket.join(code);
        socket.currentRoom = code;

        const participantCount = participants.size;

        // ─────────────────────────────────────────────────────────────────────
        // Notify existing partner
        // ─────────────────────────────────────────────────────────────────────
        socket.to(code).emit('room:partner_joined', {
          userId: socket.userId,
          name: socket.user?.name || 'Your Partner',
          participantCount
        });

        // ─────────────────────────────────────────────────────────────────────
        // Lock room when two participants are present
        // ─────────────────────────────────────────────────────────────────────
        if (participantCount >= 2) {
          io.to(code).emit('room:locked', {
            message:
              'Room is now full. Enjoy your movie! 🎬'
          });
        }

        // ─────────────────────────────────────────────────────────────────────
        // Return current playback state
        // ─────────────────────────────────────────────────────────────────────
        callback?.({
          success: true,
          participantCount,
          playbackPosition:
            room.playbackPosition || 0,
          isPlaying:
            room.isPlaying || false
        });

        console.log(
          `[Socket] ${socket.user?.name || 'User'} joined room ${code} (${participantCount}/2)`
        );
      } catch (err) {
        console.error(
          '[Socket room:join]',
          err
        );

        callback?.({
          error: 'Failed to join room'
        });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Room: Leave
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('room:leave', ({ roomCode } = {}) => {
      const code =
        roomCode?.toUpperCase() ||
        socket.currentRoom;

      if (!code) return;

      handleLeave(socket, io, code);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Playback: Play
    // ─────────────────────────────────────────────────────────────────────────
    socket.on(
      'playback:play',
      async ({
        roomCode,
        position,
        timestamp
      } = {}) => {
        try {
          const code =
            roomCode?.toUpperCase() ||
            socket.currentRoom;

          if (!code || socket.currentRoom !== code) {
            return;
          }

          const safePosition =
            Number.isFinite(Number(position))
              ? Number(position)
              : 0;

          await Room.findOneAndUpdate(
            { roomCode: code },
            {
              isPlaying: true,
              playbackPosition: safePosition,
              status: 'playing',
              lastSyncAt: new Date()
            }
          );

          socket.to(code).emit(
            'playback:play',
            {
              position: safePosition,
              timestamp:
                timestamp || Date.now(),
              initiatedBy: socket.id
            }
          );
        } catch (err) {
          console.error(
            '[Socket playback:play]',
            err
          );
        }
      }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Playback: Pause
    // ─────────────────────────────────────────────────────────────────────────
    socket.on(
      'playback:pause',
      async ({
        roomCode,
        position,
        reason,
        timestamp
      } = {}) => {
        try {
          const code =
            roomCode?.toUpperCase() ||
            socket.currentRoom;

          if (!code || socket.currentRoom !== code) {
            return;
          }

          const safePosition =
            Number.isFinite(Number(position))
              ? Number(position)
              : 0;

          await Room.findOneAndUpdate(
            { roomCode: code },
            {
              isPlaying: false,
              playbackPosition: safePosition,
              status: 'paused',
              lastSyncAt: new Date()
            }
          );

          socket.to(code).emit(
            'playback:pause',
            {
              position: safePosition,
              reason: reason || null,
              pausedBy:
                socket.user?.name ||
                'Your partner',
              timestamp:
                timestamp || Date.now(),
              initiatedBy: socket.id
            }
          );
        } catch (err) {
          console.error(
            '[Socket playback:pause]',
            err
          );
        }
      }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Playback: Seek
    // ─────────────────────────────────────────────────────────────────────────
    socket.on(
      'playback:seek',
      async ({
        roomCode,
        position,
        timestamp
      } = {}) => {
        try {
          const code =
            roomCode?.toUpperCase() ||
            socket.currentRoom;

          if (!code || socket.currentRoom !== code) {
            return;
          }

          const safePosition =
            Number.isFinite(Number(position))
              ? Number(position)
              : 0;

          await Room.findOneAndUpdate(
            { roomCode: code },
            {
              playbackPosition: safePosition,
              lastSyncAt: new Date()
            }
          );

          socket.to(code).emit(
            'playback:seek',
            {
              position: safePosition,
              timestamp:
                timestamp || Date.now(),
              initiatedBy: socket.id
            }
          );
        } catch (err) {
          console.error(
            '[Socket playback:seek]',
            err
          );
        }
      }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Playback: Volume
    // ─────────────────────────────────────────────────────────────────────────
    socket.on(
      'playback:volume',
      ({ roomCode, volume } = {}) => {
        const code =
          roomCode?.toUpperCase() ||
          socket.currentRoom;

        if (!code || socket.currentRoom !== code) {
          return;
        }

        const safeVolume = Math.min(
          1,
          Math.max(
            0,
            Number(volume) || 0
          )
        );

        socket.to(code).emit(
          'playback:volume',
          {
            volume: safeVolume,
            changedBy: socket.userId
          }
        );
      }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Chat: Message
    // ─────────────────────────────────────────────────────────────────────────
    socket.on(
      'chat:message',
      ({
        roomCode,
        message,
        imageUrl,
        messageType
      } = {}) => {
        const code =
          roomCode?.toUpperCase() ||
          socket.currentRoom;

        if (!code || socket.currentRoom !== code) {
          return;
        }

        const payload = {
          _id: `${Date.now()}_${socket.id}`,
          senderId: socket.userId,
          senderName:
            socket.user?.name || 'Partner',
          message: message || null,
          imageUrl: imageUrl || null,
          messageType:
            messageType || 'text',
          timestamp: Date.now()
        };

        // Send to everyone, including sender.
        io.to(code).emit(
          'chat:message',
          payload
        );
      }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Chat: Typing
    // ─────────────────────────────────────────────────────────────────────────
    socket.on(
      'chat:typing',
      ({
        roomCode,
        isTyping
      } = {}) => {
        const code =
          roomCode?.toUpperCase() ||
          socket.currentRoom;

        if (!code || socket.currentRoom !== code) {
          return;
        }

        socket.to(code).emit(
          'chat:typing',
          {
            userId: socket.userId,
            name:
              socket.user?.name ||
              'Partner',
            isTyping: Boolean(isTyping)
          }
        );
      }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Chat: Reaction
    // ─────────────────────────────────────────────────────────────────────────
    socket.on(
      'chat:reaction',
      ({
        roomCode,
        messageId,
        emoji
      } = {}) => {
        const code =
          roomCode?.toUpperCase() ||
          socket.currentRoom;

        if (!code || socket.currentRoom !== code) {
          return;
        }

        socket.to(code).emit(
          'chat:reaction',
          {
            messageId,
            emoji,
            userId: socket.userId,
            name:
              socket.user?.name ||
              'Partner'
          }
        );
      }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // WebRTC: Call Offer
    // ─────────────────────────────────────────────────────────────────────────
    socket.on(
      'call:offer',
      ({ roomCode, offer } = {}) => {
        const code =
          roomCode?.toUpperCase() ||
          socket.currentRoom;

        if (!code || socket.currentRoom !== code) {
          return;
        }

        socket.to(code).emit(
          'call:offer',
          {
            offer,
            fromId: socket.id,
            fromUserId: socket.userId
          }
        );
      }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // WebRTC: Call Answer
    // ─────────────────────────────────────────────────────────────────────────
    socket.on(
      'call:answer',
      ({ roomCode, answer } = {}) => {
        const code =
          roomCode?.toUpperCase() ||
          socket.currentRoom;

        if (!code || socket.currentRoom !== code) {
          return;
        }

        socket.to(code).emit(
          'call:answer',
          {
            answer,
            fromId: socket.id
          }
        );
      }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // WebRTC: ICE Candidate
    // ─────────────────────────────────────────────────────────────────────────
    socket.on(
      'call:ice-candidate',
      ({
        roomCode,
        candidate
      } = {}) => {
        const code =
          roomCode?.toUpperCase() ||
          socket.currentRoom;

        if (!code || socket.currentRoom !== code) {
          return;
        }

        socket.to(code).emit(
          'call:ice-candidate',
          {
            candidate,
            fromId: socket.id
          }
        );
      }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Connection: Status
    // ─────────────────────────────────────────────────────────────────────────
    socket.on(
      'connection:status',
      ({
        roomCode,
        status
      } = {}) => {
        const code =
          roomCode?.toUpperCase() ||
          socket.currentRoom;

        if (!code || socket.currentRoom !== code) {
          return;
        }

        socket.to(code).emit(
          'connection:status',
          {
            userId: socket.userId,
            name:
              socket.user?.name ||
              'Partner',
            status
          }
        );
      }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Disconnect
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(
        `[Socket] Disconnected: ${socket.id} | Reason: ${reason}`
      );

      if (socket.currentRoom) {
        handleLeave(
          socket,
          io,
          socket.currentRoom
        );
      }
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────
module.exports = initSocketHandlers;
