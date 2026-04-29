const express = require('express');
const auth = require('../middleware/auth');
const Group = require('../models/Group');
const Post = require('../models/Post');
const Task = require('../models/Task');
const File = require('../models/File');
const router = express.Router();

// Get all groups where current user is a member
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user;
    const groups = await Group.find({ members: userId })
      .populate('creator', 'name email')
      .populate('members', 'name email');
    res.json(groups);
  } catch (err) {
    console.error('GET /groups error:', err);
    res.status(500).json({ msg: err.message });
  }
});

// Create a new group – only creator is member
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, subject } = req.body;
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const group = new Group({
      name,
      description,
      subject,
      creator: req.user,
      members: [req.user],
      joinCode
    });
    await group.save();
    await group.populate('creator', 'name email');
    res.status(201).json(group);
  } catch (err) {
    console.error('POST /groups error:', err);
    res.status(500).json({ msg: err.message });
  }
});

// Join a group by code
router.post('/join', auth, async (req, res) => {
  try {
    const { joinCode } = req.body;
    const group = await Group.findOne({ joinCode });
    if (!group) return res.status(404).json({ msg: 'Group not found' });
    if (group.members.includes(req.user)) {
      return res.status(400).json({ msg: 'You are already a member of this group' });
    }
    group.members.push(req.user);
    await group.save();
    await group.populate('creator', 'name email');
    res.json(group);
  } catch (err) {
    console.error('POST /groups/join error:', err);
    res.status(500).json({ msg: err.message });
  }
});

// Get a single group (only if user is member)
router.get('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findOne({
      _id: req.params.id,
      members: req.user
    }).populate('members', 'name email')
      .populate('creator', 'name email');
    if (!group) return res.status(404).json({ msg: 'Group not found or you are not a member' });
    res.json(group);
  } catch (err) {
    console.error('GET /groups/:id error:', err);
    res.status(500).json({ msg: err.message });
  }
});

// Delete group (only creator)
router.delete('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ msg: 'Group not found' });
    if (group.creator.toString() !== req.user) {
      return res.status(403).json({ msg: 'Only the group creator can delete this group' });
    }
    // Delete related data
    await Post.deleteMany({ groupId: req.params.id });
    await Task.deleteMany({ groupId: req.params.id });
    await File.deleteMany({ groupId: req.params.id });
    await group.deleteOne();
    res.json({ msg: 'Group deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Leave group (for members, not creator)
router.delete('/:id/leave', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ msg: 'Group not found' });
    if (group.creator.toString() === req.user) {
      return res.status(400).json({ msg: 'Creator cannot leave. Delete the group instead.' });
    }
    if (!group.members.includes(req.user)) {
      return res.status(400).json({ msg: 'You are not a member of this group' });
    }
    group.members = group.members.filter(m => m.toString() !== req.user);
    group.coCreators = group.coCreators.filter(c => c.toString() !== req.user);
    await group.save();
    res.json({ msg: 'Left group successfully' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// ========== MEMBER MANAGEMENT ==========
// Get group members with roles (creator / co‑creator / member)
router.get('/:id/members', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members', 'name email avatar')
      .populate('creator', 'name email avatar')
      .populate('coCreators', 'name email avatar');
    if (!group) return res.status(404).json({ msg: 'Group not found' });
    if (!group.members.some(m => m && m._id && m._id.toString() === req.user)) {
      return res.status(403).json({ msg: 'You are not a member of this group' });
    }
    const membersWithRoles = group.members
      .filter(m => m && m._id) // filter out any null or invalid members
      .map(member => {
        let role = 'member';
        if (member._id.toString() === group.creator._id.toString()) role = 'creator';
        else if (group.coCreators.some(c => c && c._id && c._id.toString() === member._id.toString())) role = 'co-creator';
        return { ...member.toObject(), role };
      });
    res.json(membersWithRoles);
  } catch (err) {
    console.error('Members error:', err);
    res.status(500).json({ msg: err.message });
  }
});

// Kick a member (creator or co‑creator can kick, with restrictions)
router.delete('/:id/kick/:userId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ msg: 'Group not found' });

    const isCreator = group.creator.toString() === req.user;
    const isCoCreator = group.coCreators.some(c => c.toString() === req.user);
    if (!isCreator && !isCoCreator) {
      return res.status(403).json({ msg: 'Only creator or co‑creators can kick members' });
    }

    const targetUserId = req.params.userId;
    if (group.creator.toString() === targetUserId) {
      return res.status(403).json({ msg: 'Cannot kick the group creator' });
    }
    const isTargetCoCreator = group.coCreators.some(c => c.toString() === targetUserId);
    if (isTargetCoCreator && !isCreator) {
      return res.status(403).json({ msg: 'Only the creator can kick co‑creators' });
    }

    group.members = group.members.filter(m => m.toString() !== targetUserId);
    group.coCreators = group.coCreators.filter(c => c.toString() !== targetUserId);
    await group.save();
    res.json({ msg: 'Member kicked' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Promote member to co‑creator (only creator)
router.put('/:id/promote/:userId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ msg: 'Group not found' });
    if (group.creator.toString() !== req.user) {
      return res.status(403).json({ msg: 'Only the creator can promote members' });
    }
    const targetUserId = req.params.userId;
    if (!group.members.some(m => m.toString() === targetUserId)) {
      return res.status(400).json({ msg: 'User is not a member' });
    }
    if (group.coCreators.some(c => c.toString() === targetUserId)) {
      return res.status(400).json({ msg: 'User is already a co‑creator' });
    }
    group.coCreators.push(targetUserId);
    await group.save();
    res.json({ msg: 'User promoted to co‑creator' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Demote co‑creator to member (only creator)
router.put('/:id/demote/:userId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ msg: 'Group not found' });
    if (group.creator.toString() !== req.user) {
      return res.status(403).json({ msg: 'Only the creator can demote co‑creators' });
    }
    const targetUserId = req.params.userId;
    if (!group.coCreators.some(c => c.toString() === targetUserId)) {
      return res.status(400).json({ msg: 'User is not a co‑creator' });
    }
    group.coCreators = group.coCreators.filter(c => c.toString() !== targetUserId);
    await group.save();
    res.json({ msg: 'Co‑creator demoted to member' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;