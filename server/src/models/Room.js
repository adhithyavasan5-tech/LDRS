const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomName: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      minlength: [3, 'Room name must be at least 3 characters'],
      maxlength: [100, 'Room name cannot exceed 100 characters'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Room password is required'],
    },
    roomCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      length: 6,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    coupleProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CoupleProfile',
      default: null,
    },
    // Movie metadata (stored in B2/S3, not in MongoDB)
    movieUrl: {
      type: String,
      default: null,
    },
    moviePublicId: {
      type: String,
      default: null,
    },
    movieName: {
      type: String,
      default: null,
    },
    movieSize: {
      type: Number, // bytes
      default: null,
    },
    movieDuration: {
      type: Number, // seconds
      default: null,
    },
    // Subtitles
    subtitleUrl: {
      type: String,
      default: null,
    },
    // Room state
    status: {
      type: String,
      enum: ['waiting', 'active', 'watching', 'paused', 'ended'],
      default: 'waiting',
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    // Playback state for reconnection sync
    playbackPosition: {
      type: Number,
      default: 0,
    },
    isPlaying: {
      type: Boolean,
      default: false,
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
    // Participants tracking
    participants: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        socketId: String,
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
roomSchema.index({ creatorId: 1 });
roomSchema.index({ status: 1 });
roomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;
