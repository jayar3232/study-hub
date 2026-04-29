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

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={isAuthenticated ? <Layout><Dashboard /></Layout> : <Navigate to="/login" />} />
      <Route path="/groups" element={isAuthenticated ? <Layout><MyGroups /></Layout> : <Navigate to="/login" />} />
      <Route path="/group/:id" element={isAuthenticated ? <Layout><GroupPage /></Layout> : <Navigate to="/login" />} />
      <Route path="/profile" element={isAuthenticated ? <Layout><Profile /></Layout> : <Navigate to="/login" />} />
      <Route path="/messages" element={isAuthenticated ? <Layout><Messages /></Layout> : <Navigate to="/login" />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <BrowserRouter>
          <div className="relative min-h-screen">
            {/* Animated background bubbles */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
              {[...Array(15)].map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-gradient-to-r from-pink-400/20 to-purple-500/20 animate-float"
                  style={{
                    width: Math.random() * 100 + 50,
                    height: Math.random() * 100 + 50,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDuration: `${Math.random() * 10 + 10}s`,
                    animationDelay: `${Math.random() * 5}s`,
                  }}
                />
              ))}
            </div>
            {/* Main app content */}
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