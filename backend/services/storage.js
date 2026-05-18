const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');

const uploadsRoot = path.resolve(__dirname, '..', 'uploads');

const cleanEnv = (value = '') => String(value || '').trim();

const supabaseUrl = cleanEnv(process.env.SUPABASE_URL);
const supabaseServiceKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseBucket = cleanEnv(
  process.env.SUPABASE_BUCKET
  || process.env.SUPABASE_STORAGE_BUCKET
  || process.env.SUPABASE_BUCKET_NAME
);

const r2AccountId = cleanEnv(process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID);
const r2AccessKeyId = cleanEnv(process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID);
const r2SecretAccessKey = cleanEnv(process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY);
const r2Bucket = cleanEnv(process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET_NAME);
const r2Endpoint = cleanEnv(
  process.env.R2_ENDPOINT
  || process.env.CLOUDFLARE_R2_ENDPOINT
  || (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : '')
).replace(/\/+$/, '');
const r2PublicBaseUrl = cleanEnv(
  process.env.R2_PUBLIC_URL
  || process.env.R2_PUBLIC_BASE_URL
  || process.env.CLOUDFLARE_R2_PUBLIC_URL
).replace(/\/+$/, '');

const requestedStorageProvider = cleanEnv(
  process.env.STORAGE_PROVIDER
  || process.env.STORAGE_DRIVER
  || process.env.UPLOAD_STORAGE_PROVIDER
).toLowerCase();

const normalizeProvider = (value = '') => {
  const provider = cleanEnv(value).toLowerCase();
  if (['local', 'disk', 'filesystem', 'file'].includes(provider)) return 'local';
  if (['r2', 'cloudflare', 'cloudflare-r2', 'cloudflare_r2', 's3-r2'].includes(provider)) return 'r2';
  if (['supabase', 'supabase-storage', 'supabase_storage'].includes(provider)) return 'supabase';
  return provider;
};

const requestedProvider = normalizeProvider(requestedStorageProvider);
const forceLocalStorage = requestedProvider === 'local';
const localFallbackSetting = cleanEnv(process.env.STORAGE_LOCAL_FALLBACK).toLowerCase();
const allowLocalFallback = localFallbackSetting
  ? !['false', '0', 'no', 'off'].includes(localFallbackSetting)
  : false;
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceKey && supabaseBucket);
const isR2Configured = Boolean(r2Endpoint && r2AccessKeyId && r2SecretAccessKey && r2Bucket);

const getActiveCloudProvider = () => {
  if (forceLocalStorage) return 'local';
  if (requestedProvider === 'r2') return isR2Configured ? 'r2' : 'local';
  if (requestedProvider === 'supabase') return isSupabaseConfigured ? 'supabase' : 'local';
  if (isR2Configured) return 'r2';
  if (isSupabaseConfigured) return 'supabase';
  return 'local';
};

const cloudStorageProvider = getActiveCloudProvider();
const isCloudStorageEnabled = cloudStorageProvider !== 'local';

const serviceKeyLooksLikeJwt = Boolean(
  supabaseServiceKey
  && supabaseServiceKey.startsWith('eyJ')
  && (supabaseServiceKey.match(/\./g) || []).length === 2
);

const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

