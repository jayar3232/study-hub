const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const Group = require('../models/Group');
const router = express.Router();

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const findMemberGroup = async (groupId, userId) => {
  if (!isValidObjectId(groupId)) return null;
  return Group.findOne({ _id: groupId, members: userId });
};

const ensurePostMember = async (post, userId) => {
  if (!post) return null;
  return findMemberGroup(post.groupId, userId);
};

const populatePost = async (post) => {
  await post.populate('userId', 'name avatar');
  await post.populate('comments.userId', 'name avatar');
  await post.populate('reactions.userId', 'name avatar');
  return post;
};

router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const group = await findMemberGroup(req.params.groupId, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });

    const posts = await Post.find({ groupId: req.params.groupId })
      .populate('userId', 'name avatar')
      .populate('comments.userId', 'name avatar')
      .populate('reactions.userId', 'name avatar')
      .sort({ createdAt: -1 });
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
      userId: req.user,
      title: title.trim(),
      content: content.trim(),
      fileUrl
    });
    await post.save();
    res.status(201).json(await populatePost(post));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/:postId/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });
    const group = await ensurePostMember(post, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });

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
    const group = await ensurePostMember(post, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });
    if (!text?.trim()) return res.status(400).json({ msg: 'Comment is required' });

    post.comments.push({ userId: req.user, text: text.trim() });
    await post.save();
    res.json(await populatePost(post));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.delete('/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });
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
    const group = await ensurePostMember(post, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });
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
    res.json(await populatePost(post));
  } catch (err) {
    console.error('Reaction error:', err);
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
