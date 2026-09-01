const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      default: null,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    imageUrl: {
      type: String,
      default: null,
    },
    imagePublicId: {
      type: String,
      default: null,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'system'],
      default: 'text',
    },
    reactions: [reactionSchema],
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
