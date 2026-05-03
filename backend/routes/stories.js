const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Story = require('../models/Story');
const Message = require('../models/Message');
const { deleteObject, isCloudStorageEnabled, uploadBuffer } = require('../services/storage');
const { createNotification } = require('../services/notifications');
const router = express.Router();

const storyUploadDir = path.join(__dirname, '..', 'uploads', 'stories');
fs.mkdirSync(storyUploadDir, { recursive: true });

const MAX_STORY_UPLOAD_SIZE = 30 * 1024 * 1024;
const STORY_DURATION_MS = 24 * 60 * 60 * 1000;

const getStoryType = (file) => {
  if (file?.mimetype?.startsWith('image/')) return 'image';
  if (file?.mimetype?.startsWith('video/')) return 'video';
  return null;
};

const localStorage = multer.diskStorage({
  destination: storyUploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.\w]/g, '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`);
  }
});

const upload = multer({
  storage: isCloudStorageEnabled ? multer.memoryStorage() : localStorage,
  limits: { fileSize: MAX_STORY_UPLOAD_SIZE },
  fileFilter: (req, file, cb) => {
    if (!getStoryType(file)) {
      const err = new Error('My Day supports images and videos only');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

const uploadStory = (req, res, next) => {
  upload.single('media')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ msg: 'My Day upload is too large. Maximum size is 30MB.' });
    }

    return res.status(err.status || 400).json({ msg: err.message || 'Upload failed' });
  });
};

const activeStoryQuery = () => ({ expiresAt: { $gt: new Date() } });
const populateStory = (query) => query
  .populate('userId', 'name avatar course campus')
  .populate('reactions.userId', 'name avatar')
  .populate('viewers.userId', 'name avatar')
  .populate('comments.userId', 'name avatar')
  .populate('comments.messageId');

const populateStoryDocument = async (story) => {
  await story.populate('userId', 'name avatar course campus');
  await story.populate('reactions.userId', 'name avatar');
  await story.populate('viewers.userId', 'name avatar');
  await story.populate('comments.userId', 'name avatar');
  await story.populate('comments.messageId');
  return story;
};

const populateMessage = (id) => Message.findById(id)
  .populate('from', 'name email avatar lastSeen')
  .populate('to', 'name email avatar lastSeen')
  .populate('reactions.userId', 'name avatar')
  .populate({
    path: 'replyTo',
    populate: { path: 'from', select: 'name email avatar lastSeen' }
  });

const getId = (value) => String(value?._id || value?.id || value || '');

const getStoryTime = (story) => {
  const value = new Date(story?.createdAt || story?.updatedAt || 0).getTime();
  return Number.isNaN(value) ? 0 : value;
};

const toPlainStory = (story) => (typeof story?.toObject === 'function' ? story.toObject() : story);

const groupStoriesByOwner = (stories = []) => {
  const groups = new Map();

  stories
    .map(toPlainStory)
    .sort((a, b) => getStoryTime(b) - getStoryTime(a))
    .forEach(story => {
      const owner = story.userId || {};
      const ownerId = getId(owner) || getId(story.user);
      if (!ownerId) return;
      if (!groups.has(ownerId)) groups.set(ownerId, { ownerId, owner, stories: [] });
      groups.get(ownerId).stories.push(story);
    });

  return Array.from(groups.values()).map(group => ({
    ...group,
    preview: group.stories[0],
    count: group.stories.length
  }));
};

router.get('/active', auth, async (req, res) => {
  try {
    const stories = await populateStory(Story.find(activeStoryQuery()))
      .sort({ createdAt: -1 })
      .limit(150);
    res.json(stories);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/active/grouped', auth, async (req, res) => {
  try {
    const stories = await populateStory(Story.find(activeStoryQuery()))
      .sort({ createdAt: -1 })
      .limit(150);
    const plainStories = stories.map(toPlainStory);
    res.json({ stories: plainStories, groups: groupStoriesByOwner(plainStories) });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/user/:userId', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ msg: 'Invalid user' });
    }

    const stories = await populateStory(Story.find({ ...activeStoryQuery(), userId: req.params.userId }))
      .sort({ createdAt: -1 });
    res.json(stories);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/user/:userId/grouped', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ msg: 'Invalid user' });
    }

    const stories = await populateStory(Story.find({ ...activeStoryQuery(), userId: req.params.userId }))
      .sort({ createdAt: -1 });
    const plainStories = stories.map(toPlainStory);
    res.json({ stories: plainStories, groups: groupStoriesByOwner(plainStories) });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/', auth, uploadStory, async (req, res) => {
  let uploadedFile = null;

  try {
    if (!req.file) return res.status(400).json({ msg: 'No media uploaded' });

    const fileType = getStoryType(req.file);
    uploadedFile = isCloudStorageEnabled
      ? await uploadBuffer({
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          folder: `users/${req.user}/stories`
        })
      : {
          filename: req.file.filename,
          path: '',
          url: `/uploads/stories/${req.file.filename}`
        };

    const story = new Story({
      userId: req.user,
      caption: req.body.caption?.trim() || '',
      fileUrl: uploadedFile.url,
      fileType,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      storagePath: uploadedFile.path,
      storageProvider: isCloudStorageEnabled ? 'supabase' : 'local',
      expiresAt: new Date(Date.now() + STORY_DURATION_MS)
    });

    await story.save();
    await populateStoryDocument(story);
    req.app.get('io')?.emit('story-updated', story);
    res.status(201).json(story);
  } catch (err) {
    if (isCloudStorageEnabled && uploadedFile?.path) {
      await deleteObject(uploadedFile.path).catch(() => {});
    }
    res.status(err.status || 500).json({ msg: err.message });
  }
});

