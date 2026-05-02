const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Story = require('../models/Story');
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
  .populate('reactions.userId', 'name avatar');

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
    await story.populate('userId', 'name avatar course campus');
    await story.populate('reactions.userId', 'name avatar');
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
    await story.populate('userId', 'name avatar course campus');
    await story.populate('reactions.userId', 'name avatar');

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
