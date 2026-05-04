const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const DEFAULT_RELEASE_APK_PATH = '/releases/syncrova-latest.apk';
const bundledReleaseApkPath = path.join(__dirname, '..', 'public', 'releases', 'syncrova-latest.apk');
const uploadedReleaseApkPath = path.join(__dirname, '..', 'uploads', 'releases', 'syncrova-latest.apk');
const DEFAULT_STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun.cloudflare.com:3478'
];

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

const parseList = (value = '') => String(value || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

const getTurnUrls = () => parseList(
  process.env.TURN_URLS
  || process.env.APP_TURN_URLS
  || process.env.VITE_TURN_URLS
  || ''
);

const getIceServers = () => {
  const turnUrls = getTurnUrls();
  const iceServers = [{ urls: DEFAULT_STUN_SERVERS }];

  if (turnUrls.length) {
    iceServers.push({
      urls: turnUrls,
      username: process.env.TURN_USERNAME || process.env.APP_TURN_USERNAME || process.env.VITE_TURN_USERNAME || undefined,
      credential: process.env.TURN_CREDENTIAL || process.env.APP_TURN_CREDENTIAL || process.env.VITE_TURN_CREDENTIAL || undefined
    });
  }

  return {
    iceServers,
    relayConfigured: turnUrls.length > 0
  };
};

router.get('/update', (req, res) => {
  const apkUrl = process.env.APP_APK_URL || DEFAULT_RELEASE_APK_PATH;
  const apkAvailable = Boolean(process.env.APP_APK_URL)
    || fs.existsSync(bundledReleaseApkPath)
    || fs.existsSync(uploadedReleaseApkPath);

  res.set('Cache-Control', 'no-store');
  res.json({
    platform: 'android',
    versionCode: Number(process.env.APP_VERSION_CODE || 20),
    versionName: process.env.APP_VERSION_NAME || '3.1.1',
    available: apkAvailable,
    required: toBoolean(process.env.APP_UPDATE_REQUIRED, false),
    apkUrl: toAbsoluteUrl(req, apkUrl),
    notes: process.env.APP_UPDATE_NOTES || 'Call reliability, mobile in-call layout, and friend request controls update.'
  });
});

router.get('/ice-servers', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(getIceServers());
});

module.exports = router;
