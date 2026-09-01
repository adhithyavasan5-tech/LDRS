const mongoose = require('mongoose');

const uploadSessionSchema = new mongoose.Schema(
  {
    uploadId: {
      type: String,
      required: true,
      unique: true,
    },
    movieObjectKey: {
      type: String,
      required: true,
    },
    movieName: {
      type: String,
      required: true,
    },
    movieSize: {
      type: Number,
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['uploading', 'completed', 'aborted'],
      default: 'uploading',
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically delete expired session records from MongoDB
uploadSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const UploadSession = mongoose.model('UploadSession', uploadSessionSchema);

module.exports = UploadSession;
