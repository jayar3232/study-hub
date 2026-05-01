const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  course: { type: String, default: '' },
  campus: { type: String, default: '' },
  bio: { type: String, default: '' },
  avatar: { type: String, default: '' },
  coverPhoto: { type: String, default: '' },
  lastSeen: { type: Date, default: null },
  isDeveloper: { type: Boolean, default: false },
  authProvider: { type: String, default: 'local' },
  passwordResetToken: { type: String, default: '' },
  passwordResetExpires: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
