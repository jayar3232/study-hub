const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Friendship = require('../models/Friendship');

const router = express.Router();

const userFields = 'name email course avatar bio lastSeen createdAt';
const normalizeId = (value) => String(value?._id || value?.id || value || '');

const toClientUser = (user) => {
  if (!user) return null;
  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    email: user.email,
    course: user.course,
    bio: user.bio,
    avatar: user.avatar,
    lastSeen: user.lastSeen,
    createdAt: user.createdAt
  };
};

const relationPayload = (friendship, currentUserId) => {
  if (!friendship) return { status: 'none' };

  const requesterId = normalizeId(friendship.requester);
  const recipientId = normalizeId(friendship.recipient);
  const currentId = normalizeId(currentUserId);

  if (friendship.status === 'accepted') {
    return { status: 'friends', requestId: friendship._id };
  }

  if (friendship.status === 'pending') {
    return {
      status: requesterId === currentId ? 'outgoing' : 'incoming',
      requestId: friendship._id,
      otherUserId: requesterId === currentId ? recipientId : requesterId
    };
  }

  return { status: 'none' };
};

const findRelationship = (currentUserId, otherUserId) => Friendship.findOne({
  $or: [
    { requester: currentUserId, recipient: otherUserId },
    { requester: otherUserId, recipient: currentUserId }
  ]
});

const emitFriendSync = (io, userIds = []) => {
  if (!io) return;
  userIds.map(normalizeId).filter(Boolean).forEach(userId => {
    io.to(`user_${userId}`).emit('friend-request-updated');
  });
};

router.get('/summary', auth, async (req, res) => {
  try {
    const currentUserId = req.user;
    const [connections, users] = await Promise.all([
      Friendship.find({
        $or: [{ requester: currentUserId }, { recipient: currentUserId }],
        status: { $in: ['pending', 'accepted'] }
      })
        .populate('requester', userFields)
        .populate('recipient', userFields)
        .sort({ updatedAt: -1 })
        .lean(),
      User.find({ _id: { $ne: currentUserId } })
        .select(userFields)
        .sort({ name: 1 })
        .lean()
    ]);

    const relationByUser = new Map();
    const friends = [];
    const incoming = [];
    const outgoing = [];

    connections.forEach(connection => {
      const requesterId = normalizeId(connection.requester);
      const recipientId = normalizeId(connection.recipient);
      const isRequester = requesterId === normalizeId(currentUserId);
      const otherUser = isRequester ? connection.recipient : connection.requester;
      if (!otherUser) return;

      const relation = relationPayload(connection, currentUserId);
      relationByUser.set(normalizeId(otherUser), relation);

      if (connection.status === 'accepted') {
        friends.push({
          _id: connection._id,
          since: connection.respondedAt || connection.updatedAt,
          user: toClientUser(otherUser),
          friendship: relation
        });
      } else if (isRequester) {
        outgoing.push({
          _id: connection._id,
          createdAt: connection.createdAt,
          recipient: toClientUser(connection.recipient),
          friendship: relation
        });
      } else {
        incoming.push({
          _id: connection._id,
          createdAt: connection.createdAt,
          requester: toClientUser(connection.requester),
          friendship: relation
        });
      }
    });

    const people = users.map(user => ({
      ...toClientUser(user),
      friendship: relationByUser.get(normalizeId(user)) || { status: 'none' }
    }));

    res.json({
      friends,
      incoming,
      outgoing,
      people,
      counts: {
        friends: friends.length,
        incoming: incoming.length,
        outgoing: outgoing.length,
        people: people.length
      }
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/request/:userId', auth, async (req, res) => {
  try {
    const targetId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (normalizeId(targetId) === normalizeId(req.user)) {
      return res.status(400).json({ msg: 'You cannot add yourself' });
    }

    const targetUser = await User.findById(targetId).select(userFields).lean();
    if (!targetUser) return res.status(404).json({ msg: 'User not found' });

    let friendship = await findRelationship(req.user, targetId);
    if (friendship?.status === 'accepted') {
      return res.json({ msg: 'Already friends', friendship: relationPayload(friendship, req.user) });
    }
    if (friendship?.status === 'pending') {
      return res.json({ msg: 'Friend request already pending', friendship: relationPayload(friendship, req.user) });
    }

    if (friendship) {
      friendship.requester = req.user;
      friendship.recipient = targetId;
      friendship.status = 'pending';
      friendship.respondedAt = null;
    } else {
      friendship = new Friendship({
        requester: req.user,
        recipient: targetId,
        status: 'pending'
      });
    }

    await friendship.save();
    emitFriendSync(req.app.get('io'), [req.user, targetId]);

    res.status(201).json({
      msg: 'Friend request sent',
      user: toClientUser(targetUser),
      friendship: relationPayload(friendship, req.user)
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ msg: 'Friend request already exists' });
    }
    res.status(500).json({ msg: err.message });
  }
});

router.put('/requests/:requestId/accept', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
      return res.status(404).json({ msg: 'Friend request not found' });
    }

    const friendship = await Friendship.findOne({
      _id: req.params.requestId,
      recipient: req.user,
      status: 'pending'
    });

    if (!friendship) return res.status(404).json({ msg: 'Friend request not found' });

    friendship.status = 'accepted';
    friendship.respondedAt = new Date();
    await friendship.save();

    emitFriendSync(req.app.get('io'), [friendship.requester, friendship.recipient]);
    res.json({ msg: 'Friend request accepted', friendship: relationPayload(friendship, req.user) });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/requests/:requestId/decline', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
      return res.status(404).json({ msg: 'Friend request not found' });
    }

    const friendship = await Friendship.findOne({
      _id: req.params.requestId,
      recipient: req.user,
      status: 'pending'
    });

    if (!friendship) return res.status(404).json({ msg: 'Friend request not found' });

    friendship.status = 'declined';
    friendship.respondedAt = new Date();
    await friendship.save();

    emitFriendSync(req.app.get('io'), [friendship.requester, friendship.recipient]);
    res.json({ msg: 'Friend request declined', friendship: { status: 'none' } });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.delete('/:friendshipId', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.friendshipId)) {
      return res.status(404).json({ msg: 'Friendship not found' });
    }

    const friendship = await Friendship.findOneAndDelete({
      _id: req.params.friendshipId,
      status: 'accepted',
      $or: [{ requester: req.user }, { recipient: req.user }]
    });

    if (!friendship) return res.status(404).json({ msg: 'Friendship not found' });

    emitFriendSync(req.app.get('io'), [friendship.requester, friendship.recipient]);
    res.json({ msg: 'Friend removed' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
