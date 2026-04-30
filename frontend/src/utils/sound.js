import messageReceivedUrl from './message recieved.mp3';
import messageSendUrl from './message send.mp3';

const soundCache = new Map();

const soundSources = {
  send: messageSendUrl,
  message: messageReceivedUrl,
  notification: messageReceivedUrl,
  success: messageSendUrl,
  ding: messageReceivedUrl,
  'message send': messageSendUrl,
  'message received': messageReceivedUrl,
  'message recieved': messageReceivedUrl
};

const getSoundUrl = (name) => {
  const normalized = String(name || '').trim().toLowerCase();
  return soundSources[normalized] || soundSources[normalized.replace(/-/g, ' ')] || null;
};

export const playUiSound = (name, volume = 0.35) => {
  if (typeof window === 'undefined' || !name) return;

  try {
    const url = getSoundUrl(name);
    if (!url) return;

    const key = `${name}:${volume}`;
    const audio = soundCache.get(key) || new Audio(url);
    audio.volume = volume;
    audio.currentTime = 0;
    soundCache.set(key, audio);
    audio.play().catch(() => {});
  } catch {
    // Missing sound files should never break the app.
  }
};
