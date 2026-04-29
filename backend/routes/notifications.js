const express = require('express');
const webpush = require('web-push');
const auth = require('../middleware/auth');
const Subscription = require('../models/Subscription');
const router = express.Router();

// VAPID keys (generate once, save in .env)
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};
webpush.setVapidDetails(
  'mailto:your-email@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

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

// Function to send push notification (used elsewhere)
async function sendPushNotification(userId, title, body, url) {
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