#!/usr/bin/env node

const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const {
  deleteObject,
  getStorageConfigStatus,
  isCloudStorageEnabled,
  uploadBuffer
} = require('../services/storage');

const main = async () => {
  const status = getStorageConfigStatus();
  console.log('Storage provider:', status.provider);
  console.log('Bucket:', status.bucket || 'missing');
  console.log('Config status:', status.status);

  if (status.missing.length) {
    console.error(`Missing required env: ${status.missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  if (!status.serviceRoleKeyLooksLikeJwt) {
    console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY does not look like the long Supabase service_role JWT key.');
  }

  if (!isCloudStorageEnabled) {
    console.error('Cloud storage is not enabled.');
    process.exitCode = 1;
    return;
  }

  let uploaded = null;
  try {
    uploaded = await uploadBuffer({
      buffer: Buffer.from(`Syncrova storage check ${new Date().toISOString()}`),
      originalName: 'storage-check.txt',
      mimeType: 'text/plain',
      folder: 'healthchecks'
    });

    console.log('Upload: ok');
    console.log('Object path:', uploaded.path || 'missing');

    if (uploaded.url) {
      const response = await fetch(uploaded.url);
      console.log('Public read:', response.ok ? 'ok' : `${response.status} failed`);
      if (!response.ok) {
        console.warn('Public URL was generated but could not be read. Make the bucket public or add signed URL support.');
      }
    } else {
      console.warn('Public URL: missing');
    }
  } catch (err) {
    console.error('Storage check failed:', err.message || err);
    if (/Invalid Compact JWS/i.test(err.message || '')) {
      console.error('Fix: use the Supabase service_role API key. Do not use the JWT Secret, anon key, or publishable key here.');
    }
    process.exitCode = 1;
    return;
  } finally {
    if (uploaded?.path) {
      await deleteObject(uploaded.path)
        .then(() => console.log('Delete: ok'))
        .catch(err => console.warn('Delete failed:', err.message || err));
    }
  }
};

main();
