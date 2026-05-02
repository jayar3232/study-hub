import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PresenceProvider } from './context/PresenceContext';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';

const Landing = lazy(() => import('./components/Landing'));
const Login = lazy(() => import('./components/Login'));
const Register = lazy(() => import('./components/Register'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const MyGroupsPage = lazy(() => import('./components/MyGroups'));
const GroupPage = lazy(() => import('./components/GroupPage'));
const Profile = lazy(() => import('./components/Profile'));
const Messages = lazy(() => import('./components/Messages'));
const OpsArena = lazy(() => import('./components/OpsArena'));
const Friends = lazy(() => import('./components/Friends'));

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen label="Preparing SYNCROVA" />;
  const protectedLayout = isAuthenticated ? <Layout /> : <Navigate to="/login" replace />;
  return (
    <Suspense fallback={<LoadingSpinner fullScreen label="Loading SYNCROVA" />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />} />
        <Route element={protectedLayout}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/groups" element={<MyGroupsPage />} />
          <Route path="/group/:id" element={<GroupPage />} />
          <Route path="/group/:id/:section" element={<GroupPage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/arena" element={<OpsArena />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PresenceProvider>
          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
          <BrowserRouter>
            <div className="relative min-h-screen overflow-hidden" style={{ background: 'var(--app-bg)' }}>
              <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(var(--app-grid-a)_1px,transparent_1px),linear-gradient(90deg,var(--app-grid-b)_1px,transparent_1px)] bg-[size:42px_42px] opacity-70" />
              <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-80 blur-2xl" style={{ background: 'var(--app-ambient)' }} />
              <div className="relative z-10">
                <AppRoutes />
              </div>
            </div>
          </BrowserRouter>
        </PresenceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
