const { getObjectUrl, getSupabaseObjectPathFromUrl } = require('../services/storage');

const cloneObject = (value) => {
  if (!value) return value;
  if (typeof value.toObject === 'function') return value.toObject();
  return { ...value };
};

const resolveStoredMediaUrl = ({ url = '', storagePath = '', storageProvider = '' } = {}) => {
  const provider = String(storageProvider || '').trim();
  const path = String(storagePath || '').trim();
  if (provider && path) return getObjectUrl(provider, path) || url || '';
  const legacySupabasePath = getSupabaseObjectPathFromUrl(url);
  if (legacySupabasePath) return getObjectUrl('r2', legacySupabasePath) || url || '';
  return url || '';
};

const serializeMediaUser = (user) => {
  const object = cloneObject(user);
  if (!object) return object;

  object.avatar = resolveStoredMediaUrl({
    url: object.avatar,
    storagePath: object.avatarStoragePath,
    storageProvider: object.avatarStorageProvider
  });
  object.coverPhoto = resolveStoredMediaUrl({
    url: object.coverPhoto,
    storagePath: object.coverPhotoStoragePath,
    storageProvider: object.coverPhotoStorageProvider
  });
  delete object.avatarStoragePath;
  delete object.avatarStorageProvider;
  delete object.coverPhotoStoragePath;
  delete object.coverPhotoStorageProvider;

  return object;
};

const hydrateMediaUserInPlace = (user) => {
  if (!user || typeof user !== 'object') return user;
  const serialized = serializeMediaUser(user);
  Object.assign(user, serialized);
  return user;
};

const hydrateMediaAsset = (asset = {}, urlField = 'fileUrl') => {
  const object = cloneObject(asset);
  if (!object) return object;
  object[urlField] = resolveStoredMediaUrl({
    url: object[urlField],
    storagePath: object.storagePath,
    storageProvider: object.storageProvider
  });
  return object;
};

const hydrateGroupMedia = (group) => {
  const object = cloneObject(group);
  if (!object) return object;

  object.photo = resolveStoredMediaUrl({
    url: object.photo,
    storagePath: object.photoStoragePath,
    storageProvider: object.photoStorageProvider
  });
  hydrateMediaUserInPlace(object.creator);
  (object.members || []).forEach(hydrateMediaUserInPlace);
  delete object.photoStoragePath;
  delete object.photoStorageProvider;
  return object;
};

const hydratePostMedia = (post) => {
  const object = cloneObject(post);
  if (!object) return object;

  hydrateMediaUserInPlace(object.userId);
  (object.comments || []).forEach(comment => {
    hydrateMediaUserInPlace(comment.userId);
    (comment.reactions || []).forEach(reaction => hydrateMediaUserInPlace(reaction.userId));
  });
  (object.reactions || []).forEach(reaction => hydrateMediaUserInPlace(reaction.userId));
  (object.taggedUsers || []).forEach(hydrateMediaUserInPlace);

  const hydratedPrimary = hydrateMediaAsset(object, 'fileUrl');
  object.fileUrl = hydratedPrimary.fileUrl || '';
  object.attachments = (object.attachments || []).map(attachment => hydrateMediaAsset(attachment, 'fileUrl'));
  return object;
};

const hydrateStoryMedia = (story) => {
  const object = cloneObject(story);
  if (!object) return object;

  hydrateMediaUserInPlace(object.userId);
  (object.reactions || []).forEach(reaction => hydrateMediaUserInPlace(reaction.userId));
  (object.viewers || []).forEach(viewer => hydrateMediaUserInPlace(viewer.userId));
  (object.comments || []).forEach(comment => hydrateMediaUserInPlace(comment.userId));

  const hydrated = hydrateMediaAsset(object, 'fileUrl');
  object.fileUrl = hydrated.fileUrl || '';
  return object;
};

const hydrateMessageMedia = (message) => {
  const object = cloneObject(message);
  if (!object) return object;

  hydrateMediaUserInPlace(object.from);
  hydrateMediaUserInPlace(object.to);
  (object.reactions || []).forEach(reaction => hydrateMediaUserInPlace(reaction.userId));
  if (object.replyTo) {
    hydrateMediaUserInPlace(object.replyTo.from);
  }

  const hydratedPrimary = hydrateMediaAsset(object, 'fileUrl');
  object.fileUrl = hydratedPrimary.fileUrl || '';
  object.attachments = (object.attachments || []).map(attachment => hydrateMediaAsset(attachment, 'fileUrl'));
  return object;
};

const hydrateGalleryMedia = (item) => {
  const object = cloneObject(item);
  if (!object) return object;

  hydrateMediaUserInPlace(object.uploadedBy);
  (object.comments || []).forEach(comment => hydrateMediaUserInPlace(comment.userId));
  (object.reactions || []).forEach(reaction => hydrateMediaUserInPlace(reaction.userId));
  (object.viewers || []).forEach(viewer => hydrateMediaUserInPlace(viewer.userId));

  const hydrated = hydrateMediaAsset(object, 'fileUrl');
  object.fileUrl = hydrated.fileUrl || '';
  return object;
};

module.exports = {
  hydrateGalleryMedia,
  hydrateGroupMedia,
  hydrateMediaAsset,
  hydrateMediaUserInPlace,
  hydrateMessageMedia,
  hydratePostMedia,
  hydrateStoryMedia,
  resolveStoredMediaUrl,
  serializeMediaUser
};
