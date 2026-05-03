const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const Group = require('../models/Group');
const Friendship = require('../models/Friendship');
const { createNotification, createNotifications } = require('../services/notifications');
const { createGroupActivity } = require('../services/activity');
const { getMentionedMemberIds } = require('../services/mentions');
const { isCloudStorageEnabled, uploadBuffer } = require('../services/storage');
const router = express.Router();

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const postUploadDir = path.join(__dirname, '..', 'uploads', 'posts');
fs.mkdirSync(postUploadDir, { recursive: true });

const MAX_POST_UPLOAD_SIZE = 35 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set(['.bat', '.cmd', '.com', '.exe', '.msi', '.ps1', '.scr', '.sh']);

const normalizeId = (value) => String(value?._id || value?.id || value || '');
const parseLimit = (value, fallback = 60, max = 100) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(number)));
};

const localStorage = multer.diskStorage({
  destination: postUploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.\w]/g, '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`);
  }
});

const upload = multer({
  storage: isCloudStorageEnabled ? multer.memoryStorage() : localStorage,
  limits: { fileSize: MAX_POST_UPLOAD_SIZE },
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

const uploadPostMedia = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ msg: 'Post upload is too large. Maximum size is 35MB.' });
    }

    return res.status(err.status || 400).json({ msg: err.message || 'Upload failed' });
  });
};

const getFileType = (file) => {
  const mimeType = file?.mimetype || '';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'file';
};

const normalizePrivacy = (value) => {
  const normalized = String(value || '').toLowerCase().replace(/[-\s]/g, '_');
  if (normalized === 'friends') return 'friends';
  if (['private', 'only_me', 'onlyme'].includes(normalized)) return 'private';
  return 'public';
};

const findMemberGroup = async (groupId, userId) => {
  if (!isValidObjectId(groupId)) return null;
  return Group.findOne({ _id: groupId, members: userId });
};

const ensurePostMember = async (post, userId) => {
  if (!post) return null;
  return findMemberGroup(post.groupId, userId);
};

const canManageGroup = (group, userId) => (
  group?.creator?.toString() === userId || group?.coCreators?.some(member => member.toString() === userId)
);

const getAcceptedFriendIds = async (userId) => {
  const rows = await Friendship.find({
    status: 'accepted',
    $or: [{ requester: userId }, { recipient: userId }]
  }).select('requester recipient').lean();

  return rows.map(row => {
    const requester = normalizeId(row.requester);
    const recipient = normalizeId(row.recipient);
    return requester === normalizeId(userId) ? recipient : requester;
  }).filter(Boolean);
};

const areFriends = async (a, b) => {
  if (!a || !b) return false;
  return Boolean(await Friendship.exists({
    status: 'accepted',
    $or: [
      { requester: a, recipient: b },
      { requester: b, recipient: a }
    ]
  }));
};

const isTimelinePost = (post) => post?.scope === 'timeline' || !post?.groupId;

const canViewTimelinePost = async (post, userId) => {
  const ownerId = normalizeId(post.userId);
  if (ownerId === normalizeId(userId)) return true;
  if (post.privacy === 'public') return true;
  if (post.privacy === 'friends') return areFriends(ownerId, userId);
  return false;
};

const ensurePostViewer = async (post, userId) => {
  if (!post) return null;
  if (!isTimelinePost(post)) return ensurePostMember(post, userId);
  return canViewTimelinePost(post, userId);
};

const populatePost = async (post) => {
  await post.populate('groupId', 'name subject description');
  await post.populate('userId', 'name avatar');
  await post.populate('comments.userId', 'name avatar');
  await post.populate('reactions.userId', 'name avatar');
  return post;
};

