const CHAT_BACKGROUND_IDS = [
  'default',
  'aurora',
  'lagoon',
  'midnight',
  'graphite',
  'soft-blue',
  'lavender',
  'peach',
  'mint',
  'classroom',
  'grid-paper',
  'circuit',
  'topographic',
  'prism',
  'sunrise',
  'velvet',
  'starfield',
  'blue-doodles',
  'mono-doodles',
  'moon-garden',
  'city-lights',
  'retro-street',
  'love-notes',
  'ocean-window',
  'pastel-stickers',
  'space-doodles',
  'sage-paper'
];

const DEFAULT_CHAT_BACKGROUND_ID = 'default';
const CHAT_BACKGROUND_ID_SET = new Set(CHAT_BACKGROUND_IDS);

const normalizeChatBackgroundId = (value = '') => {
  const id = String(value || '').trim();
  return CHAT_BACKGROUND_ID_SET.has(id) ? id : '';
};

module.exports = {
  CHAT_BACKGROUND_IDS,
  DEFAULT_CHAT_BACKGROUND_ID,
  normalizeChatBackgroundId
};
