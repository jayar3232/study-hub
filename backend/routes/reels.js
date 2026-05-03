const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const GalleryItem = require('../models/GalleryItem');
const { deleteObject, isCloudStorageEnabled, uploadBuffer } = require('../services/storage');

const router = express.Router();

const galleryUploadDir = path.join(__dirname, '..', 'uploads', 'gallery');
fs.mkdirSync(galleryUploadDir, { recursive: true });

const MAX_GALLERY_UPLOAD_SIZE = 40 * 1024 * 1024;

const getId = (value) => String(value?._id || value?.id || value || '');

const getGalleryType = (file) => {
  if (file?.mimetype?.startsWith('image/')) return 'image';
  if (file?.mimetype?.startsWith('video/')) return 'video';
  return null;
};

const localStorage = multer.diskStorage({
  destination: galleryUploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.\w]/g, '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`);
  }
});

const upload = multer({
  storage: isCloudStorageEnabled ? multer.memoryStorage() : localStorage,
  limits: { fileSize: MAX_GALLERY_UPLOAD_SIZE },
  fileFilter: (req, file, cb) => {
    if (!getGalleryType(file)) {
      const err = new Error('Gallery supports photos and videos only');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

const uploadGallery = (req, res, next) => {
  upload.single('media')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ msg: 'Gallery upload is too large. Maximum size is 40MB.' });
    }

    return res.status(err.status || 400).json({ msg: err.message || 'Upload failed' });
  });
};

const populateGallery = (query) => query
  .populate('uploadedBy', 'name avatar')
  .populate('comments.userId', 'name avatar')
  .populate('reactions.userId', 'name avatar')
  .populate('viewers.userId', 'name avatar');

const populateGalleryDocument = async (item) => {
  await item.populate('uploadedBy', 'name avatar');
  await item.populate('comments.userId', 'name avatar');
  await item.populate('reactions.userId', 'name avatar');
  await item.populate('viewers.userId', 'name avatar');
  return item;
};

