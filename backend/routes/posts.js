const express = require('express');
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const Group = require('../models/Group');
const router = express.Router();

router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const posts = await Post.find({ groupId: req.params.groupId })
      .populate('userId', 'name avatar')
      .populate('comments.userId', 'name avatar')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { groupId, title, content, fileUrl } = req.body;
    const post = new Post({ groupId, userId: req.user, title, content, fileUrl });
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/:postId/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });
    const index = post.likes.indexOf(req.user);
    if (index === -1) post.likes.push(req.user);
    else post.likes.splice(index, 1);
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/:postId/comment', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });
    post.comments.push({ userId: req.user, text });
    await post.save();
    await post.populate('comments.userId', 'name avatar');
    res.json(post);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.delete('/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });
    const group = await Group.findById(post.groupId);
    if (!group) return res.status(404).json({ msg: 'Group not found' });
    const isPostCreator = post.userId.toString() === req.user;
    const isGroupCreator = group.creator.toString() === req.user;
    if (!isPostCreator && !isGroupCreator) {
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
    // Ensure reactions array exists
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
    res.json(post);
  } catch (err) {
    console.error('Reaction error:', err);
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;