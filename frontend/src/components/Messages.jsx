import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  CheckCheck,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Mic,
  MoreVertical,
  Pin,
  PinOff,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  StickyNote,
  Square,
  Trash2,
  User,
  Video,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import EmojiPicker from 'emoji-picker-react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import NewChatModal from './NewChatModal';
import { resolveMediaUrl } from '../utils/media';
import { playUiSound } from '../utils/sound';

let socket;

const MAX_MESSAGE_UPLOAD_SIZE = 25 * 1024 * 1024;
const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const getDisplayName = (entity, fallback = 'User') => entity?.name || fallback;

const formatBytes = (bytes = 0) => {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const getFileType = (file) => {
  if (file?.type?.startsWith('image/')) return 'image';
  if (file?.type?.startsWith('video/')) return 'video';
  if (file?.type?.startsWith('audio/')) return 'audio';
  return 'file';
};

const getMessageSnippet = (message) => {
  if (!message) return '';
  if (message.unsent) return 'Message unsent';
  if (message.text?.trim()) return message.text;
  if (message.fileType === 'image') return 'Photo';
  if (message.fileType === 'video') return 'Video';
  if (message.fileType === 'audio') return 'Voice message';
  if (message.fileUrl) return message.fileName || 'File attachment';
  return 'Message';
};

const messageVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1 }
};

