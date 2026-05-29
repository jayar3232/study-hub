import type { ImagePickerAsset } from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import { ArrowLeft, BellOff, Check, Edit3, Info, MoreVertical, Palette, Phone, Pin, Search, Send, Star, Trash2, UserRound, Users, Video, X } from 'lucide-react-native';
import AudioPlayerBanner from '../components/AudioPlayerBanner';
import Avatar from '../components/Avatar';
import ChatBubble from '../components/ChatBubble';
import MediaViewer from '../components/MediaViewer';
import MessageInput from '../components/MessageInput';
import NativeCallOverlay from '../components/NativeCallOverlay';
import TypingIndicator from '../components/TypingIndicator';
import {
  deleteGroupMessageForEveryone,
  editMessage,
  fetchChatStreak,
  fetchContacts,
  fetchOnlineUsers,
  fetchGroupMessages,
  fetchGroups,
  fetchMessages,
  fetchUserPresence,
  hideGroupMessageForMe,
  hideMessageForMe,
  markGroupMessagesSeen,
  markMessagesRead,
  pinGroupMessage,
  pinMessage,
  reactToGroupMessage,
  reactToMessage,
  sendGroupMessage,
  sendMessage,
  uploadLocalMessageAsset,
  unsendMessageForEveryone,
  updateConversationBackground,
  updateConversationNickname,
  updateGroupBackground,
  uploadMessageAsset
} from '../services/messages';
import { emitTypingStart, emitTypingStop, getSocket } from '../services/socket';
import { useAuth } from '../store/AuthContext';
import { usePresenceStore } from '../store/presenceStore';
import { useTheme } from '../theme/ThemeContext';
import type { ChatStreak, ConversationSettings, Group, GroupMessage, Message, RootStackParamList, User } from '../types';
import {
  CallMode,
  CallSignalPayload,
  CallState,
  LiveKitCallSession,
  createCallId,
  getCallErrorMessage,
  requestLiveKitCallSession,
  serializeCallUser
} from '../services/calls';
import { CHAT_BACKGROUNDS, CHAT_THEMES, QUICK_REACTIONS, getBackgroundById, getThemeById } from '../utils/chatCustomizations';
import { formatActiveStatus, formatMessageTime } from '../utils/date';
import { getEntityId, getMessageKey } from '../utils/ids';
import { getMessageAttachments } from '../utils/media';
import { buildMediaViewerItems, VoiceRecordingResult } from '../utils/mediaHelpers';
import { ChatFlagState, hasChatFlag, loadChatFlags, loadChatThemes, saveChatFlags, saveChatTheme, toggleChatFlag } from '../utils/preferences';
import { useMediaViewer } from '../hooks/useMediaViewer';

type RouteProps = NativeStackScreenProps<RootStackParamList, 'ChatRoom'>['route'];
type Navigation = NativeStackNavigationProp<RootStackParamList, 'ChatRoom'>;
type ThreadMessage = Message | GroupMessage;
type ActiveCallRef = {
  callId: string;
  mode: CallMode;
  partnerId: string;
  state: CallState;
};

const emptyFlags: ChatFlagState = {
  pinned: [],
  muted: [],
  favorites: []
};

const getSender = (message: ThreadMessage, groupMode: boolean) => (
  groupMode && 'userId' in message ? message.userId : (message as Message).from
);

const getText = (message?: ThreadMessage | null) => String(message?.text || '').trim();
const getSenderName = (message: ThreadMessage, groupMode: boolean) => {
  const sender = getSender(message, groupMode);
  return typeof sender === 'object' ? sender?.name || sender?.email || 'Member' : 'Member';
};

const getDisplayName = (user?: User | null, fallback = 'Syncrova user') => user?.name || user?.email || fallback;

const getRequestErrorMessage = (error: unknown, fallback: string) => {
  const requestError = error as {
    response?: { data?: { msg?: string; message?: string; error?: string } };
    message?: string;
  };
  return requestError?.response?.data?.msg
    || requestError?.response?.data?.message
    || requestError?.response?.data?.error
    || requestError?.message
    || fallback;
};

const isOwnMessage = (message: ThreadMessage, currentUserId: string, groupMode: boolean) => (
  getEntityId(getSender(message, groupMode)) === currentUserId
);

