const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getLiveKitStatus } = require('../services/livekitConfig');
const { getStorageConfigStatus } = require('../services/storage');
const { runStorageProbe } = require('../services/mediaDiagnostics');

const router = express.Router();

const publicReleaseDir = path.join(__dirname, '..', 'public', 'releases');
const uploadedReleaseDir = path.join(__dirname, '..', 'uploads', 'releases');
const apkHashCache = new Map();
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

const bundledRelease = {
  versionName: '4.4.20',
  versionCode: 67
};

const getConfiguredVersionCode = () => {
  const value = Number(process.env.APP_VERSION_CODE);
  return Number.isInteger(value) && value > 0 ? value : 0;
};

const getReleaseInfo = () => {
  const configuredVersionCode = getConfiguredVersionCode();
  const canUseConfiguredRelease = configuredVersionCode >= bundledRelease.versionCode;

  if (!canUseConfiguredRelease) {
    return {
      ...bundledRelease,
      usesConfiguredRelease: false
    };
  }

  return {
    versionName: String(process.env.APP_VERSION_NAME || bundledRelease.versionName).trim() || bundledRelease.versionName,
    versionCode: configuredVersionCode,
    usesConfiguredRelease: true
  };
};

const isConfiguredApkUrlAllowed = (apkUrl, releaseInfo) => {
  if (!apkUrl) return false;
  if (!releaseInfo.usesConfiguredRelease && getConfiguredVersionCode()) return false;

  const safeVersion = String(releaseInfo.versionName || '').replace(/[^a-zA-Z0-9._-]/g, '-');
  const versionedApkPattern = /syncrova-([^/?#]+)\.apk/i;
  const match = String(apkUrl).match(versionedApkPattern);

  return Boolean(match) && match[1] === safeVersion;
};

const getReleaseApkFileName = (versionName) => (
  `syncrova-${String(versionName || 'latest').replace(/[^a-zA-Z0-9._-]/g, '-')}.apk`
);

const getLocalReleaseApk = (versionName) => {
  const fileName = getReleaseApkFileName(versionName);
  const bundledPath = path.join(publicReleaseDir, fileName);
  const uploadedPath = path.join(uploadedReleaseDir, fileName);

  if (fs.existsSync(uploadedPath)) {
    return {
      filePath: uploadedPath,
      urlPath: `/uploads/releases/${fileName}`
    };
  }

  if (fs.existsSync(bundledPath)) {
    return {
      filePath: bundledPath,
      urlPath: `/releases/${fileName}`
    };
  }

  return {
    filePath: '',
    urlPath: `/releases/${fileName}`
  };
};

const getFileSha256 = (filePath) => {
  if (!filePath) return '';

  try {
    const stat = fs.statSync(filePath);
    const cacheKey = `${filePath}:${stat.size}:${stat.mtimeMs}`;
    if (apkHashCache.has(cacheKey)) return apkHashCache.get(cacheKey);

    const hash = crypto
      .createHash('sha256')
      .update(fs.readFileSync(filePath))
      .digest('hex');

    apkHashCache.clear();
    apkHashCache.set(cacheKey, hash);
    return hash;
  } catch {
    return '';
  }
};

const getReleaseDownload = () => {
  const releaseInfo = getReleaseInfo();
  const { versionName } = releaseInfo;
  const releaseApk = getLocalReleaseApk(versionName);
  const configuredApkUrl = String(process.env.APP_APK_URL || '').trim();
  const useConfiguredApkUrl = isConfiguredApkUrlAllowed(configuredApkUrl, releaseInfo);
  const useLocalApk = Boolean(releaseApk.filePath);
  const apkUrl = useLocalApk ? releaseApk.urlPath : (useConfiguredApkUrl ? configuredApkUrl : releaseApk.urlPath);

  return {
    releaseInfo,
    releaseApk,
    apkUrl,
    apkAvailable: useLocalApk || useConfiguredApkUrl
  };
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
  const { releaseInfo, releaseApk, apkUrl, apkAvailable } = getReleaseDownload();
  const { versionName, versionCode } = releaseInfo;
  const apkSize = releaseApk.filePath ? fs.statSync(releaseApk.filePath).size : 0;
  const apkSha256 = releaseApk.filePath ? getFileSha256(releaseApk.filePath) : '';

  res.set('Cache-Control', 'no-store');
  res.json({
    platform: 'android',
    versionCode,
    versionName,
    available: apkAvailable,
    required: toBoolean(process.env.APP_UPDATE_REQUIRED, true),
    apkUrl: toAbsoluteUrl(req, apkUrl),
    apkSize,
    apkSha256,
    calls: getLiveKitStatus(),
    notes: process.env.APP_UPDATE_NOTES || 'Syncrova 4.4.18 makes group chat match the direct conversation layout|Smooths Android media picking for photo and video sends|Keeps APK install verification to prevent version downgrades'
  });
});

router.get('/ice-servers', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(getIceServers());
});

router.get('/storage-status', async (req, res) => {
  const status = getStorageConfigStatus();
  const runProbe = ['1', 'true', 'yes'].includes(String(req.query.probe || '').toLowerCase());
  const storageProbe = runProbe ? await runStorageProbe() : null;

  res.set('Cache-Control', 'no-store');
  res.json({
    provider: status.provider,
    requestedProvider: status.requestedProvider,
    hostedRuntime: status.hostedRuntime,
    enabled: status.enabled,
    configured: status.configured,
    status: status.status,
    missing: status.missing,
    r2EndpointConfigured: status.r2EndpointConfigured,
    r2AccessKeyConfigured: status.r2AccessKeyConfigured,
    r2SecretAccessKeyConfigured: status.r2SecretAccessKeyConfigured,
    r2PublicUrlConfigured: status.r2PublicUrlConfigured,
    storageProbe
  });
});

router.getReleaseInfo = getReleaseInfo;
router.getReleaseApkFileName = getReleaseApkFileName;
router.getReleaseDownload = getReleaseDownload;

module.exports = router;
