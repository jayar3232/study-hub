const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const DEFAULT_RELEASE_APK_PATH = '/uploads/releases/syncrova-latest.apk';
const releaseApkPath = path.join(__dirname, '..', 'uploads', 'releases', 'syncrova-latest.apk');

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const getRequestOrigin = (req) => {
  const configured = process.env.APP_PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL || '';
  if (configured) return configured.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
};

const toAbsoluteUrl = (req, value) => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const normalizedPath = value.startsWith('/') ? value : `/${value}`;
  return `${getRequestOrigin(req)}${normalizedPath}`;
};

router.get('/update', (req, res) => {
  const apkUrl = process.env.APP_APK_URL || DEFAULT_RELEASE_APK_PATH;
  const apkAvailable = Boolean(process.env.APP_APK_URL) || fs.existsSync(releaseApkPath);

  res.set('Cache-Control', 'no-store');
  res.json({
    platform: 'android',
    versionCode: Number(process.env.APP_VERSION_CODE || 2),
    versionName: process.env.APP_VERSION_NAME || '1.0.1',
    available: apkAvailable,
    required: toBoolean(process.env.APP_UPDATE_REQUIRED, false),
    apkUrl: toAbsoluteUrl(req, apkUrl),
    notes: process.env.APP_UPDATE_NOTES || 'Latest SYNCROVA mobile improvements and fixes.'
  });
});

module.exports = router;