const formatCallDuration = (startedAt?: number | null) => {
  if (!startedAt) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const mergeMessage = <T extends ThreadMessage>(rows: T[], next: T) => {
  const nextId = getEntityId(next);
  if (!nextId) return rows;
  return rows.some(item => getEntityId(item) === nextId)
    ? rows.map(item => (getEntityId(item) === nextId ? next : item))
    : [...rows, next];
};

export default function ChatRoomScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProps>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const currentUserId = getEntityId(user);
  const { chatId, userName, avatar } = route.params;
  const groupMode = route.params.mode === 'group';
  const [group, setGroup] = useState<Group | undefined>(route.params.group);
  const remoteUser: User = route.params.user || { _id: chatId, name: userName, avatar };

  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [composer, setComposer] = useState('');
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ThreadMessage | null>(null);
  const [conversation, setConversation] = useState<ConversationSettings | undefined>(route.params.conversation);
  const [chatStreak, setChatStreak] = useState<ChatStreak | null>(null);
  const [chatFlags, setChatFlags] = useState<ChatFlagState>(emptyFlags);
  const [themeId, setThemeId] = useState('messenger');
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [presenceReady, setPresenceReady] = useState(false);
  const [remoteOnline, setRemoteOnline] = useState(false);
  const [remoteLastSeen, setRemoteLastSeen] = useState<string | null>(remoteUser.lastSeen || null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<ThreadMessage | null>(null);
  const [infoMessage, setInfoMessage] = useState<ThreadMessage | null>(null);
  const [reactionViewerMessage, setReactionViewerMessage] = useState<ThreadMessage | null>(null);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<ThreadMessage | null>(null);
  const [forwardContacts, setForwardContacts] = useState<User[]>([]);
  const [forwardGroups, setForwardGroups] = useState<Group[]>([]);
  const [forwardQuery, setForwardQuery] = useState('');
  const [forwardingBusyId, setForwardingBusyId] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [callState, setCallState] = useState<CallState>('idle');
  const [callMode, setCallMode] = useState<CallMode>('audio');
  const [callPartner, setCallPartner] = useState<User | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSignalPayload | null>(null);
  const [liveKitSession, setLiveKitSession] = useState<LiveKitCallSession | null>(null);
  const [callError, setCallError] = useState('');
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(true);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [callClock, setCallClock] = useState(Date.now());
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitAtRef = useRef(0);
  const activeCallRef = useRef<ActiveCallRef>({ callId: '', mode: 'audio', partnerId: '', state: 'idle' });

  const selectedTheme = getThemeById(themeId);
  const displayName = groupMode
    ? group?.name || userName || 'Group chat'
    : conversation?.nicknames?.[chatId] || userName || getDisplayName(remoteUser);
  const backgroundId = groupMode ? group?.backgroundId : conversation?.backgroundId;
  const background = getBackgroundById(backgroundId);
  const activeChatId = chatId;
  const mediaViewer = useMediaViewer();
  const presenceStatus = usePresenceStore(state => state.statuses[chatId]);
  const storeRemoteTyping = usePresenceStore(state => Boolean(state.typingByChat[chatId]?.length));

  useEffect(() => {
    let mounted = true;
    Promise.all([loadChatFlags(), loadChatThemes()]).then(([flags, themes]) => {
      if (!mounted) return;
      setChatFlags(flags);
      setThemeId(themes[activeChatId] || 'messenger');
    }).catch(() => {});
    return () => {
      mounted = false;
    };
  }, [activeChatId]);

  useEffect(() => {
    setPresenceReady(false);
    setRemoteOnline(false);
    setRemoteLastSeen(remoteUser.lastSeen || null);
  }, [chatId, remoteUser.lastSeen]);

  useEffect(() => {
    if (groupMode || !presenceStatus) return;
    setRemoteOnline(presenceStatus.online);
    if (presenceStatus.lastSeen) setRemoteLastSeen(presenceStatus.lastSeen);
    setPresenceReady(true);
  }, [groupMode, presenceStatus]);

  useEffect(() => {
    setNicknameDraft(conversation?.nicknames?.[chatId] || '');
  }, [chatId, conversation]);

  useEffect(() => {
    if (!forwardingMessage) return;
    let mounted = true;
    Promise.all([
      fetchContacts().catch(() => []),
      fetchGroups().catch(() => [])
    ]).then(([contactRows, groupRows]) => {
      if (!mounted) return;
      setForwardContacts(contactRows);
      setForwardGroups(groupRows);
    }).catch(() => {});

    return () => {
      mounted = false;
    };
  }, [forwardingMessage]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      if (groupMode) {
        const rows = await fetchGroupMessages(chatId);
        setMessages(rows);
        setHasMore(false);
        setNextCursor(undefined);
        await markGroupMessagesSeen(chatId, rows.map(item => getEntityId(item)).filter(Boolean)).catch(() => {});
        return;
      }

      const page = await fetchMessages(chatId);
      setMessages(page.items);
      setConversation(page.conversation || route.params.conversation);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
      await Promise.all([
        markMessagesRead(chatId).catch(() => {}),
        fetchChatStreak(chatId).then(setChatStreak).catch(() => {})
      ]);
    } finally {
      setLoading(false);
    }
  }, [chatId, groupMode, route.params.conversation]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const loadOlder = useCallback(async () => {
    if (groupMode || !hasMore || loadingOlder || !nextCursor) return;
    setLoadingOlder(true);
    try {
      const page = await fetchMessages(chatId, nextCursor);
      setMessages(prev => {
        const seen = new Set(prev.map(item => getEntityId(item)));
        const older = page.items.filter(item => !seen.has(getEntityId(item)));
        return [...older, ...prev];
      });
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingOlder(false);
    }
  }, [chatId, groupMode, hasMore, loadingOlder, nextCursor]);

  const setActiveCall = useCallback((next: ActiveCallRef) => {
    activeCallRef.current = next;
    setCallState(next.state);
    setCallMode(next.mode);
  }, []);

  const resetCall = useCallback((message = '') => {
    activeCallRef.current = { callId: '', mode: 'audio', partnerId: '', state: 'idle' };
    setCallState('idle');
    setCallMode('audio');
    setCallPartner(null);
    setIncomingCall(null);
    setLiveKitSession(null);
    setCallStartedAt(null);
    setCallError(message);
    setMicMuted(false);
    setCameraOff(true);
  }, []);

  const emitCallSignal = useCallback(async (eventName: string, payload: CallSignalPayload) => {
    const socket = await getSocket();
    if (!socket.connected) socket.connect();
    socket.emit(eventName, payload);
  }, []);

  const connectLiveKitCall = useCallback(async ({
    callId,
    mode,
    partnerId,
    roomName
  }: {
    callId: string;
    mode: CallMode;
    partnerId: string;
    roomName: string;
  }) => {
    const session = await requestLiveKitCallSession({ callId, mode, partnerId, roomName });
    setLiveKitSession(session);
    setMicMuted(false);
    setCameraOff(mode !== 'video');
    return session;
  }, []);

  const startCall = useCallback(async (mode: CallMode) => {
    if (groupMode) {
      Alert.alert('Calls', 'Calls are available in direct messages.');
      return;
    }
    if (!currentUserId || !chatId || chatId === currentUserId) {
      Alert.alert('Calls', 'Could not start this call.');
      return;
    }
    if (presenceReady && !remoteOnline) {
      Alert.alert('Not active', `${displayName} is not active right now.`);
      return;
    }
    if (activeCallRef.current.state !== 'idle') {
      Alert.alert('Call active', 'Finish your current call first.');
      return;
    }

    const nextCallId = createCallId();
    const roomName = `syncrova-call-${nextCallId}`;
    setCallPartner(remoteUser);
    setIncomingCall(null);
    setCallError('');
    setLiveKitSession(null);
    setActiveCall({ callId: nextCallId, mode, partnerId: chatId, state: 'calling' });

    try {
      const session = await connectLiveKitCall({ callId: nextCallId, mode, partnerId: chatId, roomName });
      await emitCallSignal('call:start', {
        callId: nextCallId,
        from: currentUserId,
        to: chatId,
        type: mode,
        caller: serializeCallUser(user),
        provider: 'livekit',
        livekit: true,
        roomName: session.roomName
      });
    } catch (error) {
      const message = getCallErrorMessage(error, 'Could not start the call.');
      resetCall(message);
      Alert.alert('Call failed', message);
    }
  }, [
    chatId,
    connectLiveKitCall,
    currentUserId,
    displayName,
    emitCallSignal,
    groupMode,
    presenceReady,
    remoteOnline,
    remoteUser,
    resetCall,
    setActiveCall,
    user
  ]);

  const acceptCall = useCallback(async () => {
    const pendingCall = incomingCall;
    const callerId = getEntityId(pendingCall?.from);
    const nextCallId = pendingCall?.callId;
    const mode = pendingCall?.type || 'audio';
    if (!pendingCall || !callerId || !nextCallId || !currentUserId) return;

    setCallPartner((pendingCall.caller || { _id: callerId, id: callerId, name: 'Caller' }) as User);
    setCallError('');
    setActiveCall({ callId: nextCallId, mode, partnerId: callerId, state: 'connecting' });

    try {
      const session = await connectLiveKitCall({
        callId: nextCallId,
        mode,
        partnerId: callerId,
        roomName: pendingCall.roomName || `syncrova-call-${nextCallId}`
      });
      await emitCallSignal('call:answer', {
        callId: nextCallId,
        from: currentUserId,
        to: callerId,
        type: mode,
        accepted: true,
        provider: 'livekit',
        livekit: true,
        roomName: session.roomName
      });
      setIncomingCall(null);
    } catch (error) {
      const message = getCallErrorMessage(error, 'Could not join the call.');
      await emitCallSignal('call:reject', {
        callId: nextCallId,
        from: currentUserId,
        to: callerId,
        type: mode,
        reason: 'media-error'
      }).catch(() => {});
      resetCall(message);
      Alert.alert('Call failed', message);
    }
  }, [connectLiveKitCall, currentUserId, emitCallSignal, incomingCall, resetCall, setActiveCall]);

  const rejectCall = useCallback((reason = 'declined') => {
    const pending = incomingCall;
    const callerId = getEntityId(pending?.from);
    if (pending?.callId && callerId && currentUserId) {
      emitCallSignal('call:reject', {
        callId: pending.callId,
        from: currentUserId,
        to: callerId,
        type: pending.type || callMode,
        reason
      }).catch(() => {});
    }
    resetCall();
  }, [callMode, currentUserId, emitCallSignal, incomingCall, resetCall]);

  const endCall = useCallback((reason = 'ended', notify = true) => {
    const active = activeCallRef.current;
    if (notify && active.callId && active.partnerId && currentUserId) {
      emitCallSignal('call:end', {
        callId: active.callId,
        from: currentUserId,
        to: active.partnerId,
        type: active.mode,
        reason
      }).catch(() => {});
    }
    resetCall();
  }, [currentUserId, emitCallSignal, resetCall]);

  const handleLiveKitConnected = useCallback(() => {
    const active = activeCallRef.current;
    setCallError('');
    if (active.state === 'connecting') {
      activeCallRef.current = { ...active, state: 'connected' };
      setCallState('connected');
      setCallStartedAt(Date.now());
    }
  }, []);

  useEffect(() => {
    if (!['calling', 'connecting'].includes(callState)) return undefined;
    const expectedCallId = activeCallRef.current.callId;
    const timer = setTimeout(() => {
      if (activeCallRef.current.callId !== expectedCallId || !['calling', 'connecting'].includes(activeCallRef.current.state)) return;
      endCall('timeout');
      Alert.alert('Call timed out', 'Please try again.');
    }, 35000);

    return () => clearTimeout(timer);
  }, [callState, endCall]);

  useEffect(() => {
    if (callState !== 'connected') return undefined;
    const timer = setInterval(() => setCallClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [callState]);

  useEffect(() => {
    let mounted = true;
    let cleanup: undefined | (() => void);

    const setup = async () => {
      const socket = await getSocket();
      const belongsToChat = (message: Message) => {
        const fromId = getEntityId(message.from);
        const toId = getEntityId(message.to);
        return (fromId === chatId && toId === currentUserId) || (fromId === currentUserId && toId === chatId);
      };
      const onReceiveMessage = (message: Message) => {
        if (!mounted || groupMode || !belongsToChat(message)) return;
        setMessages(prev => mergeMessage(prev as Message[], message));
        if (getEntityId(message.from) === chatId) markMessagesRead(chatId).catch(() => {});
      };
      const onMessageUpdated = (message: Message) => {
        if (!mounted || groupMode || !belongsToChat(message)) return;
        setMessages(prev => prev.map(item => (getEntityId(item) === getEntityId(message) ? message : item)));
      };
      const onMessageHidden = ({ messageId }: { messageId: string }) => {
        if (!mounted || groupMode) return;
        setMessages(prev => prev.filter(item => getEntityId(item) !== messageId));
      };
      const onMessagesRead = ({ readerId }: { readerId: string }) => {
        if (!mounted || groupMode || readerId !== chatId) return;
        setMessages(prev => prev.map(item => (
          isOwnMessage(item, currentUserId, false) ? { ...(item as Message), read: true, readAt: new Date().toISOString() } : item
        )));
      };
      const onConversationBackground = (payload: { participants?: string[]; conversation?: ConversationSettings; message?: Message | null }) => {
        if (!mounted || groupMode || !payload.participants?.includes(chatId)) return;
        setConversation(payload.conversation);
        if (payload.message) setMessages(prev => mergeMessage(prev as Message[], payload.message as Message));
      };
      const onConversationNickname = onConversationBackground;
      const onTyping = ({ from }: { from: string }) => {
        if (!groupMode && from === chatId) setRemoteTyping(true);
      };
      const onStopTyping = ({ from }: { from: string }) => {
        if (!groupMode && from === chatId) setRemoteTyping(false);
      };
      const onReceiveGroupMessage = (message: GroupMessage) => {
        if (!mounted || !groupMode || getEntityId(message.groupId) !== chatId) return;
        setMessages(prev => mergeMessage(prev as GroupMessage[], message));
        markGroupMessagesSeen(chatId, [getEntityId(message)].filter(Boolean)).catch(() => {});
      };
      const onGroupMessageUpdated = (message: GroupMessage) => {
        if (!mounted || !groupMode || getEntityId(message.groupId) !== chatId) return;
        setMessages(prev => prev.map(item => (getEntityId(item) === getEntityId(message) ? message : item)));
      };
      const onGroupUpdated = (nextGroup: Group) => {
        if (!mounted || !groupMode || getEntityId(nextGroup) !== chatId) return;
        setGroup(nextGroup);
      };
      const onGroupDeleted = (messageId: string) => {
        if (!mounted || !groupMode) return;
        setMessages(prev => prev.filter(item => getEntityId(item) !== messageId));
      };
      const updatePresence = (status: { online?: boolean; lastSeen?: string | null }) => {
        if (!mounted || groupMode) return;
        setRemoteOnline(Boolean(status.online));
        if (status.lastSeen) setRemoteLastSeen(status.lastSeen);
        setPresenceReady(true);
      };
      const onOnlineUsers = (payload: string[] | { users?: string[]; userIds?: string[] } = []) => {
        if (!mounted || groupMode) return;
        const ids = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.userIds)
            ? payload.userIds
            : Array.isArray(payload.users)
              ? payload.users
              : [];
        setRemoteOnline(ids.includes(chatId));
        setPresenceReady(true);
      };
      const refreshDirectPresence = () => {
        if (groupMode || !chatId) return;
        socket.emit('check-online', chatId, (status: { online?: boolean; lastSeen?: string | null }) => {
          updatePresence(status || {});
        });
      };
      const announceOnline = () => {
        if (currentUserId) socket.emit('user-online', currentUserId, onOnlineUsers);
      };
      const onConnect = () => {
        if (!mounted) return;
        announceOnline();
        refreshDirectPresence();
      };
      const onDisconnect = () => {
        if (!mounted) return;
        setPresenceReady(false);
      };
      const onUserOnline = (payload: string | { userId?: string }) => {
        const userId = typeof payload === 'string' ? payload : payload?.userId;
        if (!mounted || groupMode || userId !== chatId) return;
        setRemoteOnline(true);
        setPresenceReady(true);
      };
      const onUserOffline = (payload: { userId?: string; lastSeen?: string }) => {
        if (!mounted || groupMode || payload?.userId !== chatId) return;
        setRemoteOnline(false);
        setRemoteLastSeen(payload.lastSeen || new Date().toISOString());
        setPresenceReady(true);
      };
      const onIncomingCallStart = (payload: CallSignalPayload) => {
        const callerId = getEntityId(payload?.from);
        const targetId = getEntityId(payload?.to);
        if (!mounted || groupMode || !callerId || !payload?.callId) return;
        if (targetId && targetId !== currentUserId) return;
        if (activeCallRef.current.state !== 'idle') {
          socket.emit('call:busy', {
            callId: payload.callId,
            from: currentUserId,
            to: callerId,
            type: payload.type || 'audio',
            reason: 'busy'
          });
          return;
        }

        const mode = payload.type || 'audio';
        activeCallRef.current = { callId: payload.callId, mode, partnerId: callerId, state: 'incoming' };
        setCallMode(mode);
        setCallPartner((payload.caller || { _id: callerId, id: callerId, name: 'Caller' }) as User);
        setIncomingCall(payload);
        setLiveKitSession(null);
        setCallError('');
        setCallState('incoming');
      };
      const onCallAnswer = (payload: CallSignalPayload) => {
        const active = activeCallRef.current;
        if (!mounted || !payload?.callId || payload.callId !== active.callId) return;
        activeCallRef.current = { ...active, state: 'connected' };
        if (payload.roomName) {
          setLiveKitSession(prev => (prev ? { ...prev, roomName: payload.roomName || prev.roomName } : prev));
        }
        setCallError('');
        setCallState('connected');
        setCallStartedAt(Date.now());
      };
      const onRemoteCallEnd = (payload: CallSignalPayload) => {
        const active = activeCallRef.current;
        if (!mounted || !payload?.callId || payload.callId !== active.callId) return;
        resetCall();
      };
      const onRemoteCallRejected = (payload: CallSignalPayload) => {
        const active = activeCallRef.current;
        if (!mounted || !payload?.callId || payload.callId !== active.callId) return;
        resetCall();
        Alert.alert('Call ended', payload.reason === 'busy' ? 'The other user is on another call.' : 'The call was declined.');
      };
      const onCallUnavailable = (payload: CallSignalPayload) => {
        const active = activeCallRef.current;
        if (!mounted || !payload?.callId || payload.callId !== active.callId) return;
        resetCall();
        Alert.alert('Call unavailable', 'The other user is offline or unavailable.');
      };

      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('online-users', onOnlineUsers);
      socket.on('user-online', onUserOnline);
      socket.on('user-offline', onUserOffline);
      socket.on('receiveMessage', onReceiveMessage);
      socket.on('message-updated', onMessageUpdated);
      socket.on('message-hidden', onMessageHidden);
      socket.on('messages-read', onMessagesRead);
      socket.on('conversation-background-updated', onConversationBackground);
      socket.on('conversation-nickname-updated', onConversationNickname);
      socket.on('user-typing', onTyping);
      socket.on('user-stop-typing', onStopTyping);
      socket.on('receive-group-message', onReceiveGroupMessage);
      socket.on('group-message-updated', onGroupMessageUpdated);
      socket.on('group-updated', onGroupUpdated);
      socket.on('message-deleted', onGroupDeleted);
      socket.on('message-deleted-for-everyone', onGroupDeleted);
      socket.on('call:start', onIncomingCallStart);
      socket.on('call:answer', onCallAnswer);
      socket.on('call:end', onRemoteCallEnd);
      socket.on('call:reject', onRemoteCallRejected);
      socket.on('call:busy', onRemoteCallRejected);
      socket.on('call:unavailable', onCallUnavailable);
      if (groupMode) socket.emit('join-group', chatId);
      if (!groupMode) {
        fetchUserPresence(chatId).then(updatePresence).catch(() => setPresenceReady(true));
        fetchOnlineUsers().then(onOnlineUsers).catch(() => {});
      }
      if (socket.connected) onConnect();
      else socket.connect();

      cleanup = () => {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('online-users', onOnlineUsers);
        socket.off('user-online', onUserOnline);
        socket.off('user-offline', onUserOffline);
        socket.off('receiveMessage', onReceiveMessage);
        socket.off('message-updated', onMessageUpdated);
        socket.off('message-hidden', onMessageHidden);
        socket.off('messages-read', onMessagesRead);
        socket.off('conversation-background-updated', onConversationBackground);
        socket.off('conversation-nickname-updated', onConversationNickname);
        socket.off('user-typing', onTyping);
        socket.off('user-stop-typing', onStopTyping);
        socket.off('receive-group-message', onReceiveGroupMessage);
        socket.off('group-message-updated', onGroupMessageUpdated);
        socket.off('group-updated', onGroupUpdated);
        socket.off('message-deleted', onGroupDeleted);
        socket.off('message-deleted-for-everyone', onGroupDeleted);
        socket.off('call:start', onIncomingCallStart);
        socket.off('call:answer', onCallAnswer);
        socket.off('call:end', onRemoteCallEnd);
        socket.off('call:reject', onRemoteCallRejected);
        socket.off('call:busy', onRemoteCallRejected);
        socket.off('call:unavailable', onCallUnavailable);
        if (groupMode) socket.emit('leave-group', chatId);
      };
    };

    setup();
    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [chatId, currentUserId, groupMode, resetCall]);

  const stopTyping = useCallback(async () => {
    if (!currentUserId || groupMode) return;
    lastTypingEmitAtRef.current = 0;
    await emitTypingStop({ chatId, to: chatId, from: currentUserId });
  }, [chatId, currentUserId, groupMode]);

  const updateComposer = async (text: string) => {
    setComposer(text);
    if (!currentUserId || groupMode) return;

    const now = Date.now();
    if (now - lastTypingEmitAtRef.current > 3000) {
      lastTypingEmitAtRef.current = now;
      emitTypingStart({ chatId, to: chatId, from: currentUserId }).catch(() => {});
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      stopTyping().catch(() => {});
    }, 2000);
  };

  const submitText = async () => {
    const text = composer.trim();
    if (!text || sending) return;
    setSending(true);
    setComposer('');
    stopTyping().catch(() => {});
    try {
      if (editingMessage && !groupMode) {
        const updated = await editMessage(getEntityId(editingMessage), text);
        setMessages(prev => prev.map(item => (getEntityId(item) === getEntityId(updated) ? updated : item)));
        setEditingMessage(null);
        return;
      }

      if (groupMode) {
        const sent = await sendGroupMessage({
          groupId: chatId,
          text,
          replyTo: replyingTo ? getEntityId(replyingTo) : undefined
        });
        setMessages(prev => mergeMessage(prev as GroupMessage[], sent));
        const socket = await getSocket();
        socket.emit('send-group-message', { groupId: chatId, message: sent });
        setReplyingTo(null);
        return;
      }

      const sent = await sendMessage({
        to: chatId,
        text,
        replyTo: replyingTo ? getEntityId(replyingTo) : undefined
      });
      setMessages(prev => mergeMessage(prev as Message[], sent));
      setReplyingTo(null);
    } catch {
      setComposer(text);
      Alert.alert('Send failed', 'Could not send this message.');
    } finally {
      setSending(false);
    }
  };

  const attachAssets = async (assets: ImagePickerAsset[]) => {
    if (!assets.length || sending) return;
    setSending(true);
    stopTyping().catch(() => {});
    const text = composer.trim();
    try {
      if (groupMode) {
        for (const [index, asset] of assets.slice(0, 10).entries()) {
          const upload = await uploadMessageAsset(asset);
          const sent = await sendGroupMessage({
            groupId: chatId,
            text: index === 0 ? text : '',
            fileUrl: upload.fileUrl,
            fileType: upload.fileType,
            replyTo: replyingTo ? getEntityId(replyingTo) : undefined
          });
          setMessages(prev => mergeMessage(prev as GroupMessage[], sent));
          const socket = await getSocket();
          socket.emit('send-group-message', { groupId: chatId, message: sent });
        }
      } else {
        const uploads = [];
        for (const asset of assets.slice(0, 10)) {
          uploads.push(await uploadMessageAsset(asset));
        }
        const sent = await sendMessage({
          to: chatId,
          text,
          replyTo: replyingTo ? getEntityId(replyingTo) : undefined,
          attachments: uploads
        });
        setMessages(prev => mergeMessage(prev as Message[], sent));
      }
      setComposer('');
      setReplyingTo(null);
    } catch (error) {
      Alert.alert('Upload failed', getRequestErrorMessage(error, 'Could not send the selected media.'));
    } finally {
      setSending(false);
    }
  };

  const sendVoiceMessage = async (recording: VoiceRecordingResult) => {
    if (!recording?.uri || sending) return;
    if (groupMode) {
      Alert.alert('Voice messages', 'Voice messages are available in direct chats first.');
      await FileSystem.deleteAsync(recording.uri, { idempotent: true }).catch(() => {});
      return;
    }

    setSending(true);
    stopTyping().catch(() => {});
    try {
      const uploaded = await uploadLocalMessageAsset(recording);
      const sent = await sendMessage({
        to: chatId,
        attachments: [uploaded],
        replyTo: replyingTo ? getEntityId(replyingTo) : undefined
      });
      setMessages(prev => mergeMessage(prev as Message[], sent));
      setReplyingTo(null);
      await FileSystem.deleteAsync(recording.uri, { idempotent: true }).catch(() => {});
    } catch (error) {
      Alert.alert('Voice failed', getRequestErrorMessage(error, 'Could not send this voice message.'));
    } finally {
      setSending(false);
    }
  };

  const openMediaViewer = (targetMessage: ThreadMessage, index: number) => {
    const sender = getSender(targetMessage, groupMode);
    const items = buildMediaViewerItems({
      message: targetMessage as Message,
      sender: typeof sender === 'object' ? sender as User : null
    });
    mediaViewer.open(items, index);
  };

  const handleReaction = async (emoji: string) => {
    const messageId = getEntityId(actionMessage);
    if (!messageId) return;
    try {
      const updated = groupMode
        ? await reactToGroupMessage(messageId, emoji)
        : await reactToMessage(messageId, emoji);
      setMessages(prev => prev.map(item => (getEntityId(item) === messageId ? updated : item)));
      setActionMessage(null);
    } catch {
      Alert.alert('Reaction failed', 'Could not react to this message.');
    }
  };

  const handlePin = async (message: ThreadMessage) => {
    const messageId = getEntityId(message);
    if (!messageId) return;
    try {
      const updated = groupMode ? await pinGroupMessage(messageId) : await pinMessage(messageId);
      setMessages(prev => prev.map(item => (getEntityId(item) === messageId ? updated : item)));
      setActionMessage(null);
    } catch {
      Alert.alert('Pin failed', 'Could not update pinned state.');
    }
  };

  const handleHide = async (message: ThreadMessage) => {
    const messageId = getEntityId(message);
    if (!messageId) return;
    try {
      if (groupMode) await hideGroupMessageForMe(messageId);
      else await hideMessageForMe(messageId);
      setMessages(prev => prev.filter(item => getEntityId(item) !== messageId));
      setActionMessage(null);
    } catch {
      Alert.alert('Remove failed', 'Could not remove this message.');
    }
  };

  const handleUnsend = async (message: ThreadMessage) => {
    const messageId = getEntityId(message);
    if (!messageId) return;
    try {
      if (groupMode) {
        await deleteGroupMessageForEveryone(messageId);
        setMessages(prev => prev.filter(item => getEntityId(item) !== messageId));
        const socket = await getSocket();
        socket.emit('delete-message-for-everyone', { messageId, groupId: chatId });
      } else {
        const updated = await unsendMessageForEveryone(messageId);
        setMessages(prev => prev.map(item => (getEntityId(item) === messageId ? updated : item)));
      }
      setActionMessage(null);
    } catch {
      Alert.alert('Unsend failed', 'Could not unsend this message.');
    }
  };

  const handleRemoveMyReaction = async (message: ThreadMessage, emoji: string) => {
    const messageId = getEntityId(message);
    if (!messageId) return;
    try {
      const updated = groupMode
        ? await reactToGroupMessage(messageId, emoji)
        : await reactToMessage(messageId, emoji);
      setMessages(prev => prev.map(item => (getEntityId(item) === messageId ? updated : item)));
      setReactionViewerMessage(updated);
    } catch {
      Alert.alert('Reaction failed', 'Could not remove this reaction.');
    }
  };

  const openForwardSheet = (message: ThreadMessage | null) => {
    if (!message) return;
    setForwardingMessage(message);
    setForwardQuery('');
    setActionMessage(null);
  };

  const forwardToDirect = async (target: User) => {
    if (!forwardingMessage) return;
    const targetId = getEntityId(target);
    if (!targetId || targetId === currentUserId || forwardingBusyId) return;
    setForwardingBusyId(targetId);
    try {
      const attachments = getMessageAttachments(forwardingMessage as Message);
      const text = getText(forwardingMessage);
      if (!text && attachments.length === 0) {
        Alert.alert('Forward failed', 'This message has no content to forward.');
        return;
      }
      await sendMessage({
        to: targetId,
        text: text ? `Forwarded: ${text}` : '',
        attachments: attachments.map(item => ({
          fileUrl: item.fileUrl,
          fileType: item.fileType || 'file',
          fileName: item.fileName,
          mimeType: item.mimeType,
          fileSize: item.fileSize,
          durationMs: item.durationMs,
          storagePath: item.storagePath,
          storageProvider: item.storageProvider,
          variants: item.variants
        }))
      });
      setForwardingMessage(null);
      Alert.alert('Forwarded', `Sent to ${getDisplayName(target)}.`);
    } catch (error) {
      Alert.alert('Forward failed', getRequestErrorMessage(error, 'Could not forward this message.'));
    } finally {
      setForwardingBusyId('');
    }
  };

  const forwardToGroup = async (targetGroup: Group) => {
    if (!forwardingMessage) return;
    const targetId = getEntityId(targetGroup);
    if (!targetId || forwardingBusyId) return;
    setForwardingBusyId(targetId);
    try {
      const attachments = getMessageAttachments(forwardingMessage as Message);
      const text = getText(forwardingMessage);
      if (!text && attachments.length === 0) {
        Alert.alert('Forward failed', 'This message has no content to forward.');
        return;
      }
      if (!attachments.length) {
        await sendGroupMessage({ groupId: targetId, text: text ? `Forwarded: ${text}` : '' });
      } else {
        for (const [index, attachment] of attachments.entries()) {
          await sendGroupMessage({
            groupId: targetId,
            text: index === 0 && text ? `Forwarded: ${text}` : '',
            fileUrl: attachment.fileUrl,
            fileType: attachment.fileType || 'file'
          });
        }
      }
      setForwardingMessage(null);
      Alert.alert('Forwarded', `Sent to ${targetGroup.name || 'group chat'}.`);
    } catch (error) {
      Alert.alert('Forward failed', getRequestErrorMessage(error, 'Could not forward this message.'));
    } finally {
      setForwardingBusyId('');
    }
  };

  const startEdit = (message: ThreadMessage) => {
    setEditingMessage(message);
    setReplyingTo(null);
    setComposer(getText(message));
    setActionMessage(null);
  };

  const setFlag = async (flag: keyof ChatFlagState) => {
    setChatFlags(prev => {
      const next = toggleChatFlag(prev, flag, activeChatId);
      saveChatFlags(next).catch(() => {});
      return next;
    });
  };

  const saveTheme = async (nextThemeId: string) => {
    setThemeId(nextThemeId);
    await saveChatTheme(activeChatId, nextThemeId).catch(() => {});
  };

  const saveBackground = async (backgroundIdToSave: string) => {
    try {
      if (groupMode) {
        const payload = await updateGroupBackground(chatId, backgroundIdToSave);
        if (payload.group) setGroup(payload.group);
        if (payload.message) setMessages(prev => mergeMessage(prev as GroupMessage[], payload.message as GroupMessage));
        return;
      }

      const payload = await updateConversationBackground(chatId, backgroundIdToSave);
      setConversation(payload.conversation || { ...conversation, backgroundId: backgroundIdToSave });
      if (payload.message) setMessages(prev => mergeMessage(prev as Message[], payload.message as Message));
    } catch {
      Alert.alert('Background failed', 'Could not update the chat background.');
    }
  };

  const saveNickname = async () => {
    try {
      const payload = await updateConversationNickname(chatId, nicknameDraft);
      setConversation(payload.conversation || { ...conversation, nicknames: { ...(conversation?.nicknames || {}), [chatId]: nicknameDraft } });
      if (payload.message) setMessages(prev => mergeMessage(prev as Message[], payload.message as Message));
    } catch {
      Alert.alert('Nickname failed', 'Could not update this nickname.');
    }
  };

  const visibleMessages = useMemo(
    () => messages.filter((message): message is ThreadMessage => Boolean(message && typeof message === 'object')),
    [messages]
  );

  const searchedMessageIds = useMemo(() => {
    const needle = messageSearch.trim().toLowerCase();
    if (!needle) return new Set<string>();
    return new Set(visibleMessages
      .filter(message => getText(message).toLowerCase().includes(needle) || getSenderName(message, groupMode).toLowerCase().includes(needle))
      .map(message => getEntityId(message))
      .filter(Boolean));
  }, [groupMode, messageSearch, visibleMessages]);

  const pinnedMessages = useMemo(() => visibleMessages.filter(message => message.pinned), [visibleMessages]);
  const sharedFiles = useMemo(() => visibleMessages.flatMap(message => getMessageAttachments(message as Message)), [visibleMessages]);
  const forwardTargets = useMemo(() => {
    const needle = forwardQuery.trim().toLowerCase();
    const contacts = forwardContacts
      .filter(contact => getEntityId(contact) !== currentUserId)
      .filter(contact => {
        if (!needle) return true;
        return `${contact.name || ''} ${contact.email || ''}`.toLowerCase().includes(needle);
      });
    const groups = forwardGroups.filter(item => {
      if (!needle) return true;
      return String(item.name || '').toLowerCase().includes(needle);
    });
    return { contacts, groups };
  }, [currentUserId, forwardContacts, forwardGroups, forwardQuery]);
  const actionIsMine = actionMessage ? isOwnMessage(actionMessage, currentUserId, groupMode) : false;
  const canEditAction = Boolean(actionMessage && actionIsMine && !groupMode && getText(actionMessage) && !getMessageAttachments(actionMessage as Message).length && !(actionMessage as Message).unsent);
  const effectiveRemoteTyping = remoteTyping || storeRemoteTyping;
  const effectiveRemoteOnline = presenceStatus?.online ?? remoteOnline;
  const effectiveRemoteLastSeen = presenceStatus?.lastSeen ?? remoteLastSeen ?? remoteUser.lastSeen ?? null;
  const presenceText = groupMode
    ? `${group?.members?.length || 0} members`
    : effectiveRemoteTyping
      ? 'Typing...'
      : formatActiveStatus({
        online: effectiveRemoteOnline,
        lastSeen: effectiveRemoteLastSeen
      });
  const callDurationText = useMemo(() => formatCallDuration(callStartedAt), [callClock, callStartedAt]);
  const callStatusText = callState === 'incoming'
    ? `Incoming ${callMode === 'video' ? 'video' : 'audio'} call`
    : callState === 'calling'
      ? 'Ringing...'
      : callState === 'connecting'
        ? 'Connecting...'
        : callState === 'connected'
          ? callDurationText || 'Connected'
          : callError;

  return (
    <View className="flex-1 pt-12" style={{ backgroundColor: colors.surface }}>
      <View className="border-b" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
        <View className="h-16 flex-row items-center gap-3 px-3">
          <Pressable className="h-10 w-10 items-center justify-center rounded-full" onPress={() => navigation.goBack()} style={{ backgroundColor: colors.surface }}>
            <ArrowLeft color={colors.text} size={22} />
          </Pressable>
          <Avatar
            name={displayName}
            online={!groupMode && effectiveRemoteOnline}
            sharedTag={`${groupMode ? 'group' : 'avatar'}-${chatId}`}
            size={42}
            uri={groupMode ? group?.photo : avatar}
            user={groupMode ? undefined : remoteUser}
          />
          <Pressable className="min-w-0 flex-1" onPress={() => setDetailsOpen(true)}>
            <Text className="text-[16px] font-semibold" numberOfLines={1} style={{ color: colors.text }}>
              {displayName}
            </Text>
            <Text className={`text-xs ${!groupMode && effectiveRemoteOnline ? 'font-semibold' : ''}`} numberOfLines={1} style={{ color: !groupMode && effectiveRemoteOnline ? colors.online : colors.mutedText }}>
              {presenceText}
            </Text>
          </Pressable>
          <Pressable className="h-10 w-10 items-center justify-center rounded-full" onPress={() => startCall('audio')} style={{ backgroundColor: colors.surface }}>
            <Phone color={colors.primary} size={19} />
          </Pressable>
          <Pressable className="h-10 w-10 items-center justify-center rounded-full" onPress={() => startCall('video')} style={{ backgroundColor: colors.surface }}>
            <Video color={colors.primary} size={19} />
          </Pressable>
          <Pressable className="h-10 w-10 items-center justify-center rounded-full" onPress={() => setSearchOpen(value => !value)} style={{ backgroundColor: colors.surface }}>
            <Search color={colors.text} size={19} />
          </Pressable>
          <Pressable className="h-10 w-10 items-center justify-center rounded-full" onPress={() => setDetailsOpen(true)} style={{ backgroundColor: colors.surface }}>
            <MoreVertical color={colors.text} size={20} />
          </Pressable>
        </View>
        {searchOpen ? (
          <View className="px-3 pb-3">
            <View className="h-11 flex-row items-center gap-2 rounded-2xl px-3" style={{ backgroundColor: colors.input }}>
              <Search color={colors.mutedText} size={17} />
              <TextInput
                className="flex-1 text-[15px]"
                onChangeText={setMessageSearch}
                placeholder="Search in conversation"
                placeholderTextColor={colors.mutedText}
                style={{ color: colors.text }}
                value={messageSearch}
              />
              {messageSearch ? (
                <Pressable onPress={() => setMessageSearch('')}>
                  <X color={colors.mutedText} size={17} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      {pinnedMessages.length > 0 && !searchOpen ? (
        <Pressable className="h-11 flex-row items-center gap-2 border-b px-4" onPress={() => setPinnedOpen(true)} style={{ backgroundColor: colors.background, borderColor: colors.border }}>
          <Pin color={colors.primary} size={16} />
          <Text className="flex-1 text-sm font-semibold" numberOfLines={1} style={{ color: colors.text }}>
            {pinnedMessages.length} pinned {pinnedMessages.length === 1 ? 'message' : 'messages'}
          </Text>
          <Text className="text-xs font-semibold" style={{ color: colors.primary }}>View</Text>
        </Pressable>
      ) : null}

      <AudioPlayerBanner />

      {loading ? (
        <View className="flex-1 items-center justify-center" style={background.style}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View className="flex-1" style={background.style}>
          <FlashList
            data={visibleMessages}
            keyExtractor={(item, index) => getMessageKey(item as Message, index)}
            ListHeaderComponent={loadingOlder ? <ActivityIndicator className="my-3" color={colors.primary} /> : null}
            maintainVisibleContentPosition={{
              autoscrollToBottomThreshold: 0.2,
              startRenderingFromBottom: true
            }}
            onStartReached={loadOlder}
            onStartReachedThreshold={0.35}
            renderItem={({ item }) => (
              <ChatBubble
                currentUserId={currentUserId}
                groupMode={groupMode}
                highlighted={searchedMessageIds.has(getEntityId(item))}
                message={item}
                onAction={setActionMessage}
                onOpenMedia={openMediaViewer}
                onReactionPress={setReactionViewerMessage}
                onReply={message => {
                  setEditingMessage(null);
                  setReplyingTo(message);
                }}
                otherBubbleColor={colors.receivedBubble}
                ownBubbleColor={selectedTheme.ownBubble}
              />
            )}
          />
        </View>
      )}

      {effectiveRemoteTyping ? (
        <View className="px-3 pb-2" style={background.style}>
          <TypingIndicator />
        </View>
      ) : null}

      <MessageInput
        editingLabel={editingMessage ? getText(editingMessage) : undefined}
        onAttach={attachAssets}
        onChangeText={updateComposer}
        onVoiceSend={sendVoiceMessage}
        onClearEdit={() => {
          setEditingMessage(null);
          setComposer('');
        }}
        onClearReply={() => setReplyingTo(null)}
        onSend={submitText}
        replyLabel={replyingTo ? getText(replyingTo) || 'Replying to media' : undefined}
        sending={sending}
        value={composer}
      />

      <MediaViewer
        initialIndex={mediaViewer.initialIndex}
        items={mediaViewer.items}
        onClose={mediaViewer.close}
        onReply={() => {
          mediaViewer.close();
        }}
        visible={mediaViewer.visible}
      />

      {callState !== 'idle' ? (
        <NativeCallOverlay
          cameraOff={cameraOff}
          callMode={callMode}
          callState={callState}
          callStatusText={callStatusText}
          error={callError}
          micMuted={micMuted}
          onAccept={acceptCall}
          onCameraMutedChange={setCameraOff}
          onConnected={handleLiveKitConnected}
          onEnd={() => endCall()}
          onError={setCallError}
          onMicMutedChange={setMicMuted}
          onReject={() => rejectCall()}
          partner={callPartner}
          session={liveKitSession}
        />
      ) : null}

      <Modal animationType="fade" transparent visible={Boolean(actionMessage)} onRequestClose={() => setActionMessage(null)}>
        <Pressable className="flex-1 justify-end bg-black/35" onPress={() => setActionMessage(null)}>
          <Pressable className="rounded-t-[28px] p-4" onPress={event => event.stopPropagation()} style={{ backgroundColor: colors.background }}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold" style={{ color: colors.text }}>Message</Text>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full" onPress={() => setActionMessage(null)} style={{ backgroundColor: colors.surface }}>
                <X color={colors.text} size={18} />
              </Pressable>
            </View>
            <View className="mb-4 flex-row justify-between rounded-3xl p-2" style={{ backgroundColor: colors.surface }}>
              {QUICK_REACTIONS.map(emoji => (
                <Pressable className="h-11 w-11 items-center justify-center rounded-full" key={emoji} onPress={() => handleReaction(emoji)} style={{ backgroundColor: colors.elevated }}>
                  <Text className="text-2xl">{emoji}</Text>
                </Pressable>
              ))}
            </View>
            <View className="gap-2">
              <Pressable className="h-12 flex-row items-center gap-3 rounded-2xl px-4" onPress={() => {
                if (actionMessage) setReplyingTo(actionMessage);
                setEditingMessage(null);
                setActionMessage(null);
              }} style={{ backgroundColor: colors.surface }}>
                <MoreVertical color={colors.primary} size={18} />
                <Text className="font-semibold" style={{ color: colors.text }}>Reply</Text>
              </Pressable>
              {canEditAction ? (
                <Pressable className="h-12 flex-row items-center gap-3 rounded-2xl px-4" onPress={() => actionMessage && startEdit(actionMessage)} style={{ backgroundColor: colors.surface }}>
                  <Edit3 color={colors.primary} size={18} />
                  <Text className="font-semibold" style={{ color: colors.text }}>Edit</Text>
                </Pressable>
              ) : null}
              <Pressable className="h-12 flex-row items-center gap-3 rounded-2xl px-4" onPress={() => actionMessage && handlePin(actionMessage)} style={{ backgroundColor: colors.surface }}>
                <Pin color={colors.primary} size={18} />
                <Text className="font-semibold" style={{ color: colors.text }}>{actionMessage?.pinned ? 'Unpin' : 'Pin'}</Text>
              </Pressable>
              <Pressable className="h-12 flex-row items-center gap-3 rounded-2xl px-4" onPress={() => openForwardSheet(actionMessage)} style={{ backgroundColor: colors.surface }}>
                <Send color={colors.primary} size={18} />
                <Text className="font-semibold" style={{ color: colors.text }}>Forward</Text>
              </Pressable>
              {actionMessage?.reactions?.length ? (
                <Pressable className="h-12 flex-row items-center gap-3 rounded-2xl px-4" onPress={() => {
                  setReactionViewerMessage(actionMessage);
                  setActionMessage(null);
                }} style={{ backgroundColor: colors.surface }}>
                  <Star color={colors.primary} size={18} />
                  <Text className="font-semibold" style={{ color: colors.text }}>View reactions</Text>
                </Pressable>
              ) : null}
              <Pressable className="h-12 flex-row items-center gap-3 rounded-2xl px-4" onPress={() => {
                setInfoMessage(actionMessage);
                setActionMessage(null);
              }} style={{ backgroundColor: colors.surface }}>
                <Info color={colors.primary} size={18} />
                <Text className="font-semibold" style={{ color: colors.text }}>Info</Text>
              </Pressable>
              <Pressable className="h-12 flex-row items-center gap-3 rounded-2xl bg-red-50 px-4" onPress={() => actionMessage && handleHide(actionMessage)}>
                <Trash2 color="#DC2626" size={18} />
                <Text className="font-semibold text-red-600">Remove for me</Text>
              </Pressable>
              {actionIsMine ? (
                <Pressable className="h-12 flex-row items-center gap-3 rounded-2xl bg-red-600 px-4" onPress={() => actionMessage && handleUnsend(actionMessage)}>
                  <Trash2 color="#FFFFFF" size={18} />
                  <Text className="font-semibold text-white">{groupMode ? 'Delete for everyone' : 'Unsend'}</Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="slide" transparent visible={pinnedOpen} onRequestClose={() => setPinnedOpen(false)}>
        <View className="flex-1 justify-end bg-black/35">
          <View className="max-h-[72%] rounded-t-[28px] p-4" style={{ backgroundColor: colors.background }}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold" style={{ color: colors.text }}>Pinned messages</Text>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full" onPress={() => setPinnedOpen(false)} style={{ backgroundColor: colors.surface }}>
                <X color={colors.text} size={18} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {pinnedMessages.slice().reverse().map(message => (
                <Pressable
                  className="mb-2 rounded-2xl p-3"
                  key={getEntityId(message)}
                  onPress={() => {
                    setPinnedOpen(false);
                    setMessageSearch(getText(message));
                    setSearchOpen(true);
                  }}
                  style={{ backgroundColor: colors.surface }}
                >
                  <View className="mb-1 flex-row items-center gap-2">
                    <Pin color={colors.primary} size={14} />
                    <Text className="text-xs font-bold" numberOfLines={1} style={{ color: colors.mutedText }}>
                      {isOwnMessage(message, currentUserId, groupMode) ? 'You' : getSenderName(message, groupMode)} · {formatMessageTime(message.createdAt)}
                    </Text>
                  </View>
                  <Text className="text-sm font-semibold" numberOfLines={3} style={{ color: colors.text }}>
                    {getText(message) || 'Media message'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={Boolean(forwardingMessage)} onRequestClose={() => setForwardingMessage(null)}>
        <View className="flex-1 justify-end bg-black/35">
          <View className="max-h-[82%] rounded-t-[28px] p-4" style={{ backgroundColor: colors.background }}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold" style={{ color: colors.text }}>Forward message</Text>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full" onPress={() => setForwardingMessage(null)} style={{ backgroundColor: colors.surface }}>
                <X color={colors.text} size={18} />
              </Pressable>
            </View>
            <View className="mb-3 rounded-2xl p-3" style={{ backgroundColor: colors.surface }}>
              <Text className="text-sm font-semibold" numberOfLines={3} style={{ color: colors.text }}>
                {getText(forwardingMessage) || `${getMessageAttachments(forwardingMessage as Message).length || 1} media/file attachment`}
              </Text>
            </View>
            <View className="mb-3 h-11 flex-row items-center gap-2 rounded-2xl px-3" style={{ backgroundColor: colors.input }}>
              <Search color={colors.mutedText} size={17} />
              <TextInput
                className="flex-1 text-[15px]"
                onChangeText={setForwardQuery}
                placeholder="Search people or groups"
                placeholderTextColor={colors.mutedText}
                style={{ color: colors.text }}
                value={forwardQuery}
              />
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {forwardTargets.contacts.map(contact => {
                const targetId = getEntityId(contact);
                return (
                  <Pressable className="h-14 flex-row items-center gap-3 rounded-2xl px-2" key={`forward-user-${targetId}`} onPress={() => forwardToDirect(contact)}>
                    <Avatar user={contact} size={40} />
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold" numberOfLines={1} style={{ color: colors.text }}>{getDisplayName(contact)}</Text>
                      <Text className="text-xs" numberOfLines={1} style={{ color: colors.mutedText }}>Direct message</Text>
                    </View>
                    {forwardingBusyId === targetId ? <ActivityIndicator color={colors.primary} /> : <Send color={colors.primary} size={18} />}
                  </Pressable>
                );
              })}
              {forwardTargets.groups.length ? (
                <Text className="mb-1 mt-3 px-2 text-xs font-bold uppercase" style={{ color: colors.mutedText }}>Groups</Text>
              ) : null}
              {forwardTargets.groups.map(targetGroup => {
                const targetId = getEntityId(targetGroup);
                return (
                  <Pressable className="h-14 flex-row items-center gap-3 rounded-2xl px-2" key={`forward-group-${targetId}`} onPress={() => forwardToGroup(targetGroup)}>
                    <View className="h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.surface }}>
                      <Users color={colors.primary} size={19} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold" numberOfLines={1} style={{ color: colors.text }}>{targetGroup.name || 'Group chat'}</Text>
                      <Text className="text-xs" numberOfLines={1} style={{ color: colors.mutedText }}>Group message</Text>
                    </View>
                    {forwardingBusyId === targetId ? <ActivityIndicator color={colors.primary} /> : <Send color={colors.primary} size={18} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={detailsOpen} onRequestClose={() => setDetailsOpen(false)}>
        <View className="flex-1 justify-end bg-black/35">
          <View className="max-h-[88%] rounded-t-[28px]" style={{ backgroundColor: colors.background }}>
            <View className="flex-row items-center justify-between px-4 py-3">
              <Text className="text-lg font-bold" style={{ color: colors.text }}>Details</Text>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full" onPress={() => setDetailsOpen(false)} style={{ backgroundColor: colors.surface }}>
                <X color={colors.text} size={18} />
              </Pressable>
            </View>
            <ScrollView className="px-4" showsVerticalScrollIndicator={false}>
              <View className="items-center pb-4">
                <Avatar user={groupMode ? undefined : remoteUser} uri={groupMode ? group?.photo : avatar} name={displayName} size={88} />
                <Text className="mt-3 text-xl font-black" numberOfLines={1} style={{ color: colors.text }}>{displayName}</Text>
                <Text className="mt-1 text-sm" numberOfLines={1} style={{ color: colors.mutedText }}>
                  {groupMode ? `${group?.members?.length || 0} members` : chatStreak ? `${chatStreak.currentStreak} day streak` : 'Direct conversation'}
                </Text>
              </View>

              <View className="mb-4 flex-row gap-2">
                <Pressable className="flex-1 items-center rounded-2xl p-3" onPress={() => setFlag('pinned')} style={{ backgroundColor: colors.surface }}>
                  <Pin color={hasChatFlag(chatFlags, 'pinned', activeChatId) ? colors.primary : colors.mutedText} size={19} />
                  <Text className="mt-1 text-xs font-bold" style={{ color: colors.text }}>Pin</Text>
                </Pressable>
                <Pressable className="flex-1 items-center rounded-2xl p-3" onPress={() => setFlag('favorites')} style={{ backgroundColor: colors.surface }}>
                  <Star color="#F59E0B" fill={hasChatFlag(chatFlags, 'favorites', activeChatId) ? '#F59E0B' : 'transparent'} size={19} />
                  <Text className="mt-1 text-xs font-bold" style={{ color: colors.text }}>Star</Text>
                </Pressable>
                <Pressable className="flex-1 items-center rounded-2xl p-3" onPress={() => setFlag('muted')} style={{ backgroundColor: colors.surface }}>
                  <BellOff color={hasChatFlag(chatFlags, 'muted', activeChatId) ? colors.danger : colors.mutedText} size={19} />
                  <Text className="mt-1 text-xs font-bold" style={{ color: colors.text }}>Mute</Text>
                </Pressable>
              </View>

              {!groupMode ? (
                <View className="mb-4 rounded-3xl p-4" style={{ backgroundColor: colors.surface }}>
                  <View className="mb-3 flex-row items-center gap-2">
                    <UserRound color={colors.primary} size={18} />
                    <Text className="font-bold" style={{ color: colors.text }}>Nickname</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      className="h-11 flex-1 rounded-2xl px-3 text-[15px]"
                      onChangeText={setNicknameDraft}
                      placeholder={userName}
                      placeholderTextColor={colors.mutedText}
                      style={{ backgroundColor: colors.input, color: colors.text }}
                      value={nicknameDraft}
                    />
                    <Pressable className="h-11 w-11 items-center justify-center rounded-2xl" onPress={saveNickname} style={{ backgroundColor: colors.primary }}>
                      <Check color="#FFFFFF" size={18} />
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View className="mb-4 rounded-3xl p-4" style={{ backgroundColor: colors.surface }}>
                <View className="mb-3 flex-row items-center gap-2">
                  <Palette color={colors.primary} size={18} />
                  <Text className="font-bold" style={{ color: colors.text }}>Theme</Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {CHAT_THEMES.map(theme => (
                    <Pressable
                      className="h-10 min-w-20 flex-row items-center gap-2 rounded-2xl px-3"
                      key={theme.id}
                      onPress={() => saveTheme(theme.id)}
                      style={{
                        backgroundColor: colors.elevated,
                        borderColor: themeId === theme.id ? colors.primary : 'transparent',
                        borderWidth: themeId === theme.id ? 2 : 0
                      }}
                    >
                      <View className="h-4 w-4 rounded-full" style={{ backgroundColor: theme.ownBubble }} />
                      <Text className="text-xs font-bold" style={{ color: colors.text }}>{theme.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View className="mb-4 rounded-3xl p-4" style={{ backgroundColor: colors.surface }}>
                <Text className="mb-3 font-bold" style={{ color: colors.text }}>Background</Text>
                <View className="flex-row flex-wrap gap-2">
                  {CHAT_BACKGROUNDS.map(item => (
                    <Pressable
                      className={`h-11 w-11 rounded-2xl border-2 ${background.id === item.id ? 'border-blue-600' : 'border-white'}`}
                      key={item.id}
                      onPress={() => saveBackground(item.id)}
                      style={{ backgroundColor: item.swatch }}
                    />
                  ))}
                </View>
              </View>

              {pinnedMessages.length ? (
                <View className="mb-4 rounded-3xl p-4" style={{ backgroundColor: colors.surface }}>
                  <Text className="mb-2 font-bold" style={{ color: colors.text }}>Pinned messages</Text>
                  {pinnedMessages.slice(-8).map(message => (
                    <Text className="mb-2 text-sm" key={getEntityId(message)} numberOfLines={2} style={{ color: colors.mutedText }}>
                      {getText(message) || 'Media message'}
                    </Text>
                  ))}
                </View>
              ) : null}

              <View className="mb-8 rounded-3xl p-4" style={{ backgroundColor: colors.surface }}>
                <Text className="mb-2 font-bold" style={{ color: colors.text }}>Files and media</Text>
                {sharedFiles.length ? sharedFiles.slice(-12).map((file, index) => (
                  <Text className="mb-2 text-sm" key={`${file.fileUrl}-${index}`} numberOfLines={1} style={{ color: colors.mutedText }}>
                    {file.fileName || file.fileType || 'Attachment'}
                  </Text>
                )) : (
                  <Text className="text-sm" style={{ color: colors.mutedText }}>No shared files yet.</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={Boolean(infoMessage)} onRequestClose={() => setInfoMessage(null)}>
        <View className="flex-1 justify-center bg-black/45 p-5">
          <View className="rounded-[28px] p-4" style={{ backgroundColor: colors.background }}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold" style={{ color: colors.text }}>Message info</Text>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full" onPress={() => setInfoMessage(null)} style={{ backgroundColor: colors.surface }}>
                <X color={colors.text} size={18} />
              </Pressable>
            </View>
            {infoMessage ? (
              <View className="gap-3">
                <View className="rounded-2xl p-3" style={{ backgroundColor: colors.surface }}>
                  <Text className="text-xs font-bold uppercase" style={{ color: colors.mutedText }}>From</Text>
                  <Text className="mt-1 font-semibold" style={{ color: colors.text }}>{isOwnMessage(infoMessage, currentUserId, groupMode) ? 'You' : getSenderName(infoMessage, groupMode)}</Text>
                </View>
                <View className="rounded-2xl p-3" style={{ backgroundColor: colors.surface }}>
                  <Text className="text-xs font-bold uppercase" style={{ color: colors.mutedText }}>Time</Text>
                  <Text className="mt-1 font-semibold" style={{ color: colors.text }}>{formatMessageTime(infoMessage.createdAt)}</Text>
                </View>
                <View className="rounded-2xl p-3" style={{ backgroundColor: colors.surface }}>
                  <Text className="text-xs font-bold uppercase" style={{ color: colors.mutedText }}>Status</Text>
                  <Text className="mt-1 font-semibold" style={{ color: colors.text }}>
                    {(infoMessage as Message).unsent ? 'Unsent' : (infoMessage as Message).read ? 'Seen' : groupMode ? 'Sent' : 'Delivered'}
                  </Text>
                </View>
                {infoMessage.reactions?.length ? (
                  <View className="rounded-2xl p-3" style={{ backgroundColor: colors.surface }}>
                    <Text className="text-xs font-bold uppercase" style={{ color: colors.mutedText }}>Reactions</Text>
                    <Text className="mt-1 font-semibold" style={{ color: colors.text }}>{infoMessage.reactions.map(reaction => reaction.emoji).join(' ')}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={Boolean(reactionViewerMessage)} onRequestClose={() => setReactionViewerMessage(null)}>
        <View className="flex-1 justify-center bg-black/45 p-5">
          <View className="max-h-[72%] rounded-[28px] p-4" style={{ backgroundColor: colors.background }}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold" style={{ color: colors.text }}>
                {reactionViewerMessage?.reactions?.length || 0} reacted
              </Text>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full" onPress={() => setReactionViewerMessage(null)} style={{ backgroundColor: colors.surface }}>
                <X color={colors.text} size={18} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {reactionViewerMessage?.reactions?.length ? reactionViewerMessage.reactions.map((reaction, index) => {
                const reactor = typeof reaction.userId === 'object' ? reaction.userId : undefined;
                const reactorId = getEntityId(reaction.userId);
                const isMine = reactorId === currentUserId;
                return (
                  <View className="mb-2 flex-row items-center gap-3 rounded-2xl p-3" key={`${reaction.emoji}-${reactorId || index}`} style={{ backgroundColor: colors.surface }}>
                    <View>
                      <Avatar user={reactor} size={42} />
                      <View className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-full shadow-sm shadow-slate-200" style={{ backgroundColor: colors.elevated }}>
                        <Text className="text-sm">{reaction.emoji}</Text>
                      </View>
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold" numberOfLines={1} style={{ color: colors.text }}>
                        {isMine ? 'You' : getDisplayName(reactor, 'Member')}
                      </Text>
                      <Text className="text-xs" numberOfLines={1} style={{ color: colors.mutedText }}>
                        Reacted with {reaction.emoji}
                      </Text>
                    </View>
                    {isMine ? (
                      <Pressable className="rounded-full px-3 py-2" onPress={() => reactionViewerMessage && handleRemoveMyReaction(reactionViewerMessage, reaction.emoji)} style={{ backgroundColor: colors.elevated }}>
                        <Text className="text-xs font-bold" style={{ color: colors.danger }}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              }) : (
                <Text className="py-5 text-center text-sm" style={{ color: colors.mutedText }}>No reactions yet.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
