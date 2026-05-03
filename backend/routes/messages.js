const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');
const { deleteObject, isCloudStorageEnabled, uploadBuffer } = require('../services/storage');
const { createNotification } = require('../services/notifications');
const router = express.Router();

const messageUploadDir = path.join(__dirname, '..', 'uploads', 'messages');
fs.mkdirSync(messageUploadDir, { recursive: true });

const MAX_MESSAGE_UPLOAD_SIZE = 25 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set(['.bat', '.cmd', '.com', '.exe', '.msi', '.ps1', '.scr', '.sh']);
const DEFAULT_MESSAGE_PAGE_LIMIT = 80;
const MAX_MESSAGE_PAGE_LIMIT = 200;

const normalizeId = (value) => String(value?._id || value?.id || value || '');

const localStorage = multer.diskStorage({
  destination: messageUploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.\w]/g, '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`);
  }
});

const upload = multer({
  storage: isCloudStorageEnabled ? multer.memoryStorage() : localStorage,
  limits: { fileSize: MAX_MESSAGE_UPLOAD_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      const err = new Error('This file type is not allowed');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

const uploadSingleFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ msg: 'File is too large. Maximum size is 25MB.' });
    }

    return res.status(err.status || 400).json({ msg: err.message || 'Upload failed' });
  });
};

const getFileType = (file) => {
  const mimeType = file?.mimetype || '';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
};

const populateMessage = (messageId) => Message.findById(messageId)
  .populate('from', 'name email avatar lastSeen')
  .populate('to', 'name email avatar lastSeen')
  .populate('reactions.userId', 'name avatar')
  .populate({
    path: 'replyTo',
    populate: { path: 'from', select: 'name email avatar lastSeen' }
  })
  .lean();

const isParticipant = (message, userId) => (
  normalizeId(message?.from) === userId || normalizeId(message?.to) === userId
);

const getMessageAttachments = (message = {}) => {
  const attachments = Array.isArray(message.attachments) ? message.attachments.filter(item => item?.fileUrl) : [];
  if (attachments.length) return attachments;
  if (!message.fileUrl) return [];
  return [{
    fileUrl: message.fileUrl,
    fileType: message.fileType,
    fileName: message.fileName,
    mimeType: message.mimeType,
    fileSize: message.fileSize,
    storagePath: message.storagePath,
    storageProvider: message.storageProvider
  }];
};

const sanitizeAttachment = (attachment = {}, userId = '') => {
  const fileUrl = String(attachment.fileUrl || '').trim();
  if (!fileUrl) return null;

  const fileType = ['image', 'video', 'audio', 'file'].includes(attachment.fileType) ? attachment.fileType : 'file';
  const storageProvider = attachment.storageProvider === 'supabase' ? 'supabase' : '';
  const userMessageFolder = `messages/${userId}/`;
  const storagePath = storageProvider === 'supabase'
    && typeof attachment.storagePath === 'string'
    && attachment.storagePath.startsWith(userMessageFolder)
    ? attachment.storagePath
    : '';

  return {
    fileUrl,
    fileType,
    fileName: String(attachment.fileName || '').slice(0, 240),
    mimeType: String(attachment.mimeType || '').slice(0, 120),
    fileSize: Math.max(0, Number(attachment.fileSize) || 0),
    storagePath,
    storageProvider: storagePath ? 'supabase' : (fileUrl.startsWith('/uploads/messages/') ? 'local' : '')
  };
};

const describeMessage = (message) => {
  const attachments = getMessageAttachments(message);
  if (message.unsent) return 'Message unsent';
  if (message.text?.trim()) return message.text;
  if (attachments.length > 1) {
    const mediaCount = attachments.filter(item => ['image', 'video'].includes(item.fileType)).length;
    return mediaCount === attachments.length
      ? `Sent ${attachments.length} photos/videos`
      : `Sent ${attachments.length} attachments`;
  }
  if (message.fileType === 'image') return 'Sent a photo';
  if (message.fileType === 'video') return 'Sent a video';
  if (message.fileType === 'audio') return 'Sent a voice message';
  if (message.fileUrl) return 'Sent a file';
  return 'Message';
};

const parseMessageLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MESSAGE_PAGE_LIMIT;
  return Math.max(20, Math.min(MAX_MESSAGE_PAGE_LIMIT, Math.floor(parsed)));
};

const emitMessageUpdated = (req, message) => {
  const io = req.app.get('io');
  if (!io || !message) return;

  io.to(`user_${normalizeId(message.from)}`).emit('message-updated', message);
  io.to(`user_${normalizeId(message.to)}`).emit('message-updated', message);
};

router.post('/upload', auth, uploadSingleFile, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });

    const uploadedFile = isCloudStorageEnabled
      ? await uploadBuffer({
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          folder: `messages/${req.user}`
        })
      : {
          filename: req.file.filename,
          path: '',
          url: `/uploads/messages/${req.file.filename}`
        };

    res.status(201).json({
      fileUrl: uploadedFile.url,
      fileType: getFileType(req.file),
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      storagePath: uploadedFile.path,
      storageProvider: isCloudStorageEnabled ? 'supabase' : 'local'
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/conversations', auth, async (req, res) => {
  try {
    const currentUserId = new mongoose.Types.ObjectId(req.user);
    const rows = await Message.aggregate([
      {
        $match: {
          $or: [{ from: currentUserId }, { to: currentUserId }],
          deletedFor: { $ne: currentUserId }
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ['$from', currentUserId] }, '$to', '$from']
          },
          lastMessageDoc: {
            $first: {
              text: '$text',
              fileType: '$fileType',
              fileUrl: '$fileUrl',
              attachments: '$attachments',
              unsent: '$unsent',
              createdAt: '$createdAt'
            }
          },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$to', currentUserId] },
                    { $eq: ['$read', false] },
                    { $eq: ['$unsent', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          user: {
            _id: '$user._id',
            name: '$user.name',
            email: '$user.email',
            avatar: '$user.avatar',
            lastSeen: '$user.lastSeen'
          },
          lastMessageDoc: 1,
          lastTime: '$lastMessageDoc.createdAt',
          unreadCount: 1
        }
      },
      { $sort: { lastTime: -1 } }
    ]);

    const conversations = rows.map((item) => ({
      user: item.user,
      lastMessage: describeMessage(item.lastMessageDoc || {}),
      lastTime: item.lastTime,
      unreadCount: item.unreadCount || 0
    }));
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.delete('/conversation/:userId', auth, async (req, res) => {
  try {
    const otherUser = await User.findById(req.params.userId);
    if (!otherUser) return res.status(404).json({ msg: 'User not found' });

    await Message.updateMany(
      {
        $or: [
          { from: req.user, to: req.params.userId },
          { from: req.params.userId, to: req.user }
        ],
        deletedFor: { $ne: req.user }
      },
      { $push: { deletedFor: req.user } }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${req.user}`).emit('conversation-deleted', { userId: req.params.userId });
    }

    res.json({ msg: 'Conversation deleted for you' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

const getDayKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const shiftDayKey = (dayKey, amount) => {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return getDayKey(date);
};

const computeLongestStreak = (dayKeys = []) => {
  let longest = 0;
  let current = 0;
  let previous = '';

  [...dayKeys].sort().forEach(dayKey => {
    current = previous && shiftDayKey(previous, 1) === dayKey ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = dayKey;
  });

  return longest;
};

router.get('/streak/:userId', auth, async (req, res) => {
  try {
    const otherUser = await User.findById(req.params.userId).select('_id');
    if (!otherUser) return res.status(404).json({ msg: 'User not found' });

    const messages = await Message.find({
      $or: [
        { from: req.user, to: req.params.userId },
        { from: req.params.userId, to: req.user }
      ],
      unsent: false,
      deletedFor: { $ne: req.user }
    }).select('from createdAt').sort({ createdAt: 1 }).lean();

    const currentUserId = normalizeId(req.user);
    const otherUserId = normalizeId(req.params.userId);
    const dayMap = new Map();

    messages.forEach(message => {
      const dayKey = getDayKey(message.createdAt);
      if (!dayKey) return;
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, new Set());
      dayMap.get(dayKey).add(normalizeId(message.from));
    });

    const mutualDays = [...dayMap.entries()]
      .filter(([, senders]) => senders.has(currentUserId) && senders.has(otherUserId))
      .map(([dayKey]) => dayKey);
    const mutualDaySet = new Set(mutualDays);
    const todayKey = getDayKey(new Date());
    const yesterdayKey = shiftDayKey(todayKey, -1);
    let anchorDay = mutualDaySet.has(todayKey) ? todayKey : (mutualDaySet.has(yesterdayKey) ? yesterdayKey : '');
    let currentStreak = 0;

    while (anchorDay && mutualDaySet.has(anchorDay)) {
      currentStreak += 1;
      anchorDay = shiftDayKey(anchorDay, -1);
    }

    res.json({
      currentStreak,
      longestStreak: computeLongestStreak(mutualDays),
      mutualDays: mutualDays.length,
      todayActive: mutualDaySet.has(todayKey),
      lastMutualDay: mutualDays[mutualDays.length - 1] || null
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/:userId', auth, async (req, res) => {
  try {
    const query = {
      $or: [
        { from: req.user, to: req.params.userId },
        { from: req.params.userId, to: req.user }
      ],
      deletedFor: { $ne: req.user }
    };

    const beforeDate = req.query.before ? new Date(req.query.before) : null;
    if (beforeDate && !Number.isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }

    const usePagination = req.query.paginated === '1' || Boolean(req.query.before) || Boolean(req.query.limit);
    if (!usePagination) {
      const messages = await Message.find(query).populate('from', 'name email avatar lastSeen')
        .populate('to', 'name email avatar lastSeen')
        .populate('reactions.userId', 'name avatar')
        .populate({
          path: 'replyTo',
          populate: { path: 'from', select: 'name email avatar lastSeen' }
        })
        .sort('createdAt')
        .lean();
      return res.json(messages);
    }

    const limit = parseMessageLimit(req.query.limit);
    const page = await Message.find(query).populate('from', 'name email avatar lastSeen')
      .populate('to', 'name email avatar lastSeen')
      .populate('reactions.userId', 'name avatar')
      .populate({
        path: 'replyTo',
        populate: { path: 'from', select: 'name email avatar lastSeen' }
      })
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = page.length > limit;
    const currentPage = hasMore ? page.slice(0, limit) : page;
    const items = currentPage.reverse();
    const oldestInPage = items[0];

    return res.json({
      items,
      hasMore,
      nextCursor: hasMore ? oldestInPage?.createdAt || null : null
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const {
      to,
      text = '',
      replyTo,
      fileUrl = '',
      fileType = '',
      fileName = '',
      mimeType = '',
      fileSize = 0,
      storagePath = '',
      storageProvider = '',
      attachments = []
    } = req.body;
    const recipient = await User.findById(to);
    if (!recipient) return res.status(404).json({ msg: 'Recipient not found' });

    const trimmedText = text.trim();
    const postedAttachments = Array.isArray(attachments)
      ? attachments.map(item => sanitizeAttachment(item, req.user)).filter(Boolean)
      : [];
    const legacyAttachment = sanitizeAttachment({
      fileUrl,
      fileType,
      fileName,
      mimeType,
      fileSize,
      storagePath,
      storageProvider
    }, req.user);
    const normalizedAttachments = postedAttachments.length
      ? postedAttachments
      : (legacyAttachment ? [legacyAttachment] : []);
    const primaryAttachment = normalizedAttachments[0] || null;

    if (!trimmedText && normalizedAttachments.length === 0) {
      return res.status(400).json({ msg: 'Message cannot be empty' });
    }

    const message = new Message({
      from: req.user,
      to,
      text: trimmedText,
      replyTo: replyTo || null,
      fileUrl: primaryAttachment?.fileUrl || '',
      fileType: primaryAttachment?.fileType || '',
      fileName: primaryAttachment?.fileName || '',
      mimeType: primaryAttachment?.mimeType || '',
      fileSize: primaryAttachment?.fileSize || 0,
      storagePath: primaryAttachment?.storagePath || '',
      storageProvider: primaryAttachment?.storageProvider || '',
      attachments: normalizedAttachments
    });
    await message.save();

    const populatedMessage = await populateMessage(message._id);
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${to}`).emit('receiveMessage', populatedMessage);
      io.to(`user_${req.user}`).emit('receiveMessage', populatedMessage);
    }

    await createNotification({
      io,
      userId: to,
      actorId: req.user,
      type: 'message',
      title: 'New message',
      body: describeMessage(message),
      href: '/messages',
      meta: { messageId: message._id, from: req.user }
    });

    res.status(201).json(populatedMessage);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/read/:userId', auth, async (req, res) => {
  try {
    const readAt = new Date();
    const result = await Message.updateMany(
      {
        from: req.params.userId,
        to: req.user,
        read: false,
        unsent: false,
        deletedFor: { $ne: req.user }
      },
      { $set: { read: true, readAt } }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${req.params.userId}`).emit('messages-read', {
        readerId: req.user,
        senderId: req.params.userId,
        readAt
      });
    }

    res.json({
      msg: 'Messages marked as read',
      modifiedCount: result.modifiedCount || 0,
      readAt
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/:messageId/pin', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ msg: 'Message not found' });
    if (!isParticipant(message, req.user)) return res.status(403).json({ msg: 'Not authorized' });

    message.pinned = !message.pinned;
    await message.save();
    const populatedMessage = await populateMessage(message._id);
    emitMessageUpdated(req, populatedMessage);
    res.json(populatedMessage);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/:messageId', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ msg: 'Message not found' });
    if (normalizeId(message.from) !== req.user) return res.status(403).json({ msg: 'Only the sender can edit this message' });
    if (message.unsent) return res.status(400).json({ msg: 'Cannot edit an unsent message' });
    if ((message.fileUrl || message.attachments?.length) && !message.text?.trim()) {
      return res.status(400).json({ msg: 'Only text messages can be edited' });
    }

    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ msg: 'Message cannot be empty' });
    if (text.length > 4000) return res.status(400).json({ msg: 'Message is too long' });

    message.text = text;
    message.editedAt = new Date();
    await message.save();

    const populatedMessage = await populateMessage(message._id);
    emitMessageUpdated(req, populatedMessage);
    res.json(populatedMessage);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/:messageId/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ msg: 'Message not found' });
    if (!isParticipant(message, req.user)) return res.status(403).json({ msg: 'Not authorized' });
    if (message.unsent) return res.status(400).json({ msg: 'Cannot react to an unsent message' });

    const existing = message.reactions.find(r => r.userId.toString() === req.user);
    if (existing) {
      if (existing.emoji === emoji) {
        message.reactions = message.reactions.filter(r => r.userId.toString() !== req.user);
      } else {
        existing.emoji = emoji;
      }
    } else {
      message.reactions.push({ userId: req.user, emoji });
    }
    await message.save();
    const populatedMessage = await populateMessage(message._id);
    emitMessageUpdated(req, populatedMessage);
    res.json(populatedMessage);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.delete('/:messageId/me', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ msg: 'Message not found' });
    if (!isParticipant(message, req.user)) return res.status(403).json({ msg: 'Not authorized' });

    if (!message.deletedFor.some(userId => userId.toString() === req.user)) {
      message.deletedFor.push(req.user);
      await message.save();
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${req.user}`).emit('message-hidden', { messageId: req.params.messageId });
    }

    res.json({ msg: 'Message removed for you', messageId: req.params.messageId });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.delete('/:messageId/everyone', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ msg: 'Message not found' });
    if (normalizeId(message.from) !== req.user) return res.status(403).json({ msg: 'Only the sender can unsend this message' });

    const storagePaths = new Set();
    if (message.storageProvider === 'supabase' && message.storagePath) storagePaths.add(message.storagePath);
    getMessageAttachments(message).forEach(attachment => {
      if (attachment.storageProvider === 'supabase' && attachment.storagePath) storagePaths.add(attachment.storagePath);
    });
    await Promise.all([...storagePaths].map(storagePath => (
      deleteObject(storagePath).catch(err => console.error('Message attachment delete failed:', err.message))
    )));

    message.unsent = true;
    message.unsentAt = new Date();
    message.text = '';
    message.fileUrl = '';
    message.fileType = '';
    message.fileName = '';
    message.mimeType = '';
    message.fileSize = 0;
    message.storagePath = '';
    message.storageProvider = '';
    message.attachments = [];
    message.reactions = [];
    await message.save();

    const populatedMessage = await populateMessage(message._id);
    emitMessageUpdated(req, populatedMessage);
    res.json(populatedMessage);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
