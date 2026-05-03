const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scope: { type: String, enum: ['group', 'timeline'], default: 'group', index: true },
  privacy: { type: String, enum: ['public', 'friends', 'private'], default: 'public', index: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  fileUrl: { type: String }, // para sa image/file attachment
  fileType: { type: String, enum: ['image', 'video', 'file', ''], default: '' },
  fileName: { type: String, default: '' },
  mimeType: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },
  storagePath: { type: String, default: '' },
  storageProvider: { type: String, enum: ['local', 'supabase', ''], default: '' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pinned: { type: Boolean, default: false, index: true },
  pinnedAt: { type: Date, default: null },
  pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String, required: true },
    date: { type: Date, default: Date.now }
  }],
  reactions: [{                           // ✅ ito ang kailangan para sa react endpoint
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: { type: String }
  }],
  createdAt: { type: Date, default: Date.now }
});

PostSchema.index({ scope: 1, privacy: 1, createdAt: -1 });
PostSchema.index({ groupId: 1, pinned: -1, pinnedAt: -1, createdAt: -1 });
PostSchema.index({ userId: 1, scope: 1, createdAt: -1 });

module.exports = mongoose.model('Post', PostSchema);
