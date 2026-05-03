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

const describeMessage = (message) => {
  if (message.unsent) return 'Message unsent';
  if (message.text?.trim()) return message.text;
  if (message.fileType === 'image') return 'Sent a photo';
  if (message.fileType === 'video') return 'Sent a video';
  if (message.fileType === 'audio') return 'Sent a voice message';
  if (message.fileUrl) return 'Sent a file';
  return 'Message';
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

router.get('/:userId', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { from: req.user, to: req.params.userId },
        { from: req.params.userId, to: req.user }
      ],
      deletedFor: { $ne: req.user }
    }).populate('from', 'name email avatar lastSeen')
      .populate('to', 'name email avatar lastSeen')
      .populate('reactions.userId', 'name avatar')
      .populate({
        path: 'replyTo',
        populate: { path: 'from', select: 'name email avatar lastSeen' }
      })
      .sort('createdAt')
      .lean();
    res.json(messages);
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
      storageProvider = ''
    } = req.body;
    const recipient = await User.findById(to);
    if (!recipient) return res.status(404).json({ msg: 'Recipient not found' });

    const trimmedText = text.trim();
    if (!trimmedText && !fileUrl) {
      return res.status(400).json({ msg: 'Message cannot be empty' });
    }

    const userMessageFolder = `messages/${req.user}/`;
    const safeStoragePath = storageProvider === 'supabase'
      && typeof storagePath === 'string'
      && storagePath.startsWith(userMessageFolder)
      ? storagePath
      : '';

    const message = new Message({
      from: req.user,
      to,
      text: trimmedText,
      replyTo: replyTo || null,
      fileUrl,
      fileType,
      fileName,
      mimeType,
      fileSize,
      storagePath: safeStoragePath,
      storageProvider: safeStoragePath ? 'supabase' : (fileUrl.startsWith('/uploads/messages/') ? 'local' : '')
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
    if (message.fileUrl && !message.text?.trim()) return res.status(400).json({ msg: 'Only text messages can be edited' });

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

    if (message.storageProvider === 'supabase' && message.storagePath) {
      await deleteObject(message.storagePath).catch(err => console.error('Message attachment delete failed:', err.message));
    }

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
