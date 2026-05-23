import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import { Search, Settings, UserCircle2 } from 'lucide-react-native';
import ChatListItem from '../components/ChatListItem';
import ContactsList from '../components/ContactsList';
import EmptyState from '../components/EmptyState';
import { deleteConversation, fetchContacts, fetchConversations } from '../services/messages';
import { getSocket } from '../services/socket';
import { useAuth } from '../store/AuthContext';
import type { Conversation, RootStackParamList, User } from '../types';
import { getEntityId } from '../utils/ids';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'ChatList'>;

export default function ChatListScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const currentUserId = getEntityId(user);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const openChat = useCallback((person: User) => {
    const chatId = getEntityId(person);
    if (!chatId) return;
    navigation.navigate('ChatRoom', {
      chatId,
      userName: person.name || person.email || 'Syncrova user',
      avatar: person.avatar || '',
      user: person
    });
  }, [navigation]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [conversationRows, contactRows] = await Promise.all([
        fetchConversations(),
        fetchContacts().catch(() => [])
      ]);
      setConversations(conversationRows);
      setContacts(contactRows);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    let mounted = true;
    let cleanup: undefined | (() => void);

    const setup = async () => {
      const socket = await getSocket();
      const reload = () => {
        if (mounted) refresh();
      };
      const announceOnline = () => {
        if (currentUserId) socket.emit('user-online', currentUserId);
      };

      socket.on('connect', announceOnline);
      socket.on('receiveMessage', reload);
      socket.on('message-updated', reload);
      socket.on('message-hidden', reload);
      socket.on('conversation-deleted', reload);
      if (socket.connected) announceOnline();
      else socket.connect();

      cleanup = () => {
        socket.off('connect', announceOnline);
        socket.off('receiveMessage', reload);
        socket.off('message-updated', reload);
        socket.off('message-hidden', reload);
        socket.off('conversation-deleted', reload);
      };
    };

    setup();
    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [currentUserId, refresh]);

  const filteredConversations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter(item => {
      const name = item.user?.name || item.user?.email || '';
      return name.toLowerCase().includes(needle);
    });
  }, [conversations, query]);

  const filteredContacts = useMemo(() => {
    const existingIds = new Set(conversations.map(item => getEntityId(item.user)));
    const needle = query.trim().toLowerCase();
    return contacts.filter(contact => {
      const id = getEntityId(contact);
      const name = contact.name || contact.email || '';
      if (!id || existingIds.has(id)) return false;
      return needle ? name.toLowerCase().includes(needle) : true;
    });
  }, [contacts, conversations, query]);

  const removeConversation = async (item: Conversation) => {
    const chatId = getEntityId(item.user);
    if (!chatId) return;
    try {
      setConversations(prev => prev.filter(row => getEntityId(row.user) !== chatId));
      await deleteConversation(chatId);
    } catch {
      Alert.alert('Delete failed', 'Could not delete this conversation.');
      refresh();
    }
  };

  const showContacts = Boolean(query.trim()) && filteredContacts.length > 0 && filteredConversations.length === 0;

  return (
    <View className="flex-1 bg-white pt-14">
      <View className="px-4 pb-3">
        <View className="flex-row items-center justify-between">
          <View className="min-w-0 flex-1">
            <Text className="text-3xl font-bold text-slate-950" numberOfLines={1}>
              Chats
            </Text>
            <Text className="mt-0.5 text-sm text-slate-500" numberOfLines={1}>
              {user?.name || user?.email || 'Syncrova'}
            </Text>
          </View>
          <View className="ml-3 flex-row gap-2">
            <Pressable className="h-11 w-11 items-center justify-center rounded-full bg-slate-100" onPress={() => navigation.navigate('Profile')}>
              <UserCircle2 color="#0F172A" size={22} />
            </Pressable>
            <Pressable className="h-11 w-11 items-center justify-center rounded-full bg-slate-100" onPress={() => navigation.navigate('Settings')}>
              <Settings color="#0F172A" size={22} />
            </Pressable>
          </View>
        </View>
        <View className="mt-4 h-12 flex-row items-center gap-2 rounded-2xl bg-slate-100 px-3">
          <Search color="#64748B" size={18} />
          <TextInput
            className="flex-1 text-[15px] text-slate-950"
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor="#94A3B8"
            value={query}
          />
        </View>
      </View>

      {showContacts ? (
        <ContactsList contacts={filteredContacts} onSelect={openChat} />
      ) : (
        <FlashList
          data={filteredConversations}
          keyExtractor={(item, index) => getEntityId(item.user) || `conversation-${index}`}
          ListEmptyComponent={
            <EmptyState
              title={loading ? 'Loading chats' : 'No conversations'}
              body={loading ? undefined : 'Search for a contact to start a native Syncrova chat.'}
            />
          }
          onRefresh={refresh}
          refreshing={refreshing}
          renderItem={({ item }) => (
            <ChatListItem
              item={item}
              onDelete={() => removeConversation(item)}
              onPress={() => openChat(item.user)}
            />
          )}
        />
      )}
    </View>
  );
}
