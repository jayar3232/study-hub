const Notification = require('../models/Notification');

const normalizeId = (value) => String(value?._id || value?.id || value || '');

const getUnreadCount = (userId) => Notification.countDocuments({ userId, read: false });

const emitNotificationState = async (io, userId, notification = null) => {
  if (!io || !userId) return;
  const unreadCount = await getUnreadCount(userId);
  io.to(`user_${normalizeId(userId)}`).emit('notifications-updated', {
    unreadCount,
    notification
  });
};

const createNotification = async ({ io, userId, actorId, type, title, body = '', href = '', meta = {} }) => {
  const targetId = normalizeId(userId);
  if (!targetId || (actorId && normalizeId(actorId) === targetId)) return null;

  const notification = await Notification.create({
    userId: targetId,
    actorId: actorId || null,
    type,
    title,
    body,
    href,
    meta
  });
  await notification.populate('actorId', 'name avatar');
  await emitNotificationState(io, targetId, notification);
  return notification;
};

const createNotifications = async ({ io, userIds = [], actorId, type, title, body = '', href = '', meta = {} }) => {
  const uniqueUserIds = [...new Set(userIds.map(normalizeId).filter(Boolean))];
  const created = [];

  for (const userId of uniqueUserIds) {
    const notification = await createNotification({ io, userId, actorId, type, title, body, href, meta });
    if (notification) created.push(notification);
  }

  return created;
};

module.exports = {
  createNotification,
  createNotifications,
  emitNotificationState,
  getUnreadCount
};
