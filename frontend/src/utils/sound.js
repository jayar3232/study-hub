import messageReceivedUrl from './message recieved.mp3';
import messageSendUrl from './message send.mp3';
import clickSoundUrl from './clicksounds.mp3';

const soundCache = new Map();

const soundSources = {
  click: clickSoundUrl,
  tab: clickSoundUrl,
  open: messageReceivedUrl,
  close: messageReceivedUrl,
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

let removeGlobalClickSound = null;

export const installGlobalClickSound = () => {
  if (typeof document === 'undefined') return () => {};
  if (removeGlobalClickSound) return removeGlobalClickSound;

  const handleClick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const muted = target.closest('[data-sound="off"]');
    if (muted) return;

    const interactive = target.closest(
      'button, a, [role="button"], input[type="checkbox"], input[type="radio"], select, summary, label'
    );
    if (!interactive) return;

    if (
      interactive.hasAttribute('disabled') ||
      interactive.getAttribute('aria-disabled') === 'true'
    ) {
      return;
    }

    const soundName = interactive.getAttribute('data-sound') ||
      (interactive.closest('nav') ? 'tab' : 'click');
    playUiSound(soundName, 0.16);
  };

  document.addEventListener('click', handleClick, true);
  removeGlobalClickSound = () => {
    document.removeEventListener('click', handleClick, true);
    removeGlobalClickSound = null;
  };

  return removeGlobalClickSound;
};
