const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['like', 'comment', 'message'], required: true },
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', NotificationSchema);