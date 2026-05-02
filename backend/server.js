const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const auth = require('./middleware/auth');
const User = require('./models/User');

dotenv.config();

const app = express();
app.set('trust proxy', 1);

const DEFAULT_CLIENT_ORIGINS = [
  'https://study-hub-app-six.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5002',
  'http://127.0.0.1:5002'
];

const allowedOrigins = (process.env.CLIENT_ORIGINS || DEFAULT_CLIENT_ORIGINS.join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TUNNEL_HOST_SUFFIXES = [
  '.trycloudflare.com',
  '.ngrok-free.app',
  '.ngrok.io',
  '.loca.lt',
  '.localtunnel.me',
  '.localhost.run',
  '.serveo.net',
  '.tunnelmole.net',
  '.devtunnels.ms'
];

const wildcardOriginPatterns = allowedOrigins
  .filter(origin => origin.includes('*') && origin !== '*')
  .map(origin => new RegExp(`^${origin.split('*').map(escapeRegex).join('.*')}$`));

const isTunnelOrigin = (origin) => {
  try {
    const { hostname } = new URL(origin);
    return TUNNEL_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix));
  } catch {
    return false;
  }
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  if (isTunnelOrigin(origin)) return true;
  return wildcardOriginPatterns.some(pattern => pattern.test(origin));
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

// CORS Configuration
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/files', require('./routes/files'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/group-chat', require('./routes/groupChat'));
app.use('/api/memories', require('./routes/memories'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/games', require('./routes/games'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/stories', require('./routes/stories'));

const notifications = require('./routes/notifications');
app.use('/api/notifications', notifications.router);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/syncrova';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Create HTTP server
const server = http.createServer(app);

// Socket.io
const io = socketIo(server, {
  cors: corsOptions
});

app.set('io', io);

// Store online users. One user can have multiple tabs/devices open.
const onlineUsers = new Map();

const normalizeId = (value) => String(value?._id || value?.id || value || '');

const getOnlineUserIds = () => Array.from(onlineUsers.keys());

const broadcastOnlineUsers = () => {
  io.emit('online-users', getOnlineUserIds());
};

const addUserSocket = (userId, socketId) => {
  const id = normalizeId(userId);
  if (!id) return false;

  const wasOffline = !onlineUsers.has(id);
  const sockets = onlineUsers.get(id) || new Set();
  sockets.add(socketId);
  onlineUsers.set(id, sockets);
  return wasOffline;
};

const registerOnlineUser = (socket, userId) => {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) return false;

  const wasOffline = addUserSocket(normalizedUserId, socket.id);
  socket.data.userId = normalizedUserId;
  socket.join(`user_${normalizedUserId}`);
  broadcastOnlineUsers();

  if (wasOffline) {
    socket.broadcast.emit('user-online', normalizedUserId);
  }

  return true;
};

const removeUserSocket = (socket) => {
  const userId = normalizeId(socket.data?.userId);
  if (!userId || !onlineUsers.has(userId)) return null;

  const sockets = onlineUsers.get(userId);
  sockets.delete(socket.id);

  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return userId;
  }

  onlineUsers.set(userId, sockets);
  return null;
};

app.get('/api/presence/online', auth, (req, res) => {
  res.json({ users: getOnlineUserIds() });
});

app.get('/api/presence/online/:userId', auth, async (req, res) => {
  try {
    const userId = normalizeId(req.params.userId);
    const user = await User.findById(userId).select('lastSeen');
    res.json({
      online: onlineUsers.has(userId),
      lastSeen: user?.lastSeen || null
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  const token = socket.handshake.auth?.token;
  if (token && process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      registerOnlineUser(socket, decoded.userId);
      console.log(`User ${decoded.userId} is online via socket auth`);
    } catch (err) {
      console.log('Socket auth failed:', err.message);
    }
  }

  // User online
  socket.on('user-online', (userId, callback) => {
    const normalizedUserId = normalizeId(userId);

    if (normalizedUserId) {
      registerOnlineUser(socket, normalizedUserId);
      console.log(`User ${normalizedUserId} is online`);

      if (typeof callback === 'function') callback(getOnlineUserIds());
    }
  });

  // Check online status
  socket.on('check-online', async (userId, callback) => {
    const normalizedUserId = normalizeId(userId);
    const isOnline = onlineUsers.has(normalizedUserId);

    if (callback) {
      const user = await User.findById(normalizedUserId).select('lastSeen').catch(() => null);
      callback({ online: isOnline, lastSeen: user?.lastSeen || null });
    }
  });

  socket.on('get-online-users', (callback) => {
    if (callback) callback(getOnlineUserIds());
  });

  // Typing event
  socket.on('typing', ({ to, from }) => {
    const toId = normalizeId(to);
    const fromId = normalizeId(from);

    if (toId && fromId) {
      io.to(`user_${toId}`).emit('user-typing', { from: fromId });
    }
  });

  // Stop typing
  socket.on('stop-typing', ({ to, from }) => {
    const toId = normalizeId(to);
    const fromId = normalizeId(from);

    if (toId && fromId) {
      io.to(`user_${toId}`).emit('user-stop-typing', { from: fromId });
    }
  });

  // Direct messages
  socket.on('sendMessage', (message) => {
    const toId = normalizeId(message?.to);
    const fromId = normalizeId(message?.from);

    if (!message || !toId || !fromId) return;

    io.to(`user_${toId}`).emit('receiveMessage', message);
    socket.to(`user_${fromId}`).emit('receiveMessage', message);
  });

  // Join group
  socket.on('join-group', (groupId) => {
    socket.join(`group_${groupId}`);
  });

  // Leave group
  socket.on('leave-group', (groupId) => {
    socket.leave(`group_${groupId}`);
  });

  // Send group message
  socket.on('send-group-message', async (data) => {
    const { groupId, message } = data;

    io.to(`group_${groupId}`).emit('receive-group-message', message);
  });

  // Delete message
  socket.on('delete-group-message', ({ messageId, groupId }) => {
    io.to(`group_${groupId}`).emit('message-deleted', messageId);
  });

  socket.on('delete-message-for-me', ({ messageId, groupId }) => {
    socket.to(`group_${groupId}`).emit('message-deleted-for-me', messageId);
  });

  socket.on('delete-message-for-everyone', ({ messageId, groupId }) => {
    io.to(`group_${groupId}`).emit('message-deleted-for-everyone', messageId);
  });

  // Disconnect
  socket.on('disconnect', async () => {
    const disconnectedUserId = removeUserSocket(socket);

    if (disconnectedUserId) {
      const lastSeen = new Date();
      await User.findByIdAndUpdate(disconnectedUserId, { lastSeen }).catch(err => {
        console.log('Last seen update failed:', err.message);
      });
      console.log(`User ${disconnectedUserId} went offline`);

      socket.broadcast.emit('user-offline', { userId: disconnectedUserId, lastSeen });
      broadcastOnlineUsers();
    }

    console.log('Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
