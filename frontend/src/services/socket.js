import { io } from 'socket.io-client';
import { getBackendOrigin } from '../utils/media';

let socket;

const getDefaultSocketUrl = () => {
  return getBackendOrigin();
};

const getToken = () => localStorage.getItem('token') || '';

export const getSocket = () => {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || getDefaultSocketUrl(), {
      auth: { token: getToken() },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000
    });

    socket.io.on('reconnect_attempt', () => {
      socket.auth = { token: getToken() };
    });
  } else {
    socket.auth = { token: getToken() };
  }

  return socket;
};

export const refreshSocketAuth = ({ reconnect = false } = {}) => {
  if (!socket) return;
  const previousToken = socket.auth?.token || '';
  const nextToken = getToken();
  socket.auth = { token: nextToken };

  if (!reconnect) return;
  if (socket.connected && previousToken !== nextToken) {
    socket.disconnect();
    socket.connect();
    return;
  }
  if (!socket.connected) socket.connect();
};

export const disconnectSocket = () => {
  if (!socket) return;

  socket.disconnect();
  socket = undefined;
};
