import messageReceivedUrl from './message recieved.mp3';
import messageSendUrl from './message send.mp3';
import clickSoundUrl from './clicksounds.mp3';
import incomingCallUrl from './incommingcallsoundeffext.mp3';

const soundCache = new Map();
const soundLastPlayedAt = new Map();
let pendingPlayback = null;
let removePlaybackUnlock = null;
const MIN_SOUND_GAP_MS = 70;

const soundSources = {
  click: clickSoundUrl,
  tab: clickSoundUrl,
  welcome: '/welcome.mp3',
  open: messageReceivedUrl,
  close: messageReceivedUrl,
  send: messageSendUrl,
  message: messageReceivedUrl,
  notification: messageReceivedUrl,
  ringtone: incomingCallUrl,
  call: incomingCallUrl,
  'incoming call': incomingCallUrl,
  incomingcall: incomingCallUrl,
  success: messageSendUrl,
  ding: messageReceivedUrl,
  'message send': messageSendUrl,
  'message received': messageReceivedUrl,
  'message recieved': messageReceivedUrl
};

const generatedSoundNames = new Set(['ringtone', 'call', 'incoming call']);
let generatedAudioContext = null;

const playGeneratedSound = (name, volume = 0.35) => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return false;

  generatedAudioContext = generatedAudioContext || new AudioContext();
  const context = generatedAudioContext;
  const normalizedName = String(name || '').trim().toLowerCase();
  const startAt = context.currentTime + 0.02;
  const notes = normalizedName.includes('ring')
    ? [
        { offset: 0, frequency: 880, duration: 0.16 },
        { offset: 0.2, frequency: 660, duration: 0.18 },
        { offset: 0.48, frequency: 880, duration: 0.16 },
        { offset: 0.68, frequency: 660, duration: 0.2 }
      ]
    : [{ offset: 0, frequency: 720, duration: 0.12 }];

  notes.forEach(note => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(note.frequency, startAt + note.offset);
    gain.gain.setValueAtTime(0.0001, startAt + note.offset);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.14), startAt + note.offset + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + note.offset + note.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt + note.offset);
    oscillator.stop(startAt + note.offset + note.duration + 0.04);
  });

  return true;
};

const getSoundUrl = (name) => {
  const normalized = String(name || '').trim().toLowerCase();
  return soundSources[normalized] || soundSources[normalized.replace(/-/g, ' ')] || null;
};

const installPlaybackUnlock = () => {
  if (typeof window === 'undefined' || removePlaybackUnlock) return;

  const replayPendingSound = () => {
    const queued = pendingPlayback;
    pendingPlayback = null;
    if (removePlaybackUnlock) removePlaybackUnlock();
    if (queued) playUiSound(queued.name, queued.volume);
  };

  window.addEventListener('pointerdown', replayPendingSound, true);
  window.addEventListener('keydown', replayPendingSound, true);
  window.addEventListener('touchstart', replayPendingSound, true);

  removePlaybackUnlock = () => {
    window.removeEventListener('pointerdown', replayPendingSound, true);
    window.removeEventListener('keydown', replayPendingSound, true);
    window.removeEventListener('touchstart', replayPendingSound, true);
    removePlaybackUnlock = null;
  };
};

export const playUiSound = (name, volume = 0.35) => {
  if (typeof window === 'undefined' || !name) return;

  try {
    const normalizedName = String(name).trim().toLowerCase();
    const now = Date.now();
    const lastPlayedAt = soundLastPlayedAt.get(normalizedName) || 0;
    if (now - lastPlayedAt < MIN_SOUND_GAP_MS) return;
    soundLastPlayedAt.set(normalizedName, now);

    const url = getSoundUrl(name);
    if (!url) {
      if (generatedSoundNames.has(normalizedName)) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        generatedAudioContext = generatedAudioContext || new AudioContext();
        const resume = generatedAudioContext.state === 'suspended'
          ? generatedAudioContext.resume()
          : Promise.resolve();
        resume
          .then(() => playGeneratedSound(normalizedName, volume))
          .catch(() => {
            pendingPlayback = { name, volume };
            installPlaybackUnlock();
          });
      }
      return;
    }

    const key = `${name}:${volume}`;
    const audio = soundCache.get(key) || new Audio(url);
    audio.volume = volume;
    audio.currentTime = 0;
    soundCache.set(key, audio);
    audio.play().catch(() => {
      pendingPlayback = { name, volume };
      installPlaybackUnlock();
    });
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

    const explicitSound = interactive.getAttribute('data-sound');
    const soundName = explicitSound === 'tab' || interactive.closest('nav') ? 'tab' : '';
    if (!soundName) return;
    playUiSound(soundName, 0.16);
  };

  document.addEventListener('click', handleClick, true);
  removeGlobalClickSound = () => {
    document.removeEventListener('click', handleClick, true);
    removeGlobalClickSound = null;
  };

  return removeGlobalClickSound;
};
