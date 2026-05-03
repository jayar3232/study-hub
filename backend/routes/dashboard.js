const express = require('express');
const auth = require('../middleware/auth');
const Group = require('../models/Group');
const Task = require('../models/Task');
const Message = require('../models/Message');

const router = express.Router();

const getId = (value) => String(value?._id || value?.id || value || '');

const describeMessage = (message) => {
  if (!message) return 'Open chat';
  if (message.unsent) return 'Message removed';
  if (message.text) return message.text;
  if (message.fileType === 'image') return 'Photo';
  if (message.fileType === 'video') return 'Video';
  if (message.fileType === 'audio') return 'Voice message';
  if (message.fileUrl) return message.fileName || 'File';
  return 'Open chat';
};

const buildConversations = (messages, userId) => {
  const currentUserId = getId(userId);
  const usersMap = new Map();

  messages.forEach(message => {
    if (!message.from || !message.to) return;

    const fromId = getId(message.from);
    const toId = getId(message.to);
    const other = fromId === currentUserId ? message.to : message.from;
    const otherId = getId(other);
    if (!otherId) return;

    if (!usersMap.has(otherId)) {
      usersMap.set(otherId, {
        user: other,
        lastMessage: describeMessage(message),
        lastTime: message.createdAt,
        unreadCount: 0
      });
    }

    if (toId === currentUserId && !message.read && !message.unsent) {
      usersMap.get(otherId).unreadCount += 1;
    }
  });

  return Array.from(usersMap.values())
    .sort((a, b) => new Date(b.lastTime || 0) - new Date(a.lastTime || 0));
};

router.get('/summary', auth, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user })
      .populate('creator', 'name email avatar')
      .populate('members', 'name email avatar')
      .sort({ createdAt: -1 })
      .lean();

    const groupIds = groups.map(group => group._id);
    const [tasks, messages] = await Promise.all([
      groupIds.length
        ? Task.find({ groupId: { $in: groupIds } })
            .populate('assignedTo', 'name avatar')
            .populate('createdBy', 'name avatar')
            .populate('completedBy', 'name avatar')
            .sort({ createdAt: -1 })
            .lean()
        : [],
      Message.find({
        $or: [{ from: req.user }, { to: req.user }],
        deletedFor: { $ne: req.user }
      })
        .sort('-createdAt')
        .limit(400)
        .populate('from', 'name email avatar lastSeen')
        .populate('to', 'name email avatar lastSeen')
        .lean()
    ]);

    const conversations = buildConversations(messages, req.user);
    const openTasks = tasks.filter(task => task.status !== 'done');
    const assignedOpenTasks = openTasks.filter(task => getId(task.assignedTo) === getId(req.user));
    const unreadMessages = conversations.reduce((sum, conversation) => sum + (conversation.unreadCount || 0), 0);

    res.json({
      groups,
      tasks,
      conversations,
      summary: {
        groupCount: groups.length,
        ownedCount: groups.filter(group => getId(group.creator) === getId(req.user)).length,
        taskCount: tasks.length,
        openTaskCount: openTasks.length,
        assignedOpenTaskCount: assignedOpenTasks.length,
        unreadMessages
      }
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
