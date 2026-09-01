const { verifyToken } = require('../utils/generateToken');
const Room = require('../models/Room');
const User = require('../models/User');
const UploadSession = require('../models/UploadSession');
const { deleteS3Object } = require('../controllers/uploadController');

// Track active rooms: roomCode → Set of socketIds
const activeRooms = new Map();
const pendingDeletions = new Map(); // roomCode → Timeout

/**
 * Schedule temporary room and movie deletion after both users disconnect (grace period)
 */
const scheduleRoomDeletion = (roomCode, io) => {
  const code = roomCode.toUpperCase();
  
  if (pendingDeletions.has(code)) {
    clearTimeout(pendingDeletions.get(code));
  }

  console.log(`[Room Cleanup] Scheduling deletion for room ${code} in 3 minutes (grace period)...`);

  const timeoutId = setTimeout(async () => {
    pendingDeletions.delete(code);
    try {
      console.log(`[Room Cleanup] Grace period expired. Starting deletion for room ${code}...`);
      const room = await Room.findOne({ roomCode: code });
      
      if (!room) {
        console.log(`[Room Cleanup] Room ${code} not found in database, skipping deletion.`);
        return;
      }

      // Delete S3 movie object
      if (room.moviePublicId) {
        console.log(`[Room Cleanup] Deleting S3 object: ${room.moviePublicId}`);
        await deleteS3Object(room.moviePublicId);
      }

      // Clean up UploadSession records tied to this room
      await UploadSession.deleteMany({
        $or: [
          { roomId: room._id },
          { movieObjectKey: room.moviePublicId }
        ]
      });

      // Delete the room itself from DB
      await Room.deleteOne({ _id: room._id });
      console.log(`[Room Cleanup] Successfully deleted room ${code} and S3 object.`);

      // Emit room ended event to namespace just in case
      io.to(code).emit('room:ended', { message: 'Watch session has ended and the movie has been deleted.' });
    } catch (err) {
      console.error(`[Room Cleanup] Error deleting room ${code}:`, err);
    }
  }, 180000); // 3 minutes grace period

  pendingDeletions.set(code, timeoutId);
};

/**
 * Initialize all Socket.io event handlers
 * @param {import('socket.io').Server} io
 */
