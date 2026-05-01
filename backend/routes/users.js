const express = require('express');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { isCloudStorageEnabled, uploadBuffer } = require('../services/storage');
const Group = require('../models/Group');
const Task = require('../models/Task');
const GameSession = require('../models/GameSession');
const { RANK_TIERS, buildLeaderboard, buildRankStats } = require('../services/ranks');
const { buildGameStats } = require('../services/gameRanks');
const router = express.Router();

const avatarUploadDir = path.join(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(avatarUploadDir, { recursive: true });

const isBcryptHash = (value = '') => /^\$2[aby]\$\d{2}\$/.test(value);

const toClientUser = (user) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  email: user.email,
  course: user.course,
  bio: user.bio,
  avatar: user.avatar,
  lastSeen: user.lastSeen,
  isDeveloper: user.isDeveloper,
  createdAt: user.createdAt
});

const localStorage = multer.diskStorage({
  destination: avatarUploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.\w]/g, '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`);
  }
});

const upload = multer({
  storage: isCloudStorageEnabled ? multer.memoryStorage() : localStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) {
      const err = new Error('Please upload an image file');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

const uploadAvatar = (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ msg: 'Avatar must be 5MB or smaller' });
    }

    return res.status(err.status || 400).json({ msg: err.message || 'Upload failed' });
  });
};

router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const { name, course, bio } = req.body;
    if (!name?.trim()) return res.status(400).json({ msg: 'Name is required' });

    const user = await User.findByIdAndUpdate(
      req.user,
      {
        name: name.trim(),
        course: course?.trim() || '',
        bio: bio?.trim() || ''
      },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ msg: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ msg: 'New password must be at least 6 characters' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ msg: 'New password must be different' });
    }

    const user = await User.findById(req.user);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const passwordMatches = isBcryptHash(user.password)
      ? await bcrypt.compare(currentPassword, user.password)
      : user.password === currentPassword;

    if (!passwordMatches) {
      return res.status(400).json({ msg: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ msg: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/avatar', auth, uploadAvatar, async (req, res) => {
  try {
    if (!req.file || req.file.size === 0) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ msg: 'Please upload a valid image file' });
    }

    const uploadedAvatar = isCloudStorageEnabled
      ? await uploadBuffer({
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          folder: `avatars/${req.user}`
        })
      : null;
    const avatarUrl = uploadedAvatar?.url || `/uploads/avatars/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(req.user, { avatar: avatarUrl }, { new: true }).select('-password');
    res.json({ avatar: avatarUrl, user: toClientUser(user) });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

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
    }).select('name email avatar lastSeen').limit(10);
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/rankings/me', auth, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user }).select('members').lean();
    const memberIds = [
      ...new Set([
        req.user,
        ...groups.flatMap(group => (group.members || []).map(member => String(member)))
      ])
    ];

    const [networkUsers, networkTasks, myTasks] = await Promise.all([
      User.find({ _id: { $in: memberIds } }).select('name email course avatar').lean(),
      Task.find({ assignedTo: { $in: memberIds } })
        .select('assignedTo status priority approvalStatus completedAt dueDate')
        .lean(),
      Task.find({ assignedTo: req.user })
        .select('assignedTo status priority approvalStatus completedAt dueDate')
        .lean()
    ]);

    const leaderboard = buildLeaderboard(networkTasks, networkUsers);
    const currentUserRank = leaderboard.find(entry => String(entry.user._id) === String(req.user)) || null;

    res.json({
      me: buildRankStats(myTasks, req.user),
      leaderboard: leaderboard.slice(0, 12),
      currentUserRank,
      totalRanked: leaderboard.length,
      tiers: RANK_TIERS
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/:id/public', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const profile = await User.findById(req.params.id)
      .select('name email course bio avatar lastSeen createdAt');

    if (!profile) return res.status(404).json({ msg: 'User not found' });

    const [sharedWorkspaces, rankTasks, gameSessions] = await Promise.all([
      Group.countDocuments({
        members: { $all: [req.user, profile._id] }
      }),
      Task.find({ assignedTo: profile._id })
        .select('assignedTo status priority approvalStatus completedAt dueDate')
        .lean(),
      GameSession.find({ userId: profile._id, gameKey: 'typing-sprint', completedAt: { $ne: null } })
        .select('score accuracy wpm correctCount totalCount maxStreak elapsedMs completedAt')
        .lean()
    ]);

    res.json({
      ...profile.toObject(),
      sharedWorkspaces,
      rankStats: buildRankStats(rankTasks, profile._id),
      gameStats: buildGameStats(gameSessions)
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