const r2 = isR2Configured
  ? new S3Client({
      region: 'auto',
      endpoint: r2Endpoint,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey
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
  const message = [
    error.message,
    error.error,
    error.name,
    error.code,
    error.statusCode,
    error.status,
    error.details,
    error.hint,
    typeof error === 'string' ? error : ''
  ].filter(Boolean).join(' ').toLowerCase();
  return [
    'exceed_cached_egress_quota',
    'exceeded_cached_egress_quota',
    'cached egress',
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

const cleanObjectPath = (objectPath = '') => {
  const cleaned = cleanEnv(objectPath).replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('\0')) return '';
  if (cleaned.split('/').some(part => part === '..')) return '';
  return cleaned;
};

const encodeObjectPath = (objectPath = '') => cleanObjectPath(objectPath)
  .split('/')
  .map(part => encodeURIComponent(part))
  .join('/');

const streamToBuffer = async (body) => {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

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

const getObjectUrl = (provider, objectPath) => {
  const storageProvider = normalizeProvider(provider);
  const storedPath = cleanObjectPath(objectPath);
  if (!storedPath) return '';

  if (storageProvider === 'r2') {
    const encodedPath = encodeObjectPath(storedPath);
    return r2PublicBaseUrl ? `${r2PublicBaseUrl}/${encodedPath}` : `/uploads/r2/${encodedPath}`;
  }

  if (storageProvider === 'supabase' && supabase) {
    const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(storedPath);
    return data?.publicUrl || '';
  }

  if (storageProvider === 'local') {
    return `/uploads/${storedPath}`;
  }

  return '';
};

const ensureCloudProvider = (provider) => {
  const storageProvider = normalizeProvider(provider || cloudStorageProvider);
  if (storageProvider === 'r2') {
    if (!isR2Configured || !r2) throw new Error('Cloudflare R2 storage is not configured');
    return 'r2';
  }
  if (storageProvider === 'supabase') {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase storage is not configured');
    return 'supabase';
  }
  throw new Error('Cloud storage is not configured');
};

const uploadObjectBuffer = async ({ buffer, objectPath, mimeType, provider = cloudStorageProvider }) => {
  const storageProvider = ensureCloudProvider(provider);
  const storedPath = cleanObjectPath(objectPath);
  if (!storedPath) throw new Error('Invalid cloud object path');

  if (storageProvider === 'r2') {
    await r2.send(new PutObjectCommand({
      Bucket: r2Bucket,
      Key: storedPath,
      Body: buffer,
      ContentType: mimeType || 'application/octet-stream',
      CacheControl: 'public, max-age=3600'
    }));

    return {
      path: storedPath,
      provider: 'r2',
      url: getObjectUrl('r2', storedPath)
    };
  }

  const { data, error } = await supabase.storage
    .from(supabaseBucket)
    .upload(storedPath, buffer, {
      contentType: mimeType || 'application/octet-stream',
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(error.message || 'Cloud upload failed');
  }

  const uploadedPath = data?.path || storedPath;
  return {
    path: uploadedPath,
    provider: 'supabase',
    url: getObjectUrl('supabase', uploadedPath)
  };
};

const uploadBuffer = async ({ buffer, originalName, mimeType, folder }) => {
  if (!isCloudStorageEnabled) {
    throw new Error('Cloud storage is not configured');
  }

  const { filename, objectPath } = createObjectPath(folder, originalName);
  try {
    const uploaded = await uploadObjectBuffer({
      buffer,
      objectPath,
      mimeType,
      provider: cloudStorageProvider
    });

    return {
      filename,
      ...uploaded
    };
  } catch (error) {
    if (allowLocalFallback && isRecoverableCloudStorageError(error)) {
      const fallback = await uploadBufferLocally({ buffer, originalName, folder });
      fallback.fallbackReason = error.message || 'Cloud upload failed';
      return fallback;
    }

    throw error;
  }
};

const deleteLocalObject = async (objectPath) => {
  const localPath = localPathFromObjectPath(objectPath);
  const targetPath = path.join(uploadsRoot, localPath);
  if (!targetPath.startsWith(`${uploadsRoot}${path.sep}`) || !fs.existsSync(targetPath)) {
    return false;
  }

  await fs.promises.unlink(targetPath).catch(() => {});
  return true;
};

const deleteObject = async (objectPath, options = {}) => {
  const storedPath = cleanObjectPath(objectPath);
  if (!storedPath) return;

  const requestedDeleteProvider = normalizeProvider(options.provider || '');
  if (requestedDeleteProvider === 'local') {
    await deleteLocalObject(storedPath);
    return;
  }

  if (!requestedDeleteProvider) {
    const deletedLocal = await deleteLocalObject(storedPath);
    if (deletedLocal) return;
  }

  const storageProvider = ensureCloudProvider(requestedDeleteProvider || cloudStorageProvider);
  if (storageProvider === 'r2') {
    await r2.send(new DeleteObjectCommand({ Bucket: r2Bucket, Key: storedPath }));
    return;
  }

  const { error } = await supabase.storage.from(supabaseBucket).remove([storedPath]);
  if (error) {
    throw new Error(error.message || 'Cloud delete failed');
  }
};

const readObjectBuffer = async (objectPath, options = {}) => {
  const storedPath = cleanObjectPath(objectPath);
  if (!storedPath) throw new Error('Invalid object path');

  const storageProvider = normalizeProvider(options.provider || cloudStorageProvider);
  if (storageProvider === 'local') {
    const localPath = localPathFromObjectPath(storedPath);
    const targetPath = path.join(uploadsRoot, localPath);
    if (!targetPath.startsWith(`${uploadsRoot}${path.sep}`)) throw new Error('Invalid local object path');
    return fs.promises.readFile(targetPath);
  }

  ensureCloudProvider(storageProvider);
  if (storageProvider === 'r2') {
    const result = await r2.send(new GetObjectCommand({ Bucket: r2Bucket, Key: storedPath }));
    return streamToBuffer(result.Body);
  }

  const { data, error } = await supabase.storage.from(supabaseBucket).download(storedPath);
  if (error) throw new Error(error.message || 'Cloud download failed');
  return Buffer.from(await data.arrayBuffer());
};

const setObjectResponseHeaders = (res, result = {}) => {
  if (result.ContentType) res.setHeader('Content-Type', result.ContentType);
  if (result.ContentLength !== undefined) res.setHeader('Content-Length', String(result.ContentLength));
  if (result.ContentRange) res.setHeader('Content-Range', result.ContentRange);
  if (result.ETag) res.setHeader('ETag', result.ETag);
  if (result.LastModified) res.setHeader('Last-Modified', new Date(result.LastModified).toUTCString());
  res.setHeader('Accept-Ranges', result.AcceptRanges || 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');
};

const getRouteObjectPath = (req) => {
  const rawValue = Array.isArray(req.params)
    ? req.params[0]
    : req.params?.[0] || req.params?.objectPath || '';
  try {
    return cleanObjectPath(String(rawValue || '').split('/').map(part => decodeURIComponent(part)).join('/'));
  } catch {
    return '';
  }
};

const serveR2Object = async (req, res, next) => {
  if (!isR2Configured || !r2) return next();

  const storedPath = getRouteObjectPath(req);
  if (!storedPath) return res.status(400).json({ msg: 'Invalid storage object path' });

  try {
    if (req.method === 'HEAD') {
      const head = await r2.send(new HeadObjectCommand({ Bucket: r2Bucket, Key: storedPath }));
      setObjectResponseHeaders(res, head);
      return res.end();
    }

    const range = cleanEnv(req.headers.range);
    const result = await r2.send(new GetObjectCommand({
      Bucket: r2Bucket,
      Key: storedPath,
      ...(range.startsWith('bytes=') ? { Range: range } : {})
    }));

    if (result.ContentRange) res.status(206);
    setObjectResponseHeaders(res, result);
    if (!result.Body) return res.end();
    return result.Body.pipe(res);
  } catch (err) {
    const statusCode = err?.$metadata?.httpStatusCode;
    if (statusCode === 404 || err.name === 'NoSuchKey' || err.name === 'NotFound') {
      return res.status(404).json({ msg: 'File not found' });
    }
    if (statusCode === 416 || err.name === 'InvalidRange') {
      return res.status(416).json({ msg: 'Requested range is not satisfiable' });
    }
    return next(err);
  }
};

const getMissingConfig = () => {
  if (requestedProvider === 'r2') {
    return [
      !r2Endpoint && 'R2_ENDPOINT or R2_ACCOUNT_ID',
      !r2AccessKeyId && 'R2_ACCESS_KEY_ID',
      !r2SecretAccessKey && 'R2_SECRET_ACCESS_KEY',
      !r2Bucket && 'R2_BUCKET_NAME'
    ].filter(Boolean);
  }

  if (requestedProvider === 'supabase') {
    return [
      !supabaseUrl && 'SUPABASE_URL',
      !supabaseServiceKey && 'SUPABASE_SERVICE_ROLE_KEY',
      !supabaseBucket && 'SUPABASE_BUCKET'
    ].filter(Boolean);
  }

  if (!isCloudStorageEnabled) {
    return [
      !r2Endpoint && 'R2_ENDPOINT or R2_ACCOUNT_ID',
      !r2AccessKeyId && 'R2_ACCESS_KEY_ID',
      !r2SecretAccessKey && 'R2_SECRET_ACCESS_KEY',
      !r2Bucket && 'R2_BUCKET_NAME',
      !supabaseUrl && 'SUPABASE_URL',
      !supabaseServiceKey && 'SUPABASE_SERVICE_ROLE_KEY',
      !supabaseBucket && 'SUPABASE_BUCKET'
    ].filter(Boolean);
  }

  return [];
};

const getStorageConfigStatus = () => ({
  provider: cloudStorageProvider,
  requestedProvider: requestedStorageProvider || 'auto',
  forceLocalStorage,
  enabled: isCloudStorageEnabled,
  localFallbackEnabled: allowLocalFallback,
  bucket: cloudStorageProvider === 'r2' ? r2Bucket : supabaseBucket,
  r2Bucket,
  r2EndpointConfigured: Boolean(r2Endpoint),
  r2AccessKeyConfigured: Boolean(r2AccessKeyId),
  r2SecretAccessKeyConfigured: Boolean(r2SecretAccessKey),
  r2PublicUrlConfigured: Boolean(r2PublicBaseUrl),
  supabaseBucket,
  urlConfigured: Boolean(supabaseUrl),
  serviceRoleKeyConfigured: Boolean(supabaseServiceKey),
  serviceRoleKeyLooksLikeJwt: serviceKeyLooksLikeJwt,
  status: isCloudStorageEnabled
    ? `${cloudStorageProvider} cloud enabled`
    : 'local uploads',
  missing: getMissingConfig()
});

module.exports = {
  cloudStorageProvider,
  deleteObject,
  getObjectUrl,
  getStorageConfigStatus,
  isCloudStorageEnabled,
  readObjectBuffer,
  serveR2Object,
  uploadBuffer,
  uploadObjectBuffer
};
