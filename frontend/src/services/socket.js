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

export const refreshSocketAuth = () => {
  if (!socket) return;
  socket.auth = { token: getToken() };
};

export const disconnectSocket = () => {
  if (!socket) return;

  socket.disconnect();
  socket = undefined;
};
