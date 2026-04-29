const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
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

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studyhub';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ MongoDB connection error:', err));

// Create HTTP server and attach Socket.io
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store online users: userId -> socketId
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('🔌 New client connected, socket ID:', socket.id);

  // User comes online
  socket.on('user-online', (userId) => {
    if (userId) {
      onlineUsers.set(userId, socket.id);
      console.log(`✅ User ${userId} is online`);
      // Notify all other clients that this user is online
      socket.broadcast.emit('user-online', userId);
    }
  });

  socket.on('check-online', (userId, callback) => {
  const isOnline = onlineUsers.has(userId);
  if (callback) callback(isOnline);
});

  // User is typing
  socket.on('typing', ({ to, from }) => {
    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('user-typing', { from });
    }
  });

  // User stopped typing
  socket.on('stop-typing', ({ to, from }) => {
    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('user-stop-typing', { from });
    }
  });

  const onReceiveMessage = (message) => {
  console.log('Socket received message:', message, 'Current selected user:', selectedUserRef.current);
  // Refresh conversation list
  fetchConversations();
  
  // Check if this message belongs to the currently open chat
  const curSelected = selectedUserRef.current;
  if (curSelected) {
    const isFromSelected = String(message.from) === String(curSelected._id);
    const isToSelected = String(message.to) === String(curSelected._id);
    if (isFromSelected || isToSelected) {
      console.log('Adding message to current chat');
      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m._id === message._id)) return prev;
        return [...prev, message];
      });
      scrollToBottom();
      if (soundEnabled && String(message.from) !== currentUserId) playNotification();
      // Mark as read
      if (isFromSelected) {
        api.put(`/messages/read/${message.from}`);
      }
    } else if (String(message.to) === currentUserId && String(message.from) !== currentUserId) {
      toast.success(`New message from ${message.from?.name || 'someone'}`);
    }
  } else {
    // No selected user, just toast
    if (String(message.to) === currentUserId && String(message.from) !== currentUserId) {
      toast.success(`New message from ${message.from?.name || 'someone'}`);
    }
  }
};


  // Handle disconnect
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
  // Group chat message
socket.on('send-group-message', async (data) => {
  const { groupId, message } = data;
  // Optionally verify group membership via DB, but trust frontend for speed
  io.to(`group_${groupId}`).emit('receive-group-message', message);
});

// Join a group room
socket.on('join-group', (groupId) => {
  socket.join(`group_${groupId}`);
});
socket.on('leave-group', (groupId) => {
  socket.leave(`group_${groupId}`);
});

socket.on('delete-group-message', async (data) => {
  const { messageId, groupId } = data;
  io.to(`group_${groupId}`).emit('message-deleted', messageId);
});
socket.on('delete-message-for-me', ({ messageId, groupId }) => {
  socket.to(`group_${groupId}`).emit('message-deleted-for-me', messageId);
});
socket.on('delete-message-for-everyone', ({ messageId, groupId }) => {
  io.to(`group_${groupId}`).emit('message-deleted-for-everyone', messageId);
});


});
const notifications = require('./routes/notifications');
app.use('/api/notifications', notifications.router);
app.use('/api/group-chat', require('./routes/groupChat'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));