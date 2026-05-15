const mongoose = require('mongoose');

const MessageAttachmentSchema = new mongoose.Schema({
  fileUrl: { type: String, default: '' },
  fileType: { type: String, enum: ['', 'image', 'video', 'audio', 'file'], default: '' },
  fileName: { type: String, default: '' },
  mimeType: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },
  storagePath: { type: String, default: '' },
  storageProvider: { type: String, enum: ['', 'local', 'supabase'], default: '' }
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },
  editedAt: { type: Date, default: null },
  fileUrl: { type: String, default: '' },
  fileType: { type: String, enum: ['', 'image', 'video', 'audio', 'file'], default: '' },
  fileName: { type: String, default: '' },
  mimeType: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },
  storagePath: { type: String, default: '' },
  storageProvider: { type: String, enum: ['', 'local', 'supabase'], default: '' },
  attachments: { type: [MessageAttachmentSchema], default: [] },
  read: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  pinned: { type: Boolean, default: false },
  unsent: { type: Boolean, default: false },
  unsentAt: { type: Date, default: null },
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reactions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: { type: String }
  }],
  createdAt: { type: Date, default: Date.now }
});

MessageSchema.index({ from: 1, to: 1, createdAt: -1 });
MessageSchema.index({ to: 1, read: 1, unsent: 1, createdAt: -1 });
MessageSchema.index({ from: 1, createdAt: -1 });
MessageSchema.index({ deletedFor: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
