const isNativeApp = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.Capacitor?.isNativePlatform?.());
};

const isNotificationSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export const getNotificationPermissionState = async () => {
  if (isNativeApp()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const state = await LocalNotifications.checkPermissions();
      return state.display || 'prompt';
    } catch {
      return 'prompt';
    }
  }

  if (!isNotificationSupported()) return 'unsupported';
  return window.Notification.permission;
};

export const requestNotificationPermission = async () => {
  if (isNativeApp()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const state = await LocalNotifications.requestPermissions();
      return state.display || 'prompt';
    } catch {
      return 'denied';
    }
  }

  if (!isNotificationSupported()) return 'unsupported';
  return window.Notification.requestPermission();
};

export const showAppNotification = async ({ title, body, tag, data } = {}) => {
  if (!title) return;

  if (isNativeApp()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const state = await LocalNotifications.checkPermissions();
      if (state.display !== 'granted') return;
      await LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Date.now() % 2147483647),
          title,
          body,
          extra: data,
          schedule: { at: new Date(Date.now() + 120) }
        }]
      });
    } catch {
      // Native notification support is optional.
    }
    return;
  }

  if (!isNotificationSupported() || window.Notification.permission !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker?.ready?.catch(() => null);
    if (registration?.showNotification) {
      registration.showNotification(title, {
        body,
        tag,
        data,
        icon: '/syncrova-app-logo.png',
        badge: '/pwa-192.png'
      });
      return;
    }

    new window.Notification(title, { body, tag, data, icon: '/syncrova-app-logo.png' });
  } catch {
    // Never block realtime chat if notification delivery fails.
  }
};
