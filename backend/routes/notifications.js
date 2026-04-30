const express = require('express');
const webpush = require('web-push');
const auth = require('../middleware/auth');
const Subscription = require('../models/Subscription');
const Notification = require('../models/Notification');
const { emitNotificationState, getUnreadCount } = require('../services/notifications');
const router = express.Router();

// VAPID keys (generate once, save in .env)
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};
const pushEnabled = Boolean(vapidKeys.publicKey && vapidKeys.privateKey);

if (pushEnabled) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:your-email@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
}

// Save subscription
router.post('/subscribe', auth, async (req, res) => {
  try {
    const subscription = req.body;
    await Subscription.findOneAndUpdate(
      { userId: req.user },
      { subscription },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Delete subscription (when user logs out or disables)
router.delete('/unsubscribe', auth, async (req, res) => {
  await Subscription.findOneAndDelete({ userId: req.user });
  res.json({ success: true });
});

router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user })
      .populate('actorId', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(40);
    const unreadCount = await getUnreadCount(req.user);
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/unread-count', auth, async (req, res) => {
  try {
    res.json({ unreadCount: await getUnreadCount(req.user) });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user, read: false }, { $set: { read: true } });
    await emitNotificationState(req.app.get('io'), req.user);
    res.json({ msg: 'Notifications marked as read', unreadCount: 0 });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/:notificationId/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, userId: req.user },
      { read: true },
      { new: true }
    ).populate('actorId', 'name avatar');

    if (!notification) return res.status(404).json({ msg: 'Notification not found' });

    await emitNotificationState(req.app.get('io'), req.user);
    res.json(notification);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Function to send push notification (used elsewhere)
async function sendPushNotification(userId, title, body, url) {
  if (!pushEnabled) return;
  const subDoc = await Subscription.findOne({ userId });
  if (!subDoc) return;
  const payload = JSON.stringify({ title, body, url });
  try {
    await webpush.sendNotification(subDoc.subscription, payload);
  } catch (err) {
    console.error('Push error:', err);
    // If subscription expired, delete it
    if (err.statusCode === 410) await Subscription.findOneAndDelete({ userId });
  }
}
module.exports = { router, sendPushNotification };
