import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Users, MessageCircle, User, LogOut, Sun, Moon, Menu, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { resolveMediaUrl } from '../utils/media';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const avatarSrc = resolveMediaUrl(user?.avatar);

  // Listen for unread message count updates from Messages component
  useEffect(() => {
    const handler = (e) => {
      setUnreadCount(e.detail?.count || 0);
    };
    window.addEventListener('unreadMessages', handler);
    return () => window.removeEventListener('unreadMessages', handler);
  }, []);

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/groups', icon: Users, label: 'My Groups' },
    { path: '/messages', icon: MessageCircle, label: 'Messages' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  // Helper to render navigation link with optional badge
  const renderNavLink = (item, isMobile = false) => {
    const isActive = location.pathname === item.path;
    const isMessages = item.path === '/messages';
    const badgeCount = isMessages ? unreadCount : 0;
    const activeClasses = isActive
      ? 'bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400'
      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700';
    const baseClasses = `flex items-center gap-3 px-4 py-2 rounded-lg transition ${activeClasses}`;
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
          className={`flex items-center gap-3 px-4 py-2 rounded-lg ${activeClasses}`}
        >
          {linkContent}
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
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 fixed h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col">
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            StudyHub
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map(item => renderNavLink(item, false))}
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
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
            className="flex items-center gap-3 w-full px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile header + bottom nav */}
      <div className="md:ml-64 flex flex-col min-h-screen">
        <header className="md:hidden bg-white/95 dark:bg-gray-800/95 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center sticky top-0 z-20 backdrop-blur">
          <h1 className="text-xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            StudyHub
          </h1>
          <div className="flex items-center gap-2">
            {user && (
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-sm font-bold text-white">
                {avatarSrc ? <img src={avatarSrc} alt={user.name} className="h-full w-full object-cover" /> : user.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <button onClick={() => setSidebarOpen(true)} className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700" aria-label="Open menu">
              <Menu size={22} />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-20 md:pb-4 overflow-x-hidden">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t flex justify-around py-2 z-20">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            const isMessages = item.path === '/messages';
            const badgeCount = isMessages ? unreadCount : 0;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`p-2 rounded-full relative ${
                  isActive
                    ? 'text-pink-600 dark:text-pink-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
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
          <button onClick={toggleTheme} className="p-2">
            {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </nav>
      </div>

      {/* Mobile sidebar overlay */}
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
              <div className="p-4 border-b flex justify-between items-center">
                <h1 className="text-xl font-bold">StudyHub</h1>
                <button onClick={() => setSidebarOpen(false)}>
                  <X size={24} />
                </button>
              </div>
              <nav className="p-4 space-y-2">
                {navItems.map(item => renderNavLink(item, true))}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 mt-4"
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
