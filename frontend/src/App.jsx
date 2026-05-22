import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Toaster } from 'react-hot-toast';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PresenceProvider } from './context/PresenceContext';
import { CallProvider } from './context/CallContext';
import Layout from './components/Layout';
import AppUpdatePrompt from './components/AppUpdatePrompt';
import WebUpdatePrompt from './components/WebUpdatePrompt';
import { PageSkeleton } from './components/SkeletonLoader';
import useFrameHealthMonitor from './hooks/useFrameHealthMonitor';

const Login = lazy(() => import('./components/Login'));
const Register = lazy(() => import('./components/Register'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const MarketplacePage = lazy(() => import('./components/MarketplacePage'));
const Profile = lazy(() => import('./components/Profile'));
const Messages = lazy(() => import('./components/Messages'));
const OpsArena = lazy(() => import('./components/OpsArena'));
const GamePlayPage = lazy(() => import('./components/GamePlayPage'));
const Friends = lazy(() => import('./components/Friends'));
const Reels = lazy(() => import('./components/Reels'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const NotificationsPage = lazy(() => import('./components/NotificationsPage'));
const GlobalSearchPage = lazy(() => import('./components/GlobalSearchPage'));
const SavedItemsPage = lazy(() => import('./components/SavedItemsPage'));
const AppHealthPage = lazy(() => import('./components/AppHealthPage'));

const getNativeBackFallbackPath = (pathname = '/') => {
  if (pathname.startsWith('/group/')) return '/marketplace';
  if (pathname.startsWith('/messages')) return '/messages';
  if (pathname.startsWith('/arena')) return '/arena';
  if (pathname.startsWith('/developer-console')) return '/developer-console';
  if (pathname.startsWith('/settings')) return '/settings';
  if (pathname.startsWith('/notifications')) return '/notifications';
  if (pathname.startsWith('/search')) return '/search';
  if (pathname.startsWith('/saved')) return '/saved';
  if (pathname.startsWith('/app-health')) return '/app-health';
  if (pathname.startsWith('/profile')) return '/profile';
  if (pathname.startsWith('/friends')) return '/friends';
  if (pathname.startsWith('/groups')) return '/marketplace';
  if (pathname.startsWith('/marketplace')) return '/marketplace';
  if (pathname.startsWith('/reels')) return '/reels';
  return '/dashboard';
};

const INTRO_SPLASH_SESSION_KEY = 'syncrova-intro-splash-shown';

const hasSeenIntroSplash = () => {
  try {
    return window.sessionStorage?.getItem(INTRO_SPLASH_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
};

const markIntroSplashSeen = () => {
  try {
    window.sessionStorage?.setItem(INTRO_SPLASH_SESSION_KEY, 'true');
  } catch {
    // Session storage can be blocked in some embedded browsers; the splash can still render normally.
  }
};

function NativeBackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const isNative = typeof window !== 'undefined' && (
      window.Capacitor?.isNativePlatform?.() ||
      Capacitor.isNativePlatform?.() ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:'
    );
    if (!isNative) return undefined;

    let cancelled = false;
    let listenerPromise = null;

    const setupBackButton = async () => {
      try {
        const { App: CapacitorApp } = await import('@capacitor/app');
        if (cancelled || !CapacitorApp?.addListener) return;

        listenerPromise = CapacitorApp.addListener('backButton', () => {
          const backEvent = new CustomEvent('syncrova:native-back', {
            cancelable: true,
            detail: { pathname: window.location.pathname }
          });
          window.dispatchEvent(backEvent);
          if (backEvent.defaultPrevented) return;

          const pathname = window.location.pathname || '/';
          const historyIndex = Number(window.history.state?.idx || 0);
          const isAppRoot = pathname === '/' || pathname === '/dashboard' || pathname === '/login';

          if (historyIndex > 0 && !isAppRoot) {
            navigate(-1);
            return;
          }

          const fallbackPath = getNativeBackFallbackPath(pathname);
          if (fallbackPath && fallbackPath !== pathname) {
            navigate(fallbackPath, { replace: true });
          } else if (window.history.length > 1) {
            navigate(-1);
          } else if (isAppRoot) {
            CapacitorApp.exitApp?.();
          } else {
            navigate('/dashboard', { replace: true });
          }
        });
      } catch {
        // Web builds and old APKs without the plugin should keep working normally.
      }
    };

    setupBackButton();

    return () => {
      cancelled = true;
      Promise.resolve(listenerPromise)
        .then(listener => listener?.remove?.())
        .catch(() => {});
    };
  }, [navigate, location.pathname]);

  return null;
}

function RouteLoadingFallback() {
  return (
    <div className="mx-auto flex min-h-[14rem] max-w-7xl items-center justify-center px-4 py-8" role="status" aria-label="Loading page">
      <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-[#0b57d0]" />
      </div>
    </div>
  );
}

function NativeNotificationRouter() {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const normalizePath = (value = '') => {
      const raw = String(value || '').trim();
      if (!raw) return '';
      try {
        const url = new URL(raw);
        if (url.protocol === 'syncrova:') {
          const path = url.pathname && url.pathname !== '/' ? url.pathname : '';
          return `${path || '/messages'}${url.search || ''}${url.hash || ''}`;
        }
        return `${url.pathname || '/messages'}${url.search || ''}${url.hash || ''}`;
      } catch {
        return raw.startsWith('/') ? raw : `/${raw}`;
      }
    };

    const openPath = (href) => {
      const path = normalizePath(href);
      if (path) navigate(path);
    };

    const handleNativeOpenPath = (event) => {
      openPath(event.detail?.href);
    };

    let appUrlListenerPromise = null;
    const setupAppUrlListener = async () => {
      try {
        const { App: CapacitorApp } = await import('@capacitor/app');
        appUrlListenerPromise = CapacitorApp.addListener('appUrlOpen', event => openPath(event?.url));
      } catch {
        // Deep linking is native-only.
      }
    };

    window.addEventListener('syncrova:native-open-path', handleNativeOpenPath);
    setupAppUrlListener();

    return () => {
      window.removeEventListener('syncrova:native-open-path', handleNativeOpenPath);
      Promise.resolve(appUrlListenerPromise)
        .then(listener => listener?.remove?.())
        .catch(() => {});
    };
  }, [navigate]);

  return null;
}

function NativeAppEnvironment() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const isNative = Boolean(window.Capacitor?.isNativePlatform?.()) ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:';
    const root = document.documentElement;
    const viewport = document.querySelector('meta[name="viewport"]');
    const previousViewport = viewport?.getAttribute('content') || '';

    root.classList.toggle('syncrova-native-app', isNative);
    if (isNative && viewport) {
      viewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
      );
    }

    return () => {
      root.classList.remove('syncrova-native-app');
      if (viewport && previousViewport) viewport.setAttribute('content', previousViewport);
    };
  }, []);

  return null;
}

