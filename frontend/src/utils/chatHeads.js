let nativeBridgePromise = null;

const defaultStatus = {
  supported: false,
  enabled: false,
  canDrawOverlays: false
};

export const isNativeAndroid = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.Capacitor?.isNativePlatform?.()) && window.Capacitor?.getPlatform?.() === 'android';
};

const getNativeBridge = async () => {
  if (!nativeBridgePromise) {
    nativeBridgePromise = import('@capacitor/core')
      .then(({ registerPlugin }) => registerPlugin('SyncrovaNativeBridge'))
      .catch(() => null);
  }
  return nativeBridgePromise;
};

const normalizeStatus = (status = {}) => ({
  supported: Boolean(status.supported),
  enabled: Boolean(status.enabled),
  canDrawOverlays: Boolean(status.canDrawOverlays)
});

export const getChatHeadsStatus = async () => {
  if (!isNativeAndroid()) return defaultStatus;

  try {
    const bridge = await getNativeBridge();
    if (!bridge?.getChatHeadsStatus) return defaultStatus;
    return normalizeStatus(await bridge.getChatHeadsStatus());
  } catch {
    return defaultStatus;
  }
};

export const setChatHeadsEnabled = async (enabled) => {
  if (!isNativeAndroid()) return defaultStatus;

  try {
    const bridge = await getNativeBridge();
    if (!bridge?.setChatHeadsEnabled) return defaultStatus;
    return normalizeStatus(await bridge.setChatHeadsEnabled({ enabled: Boolean(enabled) }));
  } catch {
    return defaultStatus;
  }
};

export const openChatHeadSettings = async () => {
  if (!isNativeAndroid()) return defaultStatus;

  try {
    const bridge = await getNativeBridge();
    if (!bridge?.openChatHeadSettings) return defaultStatus;
    return normalizeStatus(await bridge.openChatHeadSettings());
  } catch {
    return defaultStatus;
  }
};