const initSocketHandlers = (io) => {
  // ─── Authentication Middleware ─────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;

      if (!token) {
        // Allow unauthenticated connections but mark them
        socket.userId = null;
        socket.user = null;
        return next();
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        socket.userId = null;
        socket.user = null;
        return next();
      }

      const user = await User.findById(decoded.userId).select('name gender');
      socket.userId = decoded.userId;
      socket.user = user;
      next();
    } catch (err) {
      console.error('[Socket Auth]', err.message);
      next(); // Don't block connection, just mark as unauthenticated
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id} | User: ${socket.user?.name || 'Unknown'}`);

    // ─── Room: Join ──────────────────────────────────────────────────────────
    socket.on('room:join', async ({ roomCode }, callback) => {
      try {
        if (!roomCode) return callback?.({ error: 'Room code required' });

        const code = roomCode.toUpperCase();
        const room = await Room.findOne({ roomCode: code });

        if (!room) return callback?.({ error: 'Room not found' });

        // Verify authorization: must be creator or partner
        if (socket.userId) {
          const userIdStr = socket.userId.toString();
          const isCreator = room.creatorId.toString() === userIdStr;
          const isPartner = room.partnerId && room.partnerId.toString() === userIdStr;
          
          if (!isCreator && !isPartner) {
            return callback?.({ error: 'Not authorized to join this room' });
          }
        }

        // Cancel any pending room deletion if someone joins/reconnects
        if (pendingDeletions.has(code)) {
          clearTimeout(pendingDeletions.get(code));
          pendingDeletions.delete(code);
          console.log(`[Room Cleanup] Cancelled pending deletion for room ${code} because participant reconnected.`);
        }

        socket.join(code);
        socket.currentRoom = code;

        // Track participant
        if (!activeRooms.has(code)) activeRooms.set(code, new Set());
        activeRooms.get(code).add(socket.id);

        const participantCount = activeRooms.get(code).size;

        // Notify everyone in the room
        socket.to(code).emit('room:partner_joined', {
          userId: socket.userId,
          name: socket.user?.name || 'Your Partner',
          participantCount,
        });

        // If room is now full (2 people), emit locked
        if (participantCount >= 2) {
          io.to(code).emit('room:locked', { message: 'Room is now full. Enjoy your movie! 🎬' });
        }

        // Send current playback state to new joiner
        callback?.({
          success: true,
          participantCount,
          playbackPosition: room.playbackPosition,
          isPlaying: room.isPlaying,
        });

        console.log(`[Socket] ${socket.user?.name} joined room ${code} (${participantCount}/2)`);
      } catch (err) {
        console.error('[Socket room:join]', err);
        callback?.({ error: 'Failed to join room' });
      }
    });

    // ─── Room: Leave ─────────────────────────────────────────────────────────
    socket.on('room:leave', ({ roomCode }) => {
      handleLeave(socket, io, roomCode);
    });

    // ─── Playback: Play ───────────────────────────────────────────────────────
    socket.on('playback:play', async ({ roomCode, position, timestamp }) => {
      try {
        const code = roomCode?.toUpperCase() || socket.currentRoom;
        if (!code) return;

        // Persist state
        await Room.findOneAndUpdate(
          { roomCode: code },
          { isPlaying: true, playbackPosition: position, lastSyncAt: new Date() }
        );

        socket.to(code).emit('playback:play', {
          position,
          timestamp: timestamp || Date.now(),
          initiatedBy: socket.id,
        });
      } catch (err) {
        console.error('[Socket playback:play]', err);
      }
    });

    // ─── Playback: Pause ──────────────────────────────────────────────────────
    socket.on('playback:pause', async ({ roomCode, position, reason, timestamp }) => {
      try {
        const code = roomCode?.toUpperCase() || socket.currentRoom;
        if (!code) return;

        await Room.findOneAndUpdate(
          { roomCode: code },
          { isPlaying: false, playbackPosition: position, status: 'paused', lastSyncAt: new Date() }
        );

        socket.to(code).emit('playback:pause', {
          position,
          reason: reason || null,
          pausedBy: socket.user?.name || 'Your partner',
          timestamp: timestamp || Date.now(),
          initiatedBy: socket.id,
        });
      } catch (err) {
        console.error('[Socket playback:pause]', err);
      }
    });

    // ─── Playback: Seek ───────────────────────────────────────────────────────
    socket.on('playback:seek', async ({ roomCode, position, timestamp }) => {
      try {
        const code = roomCode?.toUpperCase() || socket.currentRoom;
        if (!code) return;

        await Room.findOneAndUpdate(
          { roomCode: code },
          { playbackPosition: position, lastSyncAt: new Date() }
        );

        socket.to(code).emit('playback:seek', {
          position,
          timestamp: timestamp || Date.now(),
          initiatedBy: socket.id,
        });
      } catch (err) {
        console.error('[Socket playback:seek]', err);
      }
    });

    // ─── Playback: Volume ─────────────────────────────────────────────────────
    socket.on('playback:volume', ({ roomCode, volume }) => {
      const code = roomCode?.toUpperCase() || socket.currentRoom;
      if (!code) return;

      // Volume is local — just relay to partner for awareness
      socket.to(code).emit('playback:volume', {
        volume,
        changedBy: socket.userId,
      });
    });

    // ─── Chat: Message ────────────────────────────────────────────────────────
    socket.on('chat:message', ({ roomCode, message, imageUrl, messageType }) => {
      const code = roomCode?.toUpperCase() || socket.currentRoom;
      if (!code) return;

      const payload = {
        _id: `${Date.now()}_${socket.id}`,
        senderId: socket.userId,
        senderName: socket.user?.name || 'Partner',
        message: message || null,
        imageUrl: imageUrl || null,
        messageType: messageType || 'text',
        timestamp: Date.now(),
      };

      // Send to everyone in room (including sender for confirmation)
      io.to(code).emit('chat:message', payload);
    });

    // ─── Chat: Typing ─────────────────────────────────────────────────────────
    socket.on('chat:typing', ({ roomCode, isTyping }) => {
      const code = roomCode?.toUpperCase() || socket.currentRoom;
      if (!code) return;

      socket.to(code).emit('chat:typing', {
        userId: socket.userId,
        name: socket.user?.name || 'Partner',
        isTyping,
      });
    });

    // ─── Chat: Reaction ───────────────────────────────────────────────────────
    socket.on('chat:reaction', ({ roomCode, messageId, emoji }) => {
      const code = roomCode?.toUpperCase() || socket.currentRoom;
      if (!code) return;

      socket.to(code).emit('chat:reaction', {
        messageId,
        emoji,
        userId: socket.userId,
        name: socket.user?.name || 'Partner',
      });
    });

    // ─── WebRTC: Call Offer ───────────────────────────────────────────────────
    socket.on('call:offer', ({ roomCode, offer }) => {
      const code = roomCode?.toUpperCase() || socket.currentRoom;
      if (!code) return;

      socket.to(code).emit('call:offer', {
        offer,
        fromId: socket.id,
        fromUserId: socket.userId,
      });
    });

    // ─── WebRTC: Call Answer ──────────────────────────────────────────────────
    socket.on('call:answer', ({ roomCode, answer }) => {
      const code = roomCode?.toUpperCase() || socket.currentRoom;
      if (!code) return;

      socket.to(code).emit('call:answer', {
        answer,
        fromId: socket.id,
      });
    });

    // ─── WebRTC: ICE Candidate ────────────────────────────────────────────────
    socket.on('call:ice-candidate', ({ roomCode, candidate }) => {
      const code = roomCode?.toUpperCase() || socket.currentRoom;
      if (!code) return;

      socket.to(code).emit('call:ice-candidate', {
        candidate,
        fromId: socket.id,
      });
    });

    // ─── Connection: Status ───────────────────────────────────────────────────
    socket.on('connection:status', ({ roomCode, status }) => {
      const code = roomCode?.toUpperCase() || socket.currentRoom;
      if (!code) return;

      socket.to(code).emit('connection:status', {
        userId: socket.userId,
        name: socket.user?.name || 'Partner',
        status,
      });
    });

    // ─── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} | Reason: ${reason}`);
      if (socket.currentRoom) {
        handleLeave(socket, io, socket.currentRoom);
      }
    });
  });
};

// ─── Helper: Handle Room Leave ────────────────────────────────────────────────
const handleLeave = (socket, io, roomCode) => {
  if (!roomCode) return;
  const code = roomCode.toUpperCase();

  socket.leave(code);

  if (activeRooms.has(code)) {
    activeRooms.get(code).delete(socket.id);
    if (activeRooms.get(code).size === 0) {
      activeRooms.delete(code);
      // Trigger grace period deletion
      scheduleRoomDeletion(code, io);
    }
  } else {
    // Just in case, try scheduling deletion
    scheduleRoomDeletion(code, io);
  }

  socket.to(code).emit('room:partner_left', {
    userId: socket.userId,
    name: socket.user?.name || 'Your partner',
    message: 'has left the movie date',
  });

  socket.currentRoom = null;
};

module.exports = initSocketHandlers;