function FrameStabilityMonitor() {
  useFrameHealthMonitor();
  return null;
}

function MobileScrollPerformanceGovernor() {
  const removeClassTimerRef = useRef(null);
  const removeInteractionTimerRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    const isMobileViewport = () => (
      root.classList.contains('syncrova-native-app') ||
      window.matchMedia?.('(max-width: 900px), (pointer: coarse)').matches
    );

    const clearScrollStateLater = () => {
      if (removeClassTimerRef.current) window.clearTimeout(removeClassTimerRef.current);
      removeClassTimerRef.current = window.setTimeout(() => {
        root.classList.remove('syncrova-scroll-active');
      }, 150);
    };

    const clearInteractionStateLater = () => {
      if (removeInteractionTimerRef.current) window.clearTimeout(removeInteractionTimerRef.current);
      removeInteractionTimerRef.current = window.setTimeout(() => {
        root.classList.remove('syncrova-interaction-active');
      }, 120);
    };

    const markActiveScroll = () => {
      if (!isMobileViewport() || rafRef.current) return;
      // Performance-sensitive: keep this DOM write on the next frame so scroll handlers stay passive.
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        root.classList.add('syncrova-scroll-active');
        clearScrollStateLater();
      });
    };

    const markInteractionActive = () => {
      if (!isMobileViewport()) return;
      root.classList.add('syncrova-interaction-active');
      clearInteractionStateLater();
    };

    const listenerOptions = { passive: true, capture: true };
    window.addEventListener('scroll', markActiveScroll, listenerOptions);
    window.addEventListener('touchmove', markActiveScroll, listenerOptions);
    window.addEventListener('wheel', markActiveScroll, listenerOptions);
    window.addEventListener('pointerdown', markInteractionActive, listenerOptions);
    window.addEventListener('pointermove', markInteractionActive, listenerOptions);
    window.addEventListener('pointerup', clearInteractionStateLater, listenerOptions);
    window.addEventListener('pointercancel', clearInteractionStateLater, listenerOptions);
    window.addEventListener('touchstart', markInteractionActive, listenerOptions);
    window.addEventListener('touchend', clearInteractionStateLater, listenerOptions);
    window.addEventListener('touchcancel', clearInteractionStateLater, listenerOptions);

    return () => {
      window.removeEventListener('scroll', markActiveScroll, listenerOptions);
      window.removeEventListener('touchmove', markActiveScroll, listenerOptions);
      window.removeEventListener('wheel', markActiveScroll, listenerOptions);
      window.removeEventListener('pointerdown', markInteractionActive, listenerOptions);
      window.removeEventListener('pointermove', markInteractionActive, listenerOptions);
      window.removeEventListener('pointerup', clearInteractionStateLater, listenerOptions);
      window.removeEventListener('pointercancel', clearInteractionStateLater, listenerOptions);
      window.removeEventListener('touchstart', markInteractionActive, listenerOptions);
      window.removeEventListener('touchend', clearInteractionStateLater, listenerOptions);
      window.removeEventListener('touchcancel', clearInteractionStateLater, listenerOptions);
      if (removeClassTimerRef.current) window.clearTimeout(removeClassTimerRef.current);
      if (removeInteractionTimerRef.current) window.clearTimeout(removeInteractionTimerRef.current);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      root.classList.remove('syncrova-scroll-active');
      root.classList.remove('syncrova-interaction-active');
    };
  }, []);

  return null;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageSkeleton variant="dashboard" rows={4} />;
  const protectedLayout = isAuthenticated ? <Layout /> : <Navigate to="/login" replace />;
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />} />
        <Route element={protectedLayout}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/groups" element={<Navigate to="/marketplace" replace />} />
          <Route path="/group/:id" element={<Navigate to="/marketplace" replace />} />
          <Route path="/group/:id/:section" element={<Navigate to="/marketplace" replace />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/reels" element={<Reels />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/arena" element={<OpsArena />} />
          <Route path="/arena/:gameKey" element={<GamePlayPage />} />
          <Route path="/developer-console" element={<OpsArena initialView="developer" consoleOnly />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/search" element={<GlobalSearchPage />} />
          <Route path="/saved" element={<SavedItemsPage />} />
          <Route path="/app-health" element={<AppHealthPage />} />
        </Route>
        <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </Suspense>
  );
}

