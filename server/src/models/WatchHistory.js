const mongoose = require('mongoose');

const watchHistorySchema = new mongoose.Schema(
  {
    coupleProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CoupleProfile',
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
    movieName: {
      type: String,
      required: [true, 'Movie name is required'],
      trim: true,
    },
    movieUrl: {
      type: String,
      default: null,
    },
    watchedDate: {
      type: Date,
      default: Date.now,
    },
    duration: {
      type: Number, // seconds watched
      default: 0,
    },
    // Independent ratings from each partner
    rating1: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    rating2: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    review1: {
      type: String,
      maxlength: [1000, 'Review cannot exceed 1000 characters'],
      default: null,
    },
    review2: {
      type: String,
      maxlength: [1000, 'Review cannot exceed 1000 characters'],
      default: null,
    },
    // Which user corresponds to rating1/review1
    user1Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    user2Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    completionStatus: {
      type: String,
      enum: ['completed', 'partial', 'abandoned'],
      default: 'partial',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: average rating
watchHistorySchema.virtual('averageRating').get(function () {
  if (this.rating1 && this.rating2) return (this.rating1 + this.rating2) / 2;
  return this.rating1 || this.rating2 || null;
});

// Indexes
watchHistorySchema.index({ coupleProfileId: 1, watchedDate: -1 });

const WatchHistory = mongoose.model('WatchHistory', watchHistorySchema);

module.exports = WatchHistory;
