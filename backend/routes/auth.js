const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { normalizeCampus, normalizeCourse } = require('../utils/academics');
const router = express.Router();

const isBcryptHash = (value = '') => /^\$2[aby]\$\d{2}\$/.test(value);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toClientUser = (user) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  email: user.email,
  course: normalizeCourse(user.course),
  campus: normalizeCampus(user.campus),
  bio: user.bio,
  avatar: user.avatar,
  lastSeen: user.lastSeen,
  createdAt: user.createdAt
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, course, campus } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ msg: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCourse = normalizeCourse(course);
    const normalizedCampus = normalizeCampus(campus);
    if (course && !normalizedCourse) return res.status(400).json({ msg: 'Please choose a valid NEMSU course' });
    if (campus && !normalizedCampus) return res.status(400).json({ msg: 'Please choose a valid NEMSU campus' });

    let user = await User.findOne({ email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i') });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      course: normalizedCourse,
      campus: normalizedCampus
    });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.json({ token, user: toClientUser(user) });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ msg: 'Email and password are required' });
    }
    const normalizedEmail = email?.trim().toLowerCase();
    const user = await User.findOne({ email: new RegExp(`^${escapeRegex(normalizedEmail || '')}$`, 'i') });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const passwordMatches = isBcryptHash(user.password)
      ? await bcrypt.compare(password, user.password)
      : user.password === password;

    if (!passwordMatches) return res.status(400).json({ msg: 'Invalid credentials' });

    if (!isBcryptHash(user.password)) {
      user.password = await bcrypt.hash(password, 10);
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.json({ token, user: toClientUser(user) });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