function AppIntroSplash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    const isNative = Boolean(window.Capacitor?.isNativePlatform?.()) ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:';
    const isMobile = window.matchMedia?.('(max-width: 767px), (pointer: coarse)').matches;
    if (!isNative && !isMobile) return undefined;
    if (hasSeenIntroSplash()) return undefined;

    markIntroSplashSeen();
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1900);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="syncrova-intro-splash" aria-label="Welcome to Syncrova">
      <div className="syncrova-intro-glow" />
      <div className="syncrova-intro-card">
        <div className="syncrova-intro-logo">
          <img src="/syncrova-app-logo.png" alt="" draggable={false} />
        </div>
        <p className="syncrova-intro-eyebrow">Welcome to</p>
        <h1>Syncrova</h1>
        <p className="syncrova-intro-credit">made by sigmaboyz</p>
        <div className="syncrova-intro-loader">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Syncrova render failed', error);
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem('syncrova:last-render-error', JSON.stringify({
          message: error?.message || String(error),
          stack: error?.stack || ''
        }));
      } catch {
        // Dev-only diagnostics should never affect recovery rendering.
      }
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="syncrova-error-fallback">
        <div className="syncrova-error-card">
          <img src="/syncrova-app-logo.png" alt="" draggable={false} />
          <p className="text-xs font-black uppercase text-[#0b57d0]">Syncrova recovered safely</p>
          <h1>Something went wrong</h1>
          <p>The app hit a temporary screen error. Reloading usually puts everything back in place.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload Syncrova
          </button>
        </div>
      </div>
    );
  }
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PresenceProvider>
          <MotionConfig reducedMotion="always">
            <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
            <AppUpdatePrompt />
            <WebUpdatePrompt />
            <AppIntroSplash />
            <AppErrorBoundary>
              <BrowserRouter>
                <NativeAppEnvironment />
                <FrameStabilityMonitor />
                <MobileScrollPerformanceGovernor />
                <NativeBackButtonHandler />
                <NativeNotificationRouter />
                <CallProvider>
                  <div className="app-no-motion app-stable-render relative min-h-screen overflow-hidden" style={{ background: 'var(--app-bg)' }}>
                    <div className="app-decorative-effect app-grid-overlay pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(var(--app-grid-a)_1px,transparent_1px),linear-gradient(90deg,var(--app-grid-b)_1px,transparent_1px)] bg-[size:42px_42px] opacity-70" />
                    <div className="app-decorative-effect app-ambient-overlay pointer-events-none fixed inset-x-0 top-0 z-0 h-80 blur-2xl" style={{ background: 'var(--app-ambient)' }} />
                    <div className="relative z-10">
                      <AppRoutes />
                    </div>
                  </div>
                </CallProvider>
              </BrowserRouter>
            </AppErrorBoundary>
          </MotionConfig>
        </PresenceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