router.post('/:storyId/react', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.storyId)) {
      return res.status(404).json({ msg: 'Story not found' });
    }

    const emoji = String(req.body.emoji || '').trim().slice(0, 8);
    if (!emoji) return res.status(400).json({ msg: 'Emoji is required' });

    const story = await Story.findOne({ _id: req.params.storyId, ...activeStoryQuery() });
    if (!story) return res.status(404).json({ msg: 'Story not found' });

    const existingIndex = (story.reactions || []).findIndex(reaction => String(reaction.userId) === String(req.user));
    if (existingIndex >= 0 && story.reactions[existingIndex].emoji === emoji) {
      story.reactions.splice(existingIndex, 1);
    } else if (existingIndex >= 0) {
      story.reactions[existingIndex].emoji = emoji;
      story.reactions[existingIndex].createdAt = new Date();
    } else {
      story.reactions.push({ userId: req.user, emoji });
    }

    await story.save();
    await populateStoryDocument(story);

    if (String(story.userId?._id || story.userId) !== String(req.user)) {
      await createNotification({
        io: req.app.get('io'),
        userId: story.userId?._id || story.userId,
        actorId: req.user,
        type: 'reaction',
        title: 'Someone reacted to your My Day',
        body: `${emoji} ${story.caption || 'My Day'}`,
        href: `/profile`,
        meta: { storyId: story._id, emoji }
      });
    }

    req.app.get('io')?.emit('story-updated', story);
    res.json(story);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/:storyId/view', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.storyId)) {
      return res.status(404).json({ msg: 'Story not found' });
    }

    const story = await Story.findOne({ _id: req.params.storyId, ...activeStoryQuery() });
    if (!story) return res.status(404).json({ msg: 'Story not found' });

    const viewerIndex = (story.viewers || []).findIndex(viewer => String(viewer.userId) === String(req.user));
    if (viewerIndex >= 0) {
      story.viewers[viewerIndex].viewedAt = new Date();
    } else {
      story.viewers.push({ userId: req.user, viewedAt: new Date() });
    }

    await story.save();
    await populateStoryDocument(story);
    req.app.get('io')?.emit('story-updated', story);
    res.json(story);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/:storyId/comment', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.storyId)) {
      return res.status(404).json({ msg: 'Story not found' });
    }

    const text = String(req.body.text || '').trim().slice(0, 500);
    if (!text) return res.status(400).json({ msg: 'Comment is required' });

    const story = await Story.findOne({ _id: req.params.storyId, ...activeStoryQuery() });
    if (!story) return res.status(404).json({ msg: 'Story not found' });

    const ownerId = story.userId?._id || story.userId;
    if (String(ownerId) === String(req.user)) {
      return res.status(400).json({ msg: 'You cannot reply to your own My Day' });
    }

    const message = new Message({
      from: req.user,
      to: ownerId,
      text: `Replied to your My Day: ${text}`,
      fileUrl: story.fileUrl,
      fileType: story.fileType,
      fileName: story.fileName || 'My Day',
      mimeType: story.mimeType || '',
      fileSize: story.fileSize || 0,
      storagePath: story.storagePath || '',
      storageProvider: story.storageProvider || ''
    });
    await message.save();
    const populatedMessage = await populateMessage(message._id);

    story.comments.push({ userId: req.user, text, messageId: message._id });
    await story.save();
    await populateStoryDocument(story);

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${ownerId}`).emit('receiveMessage', populatedMessage);
      io.to(`user_${req.user}`).emit('receiveMessage', populatedMessage);
      io.emit('story-updated', story);
    }

    await createNotification({
      io,
      userId: ownerId,
      actorId: req.user,
      type: 'message',
      title: 'New My Day reply',
      body: text,
      href: '/messages',
      meta: { storyId: story._id, messageId: message._id }
    });

    res.status(201).json({ story, message: populatedMessage });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.delete('/:storyId', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);
    if (!story) return res.status(404).json({ msg: 'Story not found' });
    if (String(story.userId) !== String(req.user)) {
      return res.status(403).json({ msg: 'You can only delete your own My Day' });
    }

    await story.deleteOne();
    if (story.storageProvider === 'supabase' && story.storagePath) {
      await deleteObject(story.storagePath).catch(() => {});
    } else if (story.fileUrl?.startsWith('/uploads/stories/')) {
      const localPath = path.join(__dirname, '..', story.fileUrl);
      fs.unlink(localPath, () => {});
    }

    req.app.get('io')?.emit('story-deleted', { storyId: story._id, userId: story.userId });
    res.json({ msg: 'Story deleted' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
