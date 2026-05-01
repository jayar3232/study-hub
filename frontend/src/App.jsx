import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './components/Landing';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import MyGroups from './components/MyGroups';      // ✅ Separate component
import GroupPage from './components/GroupPage';
import Profile from './components/Profile';
import Messages from './components/Messages';
import Layout from './components/Layout';
import OpsArena from './components/OpsArena';
import Friends from './components/Friends';
import LoadingSpinner from './components/LoadingSpinner';

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen label="Preparing StudentHub" />;
  const protectedLayout = isAuthenticated ? <Layout /> : <Navigate to="/login" replace />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />} />
      <Route element={protectedLayout}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/groups" element={<MyGroups />} />
        <Route path="/group/:id" element={<GroupPage />} />
        <Route path="/group/:id/:section" element={<GroupPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/arena" element={<OpsArena />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
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
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
