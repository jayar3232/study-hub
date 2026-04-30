const express = require('express');
const auth = require('../middleware/auth');
const GroupChat = require('../models/GroupChat');
const Group = require('../models/Group');
const User = require('../models/User');
const router = express.Router();

const isGroupMember = (group, userId) => group.members.some(member => member.toString() === userId);

const markMessagesSeen = async ({ groupId, userId, messageIds = [] }) => {
  const query = {
    groupId,
    userId: { $ne: userId },
    'seenBy.userId': { $ne: userId }
  };

  if (messageIds.length) {
    query._id = { $in: messageIds };
  }

  const messagesToMark = await GroupChat.find(query).select('_id');
  if (messagesToMark.length === 0) return [];

  const ids = messagesToMark.map(message => message._id);
  await GroupChat.updateMany(
    { _id: { $in: ids } },
    { $push: { seenBy: { userId, seenAt: new Date() } } }
  );

  return ids.map(id => id.toString());
};

// Get all messages for a group (only if user is member)
router.get('/:groupId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ msg: 'Group not found' });
    if (!isGroupMember(group, req.user)) return res.status(403).json({ msg: 'Not a member' });

    const newlySeenMessageIds = await markMessagesSeen({
      groupId: req.params.groupId,
      userId: req.user
    });

    const messages = await GroupChat.find({ groupId: req.params.groupId })
      .populate('userId', 'name avatar')
      .populate('seenBy.userId', 'name avatar')
      .sort({ createdAt: 1 });

    if (newlySeenMessageIds.length) {
      const reader = await User.findById(req.user).select('name avatar');
      const io = req.app.get('io');

      if (io && reader) {
        io.to(`group_${req.params.groupId}`).emit('group-messages-seen', {
          groupId: req.params.groupId,
          messageIds: newlySeenMessageIds,
          seenBy: {
            userId: reader,
            seenAt: new Date()
          }
        });
      }
    }

    res.json(messages);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Mark selected or all visible group messages as seen.
router.put('/:groupId/seen', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ msg: 'Group not found' });
    if (!isGroupMember(group, req.user)) return res.status(403).json({ msg: 'Not a member' });

    const messageIds = Array.isArray(req.body.messageIds) ? req.body.messageIds : [];
    const newlySeenMessageIds = await markMessagesSeen({
      groupId: req.params.groupId,
      userId: req.user,
      messageIds
    });
    const reader = await User.findById(req.user).select('name avatar');

    if (newlySeenMessageIds.length && reader) {
      const seenBy = {
        userId: reader,
        seenAt: new Date()
      };
      const io = req.app.get('io');

      if (io) {
        io.to(`group_${req.params.groupId}`).emit('group-messages-seen', {
          groupId: req.params.groupId,
          messageIds: newlySeenMessageIds,
          seenBy
        });
      }

      return res.json({ messageIds: newlySeenMessageIds, seenBy });
    }

    res.json({ messageIds: [], seenBy: null });
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
    if (!isGroupMember(group, req.user)) return res.status(403).json({ msg: 'Not a member' });

    const message = new GroupChat({ groupId, userId: req.user, text, fileUrl, fileType });
    await message.save();
    await message.populate('userId', 'name avatar');
    await message.populate('seenBy.userId', 'name avatar');
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
