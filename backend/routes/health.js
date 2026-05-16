const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const { getStorageConfigStatus, isCloudStorageEnabled } = require('../services/storage');
const { getLiveKitStatus } = require('../services/livekitConfig');

const router = express.Router();

const mongoStates = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

const getReleaseApkPath = () => {
  const versionName = String(process.env.APP_VERSION_NAME || '4.2.1').trim() || '4.2.1';
  const safeVersion = versionName.replace(/[^a-zA-Z0-9._-]/g, '-');
  return `/releases/syncrova-${safeVersion}.apk`;
};

router.get('/', auth, async (req, res) => {
  const io = req.app.get('io');
  const turnUrls = String(process.env.TURN_URLS || process.env.APP_TURN_URLS || process.env.VITE_TURN_URLS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const relayForced = String(
    process.env.CALL_FORCE_RELAY
    || process.env.APP_CALL_FORCE_RELAY
    || process.env.VITE_CALL_FORCE_RELAY
    || ''
  ).toLowerCase() === 'true';
  const livekitStatus = getLiveKitStatus();
  const livekitConfigured = Boolean(livekitStatus.livekitConfigured);

  res.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    api: {
      status: 'online',
      nodeEnv: process.env.NODE_ENV || 'development'
    },
    database: {
      status: mongoStates[mongoose.connection.readyState] || 'unknown',
      readyState: mongoose.connection.readyState
    },
    socket: {
      status: io ? 'online' : 'unavailable',
      connectedClients: io?.engine?.clientsCount || 0
    },
    storage: getStorageConfigStatus(),
    calls: {
      turnConfigured: turnUrls.length > 0,
      turnCount: turnUrls.length,
      livekitConfigured,
      livekitMissing: livekitStatus.livekitMissing,
      livekitWarnings: livekitStatus.livekitWarnings,
      livekitSourceKeys: livekitStatus.livekitSourceKeys,
      relayMode: relayForced
        ? 'relay preferred'
        : livekitConfigured
          ? 'livekit'
          : 'auto'
    },
    assistant: {
      openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    },
    app: {
      releaseUrl: process.env.APP_APK_URL || getReleaseApkPath()
    }
  });
});

module.exports = router;
