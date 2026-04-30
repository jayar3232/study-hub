import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { disconnectSocket, getSocket, refreshSocketAuth } from '../services/socket';

const AuthContext = createContext();

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['x-auth-token'] = token;
      // Fetch user profile
      api.get('/users/profile')
        .then(res => setUser(res.data))
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const userId = getEntityId(user);
    if (!userId) return undefined;

    const socket = getSocket();
    const announceOnline = () => {
      socket.emit('user-online', userId);
    };

    socket.on('connect', announceOnline);

    if (socket.connected) {
      announceOnline();
    } else {
      socket.connect();
    }

    const heartbeat = setInterval(announceOnline, 30000);

    return () => {
      socket.off('connect', announceOnline);
      clearInterval(heartbeat);
    };
  }, [user]);

  const login = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    api.defaults.headers.common['x-auth-token'] = newToken;
    refreshSocketAuth();
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['x-auth-token'];
    disconnectSocket();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