export default function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [conversationSearch, setConversationSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [presenceReady, setPresenceReady] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [actionMenuMessageId, setActionMenuMessageId] = useState(null);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [focusedMessageId, setFocusedMessageId] = useState(null);
  const [lastSeenByUser, setLastSeenByUser] = useState({});
  const [myNote, setMyNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [userNotes, setUserNotes] = useState({});
  const [, setPresenceClock] = useState(0);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingCancelledRef = useRef(false);
  const recordingTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingUsersTimeoutRef = useRef({});
  const selectedUserRef = useRef(null);
  const messageRefs = useRef({});

  const currentUserId = getEntityId(user);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    });
  }, []);

  const clearAttachment = useCallback(() => {
    setSelectedAttachment(null);
    setUploadProgress(0);
    setAttachmentPreview(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const updateUnreadBadge = (items) => {
    const unreadTotal = items.reduce((total, item) => total + (item.unreadCount || 0), 0);
    window.dispatchEvent(new CustomEvent('unreadMessages', { detail: { count: unreadTotal } }));
  };

  const rememberLastSeen = (items = []) => {
    setLastSeenByUser(prev => {
      const next = { ...prev };
      items.forEach(item => {
        const person = item?.user || item;
        const personId = getEntityId(person);
        if (personId && person?.lastSeen) next[personId] = person.lastSeen;
      });
      return next;
    });
  };

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/messages/conversations');
      setConversations(res.data);
      rememberLastSeen(res.data);
      updateUnreadBadge(res.data);
      return res.data;
    } catch (err) {
      console.error(err);
      return [];
    }
  }, []);

  const fetchUserNotes = useCallback(async () => {
    try {
      const [myNoteRes, activeNotesRes] = await Promise.all([
        api.get('/notes/me'),
        api.get('/notes/active')
      ]);

      setMyNote(myNoteRes.data || null);
      setNoteText(myNoteRes.data?.text || '');
      setUserNotes((activeNotesRes.data || []).reduce((map, note) => {
        const noteUserId = getEntityId(note.userId);
        if (noteUserId) map[noteUserId] = note;
        return map;
      }, {}));
    } catch (err) {
      console.error('User notes failed', err);
    }
  }, []);

  const markChatAsRead = useCallback(async (otherUserId) => {
    const id = getEntityId(otherUserId);
    if (!id || !currentUserId) return;

    try {
      const res = await api.put(`/messages/read/${id}`);
      setMessages(prev => prev.map(message => {
        const fromId = getEntityId(message.from);
        const toId = getEntityId(message.to);

        if (fromId === id && toId === currentUserId) {
          return {
            ...message,
            read: true,
            readAt: res.data?.readAt || message.readAt
          };
        }

        return message;
      }));
      fetchConversations();
    } catch (err) {
      console.error(err);
    }
  }, [currentUserId, fetchConversations]);

  const fetchMessages = useCallback(async (userId) => {
    const id = getEntityId(userId);
    if (!id) return;

    setLoading(true);
    try {
      const res = await api.get(`/messages/${id}`);
      setMessages(res.data);
      rememberLastSeen(res.data.flatMap(message => [message.from, message.to]));
      await markChatAsRead(id);
      scrollToBottom('auto');
    } catch (err) {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [markChatAsRead, scrollToBottom]);

  useEffect(() => {
    const load = async () => {
      setInitialLoading(true);
      await Promise.all([fetchConversations(), fetchUserNotes()]);
      setInitialLoading(false);
    };

    load();
  }, [fetchConversations, fetchUserNotes]);

  useEffect(() => {
    if (!currentUserId) return undefined;

    socket = getSocket();

    const syncOnlineUsers = async () => {
      try {
        const res = await api.get('/presence/online');
        setOnlineUsers(new Set((res.data?.users || []).map(String)));
        setPresenceReady(true);
      } catch (err) {
        console.error('Presence fallback failed', err);
      }
    };

    const announceOnline = () => {
      setSocketConnected(true);
      socket.emit('user-online', currentUserId, (users = []) => {
        setOnlineUsers(new Set(users.map(String)));
        setPresenceReady(true);
      });
      socket.emit('get-online-users', (users = []) => {
        setOnlineUsers(new Set(users.map(String)));
        setPresenceReady(true);
      });
    };

    const onOnlineUsers = (users = []) => {
      setOnlineUsers(new Set(users.map(String)));
      setPresenceReady(true);
    };

    const onDisconnect = () => {
      setSocketConnected(false);
      setPresenceReady(false);
      syncOnlineUsers();
    };

    const onUserOnline = (userId) => {
      const normalizedUserId = getEntityId(userId);
      if (!normalizedUserId) return;
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.add(normalizedUserId);
        return next;
      });
    };

    const onUserOffline = (payload) => {
      const userId = getEntityId(payload?.userId || payload);
      if (!userId) return;
      if (payload?.lastSeen) {
        setLastSeenByUser(prev => ({ ...prev, [userId]: payload.lastSeen }));
      }

      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    const onTyping = ({ from }) => {
      const fromId = getEntityId(from);
      if (!fromId) return;

      setTypingUsers(prev => {
        const next = new Set(prev);
        next.add(fromId);
        return next;
      });
      clearTimeout(typingUsersTimeoutRef.current[fromId]);
      typingUsersTimeoutRef.current[fromId] = setTimeout(() => {
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(fromId);
          return next;
        });
        if (getEntityId(selectedUserRef.current) === fromId) {
          setOtherUserTyping(false);
        }
      }, 3500);

      if (getEntityId(selectedUserRef.current) === getEntityId(from)) {
        setOtherUserTyping(true);
      }
    };

    const onStopTyping = ({ from }) => {
      const fromId = getEntityId(from);

      setTypingUsers(prev => {
        const next = new Set(prev);
        next.delete(fromId);
        return next;
      });
      clearTimeout(typingUsersTimeoutRef.current[fromId]);
      delete typingUsersTimeoutRef.current[fromId];

      if (getEntityId(selectedUserRef.current) === fromId) {
        setOtherUserTyping(false);
      }
    };

    const onReceiveMessage = (message) => {
      const fromId = getEntityId(message.from);
      const toId = getEntityId(message.to);
      const messageId = getEntityId(message);
      const selectedId = getEntityId(selectedUserRef.current);
      const belongsToCurrentUser = fromId === currentUserId || toId === currentUserId;
      const belongsToOpenChat = selectedId && (
        (fromId === selectedId && toId === currentUserId) ||
        (toId === selectedId && fromId === currentUserId)
      );

      if (!messageId || !belongsToCurrentUser) return;

      fetchConversations();

      if (belongsToOpenChat) {
        setMessages(prev => {
          if (prev.some(item => getEntityId(item) === messageId)) return prev;
          return [...prev, message];
        });
        setOtherUserTyping(false);
        scrollToBottom();

        if (fromId !== currentUserId) {
          if (soundEnabled) playUiSound('message', 0.5);
          markChatAsRead(fromId);
        }
      } else if (toId === currentUserId && fromId !== currentUserId) {
        if (soundEnabled) playUiSound('message', 0.5);
        toast.success(`New message from ${getDisplayName(message.from, 'someone')}`);
      }
    };

    const onMessagesRead = ({ readerId, senderId, readAt }) => {
      if (getEntityId(senderId) !== currentUserId) return;
      const reader = getEntityId(readerId);

      setMessages(prev => prev.map(message => {
        if (getEntityId(message.from) === currentUserId && getEntityId(message.to) === reader) {
          return { ...message, read: true, readAt: readAt || message.readAt };
        }

        return message;
      }));
      fetchConversations();
    };

    const onMessageUpdated = (updatedMessage) => {
      const fromId = getEntityId(updatedMessage.from);
      const toId = getEntityId(updatedMessage.to);
      const selectedId = getEntityId(selectedUserRef.current);
      const belongsToOpenChat = selectedId && (
        (fromId === selectedId && toId === currentUserId) ||
        (toId === selectedId && fromId === currentUserId)
      );

      if (belongsToOpenChat) {
        setMessages(prev => prev.map(message => (
          getEntityId(message) === getEntityId(updatedMessage) ? updatedMessage : message
        )));
      }

      fetchConversations();
    };

    const onMessageHidden = ({ messageId }) => {
      setMessages(prev => prev.filter(message => getEntityId(message) !== getEntityId(messageId)));
      fetchConversations();
    };

    const onConversationDeleted = ({ userId }) => {
      const deletedUserId = getEntityId(userId);
      setConversations(prev => prev.filter(conversation => getEntityId(conversation.user) !== deletedUserId));

      if (getEntityId(selectedUserRef.current) === deletedUserId) {
        setSelectedUser(null);
        setMessages([]);
      }
    };

    socket.on('connect', announceOnline);
    socket.on('disconnect', onDisconnect);
    socket.on('online-users', onOnlineUsers);
    socket.on('user-online', onUserOnline);
    socket.on('user-offline', onUserOffline);
    socket.on('user-typing', onTyping);
    socket.on('user-stop-typing', onStopTyping);
    socket.on('receiveMessage', onReceiveMessage);
    socket.on('messages-read', onMessagesRead);
    socket.on('message-updated', onMessageUpdated);
    socket.on('message-hidden', onMessageHidden);
    socket.on('conversation-deleted', onConversationDeleted);

    if (socket.connected) {
      announceOnline();
    } else {
      socket.connect();
    }

    syncOnlineUsers();

    const heartbeat = setInterval(() => {
      announceOnline();
      syncOnlineUsers();
    }, 15000);

    return () => {
      socket.off('connect', announceOnline);
      socket.off('disconnect', onDisconnect);
      socket.off('online-users', onOnlineUsers);
      socket.off('user-online', onUserOnline);
      socket.off('user-offline', onUserOffline);
      socket.off('user-typing', onTyping);
      socket.off('user-stop-typing', onStopTyping);
      socket.off('receiveMessage', onReceiveMessage);
      socket.off('messages-read', onMessagesRead);
      socket.off('message-updated', onMessageUpdated);
      socket.off('message-hidden', onMessageHidden);
      socket.off('conversation-deleted', onConversationDeleted);
      clearInterval(heartbeat);
    };
  }, [
    currentUserId,
    fetchConversations,
    markChatAsRead,
    scrollToBottom,
    soundEnabled
  ]);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser._id || selectedUser.id);
      inputRef.current?.focus();
    } else {
      setMessages([]);
    }

    setReplyingTo(null);
    setEmojiPickerMessageId(null);
    setActionMenuMessageId(null);
    setShowPinnedPanel(false);
    setFocusedMessageId(null);
    clearAttachment();
    setOtherUserTyping(false);
  }, [clearAttachment, fetchMessages, selectedUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
      clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        recordingCancelledRef.current = true;
        mediaRecorderRef.current.stop();
      }
      Object.values(typingUsersTimeoutRef.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setPresenceClock(value => value + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const uploadMessageAttachment = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post('/messages/upload', formData, {
      onUploadProgress: (progressEvent) => {
        if (!progressEvent.total) return;
        setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
      }
    });

    return res.data;
  };

  const sendMessage = async (overrideAttachment = null) => {
    if ((!newMessage.trim() && !selectedAttachment && !overrideAttachment) || !selectedUser || sending) return;

    const text = newMessage.trim();
    const attachment = overrideAttachment || selectedAttachment;

    setSending(true);
    setNewMessage('');
    stopTyping();

    try {
      const payload = { to: getEntityId(selectedUser), text };
      if (replyingTo) payload.replyTo = getEntityId(replyingTo);

      if (attachment?.file) {
        const upload = await uploadMessageAttachment(attachment.file);
        Object.assign(payload, upload);
      }

      const res = await api.post('/messages', payload);
      setMessages(prev => {
        if (prev.some(item => getEntityId(item) === getEntityId(res.data))) return prev;
        return [...prev, res.data];
      });
      fetchConversations();
      setReplyingTo(null);
      clearAttachment();
      if (soundEnabled) playUiSound('send', 0.35);
      scrollToBottom();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to send');
      if (!overrideAttachment) setNewMessage(text);
    } finally {
      setSending(false);
      setUploadProgress(0);
    }
  };

  const handleSaveNote = async (event) => {
    event.preventDefault();
    const text = noteText.trim();
    if (!text) return;

    setSavingNote(true);
    try {
      const res = await api.post('/notes/me', { text });
      setMyNote(res.data);
      setUserNotes(prev => ({ ...prev, [currentUserId]: res.data }));
      playUiSound('success');
      toast.success('Note posted for 2 days');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to post note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleClearNote = async () => {
    setSavingNote(true);
    try {
      await api.delete('/notes/me');
      setMyNote(null);
      setNoteText('');
      setUserNotes(prev => {
        const next = { ...prev };
        delete next[currentUserId];
        return next;
      });
      toast.success('Note removed');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to remove note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleTyping = () => {
    const selectedId = getEntityId(selectedUser);
    if (!socket || !selectedId || !currentUserId) return;

    socket.emit('typing', { to: selectedId, from: currentUserId });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing', { to: selectedId, from: currentUserId });
    }, 1200);
  };

  const stopTyping = () => {
    const selectedId = getEntityId(selectedUser);
    if (!socket || !selectedId || !currentUserId) return;

    clearTimeout(typingTimeoutRef.current);
    socket.emit('stop-typing', { to: selectedId, from: currentUserId });
  };

  const handleAttachmentSelect = (event, expectedType = null) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_MESSAGE_UPLOAD_SIZE) {
      toast.error('Maximum attachment size is 25MB');
      return;
    }

    const fileType = getFileType(file);
    if (expectedType && fileType !== expectedType) {
      toast.error(`Please choose a ${expectedType} file`);
      return;
    }

    clearAttachment();
    setSelectedAttachment({ file, fileType });
    if (fileType === 'image' || fileType === 'video' || fileType === 'audio') {
      setAttachmentPreview(URL.createObjectURL(file));
    }
  };

  const startRecording = async () => {
    if (!selectedUser || recording || sending) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Voice recording is not supported in this browser');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recordingCancelledRef.current = false;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        setRecording(false);
        clearInterval(recordingTimerRef.current);
        setRecordingSeconds(0);

        if (blob.size === 0 || recordingCancelledRef.current) return;

        const voiceFile = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
        await sendMessage({ file: voiceFile, fileType: 'audio' });
      };

      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(seconds => seconds + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      toast.error('Microphone permission was not granted');
    }
  };

  const stopRecording = () => {
    recordingCancelledRef.current = false;
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleRemoveForMe = async (messageId) => {
    try {
      await api.delete(`/messages/${messageId}/me`);
      setMessages(prev => prev.filter(message => getEntityId(message) !== messageId));
      setActionMenuMessageId(null);
      fetchConversations();
      toast.success('Removed for you');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to remove message');
    }
  };

  const handleUnsendForEveryone = async (messageId) => {
    if (!window.confirm('Unsend this message for everyone?')) return;

    try {
      const res = await api.delete(`/messages/${messageId}/everyone`);
      setMessages(prev => prev.map(message => getEntityId(message) === messageId ? res.data : message));
      setActionMenuMessageId(null);
      fetchConversations();
      toast.success('Message unsent');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to unsend message');
    }
  };

  const handleDeleteConversation = async () => {
    const selectedId = getEntityId(selectedUser);
    if (!selectedId) return;
    if (!window.confirm(`Delete conversation with ${selectedUser.name}? This only removes it for you.`)) return;

    try {
      await api.delete(`/messages/conversation/${selectedId}`);
      setMessages([]);
      setSelectedUser(null);
      await fetchConversations();
      toast.success('Conversation deleted');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to delete conversation');
    }
  };

  const handlePin = async (messageId) => {
    try {
      const res = await api.put(`/messages/${messageId}/pin`);
      setMessages(prev => prev.map(message => getEntityId(message) === messageId ? res.data : message));
      setShowPinnedPanel(res.data.pinned);
      toast.success(res.data.pinned ? 'Pinned' : 'Unpinned');
    } catch (err) {
      toast.error('Failed to pin');
    }
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      const res = await api.post(`/messages/${messageId}/react`, { emoji });
      setMessages(prev => prev.map(message => getEntityId(message) === messageId ? res.data : message));
      setEmojiPickerMessageId(null);
    } catch (err) {
      toast.error('Failed to add reaction');
    }
  };

  const handleRemoveReaction = async (messageId, emoji) => {
    try {
      const res = await api.post(`/messages/${messageId}/react`, { emoji });
      setMessages(prev => prev.map(message => getEntityId(message) === messageId ? res.data : message));
    } catch (err) {
      console.error(err);
    }
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
      return resolveMediaUrl(userData.avatar);
    }

    return null;
  };

  const latestOwnMessageId = useMemo(() => {
    const latestOwnMessage = [...messages]
      .reverse()
      .find(message => getEntityId(message.from) === currentUserId);

    return getEntityId(latestOwnMessage);
  }, [currentUserId, messages]);

  const pinnedMessages = useMemo(() => messages.filter(message => message.pinned), [messages]);

  const scrollToPinnedMessage = (messageId) => {
    setShowPinnedPanel(false);
    setFocusedMessageId(messageId);
    requestAnimationFrame(() => {
      messageRefs.current[messageId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    setTimeout(() => setFocusedMessageId(null), 1800);
  };

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter(({ user: conversationUser, lastMessage }) => {
      return (
        conversationUser?.name?.toLowerCase().includes(query) ||
        conversationUser?.email?.toLowerCase().includes(query) ||
        lastMessage?.toLowerCase().includes(query)
      );
    });
  }, [conversationSearch, conversations]);

  const selectedUserId = getEntityId(selectedUser);
  const selectedIsOnline = selectedUserId ? onlineUsers.has(selectedUserId) : false;
  const selectedLastSeen = selectedUserId ? lastSeenByUser[selectedUserId] || selectedUser?.lastSeen : null;
  const offlineText = selectedLastSeen
    ? `Offline ${formatDistanceToNow(new Date(selectedLastSeen), { addSuffix: true })}`
    : 'Offline';
  const presenceText = !socketConnected
    ? 'Reconnecting...'
    : !presenceReady
      ? 'Checking status...'
      : selectedIsOnline
        ? 'Online now'
        : offlineText;

  useEffect(() => {
    if (!selectedUserId || !socket) return undefined;

    let cancelled = false;
    const updateStatus = (payload) => {
      const isOnline = typeof payload === 'object' ? payload.online : payload;
      const lastSeen = typeof payload === 'object' ? payload.lastSeen : null;
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (isOnline) next.add(selectedUserId);
        else next.delete(selectedUserId);
        return next;
      });
      if (lastSeen) {
        setLastSeenByUser(prev => ({ ...prev, [selectedUserId]: lastSeen }));
      }
      setPresenceReady(true);
    };

    socket.emit('check-online', selectedUserId, (isOnline) => {
      if (cancelled) return;
      updateStatus(isOnline);
    });

    api.get(`/presence/online/${selectedUserId}`)
      .then(res => {
        if (!cancelled) updateStatus({ online: !!res.data?.online, lastSeen: res.data?.lastSeen });
      })
      .catch(err => console.error('Presence status fallback failed', err));

    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  const renderAvatar = (person, sizeClass = 'h-11 w-11', iconSize = 22) => {
    const avatar = getUserAvatar(person);

    return (
      <div className={`${sizeClass} relative overflow-hidden rounded-full bg-gradient-to-br from-pink-500 via-fuchsia-500 to-indigo-500 shadow-sm`}>
        {avatar ? (
          <img src={avatar} alt={getDisplayName(person)} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white">
            <User size={iconSize} />
          </div>
        )}
      </div>
    );
  };

  const MessageStatus = ({ message, isLatestOwn }) => {
    if (getEntityId(message.from) !== currentUserId) return null;

    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${message.read ? 'text-sky-500' : 'text-gray-400'}`}>
        <CheckCheck size={13} />
        {isLatestOwn && <span>{message.read ? 'Seen' : 'Delivered'}</span>}
      </span>
    );
  };

  const ReplyPreview = ({ message, isMe }) => {
    if (!message.replyTo) return null;

    const replySenderId = getEntityId(message.replyTo.from);
    const replySender = replySenderId === currentUserId ? 'You' : getDisplayName(message.replyTo.from, selectedUser?.name || 'User');

    return (
      <div className={`mb-1 rounded-xl border-l-2 px-3 py-2 text-xs ${
        isMe
          ? 'border-white/70 bg-white/15 text-white/90'
          : 'border-pink-400 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
      }`}>
        <div className="font-semibold">{replySender}</div>
        <div className="line-clamp-2 opacity-80">{getMessageSnippet(message.replyTo)}</div>
      </div>
    );
  };

  const MessageAttachment = ({ message, isMe }) => {
    if (message.unsent) {
      return <p className="text-sm italic opacity-75">This message was unsent</p>;
    }

    const mediaUrl = resolveMediaUrl(message.fileUrl);

    if (message.fileUrl && message.fileType === 'image') {
      return (
        <button type="button" onClick={() => window.open(mediaUrl, '_blank')} className="block overflow-hidden rounded-2xl">
          <img src={mediaUrl} alt={message.fileName || 'Attachment'} className="max-h-80 w-full object-contain" />
        </button>
      );
    }

    if (message.fileUrl && message.fileType === 'video') {
      return <video controls src={mediaUrl} className="max-h-80 w-full rounded-2xl" />;
    }

    if (message.fileUrl && message.fileType === 'audio') {
      return (
        <div className={`rounded-2xl p-2 ${isMe ? 'bg-white/15' : 'bg-gray-100 dark:bg-gray-800'}`}>
          <audio controls src={mediaUrl} className="w-full max-w-72" />
        </div>
      );
    }

    if (message.fileUrl) {
      return (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-3 rounded-2xl border p-3 text-sm transition ${
            isMe
              ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
              : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'
          }`}
        >
          <FileText size={20} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{message.fileName || 'Attachment'}</span>
            {message.fileSize > 0 && <span className="text-xs opacity-75">{formatBytes(message.fileSize)}</span>}
          </span>
          <Download size={17} />
        </a>
      );
    }

    return null;
  };

  if (initialLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-4 border-pink-200 dark:border-pink-950" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-pink-500 border-r-purple-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100svh-8rem)] overflow-hidden rounded-2xl border border-white/60 bg-white/85 shadow-2xl shadow-pink-500/10 backdrop-blur-xl dark:border-gray-700/70 dark:bg-gray-900/85 md:h-[calc(100vh-3rem)]">
      <div className="flex h-full flex-col">
        <div className="relative overflow-hidden border-b border-white/60 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-indigo-500 px-5 py-4 text-white dark:border-gray-800">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <h2 className="text-xl font-bold tracking-normal md:text-2xl">Messages</h2>
              <p className="text-sm text-white/80">Realtime chats, online status, and seen receipts</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm backdrop-blur">
              <span className={`h-2.5 w-2.5 rounded-full ${
                socketConnected
                  ? 'bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,0.18)]'
                  : 'bg-amber-300 shadow-[0_0_0_4px_rgba(252,211,77,0.18)]'
              }`} />
              {socketConnected ? `${onlineUsers.size} online` : 'Connecting'}
            </div>
          </motion.div>
          <div className="absolute -right-10 -top-20 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className={`${selectedUser ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-gray-200/80 bg-white/80 dark:border-gray-800 dark:bg-gray-900/80 md:w-[22rem] md:max-w-sm md:flex`}>
            <div className="border-b border-gray-200/80 p-4 dark:border-gray-800">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle size={20} className="text-pink-500" />
                  <h3 className="font-semibold text-gray-950 dark:text-white">Chats</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSoundEnabled(value => !value)}
                    className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-pink-500 dark:hover:bg-gray-800"
                    aria-label={soundEnabled ? 'Mute message sound' : 'Enable message sound'}
                  >
                    {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowModal(true)}
                    className="rounded-full bg-gray-950 p-2 text-white shadow-lg shadow-gray-950/20 transition hover:bg-pink-600 dark:bg-white dark:text-gray-950 dark:hover:bg-pink-200"
                    aria-label="Start new chat"
                  >
                    <Plus size={18} />
                  </motion.button>
                </div>
              </div>

              <form onSubmit={handleSaveNote} className="mb-3 rounded-2xl border border-pink-100 bg-pink-50/70 p-3 dark:border-pink-900/50 dark:bg-pink-950/20">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <StickyNote size={16} className="text-pink-500" />
                    Your note
                  </span>
                  <span className="text-[11px] font-semibold text-pink-600 dark:text-pink-300">2 days</span>
                </div>
                <div className="flex gap-2">
                  <input
                    value={noteText}
                    onChange={event => setNoteText(event.target.value.slice(0, 140))}
                    placeholder="Feeling focused today..."
                    className="min-w-0 flex-1 rounded-full border border-white bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-pink-300 focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={savingNote || !noteText.trim()}
                    className="rounded-full bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-600 disabled:opacity-45 dark:bg-white dark:text-gray-950 dark:hover:bg-pink-200"
                  >
                    Post
                  </button>
                </div>
                {myNote && (
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <span className="line-clamp-1">Live: {myNote.text}</span>
                    <button type="button" onClick={handleClearNote} disabled={savingNote} className="font-semibold text-rose-500 hover:text-rose-600">
                      Clear
                    </button>
                  </div>
                )}
              </form>

              <div className="relative">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={conversationSearch}
                  onChange={event => setConversationSearch(event.target.value)}
                  placeholder="Search messages"
                  className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-pink-500"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filteredConversations.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center text-gray-500">
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="mb-3 rounded-full bg-pink-50 p-4 text-pink-500 dark:bg-pink-950/30"
                  >
                    <MessageCircle size={34} />
                  </motion.div>
                  <p className="font-medium text-gray-700 dark:text-gray-200">No conversations yet</p>
                  <p className="mt-1 text-sm">Tap the plus button to start one.</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {filteredConversations.map((conversation) => {
                    const otherUser = conversation.user;
                    const otherUserId = getEntityId(otherUser);
                    const isOnline = onlineUsers.has(otherUserId);
                    const isTyping = typingUsers.has(otherUserId);
                    const isActive = selectedUserId === otherUserId;
                    const activeNote = userNotes[otherUserId];

                    return (
                      <motion.button
                        key={otherUserId}
                        layout
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        whileHover={{ x: 2 }}
                        onClick={() => setSelectedUser(otherUser)}
                        className={`mb-1 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                          isActive
                            ? 'bg-pink-50 shadow-sm ring-1 ring-pink-100 dark:bg-pink-950/30 dark:ring-pink-900/50'
                            : 'hover:bg-gray-100/80 dark:hover:bg-gray-800/80'
                        }`}
                      >
                        <div className="relative shrink-0">
                          {renderAvatar(otherUser)}
                          <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-900 ${
                            isOnline ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]' : 'bg-gray-300 dark:bg-gray-600'
                          }`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="truncate font-semibold text-gray-950 dark:text-white">{otherUser.name}</div>
                              {isOnline && (
                                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                                  Online
                                </span>
                              )}
                            </div>
                            <div className="shrink-0 text-xs text-gray-400">{formatMessageTime(conversation.lastTime)}</div>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className={`truncate text-sm ${isTyping ? 'font-semibold text-pink-500' : conversation.unreadCount ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                              {isTyping ? 'Typing...' : conversation.lastMessage}
                            </p>
                            {conversation.unreadCount > 0 && (
                              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-pink-500 px-1.5 text-xs font-bold text-white">
                                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                              </span>
                            )}
                          </div>
                          {activeNote && (
                            <p className="mt-1 line-clamp-1 rounded-full bg-white/80 px-2 py-1 text-xs font-medium text-pink-600 dark:bg-gray-950/70 dark:text-pink-300">
                              Note: {activeNote.text}
                            </p>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </aside>

          {selectedUser ? (
            <section className="flex min-w-0 flex-1 flex-col bg-gray-50/80 dark:bg-gray-950/60">
              <header className="flex items-center gap-3 border-b border-gray-200/80 bg-white/90 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
                  aria-label="Back to conversations"
                >
                  <X size={18} />
                </button>
                <div className="relative">
                  {renderAvatar(selectedUser, 'h-12 w-12', 22)}
                  <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-900 ${
                    selectedIsOnline ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]' : 'bg-gray-300 dark:bg-gray-600'
                  }`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-gray-950 dark:text-white">{selectedUser.name}</div>
                  <div className={`mt-0.5 text-xs font-medium ${otherUserTyping ? 'text-pink-500' : selectedIsOnline ? 'text-emerald-500' : !socketConnected || !presenceReady ? 'text-amber-500' : 'text-gray-500'}`}>
                    {otherUserTyping ? 'Typing...' : presenceText}
                  </div>
                  {userNotes[selectedUserId] && (
                    <div className="mt-1 line-clamp-1 text-xs font-medium text-pink-500">
                      Note: {userNotes[selectedUserId].text}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowPinnedPanel(value => !value)}
                  disabled={pinnedMessages.length === 0}
                  className="relative rounded-full p-2 text-gray-500 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-yellow-950/30"
                  aria-label="View pinned messages"
                  title="View pinned messages"
                >
                  <Pin size={18} />
                  {pinnedMessages.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-500 px-1 text-[11px] font-bold text-white">
                      {pinnedMessages.length > 9 ? '9+' : pinnedMessages.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={handleDeleteConversation}
                  className="rounded-full p-2 text-gray-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                  aria-label="Delete conversation"
                  title="Delete conversation"
                >
                  <Trash2 size={18} />
                </button>
              </header>

              <AnimatePresence>
                {showPinnedPanel && pinnedMessages.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="border-b border-yellow-200 bg-yellow-50/95 px-4 py-3 shadow-sm dark:border-yellow-900/60 dark:bg-yellow-950/20"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-yellow-800 dark:text-yellow-200">
                        <Pin size={15} />
                        Pinned messages
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPinnedPanel(false)}
                        className="rounded-full p-1 text-yellow-700 transition hover:bg-yellow-100 dark:text-yellow-200 dark:hover:bg-yellow-950/50"
                        aria-label="Close pinned messages"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {pinnedMessages.map(message => {
                        const isMe = getEntityId(message.from) === currentUserId;
                        const sender = isMe ? user : selectedUser;
                        const messageId = getEntityId(message);

                        return (
                          <button
                            key={messageId}
                            type="button"
                            onClick={() => scrollToPinnedMessage(messageId)}
                            className="min-w-[220px] max-w-xs rounded-xl border border-yellow-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-yellow-900/60 dark:bg-gray-900"
                          >
                            <span className="block truncate text-xs font-bold text-yellow-700 dark:text-yellow-300">{isMe ? 'You' : sender?.name}</span>
                            <span className="mt-1 block truncate text-gray-700 dark:text-gray-200">{getMessageSnippet(message)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                {loading ? (
                  <div className="space-y-4">
                    {[0, 1, 2].map(item => (
                      <div key={item} className={`flex animate-pulse ${item % 2 ? 'justify-end' : 'justify-start'}`}>
                        <div className="h-14 w-2/5 rounded-3xl bg-gray-200 dark:bg-gray-800" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <AnimatePresence initial={false}>
                      {messages.map((message) => {
                        const messageId = getEntityId(message);
                        const isMe = getEntityId(message.from) === currentUserId;
                        const sender = isMe ? user : selectedUser;
                        const reactions = message.reactions || [];
                        const isLatestOwn = messageId === latestOwnMessageId;

                        return (
                          <motion.div
                            key={messageId}
                            ref={(node) => {
                              if (node) messageRefs.current[messageId] = node;
                              else delete messageRefs.current[messageId];
                            }}
                            variants={messageVariants}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
                            className={`mb-4 flex scroll-mt-24 ${isMe ? 'justify-end' : 'justify-start'} group ${focusedMessageId === messageId ? 'rounded-3xl bg-yellow-100/70 py-2 dark:bg-yellow-950/30' : ''}`}
                          >
                            {!isMe && (
                              <div className="mr-2 mt-5 shrink-0">
                                {renderAvatar(sender, 'h-8 w-8', 16)}
                              </div>
                            )}

                            <div className={`max-w-[82%] md:max-w-[68%] ${isMe ? 'items-end' : 'items-start'}`}>
                              <div className={`mb-1 px-1 text-xs text-gray-500 ${isMe ? 'text-right' : 'text-left'}`}>
                                {isMe ? 'You' : sender.name}
                              </div>

                              <div className={`relative rounded-3xl px-4 py-3 shadow-sm transition duration-200 group-hover:shadow-md ${
                                isMe
                                  ? 'rounded-br-lg bg-gradient-to-br from-pink-500 to-indigo-500 text-white shadow-pink-500/20'
                                  : 'rounded-bl-lg border border-gray-200 bg-white text-gray-950 dark:border-gray-800 dark:bg-gray-900 dark:text-white'
                              }`}>
                                <ReplyPreview message={message} isMe={isMe} />
                                <div className="space-y-2">
                                  <MessageAttachment message={message} isMe={isMe} />
                                  {message.text && !message.unsent && (
                                    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{message.text}</p>
                                  )}
                                  {message.pinned && !message.unsent && (
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      isMe ? 'bg-white/15 text-white/85' : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-200'
                                    }`}>
                                      <Pin size={11} />
                                      Pinned
                                    </span>
                                  )}
                                </div>

                                {reactions.length > 0 && !message.unsent && (
                                  <div className={`absolute -bottom-4 ${isMe ? 'right-2' : 'left-2'} flex gap-0.5 rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-xs shadow-md dark:border-gray-700 dark:bg-gray-800`}>
                                    {reactions.map((reaction, index) => (
                                      <button
                                        key={`${reaction.emoji}-${index}`}
                                        onClick={() => handleRemoveReaction(messageId, reaction.emoji)}
                                        className="transition hover:scale-125"
                                      >
                                        {reaction.emoji}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className={`mt-1.5 flex items-center gap-2 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <span className="text-[11px] text-gray-400">{formatMessageTime(message.createdAt)}</span>
                                <MessageStatus message={message} isLatestOwn={isLatestOwn} />
                                {!message.unsent && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setReplyingTo(message);
                                        inputRef.current?.focus();
                                      }}
                                      className="rounded-full p-1 text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-pink-500 group-hover:opacity-100 dark:hover:bg-gray-800"
                                      aria-label="Reply"
                                    >
                                      <Reply size={13} />
                                    </button>
                                    <div className="relative">
                                      <button
                                        onClick={() => setEmojiPickerMessageId(emojiPickerMessageId === messageId ? null : messageId)}
                                        className="rounded-full p-1 text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-pink-500 group-hover:opacity-100 dark:hover:bg-gray-800"
                                        aria-label="React"
                                      >
                                        <Smile size={14} />
                                      </button>
                                      {emojiPickerMessageId === messageId && (
                                        <div className={`absolute bottom-7 z-30 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl shadow-2xl ${isMe ? 'right-0' : 'left-0'}`}>
                                          <EmojiPicker
                                            onEmojiClick={(emoji) => handleReaction(messageId, emoji.emoji)}
                                            width={300}
                                            height={340}
                                            lazyLoadEmojis
                                            skinTonesDisabled
                                            previewConfig={{ showPreview: false }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => handlePin(messageId)}
                                      className="rounded-full p-1 text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-yellow-500 group-hover:opacity-100 dark:hover:bg-gray-800"
                                      aria-label={message.pinned ? 'Unpin message' : 'Pin message'}
                                    >
                                      {message.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                                    </button>
                                  </>
                                )}
                                <div className="relative">
                                  <button
                                    onClick={() => setActionMenuMessageId(actionMenuMessageId === messageId ? null : messageId)}
                                    className="rounded-full p-1 text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                    aria-label="Message actions"
                                  >
                                    <MoreVertical size={14} />
                                  </button>
                                  {actionMenuMessageId === messageId && (
                                    <div className={`absolute bottom-7 z-30 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white text-sm shadow-xl dark:border-gray-700 dark:bg-gray-800 ${isMe ? 'right-0' : 'left-0'}`}>
                                      <button
                                        onClick={() => handleRemoveForMe(messageId)}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                      >
                                        <Trash2 size={15} /> Remove for you
                                      </button>
                                      {isMe && !message.unsent && (
                                        <button
                                          onClick={() => handleUnsendForEveryone(messageId)}
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                                        >
                                          <X size={15} /> Unsend for everyone
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>

                    <AnimatePresence>
                      {otherUserTyping && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="mb-4 flex items-end gap-2"
                        >
                          {renderAvatar(selectedUser, 'h-8 w-8', 16)}
                          <div className="flex items-center gap-1 rounded-3xl rounded-bl-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            {[0, 1, 2].map(dot => (
                              <span
                                key={dot}
                                className="h-2 w-2 animate-bounce rounded-full bg-pink-400"
                                style={{ animationDelay: `${dot * 120}ms` }}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <footer className="border-t border-gray-200/80 bg-white/95 p-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
                <AnimatePresence>
                  {replyingTo && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="mb-2 flex items-center justify-between rounded-2xl border border-pink-100 bg-pink-50 px-3 py-2 dark:border-pink-900/60 dark:bg-pink-950/20"
                    >
                      <div className="min-w-0 text-sm">
                        <div className="font-semibold text-pink-700 dark:text-pink-300">
                          Replying to {getEntityId(replyingTo.from) === currentUserId ? 'yourself' : getDisplayName(replyingTo.from, selectedUser.name)}
                        </div>
                        <p className="truncate text-xs text-gray-500">{getMessageSnippet(replyingTo)}</p>
                      </div>
                      <button
                        onClick={() => setReplyingTo(null)}
                        className="rounded-full p-1 text-gray-500 hover:bg-white dark:hover:bg-gray-900"
                        aria-label="Cancel reply"
                      >
                        <X size={16} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {selectedAttachment && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="mb-2 rounded-2xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {selectedAttachment.fileType === 'image' && attachmentPreview && <img src={attachmentPreview} alt="preview" className="h-12 w-12 rounded-xl object-cover" />}
                          {selectedAttachment.fileType === 'video' && attachmentPreview && <video src={attachmentPreview} className="h-12 w-12 rounded-xl object-cover" />}
                          {selectedAttachment.fileType === 'audio' && <Mic size={22} className="text-pink-500" />}
                          {selectedAttachment.fileType === 'file' && <FileText size={22} className="text-pink-500" />}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{selectedAttachment.file.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{formatBytes(selectedAttachment.file.size)}</p>
                          </div>
                        </div>
                        <button onClick={clearAttachment} className="rounded-full p-1 text-gray-500 transition hover:bg-white dark:hover:bg-gray-900" aria-label="Remove attachment">
                          <X size={17} />
                        </button>
                      </div>
                      {sending && uploadProgress > 0 && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                          <div className="h-full rounded-full bg-pink-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {recording && (
                  <div className="mb-2 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
                      Recording voice message: {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
                    </span>
                    <button onClick={stopRecording} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white transition hover:bg-rose-700">
                      <Square size={13} /> Stop
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={event => handleAttachmentSelect(event, 'image')} />
                  <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={event => handleAttachmentSelect(event, 'video')} />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || recording}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-pink-500 disabled:opacity-50 dark:hover:bg-gray-800"
                    aria-label="Send picture"
                  >
                    <ImageIcon size={19} />
                  </button>
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    disabled={sending || recording}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-pink-500 disabled:opacity-50 dark:hover:bg-gray-800"
                    aria-label="Send video"
                  >
                    <Video size={19} />
                  </button>
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    disabled={sending}
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50 ${
                      recording
                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-pink-500 dark:hover:bg-gray-800'
                    }`}
                    aria-label={recording ? 'Stop recording' : 'Record voice message'}
                  >
                    {recording ? <Square size={18} /> : <Mic size={19} />}
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={event => {
                      setNewMessage(event.target.value);
                      handleTyping();
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && !sending && !recording) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Aa"
                    className="min-h-12 flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-pink-500"
                    disabled={sending || recording}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => sendMessage()}
                    disabled={(!newMessage.trim() && !selectedAttachment) || sending || recording}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-white shadow-lg shadow-pink-500/25 transition disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label="Send message"
                  >
                    {sending ? <Loader2 size={19} className="animate-spin" /> : <Send size={19} />}
                  </motion.button>
                </div>
              </footer>
            </section>
          ) : (
            <section className="hidden flex-1 items-center justify-center bg-gray-50/80 p-8 text-center dark:bg-gray-950/60 md:flex">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-sm"
              >
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-indigo-100 text-pink-500 dark:from-pink-950/40 dark:to-indigo-950/40">
                  <MessageCircle size={38} />
                </div>
                <h3 className="text-xl font-bold text-gray-950 dark:text-white">Pick a conversation</h3>
                <p className="mt-2 text-sm text-gray-500">Messages update live here once you open a chat.</p>
              </motion.div>
            </section>
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
