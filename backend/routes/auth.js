const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Register – store plain text password
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, course } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    // Store password as plain text (no hashing)
    user = new User({ name, email, password, course });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user._id, name, email } });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Login – compare plain text
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    // Direct string comparison (no bcrypt)
    if (user.password !== password) return res.status(400).json({ msg: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user._id, name: user.name, email } });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;