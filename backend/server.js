const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

dotenv.config();

const app = express();

// CORS Configuration
app.use(cors({
  origin: 'https://study-hub-app-six.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

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

const notifications = require('./routes/notifications');
app.use('/api/notifications', notifications.router);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studyhub';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ MongoDB connection error:', err));

// Create HTTP server
const server = http.createServer(app);

// Socket.io
const io = socketIo(server, {
  cors: {
    origin: 'https://study-hub-app-six.vercel.app',
    methods: ['GET', 'POST']
  }
});

// Store online users
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // User online
  socket.on('user-online', (userId) => {
    if (userId) {
      onlineUsers.set(userId, socket.id);

      console.log(`✅ User ${userId} is online`);

      socket.broadcast.emit('user-online', userId);
    }
  });

  // Check online status
  socket.on('check-online', (userId, callback) => {
    const isOnline = onlineUsers.has(userId);

    if (callback) callback(isOnline);
  });

  // Typing event
  socket.on('typing', ({ to, from }) => {
    const targetSocketId = onlineUsers.get(to);

    if (targetSocketId) {
      io.to(targetSocketId).emit('user-typing', { from });
    }
  });

  // Stop typing
  socket.on('stop-typing', ({ to, from }) => {
    const targetSocketId = onlineUsers.get(to);

    if (targetSocketId) {
      io.to(targetSocketId).emit('user-stop-typing', { from });
    }
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
  socket.on('disconnect', () => {
    let disconnectedUserId = null;

    for (let [userId, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        disconnectedUserId = userId;
        onlineUsers.delete(userId);
        break;
      }
    }

    if (disconnectedUserId) {
      console.log(`🔴 User ${disconnectedUserId} went offline`);

      socket.broadcast.emit('user-offline', disconnectedUserId);
    }

    console.log('🔌 Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});