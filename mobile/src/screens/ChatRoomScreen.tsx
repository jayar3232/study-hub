import type { ImagePickerAsset } from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import { ArrowLeft, MoreVertical } from 'lucide-react-native';
import Avatar from '../components/Avatar';
import ChatBubble from '../components/ChatBubble';
import MessageInput from '../components/MessageInput';
import TypingIndicator from '../components/TypingIndicator';
import { fetchMessages, markMessagesRead, sendMessage, uploadMessageAsset } from '../services/messages';
import { getSocket } from '../services/socket';
import { useAuth } from '../store/AuthContext';
import type { Message, RootStackParamList, User } from '../types';
import { getEntityId, getMessageKey } from '../utils/ids';

type RouteProps = NativeStackScreenProps<RootStackParamList, 'ChatRoom'>['route'];
type Navigation = NativeStackNavigationProp<RootStackParamList, 'ChatRoom'>;

export default function ChatRoomScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProps>();
  const { user } = useAuth();
  const currentUserId = getEntityId(user);
  const { chatId, userName, avatar } = route.params;
  const remoteUser: User = route.params.user || { _id: chatId, name: userName, avatar };

  const [messages, setMessages] = useState<Message[]>([]);
  const [composer, setComposer] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchMessages(chatId);
      setMessages(page.items);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
      await markMessagesRead(chatId).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingOlder || !nextCursor) return;
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
  }, [chatId, hasMore, loadingOlder, nextCursor]);

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
        if (!mounted || !belongsToChat(message)) return;
        setMessages(prev => (
          prev.some(item => getEntityId(item) === getEntityId(message)) ? prev : [...prev, message]
        ));
        if (getEntityId(message.from) === chatId) markMessagesRead(chatId).catch(() => {});
      };
      const onMessageUpdated = (message: Message) => {
        if (!mounted || !belongsToChat(message)) return;
        setMessages(prev => prev.map(item => (getEntityId(item) === getEntityId(message) ? message : item)));
      };
      const onMessageHidden = ({ messageId }: { messageId: string }) => {
        if (!mounted) return;
        setMessages(prev => prev.filter(item => getEntityId(item) !== messageId));
      };
      const onTyping = ({ from }: { from: string }) => {
        if (from === chatId) setRemoteTyping(true);
      };
      const onStopTyping = ({ from }: { from: string }) => {
        if (from === chatId) setRemoteTyping(false);
      };
      const announceOnline = () => {
        if (currentUserId) socket.emit('user-online', currentUserId);
      };

      socket.on('connect', announceOnline);
      socket.on('receiveMessage', onReceiveMessage);
      socket.on('message-updated', onMessageUpdated);
      socket.on('message-hidden', onMessageHidden);
      socket.on('user-typing', onTyping);
      socket.on('user-stop-typing', onStopTyping);
      if (socket.connected) announceOnline();
      else socket.connect();

      cleanup = () => {
        socket.off('connect', announceOnline);
        socket.off('receiveMessage', onReceiveMessage);
        socket.off('message-updated', onMessageUpdated);
        socket.off('message-hidden', onMessageHidden);
        socket.off('user-typing', onTyping);
        socket.off('user-stop-typing', onStopTyping);
      };
    };

    setup();
    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [chatId, currentUserId]);

  const stopTyping = useCallback(async () => {
    if (!currentUserId) return;
    const socket = await getSocket();
    socket.emit('stop-typing', { to: chatId, from: currentUserId });
  }, [chatId, currentUserId]);

  const updateComposer = async (text: string) => {
    setComposer(text);
    if (!currentUserId) return;
    const socket = await getSocket();
    socket.emit('typing', { to: chatId, from: currentUserId });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      stopTyping().catch(() => {});
    }, 900);
  };

  const submitText = async () => {
    const text = composer.trim();
    if (!text || sending) return;
    setSending(true);
    setComposer('');
    stopTyping().catch(() => {});
    try {
      const sent = await sendMessage({
        to: chatId,
        text,
        replyTo: replyingTo ? getEntityId(replyingTo) : undefined
      });
      setMessages(prev => (prev.some(item => getEntityId(item) === getEntityId(sent)) ? prev : [...prev, sent]));
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
    try {
      const uploads = [];
      for (const asset of assets.slice(0, 10)) {
        uploads.push(await uploadMessageAsset(asset));
      }
      const sent = await sendMessage({
        to: chatId,
        text: composer.trim(),
        replyTo: replyingTo ? getEntityId(replyingTo) : undefined,
        attachments: uploads
      });
      setMessages(prev => (prev.some(item => getEntityId(item) === getEntityId(sent)) ? prev : [...prev, sent]));
      setComposer('');
      setReplyingTo(null);
    } catch {
      Alert.alert('Upload failed', 'Could not send the selected media.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View className="flex-1 bg-slate-100 pt-12">
      <View className="h-16 flex-row items-center gap-3 border-b border-slate-200 bg-white px-3">
        <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-slate-100" onPress={() => navigation.goBack()}>
          <ArrowLeft color="#0F172A" size={22} />
        </Pressable>
        <Avatar user={remoteUser} uri={avatar} name={userName} size={42} sharedTag={`avatar-${chatId}`} />
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-semibold text-slate-950" numberOfLines={1}>
            {userName}
          </Text>
          <Text className="text-xs text-slate-500" numberOfLines={1}>
            {remoteTyping ? 'Typing...' : 'Syncrova Messenger'}
          </Text>
        </View>
        <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-slate-100">
          <MoreVertical color="#0F172A" size={20} />
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0A7CFF" />
        </View>
      ) : (
        <FlashList
          data={messages}
          keyExtractor={(item, index) => getMessageKey(item, index)}
          ListHeaderComponent={loadingOlder ? <ActivityIndicator className="my-3" color="#0A7CFF" /> : null}
          maintainVisibleContentPosition={{
            autoscrollToBottomThreshold: 0.2,
            startRenderingFromBottom: true
          }}
          onStartReached={loadOlder}
          onStartReachedThreshold={0.35}
          renderItem={({ item }) => (
            <ChatBubble currentUserId={currentUserId} message={item} onReply={setReplyingTo} />
          )}
        />
      )}

      {remoteTyping ? (
        <View className="px-3 pb-2">
          <TypingIndicator />
        </View>
      ) : null}

      <MessageInput
        onAttach={attachAssets}
        onChangeText={updateComposer}
        onClearReply={() => setReplyingTo(null)}
        onSend={submitText}
        replyLabel={replyingTo ? replyingTo.text || 'Replying to media' : undefined}
        sending={sending}
        value={composer}
      />
    </View>
  );
}
