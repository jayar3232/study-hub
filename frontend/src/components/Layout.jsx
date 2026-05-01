import React, { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BellOff, Home, Users, MessageCircle, User, LogOut, Menu, Moon, Sun, X, Volume2, Target, UserPlus } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { resolveMediaUrl } from '../utils/media';
import { installGlobalClickSound, playUiSound } from '../utils/sound';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { SCHOOL_LOGO_SRC } from '../utils/academics';

const APP_NAME = 'StudentHub';

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

export default function Layout({ children }) {
  const { theme, currentTheme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [groupBadgeCount, setGroupBadgeCount] = useState(0);
  const [friendBadgeCount, setFriendBadgeCount] = useState(0);
  const [developerAccess, setDeveloperAccess] = useState(Boolean(user?.isDeveloper));
  const [messagePopups, setMessagePopups] = useState([]);
  const [dndEnabled, setDndEnabled] = useState(() => localStorage.getItem('workloop-dnd') === 'true');
  const messageTimersRef = useRef({});
  const navigate = useNavigate();
  const location = useLocation();
  const avatarSrc = resolveMediaUrl(user?.avatar);
  const pageContent = children || <Outlet />;

  useEffect(() => {
    localStorage.setItem('workloop-dnd', String(dndEnabled));
  }, [dndEnabled]);

  useEffect(() => installGlobalClickSound(), []);

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

      clearTimeout(messageTimersRef.current[popup.id]);
      messageTimersRef.current[popup.id] = setTimeout(() => {
        setMessagePopups(prev => prev.filter(item => item.id !== popup.id));
        delete messageTimersRef.current[popup.id];
      }, 7000);
    };

    socket.on('receiveMessage', onReceiveMessage);
    return () => socket.off('receiveMessage', onReceiveMessage);
  }, [dndEnabled, location.pathname, user]);

  const BrandLogo = ({ compact = false, collapsed = false }) => (
    <motion.div
      animate={{ y: [0, -3, 0] }}
      transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
      className="group/brand inline-flex min-w-0 items-center gap-3"
      title={APP_NAME}
    >
      <span className={`${compact ? 'h-14 w-14 rounded-[1.35rem]' : 'h-16 w-16 rounded-[1.6rem]'} relative flex shrink-0 items-center justify-center overflow-hidden bg-white/90 shadow-xl shadow-cyan-500/15 ring-1 ring-white/70 transition group-hover/brand:shadow-pink-500/20 dark:bg-gray-950/80 dark:ring-white/10`}>
        <span className="absolute inset-0 bg-gradient-to-br from-cyan-300/35 via-pink-300/25 to-indigo-400/35" />
        <img src={SCHOOL_LOGO_SRC} alt="NEMSU logo" className="relative h-full w-full object-cover p-1" />
      </span>
      <span className={`${collapsed ? 'max-w-0 opacity-0 md:group-hover/sidebar:max-w-[11rem] md:group-hover/sidebar:opacity-100 md:group-focus-within/sidebar:max-w-[11rem] md:group-focus-within/sidebar:opacity-100' : 'max-w-[11rem] opacity-100'} min-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out`}>
        <span className={`${compact ? 'text-[1.65rem]' : 'text-3xl'} block truncate font-black tracking-normal text-gray-950 drop-shadow-sm dark:text-white`}>
          Student<span className="bg-gradient-to-r from-cyan-500 via-pink-500 to-indigo-500 bg-clip-text text-transparent">Hub</span>
        </span>
        <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} mt-0.5 block truncate font-black uppercase tracking-normal text-gray-500 dark:text-gray-400`}>NEMSU Workspace</span>
      </span>
    </motion.div>
  );

  const DndToggle = ({ compact = false, collapsed = false }) => (
    <button
      type="button"
      aria-pressed={dndEnabled}
      onClick={() => setDndEnabled(value => !value)}
      className={`${compact ? 'rounded-full p-2' : collapsed ? 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5' : 'flex w-full items-center gap-3 rounded-lg px-4 py-2'} transition ${
        dndEnabled
          ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
      title={dndEnabled ? 'Do not disturb is on' : 'Message popups are on'}
    >
      {dndEnabled ? <BellOff size={compact ? 22 : 20} /> : <Volume2 size={compact ? 22 : 20} />}
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
      className={`${compact ? 'rounded-full p-2' : collapsed ? 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5' : 'flex w-full items-center gap-3 rounded-xl px-4 py-2.5'} text-gray-700 transition hover:-translate-y-0.5 hover:bg-gray-100 hover:text-pink-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-pink-300`}
      title={currentTheme?.helper || 'Toggle theme'}
      aria-label={currentTheme?.label || 'Toggle theme'}
    >
      {theme === 'dark' ? <Moon size={compact ? 22 : 20} /> : <Sun size={compact ? 22 : 20} />}
      {!compact && (
        <span className={`${collapsed ? 'max-w-0 opacity-0 md:group-hover/sidebar:max-w-[9rem] md:group-hover/sidebar:opacity-100 md:group-focus-within/sidebar:max-w-[9rem] md:group-focus-within/sidebar:opacity-100' : 'max-w-[9rem] opacity-100'} overflow-hidden whitespace-nowrap transition-all duration-300 ease-out`}>
          {currentTheme?.label || 'Theme'}
        </span>
      )}
    </button>
  );

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/groups', icon: Users, label: 'Workspaces' },
    { path: '/messages', icon: MessageCircle, label: 'Messages' },
    { path: '/friends', icon: UserPlus, label: 'Friends' },
    { path: '/arena', icon: Target, label: developerAccess ? 'Developer Console' : 'Fix Arena' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];
  const mobileBottomItems = navItems;

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
    const isActive = location.pathname === item.path;
    const isMessages = item.path === '/messages';
    const isGroups = item.path === '/groups';
    const isFriends = item.path === '/friends';
    const badgeCount = isMessages ? unreadCount : isGroups ? groupBadgeCount : isFriends ? friendBadgeCount : 0;
    const activeClasses = isActive
      ? 'border-pink-300/35 bg-white/35 text-pink-700 shadow-sm shadow-pink-500/10 backdrop-blur dark:border-pink-400/25 dark:bg-white/10 dark:text-pink-200'
      : 'border-transparent bg-transparent text-gray-700 hover:border-white/45 hover:bg-white/25 hover:text-gray-950 dark:text-gray-300 dark:hover:border-white/10 dark:hover:bg-white/10 dark:hover:text-white';
    const baseClasses = `flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 font-semibold transition-all duration-300 hover:-translate-y-0.5 ${activeClasses}`;
    const linkContent = (
      <>
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
          <item.icon size={isMobile ? 24 : 20} />
          {badgeCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-pink-500 text-white text-xs rounded-full min-w-[1.25rem] h-5 px-1 flex items-center justify-center">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </div>
        {!isMobile && (
          <span className="max-w-[10rem] overflow-hidden whitespace-nowrap opacity-100 transition-all duration-300 ease-out">
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
          className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 font-semibold transition ${activeClasses}`}
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

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100">
      <aside className="group/sidebar fixed z-30 hidden h-full w-64 flex-col overflow-hidden border-r border-white/45 bg-white/45 shadow-2xl shadow-gray-200/40 backdrop-blur-2xl dark:border-white/10 dark:bg-gray-950/45 dark:shadow-black/20 md:flex">
        <div className="border-b border-white/40 p-3 dark:border-white/10">
          <BrandLogo compact />
        </div>
        <nav className="flex-1 space-y-2 p-3">
          {navItems.map(item => renderNavLink(item, false))}
        </nav>
        <div className="space-y-2 border-t border-white/40 p-3 dark:border-white/10">
          <DndToggle />
          <ThemeToggle />
          {user && (
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/45 bg-white/35 p-2 shadow-sm backdrop-blur transition-[gap] duration-300 ease-out dark:border-white/10 dark:bg-white/5" title={user.email}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-sm font-bold text-white">
                {avatarSrc ? <img src={avatarSrc} alt={user.name} className="h-full w-full object-cover" /> : user.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0 max-w-[10rem] overflow-hidden opacity-100 transition-all duration-300 ease-out">
                <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">{user.name}</div>
                <div className="truncate text-xs text-gray-500">{user.email}</div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            data-sound="close"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-red-600 transition hover:-translate-y-0.5 hover:bg-red-50 dark:hover:bg-red-900/30"
            title="Logout"
          >
            <LogOut size={20} />
            <span className="max-w-[8rem] overflow-hidden whitespace-nowrap opacity-100 transition-all duration-300 ease-out">Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col md:ml-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/45 bg-white/55 p-4 shadow-lg shadow-gray-200/30 backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/55 dark:shadow-black/10 md:hidden">
          <BrandLogo compact />
          <div className="flex items-center gap-2">
            <DndToggle compact />
            {user && (
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-sm font-bold text-white">
                {avatarSrc ? <img src={avatarSrc} alt={user.name} className="h-full w-full object-cover" /> : user.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <button onClick={() => setSidebarOpen(true)} className="rounded-full p-2 text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700" aria-label="Open menu">
              <Menu size={22} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-4 pb-20 md:pb-4">
          {location.pathname.startsWith('/arena') ? (
            <div className="min-h-full">{pageContent}</div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 14, scale: 0.988 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.992 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="min-h-full"
              >
                {pageContent}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-20 flex justify-around border-t border-white/45 bg-white/55 py-2 shadow-2xl shadow-gray-300/35 backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/55 dark:shadow-black/20 md:hidden">
          {mobileBottomItems.map(item => {
            const isActive = location.pathname === item.path;
            const isMessages = item.path === '/messages';
            const isGroups = item.path === '/groups';
            const isFriends = item.path === '/friends';
            const badgeCount = isMessages ? unreadCount : isGroups ? groupBadgeCount : isFriends ? friendBadgeCount : 0;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-sound="tab"
                className={`p-2 rounded-full relative transition hover:-translate-y-0.5 ${
                  isActive
                    ? 'text-pink-600 dark:text-pink-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
                aria-label={item.label}
              >
                <item.icon size={24} />
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs rounded-full min-w-[1.25rem] h-5 px-1 flex items-center justify-center">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pointer-events-none fixed right-3 top-20 z-[60] flex w-[min(92vw,360px)] flex-col gap-3 md:right-6">
        <AnimatePresence initial={false}>
          {messagePopups.map(popup => {
            const popupAvatar = resolveMediaUrl(popup.from?.avatar);
            const senderName = getDisplayName(popup.from, 'Someone');

            return (
              <motion.button
                key={popup.id}
                layout
                initial={{ opacity: 0, x: 28, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 28, scale: 0.96 }}
                transition={{ type: 'spring', damping: 24, stiffness: 260 }}
                type="button"
                onClick={() => openMessagePopup(popup)}
                className="pointer-events-auto overflow-hidden rounded-2xl border border-pink-100 bg-white/95 p-4 text-left shadow-2xl shadow-pink-500/15 backdrop-blur transition hover:-translate-y-1 hover:border-pink-200 dark:border-pink-900/50 dark:bg-gray-900/95"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-sm font-bold text-white">
                    {popupAvatar ? <img src={popupAvatar} alt={senderName} className="h-full w-full object-cover" /> : senderName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold text-gray-950 dark:text-white">{senderName}</p>
                      <span className="rounded-full bg-pink-50 px-2 py-0.5 text-[11px] font-bold text-pink-600 dark:bg-pink-950/30 dark:text-pink-300">New</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{popup.body}</p>
                    <p className="mt-2 text-xs font-semibold text-pink-600 dark:text-pink-300">Open Messages</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-30 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed top-0 left-0 bottom-0 w-64 bg-white dark:bg-gray-800 z-40 shadow-xl md:hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <BrandLogo compact />
                <button onClick={() => setSidebarOpen(false)} data-sound="close" aria-label="Close menu">
                  <X size={24} />
                </button>
              </div>
              <nav className="p-4 space-y-2">
                {navItems.map(item => renderNavLink(item, true))}
                <DndToggle />
                <ThemeToggle />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 mt-4 dark:hover:bg-red-900/30"
                >
                  <LogOut size={20} />
                  <span>Logout</span>
                </button>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

