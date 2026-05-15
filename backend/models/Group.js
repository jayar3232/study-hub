const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  subject: { type: String, default: '' },
  photo: { type: String, default: '' },
  photoStoragePath: { type: String, default: '' },
  photoStorageProvider: { type: String, enum: ['', 'local', 'supabase'], default: '' },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  coCreators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // 👈 add this line
  joinCode: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', GroupSchema);
