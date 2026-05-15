import { Capacitor, registerPlugin } from '@capacitor/core';

const SyncrovaMediaLibrary = registerPlugin('SyncrovaMediaLibrary');

const getPlatform = () => {
  if (typeof window === 'undefined') return 'web';
  return window.Capacitor?.getPlatform?.() || Capacitor.getPlatform?.() || 'web';
};

export const isNativeMediaLibraryAvailable = () => (
  getPlatform() === 'android'
  && Boolean(Capacitor.isPluginAvailable?.('SyncrovaMediaLibrary'))
);

export const getNativeMediaWebPath = (asset = {}) => {
  const uri = asset.webPath || asset.uri || asset.contentUri || '';
  if (!uri) return '';
  return Capacitor.convertFileSrc ? Capacitor.convertFileSrc(uri) : uri;
};

export const getNativeMediaThumbnailWebPath = (asset = {}) => {
  const uri = asset.thumbnailWebPath || asset.thumbnailUri || asset.posterUri || '';
  if (!uri) return '';
  return Capacitor.convertFileSrc ? Capacitor.convertFileSrc(uri) : uri;
};

const normalizeAsset = (asset = {}) => ({
  id: String(asset.id || asset.uri || ''),
  uri: asset.uri || asset.contentUri || '',
  webPath: getNativeMediaWebPath(asset),
  thumbnailWebPath: getNativeMediaThumbnailWebPath(asset),
  name: asset.name || asset.displayName || 'Syncrova media',
  mimeType: asset.mimeType || '',
  type: asset.type === 'video' ? 'video' : 'image',
  size: Number(asset.size || 0),
  duration: Number(asset.duration || 0),
  dateAdded: Number(asset.dateAdded || 0),
  dateModified: Number(asset.dateModified || asset.dateAdded || 0),
  width: Number(asset.width || 0),
  height: Number(asset.height || 0)
});

export const checkNativeMediaPermission = async () => {
  if (!isNativeMediaLibraryAvailable()) return { permission: 'unavailable' };
  return SyncrovaMediaLibrary.checkMediaPermissions();
};

export const requestNativeMediaPermission = async () => {
  if (!isNativeMediaLibraryAvailable()) return { permission: 'unavailable' };
  return SyncrovaMediaLibrary.requestMediaPermissions();
};

export const listNativeMedia = async ({ filter = 'all', limit = 90, offset = 0 } = {}) => {
  if (!isNativeMediaLibraryAvailable()) {
    return { permission: 'unavailable', assets: [] };
  }

  const result = await SyncrovaMediaLibrary.listMedia({
    filter,
    limit,
    offset
  });

  return {
    permission: result?.permission || 'prompt',
    assets: Array.isArray(result?.assets) ? result.assets.map(normalizeAsset).filter(asset => asset.id && asset.uri) : []
  };
};

const getExtensionFromMime = (mimeType = '', fallbackType = 'image') => {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('heic')) return 'heic';
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('video')) return 'mp4';
  return fallbackType === 'video' ? 'mp4' : 'jpg';
};

const safeFileName = (name = '', mimeType = '', type = 'image') => {
  const cleaned = String(name || '').replace(/[\\/:*?"<>|]+/g, '-').trim();
  if (cleaned && /\.[a-z0-9]{2,5}$/i.test(cleaned)) return cleaned;
  const extension = getExtensionFromMime(mimeType, type);
  return `${cleaned || `syncrova-${type}`}.${extension}`;
};

export const nativeMediaAssetToFile = async (asset = {}) => {
  const source = getNativeMediaWebPath(asset);
  if (!source) throw new Error('Media source is unavailable');

  const response = await fetch(source);
  if (!response.ok) throw new Error('Could not read selected media');

  const blob = await response.blob();
  const mimeType = asset.mimeType || blob.type || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
  const lastModified = Number(asset.dateModified || asset.dateAdded || 0) > 0
    ? Number(asset.dateModified || asset.dateAdded) * 1000
    : Date.now();

  return new File([blob], safeFileName(asset.name, mimeType, asset.type), {
    type: mimeType,
    lastModified
  });
};
