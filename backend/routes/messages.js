const express = require('express');
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');
const router = express.Router();

// Get conversations list
router.get('/conversations', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ from: req.user }, { to: req.user }]
    }).sort('-createdAt').populate('from', 'name email avatar').populate('to', 'name email avatar');
    
    const usersMap = new Map();
    messages.forEach(msg => {
      const other = msg.from._id.toString() === req.user ? msg.to : msg.from;
      if (!usersMap.has(other._id.toString())) {
        usersMap.set(other._id.toString(), {
          user: other,
          lastMessage: msg.text,
          lastTime: msg.createdAt
        });
      }
    });
    const conversations = Array.from(usersMap.values()).sort((a,b) => b.lastTime - a.lastTime);
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Get messages with a specific user
router.get('/:userId', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { from: req.user, to: req.params.userId },
        { from: req.params.userId, to: req.user }
      ]
    }).populate('from', 'name email avatar')
      .populate('to', 'name email avatar')
      .sort('createdAt');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Send a message
router.post('/', auth, async (req, res) => {
  try {
    const { to, text } = req.body;
    const message = new Message({ from: req.user, to, text });
    await message.save();
    await message.populate('from', 'name email avatar');
    await message.populate('to', 'name email avatar');
    res.json(message);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Pin / unpin a message
router.put('/:messageId/pin', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ msg: 'Message not found' });
    message.pinned = !message.pinned;
    await message.save();
    res.json(message);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Add / remove reaction
router.post('/:messageId/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ msg: 'Message not found' });

    const existing = message.reactions.find(r => r.userId.toString() === req.user);
    if (existing) {
      if (existing.emoji === emoji) {
        // Remove reaction
        message.reactions = message.reactions.filter(r => r.userId.toString() !== req.user);
      } else {
        // Change emoji
        existing.emoji = emoji;
      }
    } else {
      message.reactions.push({ userId: req.user, emoji });
    }
    await message.save();
    res.json(message);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});
// Mark all messages from a specific user as read
router.put('/read/:userId', auth, async (req, res) => {
  try {
    await Message.updateMany(
      { from: req.params.userId, to: req.user, read: false },
      { $set: { read: true } }
    );
    res.json({ msg: 'Messages marked as read' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});


module.exports = router;