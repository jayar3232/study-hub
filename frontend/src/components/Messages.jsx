import React, { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  AtSign,
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  Edit3,
  Download,
  FileText,
  Image as ImageIcon,
  Info,
  Loader2,
  MessageCircle,
  Mic,
  MoreVertical,
  Pin,
  PinOff,
  Plus,
  Palette,
  Reply,
  Search,
  Send,
  Settings,
  Smile,
  Star,
  StickyNote,
  Square,
  Trash2,
  User,
  Users,
  Video,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import NewChatModal from './NewChatModal';
import UserProfileModal from './UserProfileModal';
import { optimizeImageFile, resolveMediaUrl } from '../utils/media';
import { playUiSound } from '../utils/sound';
import LoadingSpinner from './LoadingSpinner';
import MediaViewer from './MediaViewer';
import VideoThumbnail from './VideoThumbnail';

let socket;

const MAX_MESSAGE_UPLOAD_SIZE = 25 * 1024 * 1024;
const MESSAGE_RENDER_BATCH = 100;
const MOBILE_MESSAGE_RENDER_BATCH = 48;
const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const shouldAutoFocusComposer = () => (
  typeof window !== 'undefined'
  && window.matchMedia?.('(pointer: fine) and (min-width: 768px)').matches
);

const getMessageRenderBatch = () => (
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    ? MOBILE_MESSAGE_RENDER_BATCH
    : MESSAGE_RENDER_BATCH
);

const shouldPreloadAdjacentMedia = () => (
  typeof window !== 'undefined'
  && window.matchMedia?.('(pointer: fine) and (min-width: 768px)').matches
);

const getDisplayName = (entity, fallback = 'User') => entity?.name || fallback;

const MY_DAY_REPLY_PREFIX = 'Replied to your My Day:';

const isMyDayReplyMessage = (message) => (
  typeof message?.text === 'string'
  && message.text.trim().toLowerCase().startsWith(MY_DAY_REPLY_PREFIX.toLowerCase())
);

const getMyDayReplyBody = (text = '') => (
  text.replace(new RegExp(`^${MY_DAY_REPLY_PREFIX}\\s*`, 'i'), '').trim()
);

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
  if (isMyDayReplyMessage(message)) return `My Day reply: ${getMyDayReplyBody(message.text) || 'Reply'}`;
  if (message.text?.trim()) return message.text;
  if (message.fileType === 'image') return 'Photo';
  if (message.fileType === 'video') return 'Video';
  if (message.fileType === 'audio') return 'Voice message';
  if (message.fileUrl) return message.fileName || 'File attachment';
  return 'Message';
};

const readStoredValue = (key, legacyKey) => {
  if (typeof window === 'undefined') return null;
  const currentValue = window.localStorage.getItem(key);
  if (currentValue !== null || !legacyKey) return currentValue;

  const legacyValue = window.localStorage.getItem(legacyKey);
  if (legacyValue !== null) window.localStorage.setItem(key, legacyValue);
  return legacyValue;
};

const readStoredIdSet = (key, legacyKey) => {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(readStoredValue(key, legacyKey) || '[]').map(String));
  } catch {
    return new Set();
  }
};

const readStoredObject = (key, legacyKey) => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(readStoredValue(key, legacyKey) || '{}') || {};
  } catch {
    return {};
  }
};

const STORAGE_KEYS = {
  favoriteChats: 'syncrova-favorite-chats',
  mutedChats: 'syncrova-muted-chats',
  pinnedChats: 'syncrova-pinned-chats',
  chatNicknames: 'syncrova-chat-nicknames',
  chatThemes: 'syncrova-chat-themes'
};

const LEGACY_STORAGE_KEYS = {
  favoriteChats: 'studenthub-favorite-chats',
  mutedChats: 'studenthub-muted-chats',
  pinnedChats: 'studenthub-pinned-chats',
  chatNicknames: 'studenthub-chat-nicknames',
  chatThemes: 'studenthub-chat-themes'
};

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '✅'];

const CHAT_THEMES = {
  default: {
    label: 'Messenger Blue',
    own: 'from-[#0084ff] to-[#00b2ff]',
    accent: 'text-[#0084ff] dark:text-sky-300'
  },
  blue: {
    label: 'Facebook',
    own: 'from-[#1877f2] to-[#0a58ca]',
    accent: 'text-[#1877f2] dark:text-blue-300'
  },
  violet: {
    label: 'Violet',
    own: 'from-violet-600 to-fuchsia-600',
    accent: 'text-violet-600 dark:text-violet-300'
  },
  emerald: {
    label: 'Emerald',
    own: 'from-emerald-600 to-teal-600',
    accent: 'text-emerald-600 dark:text-emerald-300'
  }
};

