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

const isCallRelayForced = () => toBoolean(
  process.env.CALL_FORCE_RELAY
  || process.env.APP_CALL_FORCE_RELAY
  || process.env.VITE_CALL_FORCE_RELAY,
  false
);

const getLiveKitStatus = () => {
  const missing = [
    !String(process.env.LIVEKIT_URL || '').trim() && 'LIVEKIT_URL',
    !String(process.env.LIVEKIT_API_KEY || '').trim() && 'LIVEKIT_API_KEY',
    !String(process.env.LIVEKIT_API_SECRET || '').trim() && 'LIVEKIT_API_SECRET'
  ].filter(Boolean);

  return {
    livekitConfigured: missing.length === 0,
    livekitMissing: missing
  };
};

const getIceServers = () => {
  const turnUrls = getTurnUrls();
  const iceServers = [{ urls: DEFAULT_STUN_SERVERS }];
  const relayConfigured = turnUrls.length > 0;
  const forceRelay = relayConfigured && isCallRelayForced();

  if (relayConfigured) {
    iceServers.push({
      urls: turnUrls,
      username: process.env.TURN_USERNAME || process.env.APP_TURN_USERNAME || process.env.VITE_TURN_USERNAME || undefined,
      credential: process.env.TURN_CREDENTIAL || process.env.APP_TURN_CREDENTIAL || process.env.VITE_TURN_CREDENTIAL || undefined
    });
  }

  return {
    iceServers,
    relayConfigured,
    forceRelay,
    iceTransportPolicy: forceRelay ? 'relay' : 'all',
    ttlSeconds: 300
  };
};

router.get('/update', (req, res) => {
  const apkUrl = process.env.APP_APK_URL || DEFAULT_RELEASE_APK_PATH;
  const apkAvailable = Boolean(process.env.APP_APK_URL)
    || fs.existsSync(bundledReleaseApkPath)
    || fs.existsSync(uploadedReleaseApkPath);
  const localApkPath = fs.existsSync(bundledReleaseApkPath)
    ? bundledReleaseApkPath
    : (fs.existsSync(uploadedReleaseApkPath) ? uploadedReleaseApkPath : '');
  const apkSize = localApkPath ? fs.statSync(localApkPath).size : 0;

  res.set('Cache-Control', 'no-store');
  res.json({
    platform: 'android',
    versionCode: Number(process.env.APP_VERSION_CODE || 40),
    versionName: process.env.APP_VERSION_NAME || '3.3.10',
    available: apkAvailable,
    required: toBoolean(process.env.APP_UPDATE_REQUIRED, true),
    apkUrl: toAbsoluteUrl(req, apkUrl),
    apkSize,
    calls: getLiveKitStatus(),
    notes: process.env.APP_UPDATE_NOTES || 'Knife Duel visual overhaul with larger fighters|Cinematic throwing-knife camera, dust, sound, and haptics|Student marketplace and mobile UI polish|LiveKit voice and video call support'
  });
});

router.get('/ice-servers', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(getIceServers());
});

module.exports = router;
