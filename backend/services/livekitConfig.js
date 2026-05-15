const readFirstEnv = (keys = []) => {
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return { key, value };
  }
  return { key: keys[0] || '', value: '' };
};

const livekitEnvKeys = {
  url: ['LIVEKIT_URL', 'LIVEKIT_WS_URL', 'LIVEKIT_CLOUD_URL', 'VITE_LIVEKIT_URL'],
  apiKey: ['LIVEKIT_API_KEY', 'LIVEKIT_KEY', 'LIVEKIT_APIKEY'],
  apiSecret: ['LIVEKIT_API_SECRET', 'LIVEKIT_SECRET', 'LIVEKIT_API_SECRET_KEY']
};

const getLiveKitConfig = () => {
  const url = readFirstEnv(livekitEnvKeys.url);
  const apiKey = readFirstEnv(livekitEnvKeys.apiKey);
  const apiSecret = readFirstEnv(livekitEnvKeys.apiSecret);

  const missing = [
    !url.value && 'LIVEKIT_URL',
    !apiKey.value && 'LIVEKIT_API_KEY',
    !apiSecret.value && 'LIVEKIT_API_SECRET'
  ].filter(Boolean);

  return {
    livekitUrl: url.value,
    apiKey: apiKey.value,
    apiSecret: apiSecret.value,
    configured: missing.length === 0,
    missing,
    sourceKeys: {
      url: url.value ? url.key : '',
      apiKey: apiKey.value ? apiKey.key : '',
      apiSecret: apiSecret.value ? apiSecret.key : ''
    }
  };
};

const getLiveKitStatus = () => {
  const config = getLiveKitConfig();
  return {
    livekitConfigured: config.configured,
    livekitMissing: config.missing,
    livekitSourceKeys: config.sourceKeys
  };
};

module.exports = {
  getLiveKitConfig,
  getLiveKitStatus
};
