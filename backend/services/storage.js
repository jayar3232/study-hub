const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const supabaseBucket = process.env.SUPABASE_BUCKET?.trim();

const isCloudStorageEnabled = Boolean(supabaseUrl && supabaseServiceKey && supabaseBucket);

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

const uploadBuffer = async ({ buffer, originalName, mimeType, folder }) => {
  if (!isCloudStorageEnabled || !supabase) {
    throw new Error('Cloud storage is not configured');
  }

  const { filename, objectPath } = createObjectPath(folder, originalName);
  const { data, error } = await supabase.storage
    .from(supabaseBucket)
    .upload(objectPath, buffer, {
      contentType: mimeType || 'application/octet-stream',
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(error.message || 'Cloud upload failed');
  }

  const storedPath = data?.path || objectPath;
  const { data: publicData } = supabase.storage.from(supabaseBucket).getPublicUrl(storedPath);

  return {
    filename,
    path: storedPath,
    url: publicData?.publicUrl || ''
  };
};

const deleteObject = async (objectPath) => {
  if (!isCloudStorageEnabled || !supabase || !objectPath) return;

  const { error } = await supabase.storage.from(supabaseBucket).remove([objectPath]);
  if (error) {
    throw new Error(error.message || 'Cloud delete failed');
  }
};

module.exports = {
  deleteObject,
  isCloudStorageEnabled,
  uploadBuffer
};