export default function Messages() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [conversationSearch, setConversationSearch] = useState('');
  const [conversationFilter, setConversationFilter] = useState('all');
  const [favoriteConversationIds, setFavoriteConversationIds] = useState(() => readStoredIdSet(STORAGE_KEYS.favoriteChats, LEGACY_STORAGE_KEYS.favoriteChats));
  const [mutedConversationIds, setMutedConversationIds] = useState(() => readStoredIdSet(STORAGE_KEYS.mutedChats, LEGACY_STORAGE_KEYS.mutedChats));
  const [pinnedConversationIds, setPinnedConversationIds] = useState(() => readStoredIdSet(STORAGE_KEYS.pinnedChats, LEGACY_STORAGE_KEYS.pinnedChats));
  const [conversationNicknames, setConversationNicknames] = useState(() => readStoredObject(STORAGE_KEYS.chatNicknames, LEGACY_STORAGE_KEYS.chatNicknames));
  const [conversationThemes, setConversationThemes] = useState(() => readStoredObject(STORAGE_KEYS.chatThemes, LEGACY_STORAGE_KEYS.chatThemes));
  const [selectedUser, setSelectedUser] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [visibleMessageCount, setVisibleMessageCount] = useState(() => getMessageRenderBatch());
  const [composerHasText, setComposerHasText] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [messageSearch, setMessageSearch] = useState('');
  const [messageSearchIndex, setMessageSearchIndex] = useState(0);
  const [selectedMessageInfo, setSelectedMessageInfo] = useState(null);
  const [unreadDividerMessageId, setUnreadDividerMessageId] = useState(null);
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
  const [showChatDetails, setShowChatDetails] = useState(false);
  const [focusedMessageId, setFocusedMessageId] = useState(null);
  const [lastSeenByUser, setLastSeenByUser] = useState({});
  const [myNote, setMyNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [userNotes, setUserNotes] = useState({});
  const [mediaPreview, setMediaPreview] = useState(null);
  const [, setPresenceClock] = useState(0);

  const messageThreadRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingCancelledRef = useRef(false);
  const recordingTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const latestFetchIdRef = useRef(0);
  const openingConversationRef = useRef(false);
  const composerTextRef = useRef('');
  const typingUsersTimeoutRef = useRef({});
  const selectedUserRef = useRef(null);
  const messageRefs = useRef({});
  const reactionPressTimerRef = useRef(null);

  const currentUserId = getEntityId(user);
  const deferredConversationSearch = useDeferredValue(conversationSearch);
  const selectedUserId = getEntityId(selectedUser);
  const targetUserId = searchParams.get('user');

  const focusComposerInput = useCallback(() => {
    if (shouldAutoFocusComposer()) inputRef.current?.focus();
  }, []);

  const toggleStoredId = useCallback((storageKey, setter, rawId) => {
    const id = getEntityId(rawId);
    if (!id) return;

    setter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      }

      return next;
    });
  }, []);

  const toggleFavoriteConversation = useCallback((rawId) => {
    toggleStoredId(STORAGE_KEYS.favoriteChats, setFavoriteConversationIds, rawId);
  }, [toggleStoredId]);

  const toggleMuteConversation = useCallback((rawId) => {
    toggleStoredId(STORAGE_KEYS.mutedChats, setMutedConversationIds, rawId);
  }, [toggleStoredId]);

  const togglePinnedConversation = useCallback((rawId) => {
    toggleStoredId(STORAGE_KEYS.pinnedChats, setPinnedConversationIds, rawId);
  }, [toggleStoredId]);

  const updateStoredObject = useCallback((storageKey, setter, rawId, value) => {
    const id = getEntityId(rawId);
    if (!id) return;

    setter(prev => {
      const next = { ...prev };
      if (!value) delete next[id];
      else next[id] = value;

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }

      return next;
    });
  }, []);

  const updateConversationNickname = useCallback((rawId, value) => {
    updateStoredObject(STORAGE_KEYS.chatNicknames, setConversationNicknames, rawId, value.trim());
  }, [updateStoredObject]);

  const updateConversationTheme = useCallback((rawId, value) => {
    updateStoredObject(STORAGE_KEYS.chatThemes, setConversationThemes, rawId, value === 'default' ? '' : value);
  }, [updateStoredObject]);

  const clearTargetUserParam = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('user');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => () => clearReactionPressTimer(), []);

  const scrollThreadToBottomNow = useCallback(() => {
    const thread = messageThreadRef.current;
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    requestAnimationFrame(() => {
      const thread = messageThreadRef.current;
      if (thread) {
        if (behavior === 'auto') {
          thread.scrollTop = thread.scrollHeight;
          return;
        }

        thread.scrollTo({ top: thread.scrollHeight, behavior });
        return;
      }

      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
  }, []);

  const stabilizeOpeningScroll = useCallback(() => {
    const frames = [];
    const timers = [];
    const run = () => scrollThreadToBottomNow();

    run();
    frames.push(requestAnimationFrame(() => {
      run();
      frames.push(requestAnimationFrame(run));
    }));

    if (typeof window !== 'undefined') {
      timers.push(
        window.setTimeout(run, 80),
        window.setTimeout(run, 220),
        window.setTimeout(run, 520)
      );
    }

    return () => {
      frames.forEach(cancelAnimationFrame);
      timers.forEach(window.clearTimeout);
    };
  }, [scrollThreadToBottomNow]);

  const keepOpeningThreadPinned = useCallback(() => {
    if (!openingConversationRef.current) return;
    scrollThreadToBottomNow();
    if (typeof window !== 'undefined') window.setTimeout(scrollThreadToBottomNow, 60);
  }, [scrollThreadToBottomNow]);

  const setComposerText = useCallback((value = '') => {
    composerTextRef.current = value;
    if (inputRef.current) inputRef.current.value = value;
    setComposerHasText(Boolean(value.trim()));
  }, []);

  const clearComposerText = useCallback(() => {
    setComposerText('');
  }, [setComposerText]);

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

    const fetchId = latestFetchIdRef.current + 1;
    latestFetchIdRef.current = fetchId;
    openingConversationRef.current = true;
    setLoading(true);
    setVisibleMessageCount(getMessageRenderBatch());

    try {
      const res = await api.get(`/messages/${id}`);
      if (latestFetchIdRef.current !== fetchId) return;

      const loadedMessages = res.data || [];
      setMessages(loadedMessages);
      const firstUnreadIncoming = loadedMessages.find(message => (
        getEntityId(message.from) === id
        && getEntityId(message.to) === currentUserId
        && !message.read
        && !message.unsent
      ));
      setUnreadDividerMessageId(getEntityId(firstUnreadIncoming));
      rememberLastSeen(loadedMessages.flatMap(message => [message.from, message.to]));
      await markChatAsRead(id);
    } catch (err) {
      toast.error('Failed to load messages');
    } finally {
      if (latestFetchIdRef.current === fetchId) setLoading(false);
    }
  }, [currentUserId, markChatAsRead, scrollToBottom]);

  useEffect(() => {
    const load = async () => {
      setInitialLoading(true);
      await Promise.all([fetchConversations(), fetchUserNotes()]);
      setInitialLoading(false);
    };

    load();
  }, [fetchConversations, fetchUserNotes]);

  useEffect(() => {
    if (!targetUserId || !currentUserId || initialLoading) return undefined;

    if (targetUserId === currentUserId) {
      clearTargetUserParam();
      return undefined;
    }

    const existingConversation = conversations.find(item => getEntityId(item.user) === targetUserId);
    if (existingConversation?.user) {
      setSelectedUser(existingConversation.user);
      clearTargetUserParam();
      return undefined;
    }

    let cancelled = false;
    const openTargetConversation = async () => {
      try {
        const res = await api.get(`/users/${targetUserId}/public`);
        if (!cancelled) {
          setSelectedUser(res.data);
          clearTargetUserParam();
        }
      } catch (err) {
        if (!cancelled) {
          toast.error('Could not open that conversation');
          clearTargetUserParam();
        }
      }
    };

    openTargetConversation();
    return () => {
      cancelled = true;
    };
  }, [clearTargetUserParam, conversations, currentUserId, initialLoading, targetUserId]);

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
          if (soundEnabled && !mutedConversationIds.has(fromId)) playUiSound('message', 0.5);
          markChatAsRead(fromId);
        }
      } else if (toId === currentUserId && fromId !== currentUserId) {
        if (!mutedConversationIds.has(fromId)) {
          if (soundEnabled) playUiSound('message', 0.5);
          toast.success(`New message from ${getDisplayName(message.from, 'someone')}`);
        }
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
    mutedConversationIds,
    scrollToBottom,
    soundEnabled
  ]);

  useEffect(() => {
    if (selectedUser) {
      setMessages([]);
      setVisibleMessageCount(getMessageRenderBatch());
      openingConversationRef.current = true;
      fetchMessages(selectedUser._id || selectedUser.id);
    } else {
      setMessages([]);
      openingConversationRef.current = false;
    }

    setReplyingTo(null);
    setEditingMessage(null);
    setMessageSearch('');
    setMessageSearchIndex(0);
    setSelectedMessageInfo(null);
    setEmojiPickerMessageId(null);
    setActionMenuMessageId(null);
    setShowPinnedPanel(false);
    setFocusedMessageId(null);
    clearAttachment();
    clearComposerText();
    setOtherUserTyping(false);
  }, [clearAttachment, clearComposerText, fetchMessages, selectedUser]);

  useLayoutEffect(() => {
    if (loading || !messages.length || !selectedUserId || !openingConversationRef.current) return;
    scrollThreadToBottomNow();
  }, [loading, messages.length, scrollThreadToBottomNow, selectedUserId]);

  useEffect(() => {
    if (!messages.length || loading) return undefined;

    if (openingConversationRef.current) {
      const cleanupScroll = stabilizeOpeningScroll();
      const finishTimer = window.setTimeout(() => {
        scrollThreadToBottomNow();
        openingConversationRef.current = false;
      }, 700);

      return () => {
        cleanupScroll();
        window.clearTimeout(finishTimer);
      };
    }

    scrollToBottom('smooth');

    return undefined;
  }, [loading, messages.length, scrollThreadToBottomNow, scrollToBottom, selectedUserId, stabilizeOpeningScroll]);

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

  const uploadMessageAttachment = async (file, fileType = '') => {
    const uploadFile = fileType === 'image' ? await optimizeImageFile(file) : file;
    const formData = new FormData();
    formData.append('file', uploadFile);

    const res = await api.post('/messages/upload', formData, {
      onUploadProgress: (progressEvent) => {
        if (!progressEvent.total) return;
        setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
      }
    });

    return res.data;
  };

  const sendMessage = async (overrideAttachment = null) => {
    const draftText = composerTextRef.current;
    const text = draftText.trim();
    if ((!text && !selectedAttachment && !overrideAttachment) || !selectedUser || sending) return;

    const attachment = overrideAttachment || selectedAttachment;

    setSending(true);
    clearComposerText();
    stopTyping();

    try {
      const payload = { to: getEntityId(selectedUser), text };
      if (replyingTo) payload.replyTo = getEntityId(replyingTo);

      if (attachment?.file) {
        const upload = await uploadMessageAttachment(attachment.file, attachment.fileType);
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
      if (!overrideAttachment) setComposerText(draftText);
    } finally {
      setSending(false);
      setUploadProgress(0);
    }
  };

  const handleEditMessage = async () => {
    const messageId = getEntityId(editingMessage);
    const text = composerTextRef.current.trim();
    if (!messageId || !text || sending) return;

    setSending(true);
    try {
      const res = await api.put(`/messages/${messageId}`, { text });
      setMessages(prev => prev.map(message => getEntityId(message) === messageId ? res.data : message));
      setEditingMessage(null);
      clearComposerText();
      setActionMenuMessageId(null);
      fetchConversations();
      toast.success('Message edited');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to edit message');
    } finally {
      setSending(false);
    }
  };

  const submitComposer = () => {
    if (editingMessage) {
      handleEditMessage();
      return;
    }
    sendMessage();
  };

  const startEditMessage = (message) => {
    setEditingMessage(message);
    setReplyingTo(null);
    clearAttachment();
    setComposerText(message.text || '');
    setActionMenuMessageId(null);
    requestAnimationFrame(focusComposerInput);
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
      toast.success('Note posted for 1 day');
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

    const now = Date.now();
    if (now - lastTypingEmitRef.current > 700) {
      lastTypingEmitRef.current = now;
      socket.emit('typing', { to: selectedId, from: currentUserId });
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing', { to: selectedId, from: currentUserId });
    }, 1200);
  };

  const stopTyping = () => {
    const selectedId = getEntityId(selectedUser);
    if (!socket || !selectedId || !currentUserId) return;

    clearTimeout(typingTimeoutRef.current);
    lastTypingEmitRef.current = 0;
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
    if (!window.confirm(`Delete conversation with ${selectedDisplayName}? This only removes it for you.`)) return;

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

  const isTouchReactionMode = () => (
    typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)').matches
  );

  const clearReactionPressTimer = () => {
    if (reactionPressTimerRef.current) {
      clearTimeout(reactionPressTimerRef.current);
      reactionPressTimerRef.current = null;
    }
  };

  const startReactionPress = (messageId) => {
    if (!isTouchReactionMode()) return;
    clearReactionPressTimer();
    reactionPressTimerRef.current = setTimeout(() => {
      setActionMenuMessageId(null);
      setEmojiPickerMessageId(messageId);
      playUiSound('click', 0.1);
    }, 430);
  };

  const jumpToMessage = (messageId) => {
    const id = getEntityId(messageId);
    if (!id) return;
    const targetIndex = messages.findIndex(message => getEntityId(message) === id);
    if (targetIndex >= 0) {
      setVisibleMessageCount(count => Math.max(count, messages.length - targetIndex));
    }
    setFocusedMessageId(id);
    setShowPinnedPanel(false);
    window.setTimeout(() => {
      messageRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    setTimeout(() => setFocusedMessageId(null), 1800);
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
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (getEntityId(message.from) === currentUserId) return getEntityId(message);
    }
    return '';
  }, [currentUserId, messages]);

  const pinnedMessages = useMemo(() => messages.filter(message => message.pinned), [messages]);

  const scrollToPinnedMessage = (messageId) => {
    jumpToMessage(messageId);
  };

  const unreadTotal = useMemo(
    () => conversations.reduce((total, conversation) => total + (conversation.unreadCount || 0), 0),
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    const query = deferredConversationSearch.trim().toLowerCase();

    return conversations.filter(({ user: conversationUser, lastMessage, unreadCount }) => {
      const conversationId = getEntityId(conversationUser);
      if (conversationFilter === 'unread' && !unreadCount) return false;
      if (conversationFilter === 'favorites' && !favoriteConversationIds.has(conversationId)) return false;
      if (conversationFilter === 'muted' && !mutedConversationIds.has(conversationId)) return false;
      if (conversationFilter === 'pinned' && !pinnedConversationIds.has(conversationId)) return false;
      if (!query) return true;

      return (
        conversationUser?.name?.toLowerCase().includes(query) ||
        conversationUser?.email?.toLowerCase().includes(query) ||
        lastMessage?.toLowerCase().includes(query)
      );
    }).sort((a, b) => {
      const aPinned = pinnedConversationIds.has(getEntityId(a.user));
      const bPinned = pinnedConversationIds.has(getEntityId(b.user));
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return new Date(b.lastTime || 0) - new Date(a.lastTime || 0);
    });
  }, [conversationFilter, conversations, deferredConversationSearch, favoriteConversationIds, mutedConversationIds, pinnedConversationIds]);

  const selectedIsOnline = selectedUserId ? onlineUsers.has(selectedUserId) : false;
  const selectedIsFavorite = selectedUserId ? favoriteConversationIds.has(selectedUserId) : false;
  const selectedIsMuted = selectedUserId ? mutedConversationIds.has(selectedUserId) : false;
  const selectedIsPinned = selectedUserId ? pinnedConversationIds.has(selectedUserId) : false;
  const selectedNickname = selectedUserId ? conversationNicknames[selectedUserId] || '' : '';
  const selectedDisplayName = selectedNickname || selectedUser?.name || 'User';
  const selectedThemeKey = selectedUserId ? conversationThemes[selectedUserId] || 'default' : 'default';
  const selectedTheme = CHAT_THEMES[selectedThemeKey] || CHAT_THEMES.default;
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

  const conversationFilters = useMemo(() => ([
    { id: 'all', label: 'All', count: conversations.length },
    { id: 'pinned', label: 'Pinned', count: pinnedConversationIds.size },
    { id: 'unread', label: 'Unread', count: unreadTotal },
    { id: 'favorites', label: 'Favorites', count: favoriteConversationIds.size },
    { id: 'muted', label: 'Muted', count: mutedConversationIds.size }
  ]), [conversations.length, favoriteConversationIds.size, mutedConversationIds.size, pinnedConversationIds.size, unreadTotal]);
  const noteTrayItems = useMemo(() => {
    const items = [];
    if (user) {
      items.push({
        id: 'me',
        person: user,
        text: myNote?.text || 'Create note',
        isMe: true,
        hasNote: Boolean(myNote?.text)
      });
    }

    Object.values(userNotes)
      .filter(note => getEntityId(note.userId) && getEntityId(note.userId) !== currentUserId)
      .slice(0, 12)
      .forEach(note => {
        items.push({
          id: getEntityId(note.userId),
          person: note.userId,
          text: note.text,
          isMe: false,
          hasNote: true
        });
      });

    return items;
  }, [currentUserId, myNote, user, userNotes]);

  const messageSearchMatches = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query) return [];
    return messages
      .filter(message => !message.unsent && getMessageSnippet(message).toLowerCase().includes(query))
      .map(message => getEntityId(message))
      .filter(Boolean);
  }, [messageSearch, messages]);
  const messageSearchMatchSet = useMemo(() => new Set(messageSearchMatches), [messageSearchMatches]);

  useEffect(() => {
    setMessageSearchIndex(0);
  }, [messageSearch, selectedUserId]);

  useEffect(() => {
    setShowChatDetails(false);
    setVisibleMessageCount(getMessageRenderBatch());
  }, [selectedUserId]);

  const goToSearchMatch = (direction = 0) => {
    if (!messageSearchMatches.length) return;
    const nextIndex = direction === 0
      ? messageSearchIndex
      : (messageSearchIndex + direction + messageSearchMatches.length) % messageSearchMatches.length;
    setMessageSearchIndex(nextIndex);
    jumpToMessage(messageSearchMatches[nextIndex]);
  };

  const mediaGalleryItems = useMemo(() => (
    messages
      .filter(message => !message.unsent && message.fileUrl && ['image', 'video'].includes(message.fileType))
      .map(message => {
        const messageId = getEntityId(message);
        const senderName = getEntityId(message.from) === currentUserId
          ? 'You'
          : getDisplayName(message.from, selectedDisplayName);
        const mediaTypeLabel = message.fileType === 'image' ? 'Photo' : 'Video';
        const sentTime = message.createdAt ? formatMessageTime(message.createdAt) : '';

        return {
          id: messageId,
          messageId,
          type: message.fileType,
          url: resolveMediaUrl(message.fileUrl),
          name: message.fileName || mediaTypeLabel,
          details: [senderName, sentTime].filter(Boolean).join(' - ')
        };
      })
  ), [currentUserId, messages, selectedDisplayName]);

  const mediaPreviewIndex = mediaPreview
    ? mediaGalleryItems.findIndex(item => item.id === mediaPreview.id)
    : -1;
  const currentMediaPreview = mediaPreviewIndex >= 0 ? mediaGalleryItems[mediaPreviewIndex] : mediaPreview;
  const hasMediaNavigation = mediaPreviewIndex >= 0 && mediaGalleryItems.length > 1;
  const mediaPositionLabel = currentMediaPreview
    ? [
        mediaPreviewIndex >= 0 ? `${mediaPreviewIndex + 1} of ${mediaGalleryItems.length}` : '',
        currentMediaPreview.details
      ].filter(Boolean).join(' - ')
    : '';

  const openMediaPreview = (message) => {
    const messageId = getEntityId(message);
    const galleryItem = mediaGalleryItems.find(item => item.id === messageId);
    if (galleryItem) {
      setMediaPreview(galleryItem);
      return;
    }

    const mediaTypeLabel = message.fileType === 'image' ? 'Photo' : 'Video';
    setMediaPreview({
      id: messageId,
      type: message.fileType,
      url: resolveMediaUrl(message.fileUrl),
      name: message.fileName || mediaTypeLabel,
      details: mediaTypeLabel
    });
  };

  const moveMediaPreview = (direction) => {
    if (!hasMediaNavigation) return;
    const nextIndex = (mediaPreviewIndex + direction + mediaGalleryItems.length) % mediaGalleryItems.length;
    setMediaPreview(mediaGalleryItems[nextIndex]);
  };

  const sharedMediaItems = useMemo(() => (
    messages
      .filter(message => !message.unsent && message.fileUrl && ['image', 'video'].includes(message.fileType))
      .reverse()
  ), [messages]);

  useEffect(() => {
    if (!hasMediaNavigation || !shouldPreloadAdjacentMedia()) return;

    [-1, 1].forEach(direction => {
      const item = mediaGalleryItems[(mediaPreviewIndex + direction + mediaGalleryItems.length) % mediaGalleryItems.length];
      if (item?.type === 'image') {
        const image = new window.Image();
        image.src = item.url;
      }
    });
  }, [hasMediaNavigation, mediaGalleryItems, mediaPreviewIndex]);

  const sharedFileItems = useMemo(() => (
    messages
      .filter(message => !message.unsent && message.fileUrl && !['image', 'video'].includes(message.fileType))
      .slice(-5)
      .reverse()
  ), [messages]);

  const messageSearchActive = Boolean(messageSearch.trim());
  const renderedMessages = useMemo(() => {
    if (messageSearchActive) return messages;
    return messages.slice(-visibleMessageCount);
  }, [messageSearchActive, messages, visibleMessageCount]);
  const hiddenMessageCount = Math.max(0, messages.length - renderedMessages.length);

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
      <div className={`${sizeClass} relative overflow-hidden rounded-full bg-gradient-to-br from-[#1877f2] to-[#00b2ff] shadow-sm`}>
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
      <button
        type="button"
        onClick={() => jumpToMessage(message.replyTo)}
        className={`mb-1 block w-full rounded-xl border-l-2 px-3 py-2 text-left text-xs ${
        isMe
          ? 'border-white/70 bg-white/15 text-white/90'
          : 'border-[#1877f2] bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
      }`}>
        <div className="font-semibold">{replySender}</div>
        <div className="line-clamp-2 opacity-80">{getMessageSnippet(message.replyTo)}</div>
      </button>
    );
  };

  const MessageAttachment = ({ message, isMe, isMyDayReply = false }) => {
    if (message.unsent) {
      return <p className="text-sm italic opacity-75">This message was unsent</p>;
    }

    const mediaUrl = resolveMediaUrl(message.fileUrl);

    if (message.fileUrl && message.fileType === 'image') {
      return (
        <button
          type="button"
          onClick={() => openMediaPreview(message)}
          className={`message-media-attachment block overflow-hidden rounded-2xl ${
            isMyDayReply ? 'bg-gray-100 p-1 dark:bg-gray-950/80' : 'bg-black/5 dark:bg-white/5'
          }`}
          aria-label="View photo"
        >
          <img
            src={mediaUrl}
            alt={message.fileName || 'Attachment'}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={keepOpeningThreadPinned}
            className={`${isMyDayReply ? 'max-h-72 rounded-[1rem]' : 'max-h-80'} w-full object-contain`}
          />
        </button>
      );
    }

    if (message.fileUrl && message.fileType === 'video') {
      return (
        <button
          type="button"
          onClick={() => openMediaPreview(message)}
          className="message-media-attachment block w-full overflow-hidden rounded-2xl"
          aria-label="View video"
        >
          <span className="relative block overflow-hidden rounded-2xl bg-black">
            <VideoThumbnail
              src={mediaUrl}
              className="max-h-80 w-full"
              videoClassName="max-h-80 object-contain opacity-95"
              iconSize={25}
              label={message.fileName || 'Video attachment'}
              onReady={keepOpeningThreadPinned}
            />
          </span>
        </button>
      );
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

  const ChatDetailsContent = ({ compact = false }) => (
    <div className={`${compact ? 'max-h-[76svh] overflow-y-auto px-4 pb-4' : ''}`}>
      <div className="border-b border-slate-200/80 p-5 text-center dark:border-gray-800">
        <button type="button" onClick={() => setProfileUser(selectedUser)} className="mx-auto block" aria-label="View profile">
          <span className="relative block">
            {renderAvatar(selectedUser, 'h-20 w-20', 32)}
            <span className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white dark:border-gray-950 ${
              selectedIsOnline ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
            }`} />
          </span>
        </button>
        <h3 className="mt-3 truncate text-lg font-black text-slate-950 dark:text-white">{selectedDisplayName}</h3>
        <p className={`text-sm font-semibold ${selectedIsOnline ? 'text-emerald-500' : 'text-slate-500 dark:text-gray-400'}`}>
          {otherUserTyping ? 'Typing...' : presenceText}
        </p>
        {userNotes[selectedUserId] && (
          <p className="mx-auto mt-3 line-clamp-2 rounded-2xl bg-pink-50 px-3 py-2 text-sm font-semibold text-pink-700 dark:bg-pink-950/30 dark:text-pink-200">
            {userNotes[selectedUserId].text}
          </p>
        )}
      </div>

      <div className={`${compact ? 'pt-4' : 'p-4'} space-y-4`}>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => togglePinnedConversation(selectedUserId)}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left text-sm font-bold text-slate-700 hover:bg-white dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Pin size={18} className={`mb-2 ${selectedIsPinned ? 'fill-pink-500 text-pink-500' : 'text-pink-500'}`} />
            {selectedIsPinned ? 'Pinned' : 'Pin chat'}
          </button>
          <button
            type="button"
            onClick={() => toggleMuteConversation(selectedUserId)}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left text-sm font-bold text-slate-700 hover:bg-white dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {selectedIsMuted ? <BellOff size={18} className="mb-2 text-pink-500" /> : <Bell size={18} className="mb-2 text-pink-500" />}
            {selectedIsMuted ? 'Muted' : 'Alerts on'}
          </button>
          <button
            type="button"
            onClick={() => toggleFavoriteConversation(selectedUserId)}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left text-sm font-bold text-slate-700 hover:bg-white dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Star size={18} className={`mb-2 ${selectedIsFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-pink-500'}`} />
            {selectedIsFavorite ? 'Favorite' : 'Star'}
          </button>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-gray-800 dark:bg-gray-900">
          <label className="text-xs font-black uppercase text-slate-400">Nickname</label>
          <input
            value={selectedNickname}
            onChange={event => updateConversationNickname(selectedUserId, event.target.value)}
            placeholder={selectedUser?.name || 'Friend'}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-pink-300 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-gray-800 dark:bg-gray-900">
          <label className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
            <Palette size={14} />
            Chat theme
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {Object.entries(CHAT_THEMES).map(([key, theme]) => (
              <button
                key={key}
                type="button"
                onClick={() => updateConversationTheme(selectedUserId, key)}
                className={`rounded-2xl border p-2 text-left text-xs font-black ${
                  selectedThemeKey === key
                    ? 'border-pink-300 bg-white text-slate-950 dark:bg-gray-950 dark:text-white'
                    : 'border-transparent bg-white/70 text-slate-500 dark:bg-gray-950/60 dark:text-gray-400'
                }`}
              >
                <span className={`mb-1 block h-4 rounded-full bg-gradient-to-r ${theme.own}`} />
                {theme.label}
              </button>
            ))}
          </div>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-950 dark:text-white">Media</h4>
            <span className="text-xs font-bold text-slate-400">{sharedMediaItems.length}</span>
          </div>
          {sharedMediaItems.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-3">
              {sharedMediaItems.slice(0, 8).map(message => {
                const mediaUrl = resolveMediaUrl(message.fileUrl);
                return (
                  <button
                    key={getEntityId(message)}
                    type="button"
                    onClick={() => {
                      setShowChatDetails(false);
                      openMediaPreview(message);
                    }}
                    className="aspect-square overflow-hidden rounded-2xl bg-slate-100 dark:bg-gray-900"
                    aria-label="Open shared media"
                  >
                    {message.fileType === 'image' ? (
              <img src={mediaUrl} alt={message.fileName || 'Shared media'} loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
            ) : (
              <VideoThumbnail src={mediaUrl} className="h-full w-full" iconSize={21} label={message.fileName || 'Shared video'} preload="none" />
            )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-gray-900 dark:text-gray-400">Shared photos and videos will appear here.</p>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-950 dark:text-white">Files and voice</h4>
            <span className="text-xs font-bold text-slate-400">{sharedFileItems.length}</span>
          </div>
          <div className="space-y-2">
            {sharedFileItems.length > 0 ? sharedFileItems.map(message => (
              <a
                key={getEntityId(message)}
                href={resolveMediaUrl(message.fileUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {message.fileType === 'audio' ? <Mic size={18} className="text-pink-500" /> : <FileText size={18} className="text-pink-500" />}
                <span className="min-w-0 flex-1 truncate">{message.fileName || (message.fileType === 'audio' ? 'Voice message' : 'Attachment')}</span>
                <Download size={15} className="text-slate-400" />
              </a>
            )) : (
              <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-gray-900 dark:text-gray-400">No files shared yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );

  if (initialLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <LoadingSpinner compact label="Loading messages" />
      </div>
    );
  }

  return (
    <div className="messages-pro-shell mobile-chat-shell mobile-messenger-shell overflow-hidden border border-slate-200/80 bg-white shadow-xl shadow-slate-300/20 dark:border-gray-800/80 dark:bg-gray-950 dark:shadow-black/20">
      <div className="flex h-full min-h-0">
        <aside className="messages-tools-rail hidden w-60 shrink-0 flex-col border-r border-slate-200/80 bg-slate-50/90 p-4 dark:border-gray-800 dark:bg-gray-950/95 2xl:flex">
          <div className="flex items-center gap-3 px-1 py-2">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-gray-900 dark:ring-gray-800">
              <img src="/syncrova-app-logo.png" alt="SYNCROVA" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-slate-950 dark:text-white">SYNCROVA</p>
              <p className="truncate text-[10px] font-black uppercase text-slate-400">Messenger</p>
            </div>
          </div>

          <nav className="mt-6 space-y-1">
            {[
              { label: 'Chats', icon: MessageCircle, active: true, count: unreadTotal },
              { label: 'Mentions', icon: AtSign, count: 0 },
              { label: 'All Contacts', icon: Users, count: conversations.length },
              { label: 'Favorites', icon: Star, count: favoriteConversationIds.size },
              { label: 'Pinned', icon: Pin, count: pinnedMessages.length },
              { label: 'Settings', icon: Settings }
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    if (item.label === 'Favorites') setConversationFilter('favorites');
                    if (item.label === 'Pinned') setShowPinnedPanel(value => !value);
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold ${
                    item.active
                      ? 'bg-white text-pink-600 shadow-sm ring-1 ring-slate-200 dark:bg-gray-900 dark:text-pink-300 dark:ring-gray-800'
                      : 'text-slate-600 hover:bg-white/80 hover:text-slate-950 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={19} />
                  <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                  {item.count > 0 && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-gray-800 dark:text-gray-300">
                      {item.count > 99 ? '99+' : item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto rounded-3xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            Notes now live above your chat list, just like Messenger.
          </div>
        </aside>

        <aside className={`${selectedUser ? 'hidden md:flex' : 'flex'} mobile-conversation-list messages-conversation-column w-full flex-col border-r border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-950 md:w-[23rem] md:max-w-none md:flex xl:w-[24rem]`}>
          <div className="border-b border-gray-200/80 p-4 dark:border-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-normal text-gray-950 dark:text-white">Chats</h2>
                <p className="text-sm text-slate-500 dark:text-gray-400">
                  {socketConnected ? `${onlineUsers.size} online now` : 'Connecting to live chat'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSoundEnabled(value => !value)}
                  className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-pink-600 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-pink-300"
                  aria-label={soundEnabled ? 'Mute message sound' : 'Enable message sound'}
                >
                  {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="grid h-10 w-10 place-items-center rounded-2xl bg-[#1877f2] text-white shadow-sm hover:bg-[#0f63d5]"
                  aria-label="Start new chat"
                >
                  <Plus size={19} />
                </button>
              </div>
            </div>

            <div className="relative">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={conversationSearch}
                onChange={event => setConversationSearch(event.target.value)}
                placeholder="Search conversations"
                className="w-full rounded-2xl border border-gray-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-pink-300 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-pink-500"
              />
            </div>

            <div className="messenger-notes-tray mt-3 -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {noteTrayItems.map(item => {
                const personId = getEntityId(item.person);
                const noteAvatar = renderAvatar(item.person, 'h-12 w-12', 20);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.isMe) {
                        setShowNoteComposer(value => !value);
                        return;
                      }
                      const conversation = conversations.find(entry => getEntityId(entry.user) === personId);
                      if (conversation?.user) setSelectedUser(conversation.user);
                    }}
                    className="messenger-note-head group w-[4.75rem] shrink-0 text-center"
                  >
                    <span className="relative mx-auto block h-[4.75rem] w-[4.75rem]">
                      <span className={`absolute inset-x-0 top-0 z-10 mx-auto line-clamp-2 min-h-7 max-w-[4.45rem] rounded-2xl px-2 py-1 text-[10px] font-black leading-tight shadow-sm ring-1 ${
                        item.hasNote
                          ? 'bg-white text-slate-800 ring-slate-200 dark:bg-gray-900 dark:text-white dark:ring-gray-700'
                          : 'bg-[#1877f2] text-white ring-blue-300'
                      }`}>
                        {item.text}
                      </span>
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full ring-2 ring-white transition group-hover:ring-[#1877f2] dark:ring-gray-950">
                        {noteAvatar}
                      </span>
                      {item.isMe && (
                        <span className="absolute bottom-0 right-2 z-20 grid h-5 w-5 place-items-center rounded-full bg-[#1877f2] text-white ring-2 ring-white dark:ring-gray-950">
                          <Plus size={12} strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-[11px] font-bold text-slate-600 dark:text-gray-300">
                      {item.isMe ? 'Your note' : item.person?.name || 'Friend'}
                    </span>
                  </button>
                );
              })}
            </div>

            {showNoteComposer && (
              <form onSubmit={handleSaveNote} className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-black uppercase text-[#1877f2] dark:text-sky-300">
                    <StickyNote size={14} />
                    Your note
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">1 day</span>
                </div>
                <div className="flex gap-2">
                  <input
                    value={noteText}
                    onChange={event => setNoteText(event.target.value.slice(0, 140))}
                    placeholder="Share a quick note..."
                    className="min-w-0 flex-1 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#1877f2] dark:border-blue-900/50 dark:bg-gray-950 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={savingNote || !noteText.trim()}
                    className="rounded-xl bg-[#1877f2] px-3 py-2 text-xs font-black text-white disabled:opacity-45"
                  >
                    Post
                  </button>
                  {myNote && (
                    <button type="button" onClick={handleClearNote} disabled={savingNote} className="rounded-xl px-2 text-xs font-black text-rose-500">
                      Clear
                    </button>
                  )}
                </div>
              </form>
            )}

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {conversationFilters.map(filter => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setConversationFilter(filter.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${
                    conversationFilter === filter.id
                      ? 'bg-[#1877f2] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  {filter.label}
                  {filter.count > 0 && <span className="rounded-full bg-white/20 px-1.5">{filter.count > 99 ? '99+' : filter.count}</span>}
                </button>
              ))}
            </div>

          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filteredConversations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center text-gray-500">
                <div className="mb-3 rounded-full bg-pink-50 p-4 text-pink-600 dark:bg-pink-950/30 dark:text-pink-300">
                  <MessageCircle size={34} />
                </div>
                <p className="font-bold text-gray-700 dark:text-gray-200">No conversations found</p>
                <p className="mt-1 text-sm">Start a chat or try another filter.</p>
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const otherUser = conversation.user;
                const otherUserId = getEntityId(otherUser);
                const isOnline = onlineUsers.has(otherUserId);
                const isTyping = typingUsers.has(otherUserId);
                const isActive = selectedUserId === otherUserId;
                const isFavorite = favoriteConversationIds.has(otherUserId);
                const isMuted = mutedConversationIds.has(otherUserId);
                const isPinned = pinnedConversationIds.has(otherUserId);
                const displayName = conversationNicknames[otherUserId] || otherUser.name;

                return (
                  <button
                    key={otherUserId}
                    type="button"
                    onClick={() => setSelectedUser(otherUser)}
                    className={`mb-1 flex w-full items-center gap-3 rounded-2xl p-3 text-left ${
                      isActive
                        ? 'bg-blue-50 ring-1 ring-blue-100 dark:bg-blue-950/30 dark:ring-blue-900/50'
                        : 'hover:bg-slate-100/80 dark:hover:bg-gray-900'
                    }`}
                  >
                    <div className="relative shrink-0">
                      {renderAvatar(otherUser, 'h-12 w-12', 22)}
                      <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-900 ${
                        isOnline ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <div className="truncate font-bold text-gray-950 dark:text-white">{displayName}</div>
                          {isPinned && <Pin size={13} className="shrink-0 fill-pink-500 text-pink-500" />}
                          {isFavorite && <Star size={13} className="shrink-0 fill-yellow-400 text-yellow-400" />}
                          {isMuted && <BellOff size={13} className="shrink-0 text-slate-400" />}
                        </div>
                        <div className="shrink-0 text-xs text-gray-400">{formatMessageTime(conversation.lastTime)}</div>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${isTyping ? 'font-semibold text-[#1877f2] dark:text-sky-300' : conversation.unreadCount ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                          {isTyping ? 'Typing...' : conversation.lastMessage}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#1877f2] px-1.5 text-xs font-bold text-white">
                            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

          {selectedUser ? (
            <section className="mobile-conversation-panel flex min-w-0 flex-1 flex-col bg-slate-50/90 dark:bg-gray-950/70">
              <header className="mobile-chat-header flex items-center gap-3 border-b border-gray-200/80 bg-white/95 px-4 py-3 dark:border-gray-800 dark:bg-gray-950/95">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={21} strokeWidth={2.7} />
                </button>
                <button type="button" onClick={() => setProfileUser(selectedUser)} className="relative shrink-0 rounded-full ring-2 ring-transparent transition hover:ring-pink-300" title="View profile">
                  {renderAvatar(selectedUser, 'h-12 w-12', 22)}
                  <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-900 ${
                    selectedIsOnline ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]' : 'bg-gray-300 dark:bg-gray-600'
                  }`} />
                </button>
                <button type="button" onClick={() => setProfileUser(selectedUser)} className="min-w-0 flex-1 text-left" title="View profile">
                  <div className="truncate font-semibold text-gray-950 dark:text-white">{selectedDisplayName}</div>
                  <div className={`mt-0.5 text-xs font-medium ${otherUserTyping ? 'text-[#1877f2] dark:text-sky-300' : selectedIsOnline ? 'text-emerald-500' : !socketConnected || !presenceReady ? 'text-amber-500' : 'text-gray-500'}`}>
                    {otherUserTyping ? 'Typing...' : presenceText}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => togglePinnedConversation(selectedUserId)}
                  className={`relative rounded-full p-2 transition ${
                    selectedIsPinned
                      ? 'bg-blue-50 text-[#1877f2] dark:bg-blue-950/30 dark:text-sky-300'
                      : 'text-gray-500 hover:bg-blue-50 hover:text-[#1877f2] dark:hover:bg-blue-950/30'
                  }`}
                  aria-label={selectedIsPinned ? 'Unpin chat' : 'Pin chat'}
                  title={selectedIsPinned ? 'Unpin chat' : 'Pin chat'}
                >
                  <Pin size={18} />
                </button>
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
                  type="button"
                  onClick={() => setShowChatDetails(true)}
                  className="rounded-full p-2 text-gray-500 transition hover:bg-cyan-50 hover:text-cyan-600 dark:hover:bg-cyan-950/30 xl:hidden"
                  aria-label="Open chat settings"
                  title="Chat settings"
                >
                  <Settings size={18} />
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

              <div className="border-b border-gray-200/80 bg-white/95 px-3 py-2 dark:border-gray-800 dark:bg-gray-950/95">
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={messageSearch}
                      onChange={event => setMessageSearch(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          goToSearchMatch(event.shiftKey ? -1 : 1);
                        }
                      }}
                      placeholder="Search in conversation"
                      className="h-10 w-full rounded-2xl border border-gray-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold text-gray-900 outline-none focus:border-pink-300 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                  {messageSearch && (
                    <div className="flex items-center gap-1">
                      <span className="hidden rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500 dark:bg-gray-800 dark:text-gray-300 sm:inline-flex">
                        {messageSearchMatches.length ? `${messageSearchIndex + 1}/${messageSearchMatches.length}` : '0'}
                      </span>
                      <button type="button" onClick={() => goToSearchMatch(-1)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300" aria-label="Previous search result">
                        <ArrowLeft size={16} />
                      </button>
                      <button type="button" onClick={() => goToSearchMatch(1)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300" aria-label="Next search result">
                        <ArrowLeft size={16} className="rotate-180" />
                      </button>
                      <button type="button" onClick={() => setMessageSearch('')} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300" aria-label="Clear search">
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {showPinnedPanel && pinnedMessages.length > 0 && (
                  <div className="border-b border-yellow-200 bg-yellow-50/95 px-4 py-3 shadow-sm dark:border-yellow-900/60 dark:bg-yellow-950/20">
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
                  </div>
                )}

              <div ref={messageThreadRef} className="mobile-message-thread min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-5">
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
                    <>
                      {hiddenMessageCount > 0 && (
                        <div className="mb-4 flex justify-center">
                          <button
                            type="button"
                            onClick={() => setVisibleMessageCount(count => Math.min(messages.length, count + getMessageRenderBatch()))}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-[#1877f2] dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-blue-900/60 dark:hover:text-sky-200"
                          >
                            Show earlier messages ({hiddenMessageCount})
                          </button>
                        </div>
                      )}

                      {renderedMessages.map((message) => {
                        const messageId = getEntityId(message);
                        const isMe = getEntityId(message.from) === currentUserId;
                        const sender = isMe ? user : selectedUser;
                        const reactions = message.reactions || [];
                        const isLatestOwn = messageId === latestOwnMessageId;
                        const isSearchMatch = messageSearchMatchSet.has(messageId);
                        const showUnreadDivider = unreadDividerMessageId && unreadDividerMessageId === messageId;
                        const isMyDayReply = isMyDayReplyMessage(message);
                        const bubbleClassName = isMyDayReply
                          ? `my-day-reply-bubble relative rounded-3xl border border-gray-200 bg-white px-3 py-3 text-gray-950 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-white ${
                              isMe ? 'rounded-br-xl' : 'rounded-bl-xl'
                            }`
                          : `message-bubble relative rounded-3xl px-4 py-3 shadow-sm ${
                              isMe
                                ? `own-message-bubble rounded-br-lg bg-gradient-to-br ${selectedTheme.own} text-white shadow-blue-500/15`
                                : 'rounded-bl-lg border border-gray-200 bg-white text-gray-950 dark:border-gray-800 dark:bg-gray-900 dark:text-white'
                            } ${isMe && isLatestOwn ? 'ring-2 ring-blue-300/40 shadow-xl shadow-blue-500/20' : ''}`;

                        return (
                          <React.Fragment key={messageId}>
                            {showUnreadDivider && (
                              <div className="my-4 flex items-center gap-3">
                                <span className="h-px flex-1 bg-pink-200 dark:bg-pink-900/60" />
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#1877f2] dark:bg-blue-950/40 dark:text-sky-200">New messages</span>
                                <span className="h-px flex-1 bg-pink-200 dark:bg-pink-900/60" />
                              </div>
                            )}
                            <div
                              ref={(node) => {
                                if (node) messageRefs.current[messageId] = node;
                                else delete messageRefs.current[messageId];
                              }}
                              className={`message-row mb-4 flex scroll-mt-24 ${isMe ? 'justify-end' : 'justify-start'} group ${focusedMessageId === messageId || isSearchMatch ? 'rounded-3xl bg-yellow-100/70 py-2 dark:bg-yellow-950/30' : ''}`}
                            >
                            {!isMe && (
                              <div className="mr-2 mt-5 shrink-0">
                                {renderAvatar(sender, 'h-8 w-8', 16)}
                              </div>
                            )}

                            <div className={`max-w-[82%] md:max-w-[68%] ${isMe ? 'items-end' : 'items-start'}`}>
                              <div className={`mb-1 px-1 text-xs text-gray-500 ${isMe ? 'text-right' : 'text-left'}`}>
                                {isMe ? 'You' : selectedDisplayName}
                              </div>

                              <div
                                onTouchStart={() => !message.unsent && startReactionPress(messageId)}
                                onTouchEnd={clearReactionPressTimer}
                                onTouchMove={clearReactionPressTimer}
                                onTouchCancel={clearReactionPressTimer}
                                onContextMenu={(event) => {
                                  if (!isTouchReactionMode() || message.unsent) return;
                                  event.preventDefault();
                                  setActionMenuMessageId(null);
                                  setEmojiPickerMessageId(messageId);
                                }}
                                  className={bubbleClassName}
                              >
                                <ReplyPreview message={message} isMe={isMe} />
                                <div className="space-y-2">
                                  <MessageAttachment message={message} isMe={isMe} isMyDayReply={isMyDayReply} />
                                  {message.text && !message.unsent && (
                                    isMyDayReply ? (
                                      <div className="rounded-2xl bg-gray-50 px-3 py-2.5 text-left ring-1 ring-gray-100 dark:bg-gray-950/60 dark:ring-gray-800">
                                        <p className="text-[11px] font-black uppercase tracking-normal text-gray-400 dark:text-gray-500">My Day reply</p>
                                        <p className="mt-1 whitespace-pre-wrap break-words text-[15px] font-semibold leading-relaxed text-gray-950 dark:text-white">
                                          {getMyDayReplyBody(message.text) || 'Reply'}
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{message.text}</p>
                                    )
                                  )}
                                  {message.editedAt && !message.unsent && (
                                    <span className={`text-[11px] font-semibold ${isMe && !isMyDayReply ? 'text-white/65' : 'text-gray-400'}`}>Edited</span>
                                  )}
                                  {message.pinned && !message.unsent && (
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      isMe && !isMyDayReply ? 'bg-white/15 text-white/85' : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-200'
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
                                        className="hover:opacity-80"
                                      >
                                        {reaction.emoji}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className={`mobile-message-actions mt-1.5 flex items-center gap-2 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <span className="text-[11px] text-gray-400">{formatMessageTime(message.createdAt)}</span>
                                <MessageStatus message={message} isLatestOwn={isLatestOwn} />
                                {!message.unsent && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setReplyingTo(message);
                                        focusComposerInput();
                                      }}
                                      className="rounded-full p-1 text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-[#1877f2] group-hover:opacity-100 dark:hover:bg-gray-800 dark:hover:text-sky-300"
                                      aria-label="Reply"
                                    >
                                      <Reply size={13} />
                                    </button>
                                    <div className="relative">
                                      <button
                                        onClick={() => setEmojiPickerMessageId(emojiPickerMessageId === messageId ? null : messageId)}
                                        className="rounded-full p-1 text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-[#1877f2] group-hover:opacity-100 dark:hover:bg-gray-800 dark:hover:text-sky-300"
                                        aria-label="React"
                                      >
                                        <Smile size={14} />
                                      </button>
                                      {emojiPickerMessageId === messageId && (
                                        <div className={`mobile-reaction-picker absolute bottom-7 z-30 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl dark:border-gray-700 dark:bg-gray-900 ${isMe ? 'right-0' : 'left-0'}`}>
                                          <div className="mb-1 flex items-center justify-between px-1">
                                            <span className="text-xs font-black uppercase text-gray-400">React</span>
                                            <button type="button" onClick={() => setEmojiPickerMessageId(null)} className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" aria-label="Close reactions">
                                              <ArrowLeft size={15} />
                                            </button>
                                          </div>
                                          <div className="grid grid-cols-4 gap-1">
                                            {QUICK_REACTIONS.map(emoji => (
                                              <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => handleReaction(messageId, emoji)}
                                                className="grid h-11 place-items-center rounded-xl text-2xl hover:bg-gray-100 dark:hover:bg-gray-800"
                                              >
                                                {emoji}
                                              </button>
                                            ))}
                                          </div>
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
                                        onClick={() => {
                                          setSelectedMessageInfo(message);
                                          setActionMenuMessageId(null);
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                      >
                                        <Info size={15} /> Message info
                                      </button>
                                      {isMe && message.text && !message.unsent && (
                                        <button
                                          onClick={() => startEditMessage(message)}
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                        >
                                          <Edit3 size={15} /> Edit message
                                        </button>
                                      )}
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
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </>

                    {otherUserTyping && (
                        <div className="mb-4 flex items-end gap-2">
                          {renderAvatar(selectedUser, 'h-8 w-8', 16)}
                          <div className="flex items-center gap-1 rounded-3xl rounded-bl-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            {[0, 1, 2].map(dot => (
                              <span
                                key={dot}
                                className="h-2 w-2 animate-bounce rounded-full bg-[#0084ff]"
                                style={{ animationDelay: `${dot * 120}ms` }}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <footer className="message-composer-footer border-t border-gray-200/80 bg-white/95 p-2 dark:border-gray-800 dark:bg-gray-950/95 sm:p-3">
                {editingMessage && (
                    <div className="mb-2 flex items-center justify-between rounded-2xl border border-cyan-100 bg-cyan-50 px-3 py-2 dark:border-cyan-900/60 dark:bg-cyan-950/20">
                      <div className="min-w-0 text-sm">
                        <div className="font-semibold text-cyan-700 dark:text-cyan-300">Editing message</div>
                        <p className="truncate text-xs text-gray-500">{getMessageSnippet(editingMessage)}</p>
                      </div>
                      <button
                        onClick={() => {
                          setEditingMessage(null);
                          clearComposerText();
                        }}
                        className="rounded-full p-1 text-gray-500 hover:bg-white dark:hover:bg-gray-900"
                        aria-label="Cancel edit"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                {replyingTo && (
                    <div className="mb-2 flex items-center justify-between rounded-2xl border border-pink-100 bg-pink-50 px-3 py-2 dark:border-pink-900/60 dark:bg-pink-950/20">
                      <div className="min-w-0 text-sm">
                        <div className="font-semibold text-pink-700 dark:text-pink-300">
                          Replying to {getEntityId(replyingTo.from) === currentUserId ? 'yourself' : getDisplayName(replyingTo.from, selectedDisplayName)}
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
                    </div>
                  )}

                {selectedAttachment && (
                    <div className="mb-2 rounded-2xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {selectedAttachment.fileType === 'image' && attachmentPreview && <img src={attachmentPreview} alt="preview" className="h-12 w-12 rounded-xl object-cover" />}
                          {selectedAttachment.fileType === 'video' && attachmentPreview && (
                            <VideoThumbnail
                              src={attachmentPreview}
                              className="h-12 w-12"
                              iconSize={16}
                              rounded="rounded-xl"
                              label="Selected video preview"
                            />
                          )}
                                {selectedAttachment.fileType === 'audio' && <Mic size={22} className="text-[#1877f2] dark:text-sky-300" />}
                          {selectedAttachment.fileType === 'file' && <FileText size={22} className="text-[#1877f2] dark:text-sky-300" />}
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
                          <div className="h-full rounded-full bg-[#1877f2] transition-all" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      )}
                    </div>
                  )}

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

                <div className="message-composer-grid">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={event => handleAttachmentSelect(event, 'image')} />
                  <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={event => handleAttachmentSelect(event, 'video')} />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || recording || Boolean(editingMessage)}
                    className="message-composer-action"
                    aria-label="Send picture"
                  >
                    <ImageIcon size={19} />
                  </button>
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    disabled={sending || recording || Boolean(editingMessage)}
                    className="message-composer-action"
                    aria-label="Send video"
                  >
                    <Video size={19} />
                  </button>
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    disabled={sending || Boolean(editingMessage)}
                    className={`message-composer-action ${
                      recording
                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300'
                        : ''
                    }`}
                    aria-label={recording ? 'Stop recording' : 'Record voice message'}
                  >
                    {recording ? <Square size={18} /> : <Mic size={19} />}
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    onChange={event => {
                      const value = event.target.value;
                      composerTextRef.current = value;
                      setComposerHasText(prev => {
                        const next = Boolean(value.trim());
                        return prev === next ? prev : next;
                      });
                      handleTyping();
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && !sending && !recording) {
                        event.preventDefault();
                        submitComposer();
                      }
                    }}
                    placeholder="Aa"
                    className="message-composer-input"
                    disabled={sending || recording}
                  />
                  <button
                    onClick={submitComposer}
                    disabled={(!composerHasText && !selectedAttachment) || sending || recording}
                    className="message-composer-send"
                    aria-label="Send message"
                  >
                    {sending ? <Loader2 size={19} className="animate-spin" /> : <Send size={19} />}
                  </button>
                </div>
              </footer>
            </section>
          ) : (
            <section className="hidden flex-1 items-center justify-center bg-slate-50/90 p-8 text-center dark:bg-gray-950/70 md:flex">
              <div className="max-w-sm">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 text-[#1877f2] dark:from-blue-950/40 dark:to-cyan-950/40 dark:text-sky-300">
                  <MessageCircle size={38} />
                </div>
                <h3 className="text-xl font-bold text-gray-950 dark:text-white">Pick a conversation</h3>
                <p className="mt-2 text-sm text-gray-500">Messages update live here once you open a chat.</p>
              </div>
            </section>
          )}

          {selectedUser && (
            <aside className="messages-details-panel hidden w-[18.5rem] shrink-0 flex-col border-l border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-950 xl:flex">
              <div className="border-b border-slate-200/80 p-5 text-center dark:border-gray-800">
                <button type="button" onClick={() => setProfileUser(selectedUser)} className="mx-auto block" aria-label="View profile">
                  <span className="relative block">
                    {renderAvatar(selectedUser, 'h-20 w-20', 32)}
                    <span className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white dark:border-gray-950 ${
                      selectedIsOnline ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`} />
                  </span>
                </button>
                <h3 className="mt-3 truncate text-lg font-black text-slate-950 dark:text-white">{selectedDisplayName}</h3>
                <p className={`text-sm font-semibold ${selectedIsOnline ? 'text-emerald-500' : 'text-slate-500 dark:text-gray-400'}`}>
                  {otherUserTyping ? 'Typing...' : presenceText}
                </p>
                {userNotes[selectedUserId] && (
                  <p className="mx-auto mt-3 line-clamp-2 rounded-2xl bg-pink-50 px-3 py-2 text-sm font-semibold text-pink-700 dark:bg-pink-950/30 dark:text-pink-200">
                    {userNotes[selectedUserId].text}
                  </p>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => togglePinnedConversation(selectedUserId)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left text-sm font-bold text-slate-700 hover:bg-white dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <Pin size={18} className={`mb-2 ${selectedIsPinned ? 'fill-pink-500 text-pink-500' : 'text-pink-500'}`} />
                    {selectedIsPinned ? 'Pinned' : 'Pin chat'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMuteConversation(selectedUserId)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left text-sm font-bold text-slate-700 hover:bg-white dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {selectedIsMuted ? <BellOff size={18} className="mb-2 text-pink-500" /> : <Bell size={18} className="mb-2 text-pink-500" />}
                    {selectedIsMuted ? 'Muted' : 'Alerts on'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavoriteConversation(selectedUserId)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left text-sm font-bold text-slate-700 hover:bg-white dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <Star size={18} className={`mb-2 ${selectedIsFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-pink-500'}`} />
                    {selectedIsFavorite ? 'Favorite' : 'Add star'}
                  </button>
                </div>

                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                  <label className="text-xs font-black uppercase text-slate-400">Nickname</label>
                  <input
                    value={selectedNickname}
                    onChange={event => updateConversationNickname(selectedUserId, event.target.value)}
                    placeholder={selectedUser?.name || 'Friend'}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-pink-300 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </div>

                <div className="mt-3 rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                  <label className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
                    <Palette size={14} />
                    Chat theme
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {Object.entries(CHAT_THEMES).map(([key, theme]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => updateConversationTheme(selectedUserId, key)}
                        className={`rounded-2xl border p-2 text-left text-xs font-black ${
                          selectedThemeKey === key
                            ? 'border-pink-300 bg-white text-slate-950 dark:bg-gray-950 dark:text-white'
                            : 'border-transparent bg-white/70 text-slate-500 dark:bg-gray-950/60 dark:text-gray-400'
                        }`}
                      >
                        <span className={`mb-1 block h-4 rounded-full bg-gradient-to-r ${theme.own}`} />
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <button type="button" onClick={() => setProfileUser(selectedUser)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-gray-200 dark:hover:bg-gray-900">
                    <Info size={18} className="text-pink-500" />
                    View profile
                    <ChevronRight size={16} className="ml-auto text-slate-400" />
                  </button>
                  <button type="button" onClick={() => setShowPinnedPanel(value => !value)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-gray-200 dark:hover:bg-gray-900">
                    <Pin size={18} className="text-yellow-500" />
                    Pinned messages
                    <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-gray-800 dark:text-gray-300">{pinnedMessages.length}</span>
                  </button>
                  <button type="button" onClick={handleDeleteConversation} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30">
                    <Trash2 size={18} />
                    Delete conversation
                  </button>
                </div>

                <section className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-black text-slate-950 dark:text-white">Media</h4>
                    <span className="text-xs font-bold text-slate-400">{sharedMediaItems.length}</span>
                  </div>
                  {sharedMediaItems.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {sharedMediaItems.slice(0, 6).map(message => {
                        const mediaUrl = resolveMediaUrl(message.fileUrl);
                        return (
                          <button
                            key={getEntityId(message)}
                            type="button"
                            onClick={() => openMediaPreview(message)}
                            className="aspect-square overflow-hidden rounded-2xl bg-slate-100 dark:bg-gray-900"
                            aria-label="Open shared media"
                          >
                            {message.fileType === 'image' ? (
                              <img src={mediaUrl} alt={message.fileName || 'Shared media'} loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
                            ) : (
                              <VideoThumbnail src={mediaUrl} className="h-full w-full" iconSize={21} label={message.fileName || 'Shared video'} preload="none" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-gray-900 dark:text-gray-400">Shared photos and videos will appear here.</p>
                  )}
                </section>

                <section className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-black text-slate-950 dark:text-white">Files and voice</h4>
                    <span className="text-xs font-bold text-slate-400">{sharedFileItems.length}</span>
                  </div>
                  <div className="space-y-2">
                    {sharedFileItems.length > 0 ? sharedFileItems.map(message => (
                      <a
                        key={getEntityId(message)}
                        href={resolveMediaUrl(message.fileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        {message.fileType === 'audio' ? <Mic size={18} className="text-pink-500" /> : <FileText size={18} className="text-pink-500" />}
                        <span className="min-w-0 flex-1 truncate">{message.fileName || (message.fileType === 'audio' ? 'Voice message' : 'Attachment')}</span>
                        <Download size={15} className="text-slate-400" />
                      </a>
                    )) : (
                      <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-gray-900 dark:text-gray-400">No files shared yet.</p>
                    )}
                  </div>
                </section>
              </div>
            </aside>
          )}
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

      <UserProfileModal
        isOpen={Boolean(profileUser)}
        user={profileUser}
        onClose={() => setProfileUser(null)}
      />

      {selectedUser && showChatDetails && (
        <div className="fixed inset-0 z-[88] flex items-end justify-center bg-black/50 p-0 xl:hidden">
          <div className="mobile-bottom-sheet w-full max-w-lg overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-gray-800">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-pink-500">Chat settings</p>
                <h3 className="truncate text-lg font-black text-slate-950 dark:text-white">{selectedDisplayName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChatDetails(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                aria-label="Close chat settings"
              >
                <X size={18} />
              </button>
            </div>
            <ChatDetailsContent compact />
          </div>
        </div>
      )}

      {selectedMessageInfo && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="mobile-bottom-sheet w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-gray-950 sm:rounded-3xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-pink-500">Message details</p>
                <h3 className="text-xl font-black text-slate-950 dark:text-white">Message info</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessageInfo(null)}
                className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                aria-label="Close message info"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-gray-900">
                <p className="text-xs font-black uppercase text-slate-400">From</p>
                <p className="mt-1 font-bold text-slate-950 dark:text-white">
                  {getEntityId(selectedMessageInfo.from) === currentUserId ? 'You' : getDisplayName(selectedMessageInfo.from, selectedDisplayName)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-gray-900">
                  <p className="text-xs font-black uppercase text-slate-400">Sent</p>
                  <p className="mt-1 font-bold text-slate-950 dark:text-white">{formatMessageTime(selectedMessageInfo.createdAt)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-gray-900">
                  <p className="text-xs font-black uppercase text-slate-400">Status</p>
                  <p className="mt-1 font-bold text-slate-950 dark:text-white">
                    {selectedMessageInfo.unsent ? 'Unsent' : selectedMessageInfo.read ? 'Seen' : 'Delivered'}
                  </p>
                </div>
              </div>
              {selectedMessageInfo.editedAt && (
                <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100">
                  Edited {formatMessageTime(selectedMessageInfo.editedAt)}
                </div>
              )}
              {selectedMessageInfo.fileUrl && (
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-gray-900">
                  <p className="text-xs font-black uppercase text-slate-400">Attachment</p>
                  <p className="mt-1 truncate font-bold text-slate-950 dark:text-white">{selectedMessageInfo.fileName || selectedMessageInfo.fileType || 'File'}</p>
                  {selectedMessageInfo.fileSize > 0 && <p className="text-xs text-slate-500">{formatBytes(selectedMessageInfo.fileSize)}</p>}
                </div>
              )}
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-gray-900">
                <p className="text-xs font-black uppercase text-slate-400">Reactions</p>
                {selectedMessageInfo.reactions?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedMessageInfo.reactions.map((reaction, index) => (
                      <span key={`${reaction.emoji}-${index}`} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 dark:bg-gray-950 dark:text-gray-200 dark:ring-gray-800">
                        {reaction.emoji} {getDisplayName(reaction.userId, 'Member')}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">No reactions yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <MediaViewer
        media={currentMediaPreview}
        onClose={() => setMediaPreview(null)}
        onPrevious={hasMediaNavigation ? () => moveMediaPreview(-1) : undefined}
        onNext={hasMediaNavigation ? () => moveMediaPreview(1) : undefined}
        positionLabel={mediaPositionLabel}
      />
    </div>
  );
}
