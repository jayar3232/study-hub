import { io, Socket } from 'socket.io-client';
import { BACKEND_ORIGIN } from '../config';

let socket: Socket | null = null;
let tokenGetter: () => Promise<string | null> = async () => null;

export const setSocketTokenGetter = (getter: () => Promise<string | null>) => {
  tokenGetter = getter;
};

export const getSocket = async () => {
  const token = await tokenGetter();

  if (!socket) {
    socket = io(BACKEND_ORIGIN, {
      auth: { token: token || '' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000
    });

    socket.io.on('reconnect_attempt', async () => {
      if (socket) socket.auth = { token: (await tokenGetter()) || '' };
    });
  } else {
    socket.auth = { token: token || '' };
  }

  return socket;
};

export const refreshSocketAuth = async ({ reconnect = false } = {}) => {
  if (!socket) return;
  socket.auth = { token: (await tokenGetter()) || '' };
  if (reconnect) {
    socket.disconnect();
    socket.connect();
  }
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};
