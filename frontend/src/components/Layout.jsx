import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BellOff, Home, Users, MessageCircle, User, LogOut, Sun, Moon, Menu, Sparkles, X, Volume2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { resolveMediaUrl } from '../utils/media';
import { playUiSound } from '../utils/sound';
import api from '../services/api';
import { getSocket } from '../services/socket';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [groupBadgeCount, setGroupBadgeCount] = useState(0);
  const [messagePopups, setMessagePopups] = useState([]);
  const [dndEnabled, setDndEnabled] = useState(() => localStorage.getItem('workloop-dnd') === 'true');
  const messageTimersRef = useRef({});
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const avatarSrc = resolveMediaUrl(user?.avatar);

  useEffect(() => {
    localStorage.setItem('workloop-dnd', String(dndEnabled));
  }, [dndEnabled]);

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
    if (!user) return undefined;

    let cancelled = false;
    const loadBadges = async () => {
      try {
        const [messageRes, inviteRes] = await Promise.all([
          api.get('/messages/conversations').catch(() => ({ data: [] })),
          api.get('/groups/invites/me').catch(() => ({ data: [] }))
        ]);
        if (cancelled) return;

        setUnreadCount((messageRes.data || []).reduce((total, item) => total + (item.unreadCount || 0), 0));
        setGroupBadgeCount((inviteRes.data || []).length);
      } catch (err) {
        console.error('Badge sync failed', err);
      }
    };

    loadBadges();
    const interval = setInterval(loadBadges, 30000);
    const groupsHandler = () => loadBadges();
    window.addEventListener('groupsUpdated', groupsHandler);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('groupsUpdated', groupsHandler);
    };
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

  const BrandLogo = ({ compact = false }) => (
    <motion.div
      animate={{ y: [0, -2, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      className="inline-flex items-center gap-2"
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-indigo-500 text-white shadow-lg shadow-pink-500/25">
        <Sparkles size={compact ? 16 : 18} />
        <span className="absolute inset-0 rounded-xl ring-2 ring-pink-300/30 blur-[2px]" />
      </span>
      <span className={`${compact ? 'text-xl' : 'text-2xl'} font-black tracking-normal bg-gradient-to-r from-pink-500 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent drop-shadow-sm`}>
        WorkLoop
      </span>
    </motion.div>
  );

  const DndToggle = ({ compact = false }) => (
    <button
      type="button"
      aria-pressed={dndEnabled}
      onClick={() => setDndEnabled(value => !value)}
      className={`${compact ? 'rounded-full p-2' : 'flex w-full items-center gap-3 rounded-lg px-4 py-2'} transition ${
        dndEnabled
          ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
      title={dndEnabled ? 'Do not disturb is on' : 'Message popups are on'}
    >
      {dndEnabled ? <BellOff size={compact ? 22 : 20} /> : <Volume2 size={compact ? 22 : 20} />}
      {!compact && <span>{dndEnabled ? 'Do not disturb' : 'Message alerts'}</span>}
    </button>
  );

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/groups', icon: Users, label: 'Workspaces' },
    { path: '/messages', icon: MessageCircle, label: 'Messages' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

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
    const badgeCount = isMessages ? unreadCount : isGroups ? groupBadgeCount : 0;
    const activeClasses = isActive
      ? 'bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 shadow-sm'
      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700';
    const baseClasses = `flex items-center gap-3 px-4 py-2 rounded-lg transition duration-200 hover:-translate-y-0.5 ${activeClasses}`;
    const linkContent = (
      <>
        <div className="relative">
          <item.icon size={isMobile ? 24 : 20} />
          {badgeCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-pink-500 text-white text-xs rounded-full min-w-[1.25rem] h-5 px-1 flex items-center justify-center">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </div>
        {!isMobile && <span>{item.label}</span>}
      </>
    );

    if (isMobile) {
      return (
        <Link
          key={item.path}
          to={item.path}
          onClick={() => setSidebarOpen(false)}
          className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${activeClasses}`}
        >
          {linkContent}
          <span>{item.label}</span>
        </Link>
      );
    }

    return (
      <Link key={item.path} to={item.path} className={baseClasses}>
        {linkContent}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <aside className="hidden md:flex md:w-64 fixed h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <BrandLogo />
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map(item => renderNavLink(item, false))}
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <DndToggle />
          {user && (
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-sm font-bold text-white">
                {avatarSrc ? <img src={avatarSrc} alt={user.name} className="h-full w-full object-cover" /> : user.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">{user.name}</div>
                <div className="truncate text-xs text-gray-500">{user.email}</div>
              </div>
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-4 py-2 rounded-lg text-gray-700 transition hover:-translate-y-0.5 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2 rounded-lg text-red-600 transition hover:-translate-y-0.5 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="md:ml-64 flex flex-col min-h-screen">
        <header className="md:hidden bg-white/95 dark:bg-gray-800/95 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center sticky top-0 z-20 backdrop-blur">
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

        <main className="flex-1 p-4 pb-20 md:pb-4 overflow-x-hidden">
          {children}
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around py-2 z-20">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            const isMessages = item.path === '/messages';
            const isGroups = item.path === '/groups';
            const badgeCount = isMessages ? unreadCount : isGroups ? groupBadgeCount : 0;
            return (
              <Link
                key={item.path}
                to={item.path}
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
          <button onClick={toggleTheme} className="p-2 text-gray-500 transition hover:-translate-y-0.5 dark:text-gray-400" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
          </button>
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
                <button onClick={() => setSidebarOpen(false)} aria-label="Close menu">
                  <X size={24} />
                </button>
              </div>
              <nav className="p-4 space-y-2">
                {navItems.map(item => renderNavLink(item, true))}
                <DndToggle />
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