router.post('/upload', auth, uploadPostMedia, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });

    const uploadedFile = isCloudStorageEnabled
      ? await uploadBuffer({
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          folder: `posts/${req.user}`
        })
      : {
          filename: req.file.filename,
          path: '',
          url: `/uploads/posts/${req.file.filename}`
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

router.get('/home', auth, async (req, res) => {
  try {
    const friendIds = await getAcceptedFriendIds(req.user);
    const limit = parseLimit(req.query.limit, 36, 80);
    const posts = await Post.find({
      scope: 'timeline',
      $or: [
        { userId: req.user },
        { privacy: 'public' },
        { privacy: 'friends', userId: { $in: friendIds } }
      ]
    })
      .populate('userId', 'name avatar')
      .populate('comments.userId', 'name avatar')
      .populate('reactions.userId', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(posts);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/home', auth, async (req, res) => {
  try {
    const { content, fileUrl, fileType, fileName, mimeType, fileSize, storagePath, storageProvider } = req.body;
    const text = String(content || '').trim();
    if (!text && !fileUrl) return res.status(400).json({ msg: 'Write something or attach media first' });

    const post = new Post({
      groupId: null,
      scope: 'timeline',
      privacy: normalizePrivacy(req.body.privacy),
      userId: req.user,
      title: String(req.body.title || text || 'Timeline post').trim().slice(0, 120),
      content: text || 'Shared media',
      fileUrl: fileUrl || '',
      fileType: ['image', 'video', 'file'].includes(fileType) ? fileType : '',
      fileName: fileName || '',
      mimeType: mimeType || '',
      fileSize: Number(fileSize || 0),
      storagePath: storagePath || '',
      storageProvider: ['local', 'supabase'].includes(storageProvider) ? storageProvider : ''
    });

    await post.save();
    res.status(201).json(await populatePost(post));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/feed', auth, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user }).select('_id');
    const groupIds = groups.map(group => group._id);
    if (!groupIds.length) return res.json([]);
    const limit = parseLimit(req.query.limit, 36, 100);

    const posts = await Post.find({ groupId: { $in: groupIds } })
      .populate('groupId', 'name subject description')
      .populate('userId', 'name avatar')
      .populate('comments.userId', 'name avatar')
      .populate('reactions.userId', 'name avatar')
      .sort({ pinned: -1, pinnedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(posts);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const group = await findMemberGroup(req.params.groupId, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });
    const limit = parseLimit(req.query.limit, 80, 180);

    const posts = await Post.find({ groupId: req.params.groupId })
      .populate('groupId', 'name subject description')
      .populate('userId', 'name avatar')
      .populate('comments.userId', 'name avatar')
      .populate('reactions.userId', 'name avatar')
      .sort({ pinned: -1, pinnedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(posts);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { groupId, title, content, fileUrl } = req.body;
    const group = await findMemberGroup(groupId, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ msg: 'Title and content are required' });
    }

    const post = new Post({
      groupId,
      scope: 'group',
      privacy: 'private',
      userId: req.user,
      title: title.trim(),
      content: content.trim(),
      fileUrl
    });
    await post.save();
    await createGroupActivity({
      groupId,
      actorId: req.user,
      type: 'post',
      title: 'published a post',
      detail: title.trim(),
      targetId: post._id,
      targetModel: 'Post'
    });
    await createNotifications({
      io: req.app.get('io'),
      userIds: group.members,
      actorId: req.user,
      type: 'post',
      title: `${group.name}: new post`,
      body: title.trim(),
      href: `/group/${groupId}`,
      meta: { groupId, postId: post._id }
    });
    const mentionedUserIds = await getMentionedMemberIds(group, `${title} ${content}`);
    if (mentionedUserIds.length) {
      await createNotifications({
        io: req.app.get('io'),
        userIds: mentionedUserIds,
        actorId: req.user,
        type: 'post',
        title: `${group.name}: you were mentioned`,
        body: title.trim(),
        href: `/group/${groupId}`,
        meta: { groupId, postId: post._id, mention: true }
      });
    }
    res.status(201).json(await populatePost(post));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/:postId/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });
    const access = await ensurePostViewer(post, req.user);
    if (!access) return res.status(403).json({ msg: 'You cannot view this post' });

    const index = post.likes.findIndex(userId => userId.toString() === req.user);
    if (index === -1) post.likes.push(req.user);
    else post.likes.splice(index, 1);
    await post.save();
    res.json(await populatePost(post));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/:postId/comment', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });
    const access = await ensurePostViewer(post, req.user);
    if (!access) return res.status(403).json({ msg: 'You cannot view this post' });
    if (!text?.trim()) return res.status(400).json({ msg: 'Comment is required' });

    post.comments.push({ userId: req.user, text: text.trim() });
    await post.save();
    const group = isTimelinePost(post) ? null : access;
    if (group) {
      await createGroupActivity({
        groupId: post.groupId,
        actorId: req.user,
        type: 'comment',
        title: 'commented on a post',
        detail: post.title,
        targetId: post._id,
        targetModel: 'Post'
      });
    }
    await createNotification({
      io: req.app.get('io'),
      userId: post.userId,
      actorId: req.user,
      type: 'comment',
      title: 'New comment on your post',
      body: text.trim(),
      href: group ? `/group/${post.groupId}` : '/dashboard',
      meta: { groupId: post.groupId, postId: post._id }
    });
    const mentionedUserIds = group ? await getMentionedMemberIds(group, text) : [];
    if (mentionedUserIds.length) {
      await createNotifications({
        io: req.app.get('io'),
        userIds: mentionedUserIds,
        actorId: req.user,
        type: 'comment',
        title: `${group.name}: you were mentioned`,
        body: text.trim(),
        href: `/group/${post.groupId}`,
        meta: { groupId: post.groupId, postId: post._id, mention: true }
      });
    }
    res.json(await populatePost(post));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/:postId/pin', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });
    const group = await ensurePostMember(post, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });
    if (!canManageGroup(group, req.user)) return res.status(403).json({ msg: 'Only workspace admins can pin announcements' });

    post.pinned = !post.pinned;
    post.pinnedAt = post.pinned ? new Date() : null;
    post.pinnedBy = post.pinned ? req.user : null;
    await post.save();

    await createGroupActivity({
      groupId: post.groupId,
      actorId: req.user,
      type: 'post',
      title: post.pinned ? 'pinned an announcement' : 'unpinned an announcement',
      detail: post.title,
      targetId: post._id,
      targetModel: 'Post'
    });

    res.json(await populatePost(post));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.delete('/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });

    if (isTimelinePost(post)) {
      if (normalizeId(post.userId) !== normalizeId(req.user)) {
        return res.status(403).json({ msg: 'Not authorized' });
      }
      await post.deleteOne();
      return res.json({ msg: 'Post deleted' });
    }

    const group = await ensurePostMember(post, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });

    const isPostCreator = post.userId.toString() === req.user;
    const isGroupCreator = group.creator.toString() === req.user;
    const isCoCreator = group.coCreators?.some(c => c.toString() === req.user);
    if (!isPostCreator && !isGroupCreator && !isCoCreator) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    await post.deleteOne();
    res.json({ msg: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/:postId/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });
    const access = await ensurePostViewer(post, req.user);
    if (!access) return res.status(403).json({ msg: 'You cannot view this post' });
    if (!emoji?.trim()) return res.status(400).json({ msg: 'Reaction is required' });

    if (!post.reactions) post.reactions = [];
    const existingIndex = post.reactions.findIndex(r => r.userId.toString() === req.user);
    if (existingIndex !== -1) {
      if (post.reactions[existingIndex].emoji === emoji) {
        post.reactions.splice(existingIndex, 1);
      } else {
        post.reactions[existingIndex].emoji = emoji;
      }
    } else {
      post.reactions.push({ userId: req.user, emoji });
    }
    await post.save();
    const group = isTimelinePost(post) ? null : access;
    if (group) {
      await createGroupActivity({
        groupId: post.groupId,
        actorId: req.user,
        type: 'reaction',
        title: 'reacted to a post',
        detail: post.title,
        targetId: post._id,
        targetModel: 'Post'
      });
    }
    await createNotification({
      io: req.app.get('io'),
      userId: post.userId,
      actorId: req.user,
      type: 'reaction',
      title: 'New reaction on your post',
      body: `${emoji} ${post.title}`,
      href: group ? `/group/${post.groupId}` : '/dashboard',
      meta: { groupId: post.groupId, postId: post._id }
    });
    res.json(await populatePost(post));
  } catch (err) {
    console.error('Reaction error:', err);
    res.status(500).json({ msg: err.message });
  }
});

router.put('/:postId/save', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });
    const access = await ensurePostViewer(post, req.user);
    if (!access) return res.status(403).json({ msg: 'You cannot view this post' });

    const index = post.savedBy.findIndex(userId => userId.toString() === req.user);
    if (index === -1) post.savedBy.push(req.user);
    else post.savedBy.splice(index, 1);

    await post.save();
    res.json(await populatePost(post));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
