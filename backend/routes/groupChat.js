const express = require('express');
const auth = require('../middleware/auth');
const GroupChat = require('../models/GroupChat');
const Group = require('../models/Group');
const router = express.Router();

// Get all messages for a group (only if user is member)
router.get('/:groupId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ msg: 'Group not found' });
    if (!group.members.includes(req.user)) return res.status(403).json({ msg: 'Not a member' });

    const messages = await GroupChat.find({ groupId: req.params.groupId })
      .populate('userId', 'name avatar')
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Delete a group chat message (only the sender can delete)
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const message = await GroupChat.findById(req.params.messageId);
    if (!message) return res.status(404).json({ msg: 'Message not found' });
    if (message.userId.toString() !== req.user) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    await message.deleteOne();
    res.json({ msg: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Post a message to group chat
router.post('/', auth, async (req, res) => {
  try {
    const { groupId, text, fileUrl, fileType } = req.body;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: 'Group not found' });
    if (!group.members.includes(req.user)) return res.status(403).json({ msg: 'Not a member' });

    const message = new GroupChat({ groupId, userId: req.user, text, fileUrl, fileType });
    await message.save();
    await message.populate('userId', 'name avatar');
    res.json(message);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});
// Delete for me (just add current user to deletedFor)
router.delete('/me/:messageId', auth, async (req, res) => {
  try {
    const message = await GroupChat.findById(req.params.messageId);
    if (!message) return res.status(404).json({ msg: 'Message not found' });
    if (message.userId.toString() !== req.user) {
      return res.status(403).json({ msg: 'Can only delete your own messages' });
    }
    if (!message.deletedFor.includes(req.user)) {
      message.deletedFor.push(req.user);
      await message.save();
    }
    res.json({ msg: 'Message hidden for you' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Unsend for everyone (permanent delete)
router.delete('/everyone/:messageId', auth, async (req, res) => {
  try {
    const message = await GroupChat.findById(req.params.messageId);
    if (!message) return res.status(404).json({ msg: 'Message not found' });
    if (message.userId.toString() !== req.user) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    await message.deleteOne();
    res.json({ msg: 'Message deleted for everyone' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;