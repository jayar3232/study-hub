const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const supabaseBucket = (
  process.env.SUPABASE_BUCKET
  || process.env.SUPABASE_STORAGE_BUCKET
  || process.env.SUPABASE_BUCKET_NAME
  || ''
).trim();

const isCloudStorageEnabled = Boolean(supabaseUrl && supabaseServiceKey && supabaseBucket);
const uploadsRoot = path.resolve(__dirname, '..', 'uploads');
const allowLocalFallback = String(process.env.STORAGE_LOCAL_FALLBACK || 'true').toLowerCase() !== 'false';
const serviceKeyLooksLikeJwt = Boolean(
  supabaseServiceKey
  && supabaseServiceKey.startsWith('eyJ')
  && (supabaseServiceKey.match(/\./g) || []).length === 2
);

const supabase = isCloudStorageEnabled
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

const normalizeFolder = (folder = '') => folder
  .split('/')
  .map(part => part.trim().replace(/[^a-zA-Z0-9_-]/g, '-'))
  .filter(Boolean)
  .join('/');

const safeExtension = (filename = '') => {
  const ext = path.extname(filename).toLowerCase().replace(/[^.\w]/g, '');
  return ext || '';
};

const createObjectPath = (folder, originalName) => {
  const cleanFolder = normalizeFolder(folder);
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExtension(originalName)}`;
  return {
    filename,
    objectPath: cleanFolder ? `${cleanFolder}/${filename}` : filename
  };
};

const isRecoverableCloudStorageError = (error = {}) => {
  const message = String(error.message || error.error || error.name || error || '').toLowerCase();
  return [
    'exceed_cached_egress_quota',
    'egress quota',
    'quota',
    'limit exceeded',
    'resource exhausted',
    'rate limit',
    'too many requests'
  ].some(pattern => message.includes(pattern));
};

const localPathFromObjectPath = (objectPath = '') => (
  objectPath
    .split('/')
    .map(part => part.trim().replace(/[^a-zA-Z0-9._-]/g, '-'))
    .filter(Boolean)
    .join('/')
);

const uploadBufferLocally = async ({ buffer, originalName, folder }) => {
  const { filename, objectPath } = createObjectPath(folder, originalName);
  const localPath = localPathFromObjectPath(objectPath);
  const targetPath = path.join(uploadsRoot, localPath);

  if (!targetPath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw new Error('Invalid local upload path');
  }

  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.promises.writeFile(targetPath, buffer);

  return {
    filename,
    path: localPath.replace(/\\/g, '/'),
    provider: 'local',
    url: `/uploads/${localPath.replace(/\\/g, '/')}`
  };
};

const uploadBuffer = async ({ buffer, originalName, mimeType, folder }) => {
  if (!isCloudStorageEnabled || !supabase) {
    throw new Error('Cloud storage is not configured');
  }

  const { filename, objectPath } = createObjectPath(folder, originalName);
  let uploadResult;
  try {
    uploadResult = await supabase.storage
      .from(supabaseBucket)
      .upload(objectPath, buffer, {
        contentType: mimeType || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false
      });
  } catch (error) {
    if (allowLocalFallback && isRecoverableCloudStorageError(error)) {
      const fallback = await uploadBufferLocally({ buffer, originalName, folder });
      fallback.fallbackReason = error.message || 'Cloud upload failed';
      return fallback;
    }

    throw error;
  }

  const { data, error } = uploadResult;

  if (error) {
    if (allowLocalFallback && isRecoverableCloudStorageError(error)) {
      const fallback = await uploadBufferLocally({ buffer, originalName, folder });
      fallback.fallbackReason = error.message || 'Cloud upload failed';
      return fallback;
    }

    throw new Error(error.message || 'Cloud upload failed');
  }

  const storedPath = data?.path || objectPath;
  const { data: publicData } = supabase.storage.from(supabaseBucket).getPublicUrl(storedPath);

  return {
    filename,
    path: storedPath,
    provider: 'supabase',
    url: publicData?.publicUrl || ''
  };
};

const deleteObject = async (objectPath) => {
  if (!objectPath) return;

  const localPath = localPathFromObjectPath(objectPath);
  const targetPath = path.join(uploadsRoot, localPath);
  if (targetPath.startsWith(`${uploadsRoot}${path.sep}`) && fs.existsSync(targetPath)) {
    await fs.promises.unlink(targetPath).catch(() => {});
    return;
  }

  if (!isCloudStorageEnabled || !supabase) return;

  const { error } = await supabase.storage.from(supabaseBucket).remove([objectPath]);
  if (error) {
    throw new Error(error.message || 'Cloud delete failed');
  }
};

const getStorageConfigStatus = () => ({
  provider: isCloudStorageEnabled ? 'supabase' : 'local',
  enabled: isCloudStorageEnabled,
  localFallbackEnabled: allowLocalFallback,
  bucket: supabaseBucket || '',
  urlConfigured: Boolean(supabaseUrl),
  serviceRoleKeyConfigured: Boolean(supabaseServiceKey),
  serviceRoleKeyLooksLikeJwt: serviceKeyLooksLikeJwt,
  status: isCloudStorageEnabled
    ? serviceKeyLooksLikeJwt
      ? 'cloud enabled'
      : 'cloud configured, service role key does not look like a Supabase JWT'
    : 'local uploads',
  missing: [
    !supabaseUrl && 'SUPABASE_URL',
    !supabaseServiceKey && 'SUPABASE_SERVICE_ROLE_KEY',
    !supabaseBucket && 'SUPABASE_BUCKET'
  ].filter(Boolean)
});

module.exports = {
  deleteObject,
  getStorageConfigStatus,
  isCloudStorageEnabled,
  uploadBuffer
};
