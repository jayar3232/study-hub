const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const storage = multer.diskStorage({
  destination: './uploads/avatars/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Update profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, course } = req.body;
    const user = await User.findByIdAndUpdate(req.user, { name, course }, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Upload avatar
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(req.user, { avatar: avatarUrl }, { new: true });
    res.json({ avatar: avatarUrl });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Search users (for starting new chat)
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const users = await User.find({
      _id: { $ne: req.user },
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    }).select('name email avatar').limit(10);
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;