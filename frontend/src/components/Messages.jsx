import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  MessageCircle, Send, Plus, User, Pin, PinOff, Smile, 
  Image as ImageIcon, Reply, CheckCheck, X, Volume2, VolumeX
} from 'lucide-react';
import api from '../services/api';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import NewChatModal from './NewChatModal';
import { formatDistanceToNow, format } from 'date-fns';
import EmojiPicker from 'emoji-picker-react';
import useSound from 'use-sound';

let socket;

export default function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [playNotification] = useSound('/sounds/ding.mp3', { soundEnabled, volume: 0.5 });
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  let typingTimeout = null;

  const currentUserId = user?._id ? String(user._id) : null;

  // Socket initialization (only once)
  useEffect(() => {
    if (!socket) {
      // Connect to the same origin (works through proxy/tunnel)
      socket = io('', { transports: ['websocket'] });
      socket.on('connect', () => console.log('Socket connected'));
      socket.on('disconnect', () => console.log('Socket disconnected'));
    }
    return () => {};
  }, []);

  // Keep a ref to the selected user to avoid stale closures
  const selectedUserRef = useRef(selectedUser);
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // Socket event listeners + online heartbeat
  useEffect(() => {
    if (!socket) return;

    // --- online status handlers ---
    const onUserOnline = (userId) => {
      setOnlineUsers(prev => new Set(prev).add(String(userId)));
    };
    const onUserOffline = (userId) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(String(userId));
        return newSet;
      });
    };

    // --- typing handlers ---
    const onTyping = ({ from }) => {
      if (selectedUserRef.current && String(from) === String(selectedUserRef.current._id)) {
        setOtherUserTyping(true);
      }
    };
    const onStopTyping = ({ from }) => {
      if (selectedUserRef.current && String(from) === String(selectedUserRef.current._id)) {
        setOtherUserTyping(false);
      }
    };

    // --- message handler ---
    const onReceiveMessage = (message) => {
      console.log('📩 Received message via socket:', message);
      // Refresh conversation list to update last message and unread badge
      fetchConversations();

      const curSelected = selectedUserRef.current;
      if (curSelected && (String(message.from) === String(curSelected._id) || String(message.to) === String(curSelected._id))) {
        console.log('✅ Message belongs to current chat, adding to messages');
        setMessages(prev => {
          if (prev.some(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
        scrollToBottom();
        if (soundEnabled && String(message.from) !== currentUserId) playNotification();
        // Mark as read if the message is from the other user
        if (String(message.from) === String(curSelected._id)) {
          api.put(`/messages/read/${message.from}`);
        }
      } else if (String(message.to) === currentUserId && String(message.from) !== currentUserId) {
        toast.success(`New message from ${message.from?.name || 'someone'}`);
      }
    };

    socket.on('user-online', onUserOnline);
    socket.on('user-offline', onUserOffline);
    socket.on('user-typing', onTyping);
    socket.on('user-stop-typing', onStopTyping);
    socket.on('receiveMessage', onReceiveMessage);

    // --- Tell server I am online & heartbeat every 30s ---
    const emitOnline = () => {
      if (currentUserId && socket.connected) {
        socket.emit('user-online', currentUserId);
      }
    };
    emitOnline();
    const heartbeat = setInterval(emitOnline, 30000);

    return () => {
      socket.off('user-online', onUserOnline);
      socket.off('user-offline', onUserOffline);
      socket.off('user-typing', onTyping);
      socket.off('user-stop-typing', onStopTyping);
      socket.off('receiveMessage', onReceiveMessage);
      clearInterval(heartbeat);
    };
  }, [soundEnabled, playNotification, currentUserId]);

  // Fetch conversations on mount
  useEffect(() => {
    const load = async () => {
      setInitialLoading(true);
      await fetchConversations();
      setInitialLoading(false);
    };
    load();
  }, []);

  // When selected user changes, load messages and mark as read
  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser._id);
      api.put(`/messages/read/${selectedUser._id}`).then(() => fetchConversations());
      scrollToBottom();
      inputRef.current?.focus();
    }
    setReplyingTo(null);
    setAttachment(null);
    setAttachmentPreview(null);
  }, [selectedUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/messages/conversations');
      setConversations(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchMessages = async (userId) => {
    setLoading(true);
    try {
      const res = await api.get(`/messages/${userId}`);
      setMessages(res.data);
    } catch (err) {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !attachment) || !selectedUser) return;
    const text = newMessage.trim();
    setNewMessage('');
    setAttachment(null);
    setAttachmentPreview(null);
    try {
      const payload = { to: selectedUser._id, text };
      if (replyingTo) payload.replyTo = replyingTo._id;
      const res = await api.post('/messages', payload);
      console.log('📤 Sent message:', res.data);
      setMessages(prev => [...prev, res.data]); // optimistic update
      socket.emit('sendMessage', res.data);
      fetchConversations();
      scrollToBottom();
      setReplyingTo(null);
    } catch (err) {
      toast.error('Failed to send');
      setNewMessage(text);
    }
  };

  const handleTyping = () => {
    if (!selectedUser) return;
    socket.emit('typing', { to: selectedUser._id, from: currentUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('stop-typing', { to: selectedUser._id, from: currentUserId });
    }, 1500);
  };

  const handlePin = async (messageId) => {
    try {
      const res = await api.put(`/messages/${messageId}/pin`);
      setMessages(prev => prev.map(m => m._id === messageId ? res.data : m));
      toast.success(res.data.pinned ? 'Pinned' : 'Unpinned');
    } catch (err) { toast.error('Failed to pin'); }
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      const res = await api.post(`/messages/${messageId}/react`, { emoji });
      setMessages(prev => prev.map(m => m._id === messageId ? res.data : m));
      setEmojiPickerMessageId(null);
    } catch (err) { toast.error('Failed to add reaction'); }
  };

  const handleRemoveReaction = async (messageId, emoji) => {
    try {
      const res = await api.post(`/messages/${messageId}/react`, { emoji });
      setMessages(prev => prev.map(m => m._id === messageId ? res.data : m));
    } catch (err) {}
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatMessageTime = (date) => {
    const msgDate = new Date(date);
    const now = new Date();
    const diffMins = Math.floor((now - msgDate) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return format(msgDate, 'h:mm a');
    return formatDistanceToNow(msgDate, { addSuffix: true });
  };

  const getUserAvatar = (userData) => {
    if (userData?.avatar && userData.avatar !== '') {
      return userData.avatar; // relative path
    }
    return null;
  };

  const MessageStatus = ({ message }) => {
    const msgFrom = message.from?._id || message.from;
    if (String(msgFrom) === currentUserId) {
      return message.read ? <CheckCheck size={12} className="text-blue-500" /> : <CheckCheck size={12} className="text-gray-400" />;
    }
    return null;
  };

  const pinnedMessages = messages.filter(m => m.pinned);
  const normalMessages = messages.filter(m => !m.pinned);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-2xl shadow-xl p-6 text-white"
      >
        <h2 className="text-2xl font-bold">Messages</h2>
        <p className="text-purple-100 mt-1">Chat with your study group members in real time</p>
      </motion.div>

      {/* Main Chat Container */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex h-[calc(100vh-280px)]">
          {/* Conversations Sidebar */}
          <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MessageCircle size={20} className="text-pink-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Chats</h3>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                  {soundEnabled ? <Volume2 size={18} className="text-gray-500" /> : <VolumeX size={18} className="text-gray-500" />}
                </button>
                <button onClick={() => setShowModal(true)} className="p-1 rounded-full bg-pink-500 text-white hover:bg-pink-600 transition">
                  <Plus size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scroll">
              {conversations.length === 0 ? (
                <div className="text-center text-gray-500 py-10 px-4">
                  <MessageCircle size={40} className="mx-auto mb-2 opacity-50" />
                  No conversations yet.<br />Click + to start a chat.
                </div>
              ) : (
                <AnimatePresence>
                  {conversations.map((conv, idx) => {
                    const otherUser = conv.user;
                    const isOnline = onlineUsers.has(String(otherUser._id));
                    const avatar = getUserAvatar(otherUser);
                    return (
                      <motion.div
                        key={otherUser._id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        whileHover={{ backgroundColor: 'rgba(0,0,0,0.03)' }}
                        onClick={() => setSelectedUser(otherUser)}
                        className={`p-3 cursor-pointer transition flex items-center gap-3 ${
                          selectedUser?._id === otherUser._id ? 'bg-pink-50 dark:bg-pink-900/20' : ''
                        }`}
                      >
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center overflow-hidden">
                            {avatar ? <img src={avatar} alt={otherUser.name} className="w-full h-full object-cover" /> : <User size={24} className="text-white" />}
                          </div>
                          {isOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate text-gray-900 dark:text-white">{otherUser.name}</div>
                          <div className="text-sm text-gray-500 truncate">{conv.lastMessage}</div>
                        </div>
                        <div className="text-xs text-gray-400">{formatMessageTime(conv.lastTime)}</div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Chat Area */}
          {selectedUser ? (
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-800/50">
              {/* Chat Header */}
              <div className="p-4 border-b bg-white dark:bg-gray-800 flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center overflow-hidden">
                    {getUserAvatar(selectedUser) ? (
                      <img src={getUserAvatar(selectedUser)} alt={selectedUser.name} className="w-full h-full object-cover" />
                    ) : (
                      <User size={20} className="text-white" />
                    )}
                  </div>
                  {onlineUsers.has(String(selectedUser._id)) && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{selectedUser.name}</div>
                  <div className="text-xs text-gray-500">
                    {otherUserTyping ? 'Typing...' : (onlineUsers.has(String(selectedUser._id)) ? 'Online' : 'Offline')}
                  </div>
                </div>
              </div>

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => (
                      <div key={i} className="flex justify-start animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 mr-2"></div>
                        <div className="w-64 h-16 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {pinnedMessages.length > 0 && (
                      <div className="mb-4">
                        <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/80 py-1 text-xs font-semibold text-gray-500 flex items-center gap-1 backdrop-blur-sm">
                          <Pin size={12} /> Pinned
                        </div>
                        {pinnedMessages.map(msg => {
                          const isMe = String(msg.from?._id || msg.from) === currentUserId;
                          const sender = isMe ? user : selectedUser;
                          return (
                            <motion.div
                              key={msg._id}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2 mb-2 flex items-center gap-2"
                            >
                              <div className="w-6 h-6 rounded-full bg-gray-300 overflow-hidden">
                                {getUserAvatar(sender) ? (
                                  <img src={getUserAvatar(sender)} alt="" className="w-full h-full" />
                                ) : (
                                  <User size={14} />
                                )}
                              </div>
                              <div className="flex-1 text-sm">
                                <span className="font-semibold">{sender.name}:</span> {msg.text}
                              </div>
                              <button onClick={() => handlePin(msg._id)} className="text-gray-400 hover:text-yellow-500">
                                <PinOff size={14} />
                              </button>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                    {normalMessages.map((msg, idx) => {
                      const isMe = String(msg.from?._id || msg.from) === currentUserId;
                      const sender = isMe ? user : selectedUser;
                      const reactions = msg.reactions || [];
                      const hasReply = msg.replyTo;
                      return (
                        <motion.div
                          key={msg._id}
                          initial={{ opacity: 0, scale: 0.9, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}
                        >
                          {!isMe && (
                            <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 overflow-hidden mr-2 flex-shrink-0 mt-1">
                              {getUserAvatar(sender) ? (
                                <img src={getUserAvatar(sender)} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <User size={16} className="mx-auto mt-2" />
                              )}
                            </div>
                          )}
                          <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                            {!isMe && <div className="text-xs text-gray-500 mb-0.5 ml-1">{sender.name}</div>}
                            {isMe && <div className="text-xs text-gray-500 mb-0.5 text-right">You</div>}
                            {hasReply && (
                              <div className="text-xs bg-gray-100 dark:bg-gray-700 p-1 rounded mb-1 italic border-l-2 border-pink-500">
                                ↪️ Replied to {msg.replyTo?.from === currentUserId ? 'you' : msg.replyTo?.fromName}
                              </div>
                            )}
                            <div className={`relative px-4 py-2 rounded-2xl shadow-sm transition-all ${
                              isMe
                                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-br-none'
                                : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none'
                            }`}>
                              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                              {reactions.length > 0 && (
                                <div className="absolute -bottom-4 right-0 flex gap-0.5 text-xs bg-white dark:bg-gray-800 rounded-full px-1 shadow">
                                  {reactions.map((r, idx) => (
                                    <button key={idx} onClick={() => handleRemoveReaction(msg._id, r.emoji)} className="hover:scale-110 transition">
                                      {r.emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-1 justify-end">
                              <span className="text-xs text-gray-400">{formatMessageTime(msg.createdAt)}</span>
                              <MessageStatus message={msg} />
                              <button
                                onClick={() => {
                                  setReplyingTo({ _id: msg._id, text: msg.text, from: msg.from, fromName: sender.name });
                                  inputRef.current?.focus();
                                }}
                                className="text-gray-400 hover:text-pink-500 transition"
                              >
                                <Reply size={12} />
                              </button>
                              <div className="relative">
                                <button onClick={() => setEmojiPickerMessageId(emojiPickerMessageId === msg._id ? null : msg._id)} className="text-gray-400 hover:text-pink-500 transition">
                                  <Smile size={14} />
                                </button>
                                {emojiPickerMessageId === msg._id && (
                                  <div className="absolute bottom-6 right-0 z-20">
                                    <EmojiPicker onEmojiClick={(emoji) => handleReaction(msg._id, emoji.emoji)} />
                                  </div>
                                )}
                              </div>
                              <button onClick={() => handlePin(msg._id)} className="text-gray-400 hover:text-yellow-500 transition">
                                {msg.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input Area */}
              <div className="p-3 border-t bg-white dark:bg-gray-800">
                {replyingTo && (
                  <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex justify-between items-center">
                    <div className="text-sm">
                      <span className="font-semibold">Replying to {replyingTo.fromName}</span>
                      <p className="text-xs text-gray-500 truncate">{replyingTo.text}</p>
                    </div>
                    <button onClick={() => setReplyingTo(null)}><X size={16} /></button>
                  </div>
                )}
                {attachmentPreview && (
                  <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex justify-between items-center">
                    <img src={attachmentPreview} className="w-10 h-10 object-cover rounded" />
                    <button onClick={() => { setAttachment(null); setAttachmentPreview(null); }}><X size={16} /></button>
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="p-2 rounded-full hover:bg-gray-100 cursor-pointer">
                    <ImageIcon size={20} className="text-gray-500" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setAttachment(file);
                        const reader = new FileReader();
                        reader.onloadend = () => setAttachmentPreview(reader.result);
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    onKeyUp={handleTyping}
                    placeholder="Aa"
                    className="flex-1 p-3 rounded-full border dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500 transition"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={sendMessage}
                    disabled={!newMessage.trim() && !attachment}
                    className="p-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white disabled:opacity-50 shadow-md hover:shadow-lg transition"
                  >
                    <Send size={20} />
                  </motion.button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-white dark:bg-gray-800">
              <MessageCircle size={48} className="mb-4 opacity-30" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">or start a new chat from the + button.</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <NewChatModal
          onClose={() => setShowModal(false)}
          onSelectUser={(newUser) => {
            setSelectedUser(newUser);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}