const toPayload = (item, currentUserId) => {
  const plain = typeof item.toObject === 'function' ? item.toObject() : item;
  const itemId = getId(plain);
  const viewerId = getId(currentUserId);
  const reactions = plain.reactions || [];
  const savedBy = plain.savedBy || [];
  const viewers = plain.viewers || [];

  return {
    id: itemId,
    _id: itemId,
    source: 'gallery',
    sourceUrl: plain.fileUrl,
    videoId: itemId,
    embedUrl: plain.fileUrl,
    title: plain.title || 'Gallery item',
    caption: plain.caption || '',
    providerName: 'Gallery',
    mediaType: plain.fileType,
    fileType: plain.fileType,
    fileName: plain.fileName || '',
    uploadedBy: plain.uploadedBy || null,
    reactionCount: reactions.length,
    savedCount: savedBy.length,
    viewCount: viewers.length,
    reacted: reactions.some(reaction => getId(reaction.userId) === viewerId),
    saved: savedBy.some(userId => getId(userId) === viewerId),
    comments: plain.comments || [],
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

const findVisibleGalleryItem = async (itemId) => {
  if (!mongoose.Types.ObjectId.isValid(itemId)) return null;
  return GalleryItem.findById(itemId);
};

router.get('/', auth, async (req, res) => {
  try {
    const items = await populateGallery(GalleryItem.find({}).sort({ createdAt: -1 })).lean();
    const gallery = items.map(item => toPayload(item, req.user));
    res.json({ gallery, memories: gallery, reels: gallery });
  } catch (err) {
    console.error('Gallery feed failed', err);
    res.status(500).json({ msg: 'Failed to load gallery' });
  }
});

router.post('/', auth, uploadGallery, async (req, res) => {
  let uploadedFile = null;

  try {
    const title = String(req.body?.title || '').trim().slice(0, 120);
    const caption = String(req.body?.caption || '').trim().slice(0, 500);
    if (!title) return res.status(400).json({ msg: 'Gallery title is required' });
    if (!req.file) return res.status(400).json({ msg: 'Please choose a photo or video' });

    const fileType = getGalleryType(req.file);
    uploadedFile = isCloudStorageEnabled
      ? await uploadBuffer({
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          folder: 'gallery'
        })
      : {
          filename: req.file.filename,
          path: '',
          url: `/uploads/gallery/${req.file.filename}`
        };

    const item = new GalleryItem({
      title,
      caption,
      fileUrl: uploadedFile.url,
      fileType,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      storagePath: uploadedFile.path,
      storageProvider: isCloudStorageEnabled ? 'supabase' : 'local',
      uploadedBy: req.user
    });

    await item.save();
    await populateGalleryDocument(item);
    res.status(201).json({ reel: toPayload(item, req.user), galleryItem: toPayload(item, req.user) });
  } catch (err) {
    if (isCloudStorageEnabled && uploadedFile?.path) {
      await deleteObject(uploadedFile.path).catch(() => {});
    }
    res.status(err.status || 500).json({ msg: err.message || 'Gallery upload failed' });
  }
});

router.post('/import', auth, (req, res) => {
  res.status(410).json({ msg: 'External imports were removed. Upload photos or videos to Gallery instead.' });
});

router.post('/:itemId/react', auth, async (req, res) => {
  try {
    const item = await findVisibleGalleryItem(req.params.itemId);
    if (!item) return res.status(404).json({ msg: 'Gallery item not found' });

    item.reactions = item.reactions || [];
    const existingIndex = item.reactions.findIndex(reaction => getId(reaction.userId) === getId(req.user));
    if (existingIndex >= 0) item.reactions.splice(existingIndex, 1);
    else item.reactions.push({ userId: req.user, emoji: req.body?.type || 'like' });

    await item.save();
    await populateGalleryDocument(item);
    res.json({ reel: toPayload(item, req.user) });
  } catch (err) {
    console.error('Gallery reaction failed', err);
    res.status(500).json({ msg: 'Failed to update reaction' });
  }
});

router.post('/:itemId/save', auth, async (req, res) => {
  try {
    const item = await findVisibleGalleryItem(req.params.itemId);
    if (!item) return res.status(404).json({ msg: 'Gallery item not found' });

    item.savedBy = item.savedBy || [];
    const existingIndex = item.savedBy.findIndex(userId => getId(userId) === getId(req.user));
    if (existingIndex >= 0) item.savedBy.splice(existingIndex, 1);
    else item.savedBy.push(req.user);

    await item.save();
    await populateGalleryDocument(item);
    res.json({ reel: toPayload(item, req.user) });
  } catch (err) {
    console.error('Gallery save failed', err);
    res.status(500).json({ msg: 'Failed to update saved item' });
  }
});

router.post('/:itemId/view', auth, async (req, res) => {
  try {
    const item = await findVisibleGalleryItem(req.params.itemId);
    if (!item) return res.json({ ok: true });

    item.viewers = item.viewers || [];
    const viewerIndex = item.viewers.findIndex(viewer => getId(viewer.userId) === getId(req.user));
    if (viewerIndex >= 0) item.viewers[viewerIndex].viewedAt = new Date();
    else item.viewers.push({ userId: req.user, viewedAt: new Date() });
    await item.save();
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

router.post('/:itemId/comment', auth, async (req, res) => {
  try {
    const item = await findVisibleGalleryItem(req.params.itemId);
    if (!item) return res.status(404).json({ msg: 'Gallery item not found' });

    const text = String(req.body?.text || '').trim().slice(0, 500);
    if (!text) return res.status(400).json({ msg: 'Comment is required' });

    item.comments.push({ userId: req.user, text });
    await item.save();
    await populateGalleryDocument(item);
    res.status(201).json({ reel: toPayload(item, req.user) });
  } catch (err) {
    console.error('Gallery comment failed', err);
    res.status(500).json({ msg: 'Failed to post comment' });
  }
});

module.exports = router;
