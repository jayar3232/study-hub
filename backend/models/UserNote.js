const mongoose = require('mongoose');

const UserNoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  text: { type: String, required: true, maxlength: 140 },
  expiresAt: { type: Date, required: true, index: true }
}, { timestamps: true });

module.exports = mongoose.models.UserNote || mongoose.model('UserNote', UserNoteSchema);
