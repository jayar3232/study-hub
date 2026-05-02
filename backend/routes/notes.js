const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Group = require('../models/Group');
const GroupNote = require('../models/GroupNote');
const UserNote = require('../models/UserNote');
const { createGroupActivity } = require('../services/activity');
const router = express.Router();

const NOTE_TTL_MS = 24 * 60 * 60 * 1000;
const USER_NOTE_MAX_LENGTH = 140;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const findMemberGroup = async (groupId, userId) => {
  if (!isValidObjectId(groupId)) return null;
  return Group.findOne({ _id: groupId, members: userId });
};

const populateNote = async (note) => {
  await note.populate('userId', 'name avatar');
  return note;
};

const populateUserNote = async (note) => {
  if (!note) return null;
  await note.populate('userId', 'name avatar lastSeen');
  return note;
};

const removeExpiredUserNotes = () => UserNote.deleteMany({ expiresAt: { $lte: new Date() } });

router.get('/me', auth, async (req, res) => {
  try {
    await removeExpiredUserNotes();
    const note = await UserNote.findOne({
      userId: req.user,
      expiresAt: { $gt: new Date() }
    });
    res.json(note ? await populateUserNote(note) : null);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/active', auth, async (req, res) => {
  try {
    await removeExpiredUserNotes();
    const notes = await UserNote.find({ expiresAt: { $gt: new Date() } })
      .populate('userId', 'name avatar lastSeen')
      .sort({ updatedAt: -1 })
      .limit(100);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/me', auth, async (req, res) => {
  try {
    const text = req.body.text?.trim();
    if (!text) return res.status(400).json({ msg: 'Note text is required' });
    if (text.length > USER_NOTE_MAX_LENGTH) {
      return res.status(400).json({ msg: `Note must be ${USER_NOTE_MAX_LENGTH} characters or less` });
    }

    const note = await UserNote.findOneAndUpdate(
      { userId: req.user },
      {
        userId: req.user,
        text,
        expiresAt: new Date(Date.now() + NOTE_TTL_MS)
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(await populateUserNote(note));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.delete('/me', auth, async (req, res) => {
  try {
    await UserNote.deleteOne({ userId: req.user });
    res.json({ msg: 'Note removed' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const group = await findMemberGroup(req.params.groupId, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });

    await GroupNote.deleteMany({ groupId: req.params.groupId, expiresAt: { $lte: new Date() } });
    const notes = await GroupNote.find({
      groupId: req.params.groupId,
      expiresAt: { $gt: new Date() }
    })
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/group/:groupId', auth, async (req, res) => {
  try {
    const group = await findMemberGroup(req.params.groupId, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });

    const text = req.body.text?.trim();
    if (!text) return res.status(400).json({ msg: 'Note text is required' });
    if (text.length > 180) return res.status(400).json({ msg: 'Note must be 180 characters or less' });

    const note = new GroupNote({
      groupId: req.params.groupId,
      userId: req.user,
      text,
      expiresAt: new Date(Date.now() + NOTE_TTL_MS)
    });
    await note.save();
    await createGroupActivity({
      groupId: req.params.groupId,
      actorId: req.user,
      type: 'note',
      title: 'posted a group note',
      detail: text,
      targetId: note._id,
      targetModel: 'GroupNote'
    });
    res.status(201).json(await populateNote(note));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.delete('/:noteId', auth, async (req, res) => {
  try {
    const note = await GroupNote.findById(req.params.noteId);
    if (!note) return res.status(404).json({ msg: 'Note not found' });

    const group = await findMemberGroup(note.groupId, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });

    const isOwner = note.userId.toString() === req.user;
    const isCreator = group.creator.toString() === req.user;
    const isCoCreator = group.coCreators?.some(userId => userId.toString() === req.user);
    if (!isOwner && !isCreator && !isCoCreator) {
      return res.status(403).json({ msg: 'Not authorized to delete this note' });
    }

    await note.deleteOne();
    res.json({ msg: 'Note deleted', noteId: req.params.noteId });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
