import React, { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Bell, BellOff, CheckCheck, Clapperboard, Home, Users, MessageCircle, User, LogOut, Menu, Moon, Sun, Trash2, X, Volume2, Target, UserPlus, Download, PlusCircle, WifiOff } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { resolveMediaUrl } from '../utils/media';
import { installGlobalClickSound, playUiSound } from '../utils/sound';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { AppLogoMark, AppWordmark } from './AppLogo';
import { getNotificationPermissionState, requestNotificationPermission, showAppNotification } from '../utils/notifications';
import OnlineRoster from './OnlineRoster';

const APP_NAME = 'SYNCROVA';

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const getDisplayName = (entity, fallback = 'User') => entity?.name || entity?.email || fallback;

const getMessageSnippet = (message) => {
  if (!message) return 'New message';
  if (message.unsent) return 'Message unsent';
  if (message.text?.trim()) return message.text;
  if (message.fileType === 'image') return 'Sent a photo';
  if (message.fileType === 'video') return 'Sent a video';
  if (message.fileType === 'audio') return 'Sent a voice message';
  if (message.fileUrl) return message.fileName || 'Sent an attachment';
  return 'New message';
};

const formatNotificationTime = (value) => {
  if (!value) return 'Now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Now';
  const diffMins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function Layout({ children }) {
  const { theme, currentTheme, toggleTheme, mobileLightOnly } = useTheme();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [groupBadgeCount, setGroupBadgeCount] = useState(0);
  const [friendBadgeCount, setFriendBadgeCount] = useState(0);
  const [developerAccess, setDeveloperAccess] = useState(Boolean(user?.isDeveloper));
  const [messagePopups, setMessagePopups] = useState([]);
  const [dndEnabled, setDndEnabled] = useState(() => localStorage.getItem('workloop-dnd') === 'true');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [notificationPermission, setNotificationPermission] = useState('prompt');
  const [isInstalledApp, setIsInstalledApp] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true;
  });
  const messageTimersRef = useRef({});
  const navigate = useNavigate();
  const location = useLocation();
  const avatarSrc = resolveMediaUrl(user?.avatar);
  const pageContent = children || <Outlet />;
  const isCompactRoute = location.pathname.startsWith('/messages') || location.pathname.startsWith('/arena') || location.pathname.startsWith('/group/') || location.pathname.startsWith('/reels');
  const isDashboardRoute = location.pathname === '/dashboard';
  const isWorkspaceRoute = location.pathname === '/groups';
  const isProfileRoute = location.pathname.startsWith('/profile');
  const shouldShowSocialRail = !isCompactRoute && !isDashboardRoute && !isWorkspaceRoute && !isProfileRoute;

  const pageMeta = (() => {
    if (location.pathname.startsWith('/groups')) return { title: 'Workspaces', helper: 'Projects, teams, invites', action: () => navigate('/groups') };
    if (location.pathname.startsWith('/messages')) return { title: 'Messages', helper: 'Realtime chats and media', action: () => navigate('/messages') };
    if (location.pathname.startsWith('/reels')) return { title: 'Gallery', helper: 'Photos and videos', action: () => navigate('/reels') };
    if (location.pathname.startsWith('/friends')) return { title: 'Friends', helper: 'Requests and teammates', action: () => navigate('/friends') };
    if (location.pathname.startsWith('/arena')) return { title: developerAccess ? 'Developer Console' : 'Fix Arena', helper: 'Reports, games, ranks', action: () => navigate('/arena') };
    if (location.pathname.startsWith('/profile')) return { title: 'Me', helper: 'Profile and settings', action: () => navigate('/profile') };
    if (location.pathname.startsWith('/group/')) return { title: 'Workspace', helper: 'Focused project room', action: () => navigate('/groups') };
    return { title: 'Dashboard', helper: 'Today at a glance', action: () => navigate('/dashboard') };
  })();

  useEffect(() => {
    localStorage.setItem('workloop-dnd', String(dndEnabled));
  }, [dndEnabled]);

  useEffect(() => installGlobalClickSound(), []);

  useEffect(() => {
    let cancelled = false;
    getNotificationPermissionState().then(state => {
      if (!cancelled) setNotificationPermission(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalledApp(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => () => {
    Object.values(messageTimersRef.current).forEach(clearTimeout);
    messageTimersRef.current = {};
  }, []);

  useEffect(() => {
    const handler = (e) => {
      setUnreadCount(e.detail?.count || 0);
    };
    window.addEventListener('unreadMessages', handler);
    return () => window.removeEventListener('unreadMessages', handler);
  }, []);

  useEffect(() => {
    if (!user) {
      setDeveloperAccess(false);
      return undefined;
    }

    setDeveloperAccess(Boolean(user?.isDeveloper));

    let cancelled = false;
    api.get('/games/developers/me')
      .then(res => {
        if (!cancelled) setDeveloperAccess(Boolean(res.data?.isDeveloper || user?.isDeveloper));
      })
      .catch(() => {
        if (!cancelled) setDeveloperAccess(Boolean(user?.isDeveloper));
      });

    const developerHandler = (event) => {
      setDeveloperAccess(Boolean(event.detail?.isDeveloper));
    };

    window.addEventListener('developerAccessUpdated', developerHandler);
    return () => {
      cancelled = true;
      window.removeEventListener('developerAccessUpdated', developerHandler);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    let cancelled = false;
    const loadBadges = async () => {
      try {
        const [messageRes, inviteRes, friendRes] = await Promise.all([
          api.get('/messages/conversations').catch(() => ({ data: [] })),
          api.get('/groups/invites/me').catch(() => ({ data: [] })),
          api.get('/friends/summary').catch(() => ({ data: { incoming: [] } }))
        ]);
        if (cancelled) return;

        setUnreadCount((messageRes.data || []).reduce((total, item) => total + (item.unreadCount || 0), 0));
        setGroupBadgeCount((inviteRes.data || []).length);
        setFriendBadgeCount((friendRes.data?.incoming || []).length);
      } catch (err) {
        console.error('Badge sync failed', err);
      }
    };

    loadBadges();
    const interval = setInterval(loadBadges, 30000);
    const groupsHandler = () => loadBadges();
    const friendsHandler = () => loadBadges();
    window.addEventListener('groupsUpdated', groupsHandler);
    window.addEventListener('friendsUpdated', friendsHandler);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('groupsUpdated', groupsHandler);
      window.removeEventListener('friendsUpdated', friendsHandler);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    const socket = getSocket();
    const refreshFriends = () => {
      api.get('/friends/summary')
        .then(res => setFriendBadgeCount((res.data?.incoming || []).length))
        .catch(() => {});
      window.dispatchEvent(new CustomEvent('friendsUpdated'));
    };

    socket.on('friend-request-updated', refreshFriends);
    return () => socket.off('friend-request-updated', refreshFriends);
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    let cancelled = false;
    const loadNotifications = async () => {
      try {
        const res = await api.get('/notifications');
        if (cancelled) return;
        setNotifications(res.data?.notifications || []);
        setNotificationUnreadCount(res.data?.unreadCount || 0);
      } catch {
        // Notification center is non-blocking.
      }
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 45000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    const socket = getSocket();
    const refreshNotifications = ({ unreadCount: nextUnreadCount, notification } = {}) => {
      if (typeof nextUnreadCount === 'number') setNotificationUnreadCount(nextUnreadCount);
      if (notification) setNotifications(prev => [notification, ...prev.filter(item => getEntityId(item) !== getEntityId(notification))].slice(0, 40));
      api.get('/notifications')
        .then(res => {
          setNotifications(res.data?.notifications || []);
          setNotificationUnreadCount(res.data?.unreadCount || 0);
        })
        .catch(() => {});
    };

    socket.on('notifications-updated', refreshNotifications);
    return () => socket.off('notifications-updated', refreshNotifications);
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    const currentUserId = getEntityId(user);
    const socket = getSocket();

    const onReceiveMessage = (message) => {
      const fromId = getEntityId(message.from);
      const toId = getEntityId(message.to);
      const messageId = getEntityId(message) || `${fromId}-${Date.now()}`;
      const isIncoming = toId === currentUserId && fromId !== currentUserId;

      if (!isIncoming) return;

      if (!location.pathname.startsWith('/messages')) {
        setUnreadCount(value => value + 1);
      }

      if (dndEnabled || location.pathname.startsWith('/messages')) return;

      const popup = {
        id: messageId,
        from: message.from,
        body: getMessageSnippet(message),
        createdAt: message.createdAt || new Date().toISOString()
      };

      setMessagePopups(prev => [popup, ...prev.filter(item => item.id !== popup.id)].slice(0, 3));
      playUiSound('message', 0.45);
      showAppNotification({
        title: getDisplayName(message.from, 'New message'),
        body: popup.body,
        tag: `message-${fromId}`,
        data: { path: '/messages', fromId }
      });

      clearTimeout(messageTimersRef.current[popup.id]);
      messageTimersRef.current[popup.id] = setTimeout(() => {
        setMessagePopups(prev => prev.filter(item => item.id !== popup.id));
        delete messageTimersRef.current[popup.id];
      }, 7000);
    };

    socket.on('receiveMessage', onReceiveMessage);
    return () => socket.off('receiveMessage', onReceiveMessage);
  }, [dndEnabled, location.pathname, user]);

  const BrandLogo = ({ compact = false, collapsed = false, mobile = false, inverse = false }) => (
    <div className="group/brand inline-flex min-w-0 items-center gap-3" title={APP_NAME}>
      <AppLogoMark size={mobile ? 'sm' : compact ? 'md' : 'lg'} className={inverse ? 'shadow-none ring-white/20' : ''} />
      <span className={`${collapsed ? 'max-w-0 opacity-0 md:group-hover/sidebar:max-w-[11rem] md:group-hover/sidebar:opacity-100 md:group-focus-within/sidebar:max-w-[11rem] md:group-focus-within/sidebar:opacity-100' : 'max-w-[11rem] opacity-100'} min-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out`}>
        <AppWordmark size={mobile ? 'sm' : compact ? 'sm' : 'md'} tone={inverse ? 'inverse' : 'default'} />
      </span>
    </div>
  );

  const DndToggle = ({ compact = false, collapsed = false }) => (
    <button
      type="button"
      aria-pressed={dndEnabled}
      onClick={() => setDndEnabled(value => !value)}
      className={`${compact ? 'flex h-9 min-w-0 items-center justify-center rounded-xl px-2' : collapsed ? 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5' : 'flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm'} transition ${
        dndEnabled
          ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/35 dark:text-rose-300 dark:hover:bg-rose-950/55'
          : compact
            ? 'text-slate-600 hover:bg-blue-50 hover:text-[#0b57d0] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-200'
            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
      title={dndEnabled ? 'Do not disturb is on' : 'Message popups are on'}
    >
      {dndEnabled ? <BellOff size={compact ? 17 : 20} /> : <Volume2 size={compact ? 17 : 20} />}
      {!compact && (
        <span className={`${collapsed ? 'max-w-0 opacity-0 md:group-hover/sidebar:max-w-[9rem] md:group-hover/sidebar:opacity-100 md:group-focus-within/sidebar:max-w-[9rem] md:group-focus-within/sidebar:opacity-100' : 'max-w-[9rem] opacity-100'} overflow-hidden whitespace-nowrap transition-all duration-300 ease-out`}>
          {dndEnabled ? 'Do not disturb' : 'Message alerts'}
        </span>
      )}
    </button>
  );

  const ThemeToggle = ({ compact = false, collapsed = false }) => (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${compact ? 'flex h-9 min-w-0 items-center justify-center rounded-xl px-2 text-slate-600 hover:bg-blue-50 hover:text-[#0b57d0] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-200' : collapsed ? 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-gray-700 hover:bg-gray-100 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-300' : 'flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-300'} transition`}
      title={currentTheme?.helper || 'Toggle theme'}
      aria-label={currentTheme?.label || 'Toggle theme'}
    >
      {theme === 'dark' ? <Moon size={compact ? 17 : 20} /> : <Sun size={compact ? 17 : 20} />}
      {!compact && (
        <span className={`${collapsed ? 'max-w-0 opacity-0 md:group-hover/sidebar:max-w-[9rem] md:group-hover/sidebar:opacity-100 md:group-focus-within/sidebar:max-w-[9rem] md:group-focus-within/sidebar:opacity-100' : 'max-w-[9rem] opacity-100'} overflow-hidden whitespace-nowrap transition-all duration-300 ease-out`}>
          {currentTheme?.label || 'Theme'}
        </span>
      )}
    </button>
  );

  const SidebarProfileTools = ({ mobile = false }) => {
    if (!user) return null;

    const profileActive = isNavItemActive('/profile');
    return (
      <section className={`${mobile ? 'space-y-2' : 'rounded-2xl border border-slate-200 bg-white p-2 shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20'}`}>
        <Link
          to="/profile"
          data-sound="tab"
          onClick={() => mobile && setSidebarOpen(false)}
          className={`flex min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 transition ${
            profileActive
              ? 'bg-blue-50 text-[#0b57d0] dark:bg-blue-950/35 dark:text-sky-200'
              : 'text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800'
          }`}
          title={user.email}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#0b57d0] to-[#2387a8] text-sm font-bold text-white ring-2 ring-white shadow-sm">
            {avatarSrc ? <img src={avatarSrc} alt={user.name} className="h-full w-full object-cover" /> : user.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-black leading-tight">{user.name}</div>
            <div className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{user.email}</div>
          </div>
        </Link>
        <div className={`mt-2 grid ${mobileLightOnly ? 'grid-cols-2' : 'grid-cols-3'} gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-950/80`} title="Quick account controls">
          <DndToggle compact />
          {!mobileLightOnly && <ThemeToggle compact />}
          <button
            type="button"
            onClick={handleLogout}
            data-sound="close"
            className="flex h-9 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/35"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={17} />
          </button>
        </div>
      </section>
    );
  };

  const handleInstallApp = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const result = await installPrompt.userChoice.catch(() => null);
    if (!result || result.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const InstallButton = () => {
    if (!installPrompt || isInstalledApp) return null;

    return (
      <button
        type="button"
        onClick={handleInstallApp}
        className="flex w-full items-center gap-2.5 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-sm font-bold text-cyan-700 transition hover:-translate-y-0.5 hover:bg-cyan-400/15 dark:border-cyan-300/20 dark:text-cyan-200"
      >
        <Download size={19} />
        <span>Install SYNCROVA</span>
      </button>
    );
  };

  const enableNotifications = async () => {
    const state = await requestNotificationPermission();
    setNotificationPermission(state);
    if (state === 'granted') {
      toast.success('Phone notifications enabled');
    } else if (state === 'denied') {
      toast.error('Notifications are blocked in your device settings');
    }
  };

  const loadNotifications = async () => {
    setNotificationsLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data?.notifications || []);
      setNotificationUnreadCount(res.data?.unreadCount || 0);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to load notifications');
    } finally {
      setNotificationsLoading(false);
    }
  };

  const openNotificationCenter = () => {
    setNotificationPanelOpen(value => {
      const next = !value;
      if (!value) loadNotifications();
      return next;
    });
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(item => ({ ...item, read: true })));
      setNotificationUnreadCount(0);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to update notifications');
    }
  };

  const openNotification = async (notification) => {
    const id = getEntityId(notification);
    if (!notification.read && id) {
      api.put(`/notifications/${id}/read`).catch(() => {});
      setNotifications(prev => prev.map(item => getEntityId(item) === id ? { ...item, read: true } : item));
      setNotificationUnreadCount(count => Math.max(0, count - 1));
    }
    setNotificationPanelOpen(false);
    if (notification.href) navigate(notification.href);
  };

  const deleteNotification = async (event, notification) => {
    event.stopPropagation();
    const id = getEntityId(notification);
    if (!id) return;
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(item => getEntityId(item) !== id));
      if (!notification.read) setNotificationUnreadCount(count => Math.max(0, count - 1));
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Delete failed');
    }
  };

  const NotificationButton = ({ compact = false }) => {
    if (notificationPermission === 'granted' || notificationPermission === 'unsupported') return null;

    return (
      <button
        type="button"
        onClick={enableNotifications}
        className={`${compact ? 'rounded-full p-2' : 'flex w-full items-center gap-2.5 rounded-xl border border-blue-300/30 bg-blue-500/10 px-3 py-1.5 text-sm font-bold'} text-blue-700 transition hover:-translate-y-0.5 hover:bg-blue-500/15 dark:text-blue-200`}
        title="Enable phone notifications"
        aria-label="Enable phone notifications"
      >
        <Bell size={compact ? 22 : 19} />
        {!compact && <span>Enable notifications</span>}
      </button>
    );
  };

  const NotificationCenterButton = ({ compact = false, surface = 'default' }) => {
    const compactClasses = surface === 'navy'
      ? 'grid h-10 w-10 place-items-center rounded-xl text-white/90 hover:bg-white/10'
      : 'grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-blue-50 hover:text-[#0b57d0] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-200';
    const regularClasses = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-[#0b57d0] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-200';

    return (
    <div className="relative">
      <button
        type="button"
        onClick={openNotificationCenter}
        className={`${compact ? compactClasses : regularClasses} relative transition`}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={compact ? 21 : 19} />
        {!compact && <span>Notifications</span>}
        {notificationUnreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-black text-white">
            {notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}
          </span>
        )}
      </button>

      {notificationPanelOpen && (
        <div className={`${compact ? 'fixed right-2 top-[4.25rem] w-[min(94vw,24rem)]' : 'absolute bottom-full left-0 mb-2 w-[min(22rem,86vw)]'} z-[80] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-gray-950/20 dark:border-slate-800 dark:bg-slate-950`}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-black text-slate-950 dark:text-white">Notifications</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{notificationUnreadCount} unread</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={markAllNotificationsRead} className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" title="Mark all read">
                <CheckCheck size={17} />
              </button>
              <button type="button" onClick={() => setNotificationPanelOpen(false)} className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" aria-label="Close notifications">
                <X size={17} />
              </button>
            </div>
          </div>
          <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-2">
            {notificationsLoading ? (
              <p className="rounded-xl p-4 text-center text-sm font-semibold text-gray-500">Loading...</p>
            ) : notifications.length ? notifications.map(notification => {
              const actor = notification.actorId || {};
              const actorAvatar = resolveMediaUrl(actor.avatar);
              return (
                <button
                  key={getEntityId(notification)}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className={`group flex w-full items-start gap-3 rounded-2xl p-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900 ${notification.read ? '' : 'bg-blue-50/80 dark:bg-blue-950/25'}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#0b57d0] to-[#2387a8] text-sm font-black text-white">
                    {actorAvatar ? <img src={actorAvatar} alt={actor.name || 'User'} className="h-full w-full object-cover" /> : (actor.name || notification.type || 'N').charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-sm font-black text-slate-950 dark:text-white">{notification.title}</span>
                    {notification.body && <span className="mt-0.5 line-clamp-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{notification.body}</span>}
                    <span className="mt-1 block text-[11px] font-black uppercase text-[#0b57d0] dark:text-sky-300">{formatNotificationTime(notification.createdAt)}</span>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={event => deleteNotification(event, notification)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') deleteNotification(event, notification);
                    }}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-950/35 dark:hover:text-rose-300"
                    title="Delete notification"
                  >
                    <Trash2 size={15} />
                  </span>
                </button>
              );
            }) : (
              <p className="rounded-xl p-5 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">No notifications yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
    );
  };

  const mainNavItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard', mobileLabel: 'Home' },
    { path: '/groups', icon: Users, label: 'Workspaces', mobileLabel: 'Spaces' },
    { path: '/messages', icon: MessageCircle, label: 'Messages', mobileLabel: 'Chats' },
    { path: '/reels', icon: Clapperboard, label: 'Gallery', mobileLabel: 'Gallery' },
    { path: '/friends', icon: UserPlus, label: 'Friends', mobileLabel: 'Friends' },
    { path: '/arena', icon: Target, label: developerAccess ? 'Developer Console' : 'Fix Arena', mobileLabel: developerAccess ? 'Console' : 'Arena' },
    { path: '/profile', icon: User, label: 'Profile', mobileLabel: 'Me' }
  ];
  const toolNavItems = [];
  const mobileBottomItems = mainNavItems;
  const tabHeavyMobileRoute = location.pathname.startsWith('/profile')
    || location.pathname.startsWith('/friends')
    || location.pathname.startsWith('/groups')
    || location.pathname.startsWith('/group/')
    || location.pathname.startsWith('/arena');
  const isNavItemActive = (path) => location.pathname === path
    || (path === '/groups' && location.pathname.startsWith('/group/'))
    || (path !== '/dashboard' && location.pathname.startsWith(`${path}/`));

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const openMessagePopup = (popup) => {
    setMessagePopups(prev => prev.filter(item => item.id !== popup.id));
    navigate('/messages');
  };

  const renderNavLink = (item, isMobile = false) => {
    const isActive = isNavItemActive(item.path);
    const isMessages = item.path === '/messages';
    const isGroups = item.path === '/groups';
    const isFriends = item.path === '/friends';
    const badgeCount = isMessages ? unreadCount : isGroups ? groupBadgeCount : isFriends ? friendBadgeCount : 0;
    const activeClasses = isActive
      ? 'border-blue-200 bg-blue-50 text-[#0b57d0] shadow-sm shadow-blue-500/10 dark:border-blue-400/25 dark:bg-blue-950/35 dark:text-sky-200'
      : 'border-transparent bg-transparent text-slate-700 hover:border-blue-100 hover:bg-blue-50/70 hover:text-[#0b57d0] dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white';
    const baseClasses = `group/nav flex h-10 w-full items-center gap-2.5 rounded-xl border px-3 text-[0.92rem] font-bold tracking-normal transition-colors ${activeClasses}`;
    const linkContent = (
      <>
        <div className={`relative flex shrink-0 items-center justify-center rounded-lg ${isMobile ? 'h-8 w-8' : 'h-8 w-8'} ${isActive ? 'bg-white shadow-sm dark:bg-white/10 dark:shadow-none' : 'bg-transparent group-hover/nav:bg-white/75 dark:group-hover/nav:bg-white/10'}`}>
          <item.icon size={isMobile ? 21 : 18} strokeWidth={isActive ? 2.6 : 2.25} />
          {badgeCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-blue-600 text-white text-xs rounded-full min-w-[1.25rem] h-5 px-1 flex items-center justify-center">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </div>
        {!isMobile && (
          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap opacity-100 transition-all duration-300 ease-out">
            {item.label}
          </span>
        )}
      </>
    );

    if (isMobile) {
      return (
        <Link
          key={item.path}
          to={item.path}
          data-sound="tab"
          onClick={() => setSidebarOpen(false)}
          className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-bold transition ${activeClasses}`}
        >
          {linkContent}
          <span>{item.label}</span>
        </Link>
      );
    }

    return (
      <Link key={item.path} to={item.path} data-sound="tab" className={baseClasses}>
        {linkContent}
      </Link>
    );
  };

  const TopbarIconButton = ({ children, onClick, label, pressed = false }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className="grid h-10 w-10 place-items-center rounded-xl text-white/90 transition hover:bg-white/10"
    >
      {children}
    </button>
  );

  return (
    <div className="portal-shell text-slate-900 dark:text-slate-100">
      <header className="fixed inset-x-0 top-0 z-40 hidden h-16 items-center justify-between bg-[#07036f] px-5 text-white shadow-lg shadow-[#07036f]/20 md:flex">
        <div className="flex min-w-0 items-center gap-3">
          <AppLogoMark size="xs" className="rounded-full bg-white p-1 shadow-none ring-1 ring-white/25" />
          <div className="min-w-0">
            <p className="truncate text-sm font-black tracking-normal">SYNCROVA</p>
            <p className="truncate text-[11px] font-semibold text-white/70">made by Eeerrreerrrriirrriivvi</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="hidden min-w-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white/90 lg:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            <span className="truncate">{pageMeta.title}</span>
          </div>
          {!isOnline && (
            <span className="hidden items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-black text-amber-100 xl:inline-flex">
              <WifiOff size={14} />
              Offline
            </span>
          )}
          <NotificationCenterButton compact surface="navy" />
          <TopbarIconButton
            label={dndEnabled ? 'Do not disturb is on' : 'Message alerts are on'}
            pressed={dndEnabled}
            onClick={() => setDndEnabled(value => !value)}
          >
            {dndEnabled ? <BellOff size={19} /> : <Volume2 size={19} />}
          </TopbarIconButton>
          <TopbarIconButton label={currentTheme?.label || 'Toggle theme'} onClick={toggleTheme}>
            {theme === 'dark' ? <Moon size={19} /> : <Sun size={19} />}
          </TopbarIconButton>
          {user && (
            <Link to="/profile" data-sound="tab" className="ml-1 flex min-w-0 items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-white transition hover:bg-white/15">
              <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 text-sm font-black ring-1 ring-white/20">
                {avatarSrc ? <img src={avatarSrc} alt={user.name} className="h-full w-full object-cover" /> : user.name?.charAt(0)?.toUpperCase()}
              </span>
              <span className="hidden max-w-[9rem] truncate text-sm font-black xl:block">{user.name}</span>
            </Link>
          )}
        </div>
      </header>

      <aside className="group/sidebar fixed bottom-0 top-16 z-30 hidden w-72 min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-white text-slate-700 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:shadow-black/30 md:flex">
        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <SidebarProfileTools />
          <section>
            <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">Main</p>
            <div className="space-y-1.5">
              {mainNavItems.map(item => renderNavLink(item, false))}
            </div>
          </section>

          {toolNavItems.length > 0 && (
          <section>
            <p className="mb-1.5 px-2.5 text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">Tools</p>
            <div className="space-y-1">
              {toolNavItems.map(item => renderNavLink(item, false))}
            </div>
          </section>
          )}
        </nav>

      </aside>

      <div className="layout-content-frame flex min-h-0 flex-col md:ml-72 md:pt-16">
        <header className="mobile-topbar sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#07036f] text-white shadow-lg shadow-[#07036f]/20 md:hidden">
          <BrandLogo mobile inverse />
          <div className="flex items-center gap-2">
            {user && (
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/15 text-sm font-bold text-white ring-1 ring-white/25">
                {avatarSrc ? <img src={avatarSrc} alt={user.name} className="h-full w-full object-cover" /> : user.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <button onClick={() => setSidebarOpen(true)} className="rounded-full p-2 text-white transition hover:bg-white/10" aria-label="Open menu">
              <Menu size={22} />
            </button>
          </div>
        </header>

        {!tabHeavyMobileRoute && (
        <div className="mobile-context-panel sticky top-[calc(3.65rem_+_env(safe-area-inset-top))] z-[18] px-2 pt-1.5 md:hidden">
          {!isOnline && (
            <div
              className="mb-2 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 shadow-lg shadow-amber-500/10 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <WifiOff size={15} />
              Offline mode. Some actions will retry when connection returns.
            </div>
          )}
          {!location.pathname.startsWith('/messages') && !location.pathname.startsWith('/reels') && (
            <div className="space-y-2">
              <div className="mobile-page-titlebar flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/92 px-3 py-2.5 shadow-lg shadow-slate-200/40 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/92 dark:shadow-black/25">
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-950 dark:text-white">{pageMeta.title}</p>
                  <p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{pageMeta.helper}</p>
                </div>
                <button
                  type="button"
                  onClick={pageMeta.action}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#07036f] text-white shadow-lg shadow-[#07036f]/15 transition active:scale-95"
                  aria-label={`Open ${pageMeta.title}`}
                >
                  <PlusCircle size={19} />
                </button>
              </div>
              <OnlineRoster compact limit={8} title="Online now" />
            </div>
          )}
        </div>
        )}

        <div className="flex min-h-0 flex-1">
          <main className={`app-main min-w-0 flex-1 overflow-x-hidden overflow-y-auto ${isCompactRoute ? 'app-main--compact' : ''}`}>
            {location.pathname.startsWith('/arena') ? (
              <div className="min-h-full">{pageContent}</div>
            ) : (
              <div className="min-h-full">{pageContent}</div>
            )}
          </main>

          {shouldShowSocialRail && (
            <aside className="desktop-social-rail hidden w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white/55 p-4 backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-950/55 xl:block">
              <div className="sticky top-20 space-y-4">
                <OnlineRoster limit={10} title="Active users" />
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
                  <p className="text-sm font-black text-slate-950 dark:text-white">Quick actions</p>
                  <div className="mt-3 space-y-2">
                    <Link to="/messages" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-[#0b57d0] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
                      <MessageCircle size={17} />
                      Messages
                    </Link>
                    <Link to="/reels" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-[#0b57d0] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
                      <Clapperboard size={17} />
                      Gallery
                    </Link>
                    <Link to="/groups" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-[#0b57d0] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
                      <Users size={17} />
                      Workspaces
                    </Link>
                    <Link to="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-[#0b57d0] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
                      <User size={17} />
                      Profile
                    </Link>
                    <Link to="/arena" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-[#0b57d0] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
                      <Target size={17} />
                      {developerAccess ? 'Developer Console' : 'Fix Arena'}
                    </Link>
                  </div>
                </section>
              </div>
            </aside>
          )}
        </div>

        <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/92 shadow-2xl shadow-slate-300/35 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/92 dark:shadow-black/30 md:hidden">
          {mobileBottomItems.map(item => {
            const isActive = isNavItemActive(item.path);
            const isMessages = item.path === '/messages';
            const isGroups = item.path === '/groups';
            const isFriends = item.path === '/friends';
            const badgeCount = isMessages ? unreadCount : isGroups ? groupBadgeCount : isFriends ? friendBadgeCount : 0;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-sound="tab"
                className={`mobile-nav-item relative flex flex-col items-center justify-center gap-0.5 ${isActive ? 'is-active' : ''}`}
                aria-label={item.label}
              >
                <item.icon size={21} strokeWidth={isActive ? 2.6 : 2.2} />
                <span className="max-w-full truncate text-[10px] font-black leading-none">{item.mobileLabel || item.label}</span>
                {badgeCount > 0 && (
                  <span className="absolute right-1 top-0 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1 text-xs text-white">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pointer-events-none fixed right-3 top-20 z-[60] flex w-[min(92vw,360px)] flex-col gap-3 md:right-6">
        {messagePopups.map(popup => {
            const popupAvatar = resolveMediaUrl(popup.from?.avatar);
            const senderName = getDisplayName(popup.from, 'Someone');

            return (
              <button
                key={popup.id}
                type="button"
                onClick={() => openMessagePopup(popup)}
                className="pointer-events-auto overflow-hidden rounded-2xl border border-blue-100 bg-white/95 p-4 text-left shadow-2xl shadow-blue-500/15 backdrop-blur transition hover:-translate-y-1 hover:border-blue-200 dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-black/30"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#0b57d0] to-[#2387a8] text-sm font-bold text-white">
                    {popupAvatar ? <img src={popupAvatar} alt={senderName} className="h-full w-full object-cover" /> : senderName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold text-slate-950 dark:text-white">{senderName}</p>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-600 dark:bg-blue-950/35 dark:text-sky-200">New</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{popup.body}</p>
                    <p className="mt-2 text-xs font-semibold text-blue-600 dark:text-sky-300">Open chat</p>
                  </div>
                </div>
              </button>
            );
          })}
      </div>

      {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-30 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <aside
              className="fixed bottom-0 left-0 top-0 z-40 w-[min(86vw,20rem)] border-r border-slate-200 bg-white/96 text-slate-900 shadow-2xl shadow-gray-950/20 backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-950/96 dark:text-slate-100 md:hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
                <BrandLogo mobile />
                <button onClick={() => setSidebarOpen(false)} data-sound="close" className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" aria-label="Close menu">
                  <X size={24} />
                </button>
              </div>
              <nav className="flex h-[calc(100%-4.5rem)] flex-col gap-4 overflow-y-auto p-4">
                <section className="space-y-2">
                  <p className="px-2 text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">Main</p>
                  {mainNavItems.map(item => renderNavLink(item, true))}
                </section>
                <SidebarProfileTools mobile />

                {toolNavItems.length > 0 && (
                <section className="space-y-2">
                  <p className="px-2 text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">Tools</p>
                  {toolNavItems.map(item => renderNavLink(item, true))}
                </section>
                )}

                <OnlineRoster compact limit={8} title="Online now" />

              </nav>
            </aside>
          </>
        )}
    </div>
  );
}

