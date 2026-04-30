const GroupActivity = require('../models/GroupActivity');

const createGroupActivity = async ({ groupId, actorId, type, title, detail = '', targetId = null, targetModel = '' }) => {
  if (!groupId || !type || !title) return null;

  const activity = await GroupActivity.create({
    groupId,
    actorId: actorId || null,
    type,
    title,
    detail,
    targetId,
    targetModel
  });
  await activity.populate('actorId', 'name avatar');
  return activity;
};

module.exports = { createGroupActivity };
