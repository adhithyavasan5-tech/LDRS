const mongoose = require('mongoose');

const watchlistItemSchema = new mongoose.Schema({
  movieTitle: {
    type: String,
    required: true,
    trim: true,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isWatched: {
    type: Boolean,
    default: false,
  },
  watchedAt: {
    type: Date,
    default: null,
  },
  notes: {
    type: String,
    maxlength: 500,
    default: null,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const reminderSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['anniversary', 'birthday', 'custom'],
    required: true,
  },
  title: String,
  date: {
    type: Date,
    required: true,
  },
  notifyDaysBefore: {
    type: [Number],
    default: [7, 1, 0], // 7 days, 1 day, on the day
  },
  isRecurring: {
    type: Boolean,
    default: true, // anniversaries repeat yearly
  },
});

const coupleProfileSchema = new mongoose.Schema(
  {
    user1Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    user2Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    coupleNickname: {
      type: String,
      trim: true,
      maxlength: 50,
      default: null,
    },
    relationshipStartDate: {
      type: Date,
      default: null,
    },
    // Stats
    totalMoviesWatched: {
      type: Number,
      default: 0,
    },
    lastMovieWatched: {
      type: String,
      default: null,
    },
    lastWatchedAt: {
      type: Date,
      default: null,
    },
    // Watchlist
    watchlist: [watchlistItemSchema],
    // Reminders (anniversary, birthday, custom)
    reminders: [reminderSchema],
    // Shared preferences
    preferences: {
      defaultSubtitleLanguage: {
        type: String,
        default: 'en',
      },
      autoSyncPlayback: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: days together
coupleProfileSchema.virtual('daysTogether').get(function () {
  if (!this.relationshipStartDate) return null;
  const diff = Date.now() - new Date(this.relationshipStartDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// Indexes
coupleProfileSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });

const CoupleProfile = mongoose.model('CoupleProfile', coupleProfileSchema);

module.exports = CoupleProfile;
