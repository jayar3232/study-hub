import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import { BellOff, Check, Edit3, MessageCircle, Plus, Search, Settings, Star, Trash2, UserCircle2, Users, X } from 'lucide-react-native';
import Avatar from '../components/Avatar';
import ChatListItem from '../components/ChatListItem';
import ContactsList from '../components/ContactsList';
import EmptyState from '../components/EmptyState';
import GroupListItem from '../components/GroupListItem';
import {
  createGroup,
  deleteMyNote,
  deleteConversation,
  fetchActiveNotes,
  fetchContacts,
  fetchConversations,
  fetchGroups,
  fetchMyNote,
  fetchStoryGroups,
  reactToNote,
  reactToStory,
  replyToNote,
  replyToStory,
  saveMyNote,
  viewNote,
  viewStory
} from '../services/messages';
import { getSocket } from '../services/socket';
import { useAuth } from '../store/AuthContext';
import type { Conversation, Group, RootStackParamList, Story, StoryGroup, User, UserNote } from '../types';
import { QUICK_REACTIONS } from '../utils/chatCustomizations';
import { getEntityId } from '../utils/ids';
import { resolveMediaUrl, resolveMediaVariantUrl } from '../utils/media';
import { ChatFlagState, hasChatFlag, loadChatFlags, saveChatFlags, toggleChatFlag } from '../utils/preferences';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'ChatList'>;
type ListMode = 'direct' | 'groups';
type ConversationFilter = 'all' | 'pinned' | 'unread' | 'favorites' | 'muted';

const emptyFlags: ChatFlagState = {
  pinned: [],
  muted: [],
  favorites: []
};

const getUserName = (user?: User | null) => user?.name || user?.email || 'Syncrova user';
const getNoteOwner = (note?: UserNote | null) => (typeof note?.userId === 'object' ? note.userId : undefined);
const getStoryOwner = (group?: StoryGroup | null) => group?.owner || {};
const getStoryPreview = (group?: StoryGroup | null) => group?.stories?.[0] || group?.preview;

function StoryVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, playerInstance => {
    playerInstance.loop = true;
    playerInstance.play();
  });

  return <VideoView contentFit="cover" nativeControls player={player} style={{ height: 420, width: '100%' }} surfaceType="textureView" />;
}

export default function ChatListScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const currentUserId = getEntityId(user);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [listMode, setListMode] = useState<ListMode>('direct');
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>('all');
  const [chatFlags, setChatFlags] = useState<ChatFlagState>(emptyFlags);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [myNote, setMyNote] = useState<UserNote | null>(null);
  const [activeNotes, setActiveNotes] = useState<UserNote[]>([]);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [noteComposerOpen, setNoteComposerOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [activeNote, setActiveNote] = useState<UserNote | null>(null);
  const [noteReplyText, setNoteReplyText] = useState('');
  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup | null>(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyReplyText, setStoryReplyText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [groupCreatorOpen, setGroupCreatorOpen] = useState(false);
  const [groupDraftName, setGroupDraftName] = useState('');
  const [groupMemberQuery, setGroupMemberQuery] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<User[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  useEffect(() => {
    loadChatFlags().then(setChatFlags).catch(() => {});
  }, []);

  const openChat = useCallback((person: User, conversation?: Conversation) => {
    const chatId = getEntityId(person);
    if (!chatId) return;
    const nickname = conversation?.conversation?.nicknames?.[chatId];
    navigation.navigate('ChatRoom', {
      chatId,
      userName: nickname || getUserName(person),
      avatar: person.avatar || person.profilePicture || '',
      user: person,
      mode: 'direct',
      conversation: conversation?.conversation
    });
  }, [navigation]);

  const openGroup = useCallback((group: Group) => {
    const chatId = getEntityId(group);
    if (!chatId) return;
    navigation.navigate('ChatRoom', {
      chatId,
      userName: group.name || 'Group chat',
      avatar: group.photo || '',
      mode: 'group',
      group
    });
  }, [navigation]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [conversationRows, contactRows, groupRows, myNoteRow, activeNoteRows, storyRows] = await Promise.all([
        fetchConversations(),
        fetchContacts().catch(() => []),
        fetchGroups().catch(() => []),
        fetchMyNote().catch(() => null),
        fetchActiveNotes().catch(() => []),
        fetchStoryGroups().catch(() => [])
      ]);
      setConversations(conversationRows);
      setContacts(contactRows);
      setGroups(groupRows);
      setMyNote(myNoteRow);
      setNoteDraft(myNoteRow?.text || '');
      setActiveNotes(activeNoteRows);
      setStoryGroups(storyRows);
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
      const reloadSocial = () => {
        if (!mounted) return;
        Promise.all([
          fetchMyNote().catch(() => null),
          fetchActiveNotes().catch(() => []),
          fetchStoryGroups().catch(() => [])
        ]).then(([nextMyNote, nextNotes, nextStories]) => {
          if (!mounted) return;
          setMyNote(nextMyNote);
          setActiveNotes(nextNotes);
          setStoryGroups(nextStories);
        }).catch(() => {});
      };
      const announceOnline = () => {
        if (!currentUserId) return;
        socket.emit('user-online', currentUserId, (ids: string[] = []) => {
          if (mounted) setOnlineUserIds(new Set(ids.map(String)));
        });
        socket.emit('get-online-users', (ids: string[] = []) => {
          if (mounted) setOnlineUserIds(new Set(ids.map(String)));
        });
      };

      socket.on('connect', announceOnline);
      socket.on('receiveMessage', reload);
      socket.on('message-updated', reload);
      socket.on('message-hidden', reload);
      socket.on('conversation-deleted', reload);
      socket.on('group-updated', reload);
      socket.on('user-note-updated', reloadSocial);
      socket.on('user-note-deleted', reloadSocial);
      socket.on('story-updated', reloadSocial);
      socket.on('story-deleted', reloadSocial);
      if (socket.connected) announceOnline();
      else socket.connect();

      cleanup = () => {
        socket.off('connect', announceOnline);
        socket.off('receiveMessage', reload);
        socket.off('message-updated', reload);
        socket.off('message-hidden', reload);
        socket.off('conversation-deleted', reload);
        socket.off('group-updated', reload);
        socket.off('user-note-updated', reloadSocial);
        socket.off('user-note-deleted', reloadSocial);
        socket.off('story-updated', reloadSocial);
        socket.off('story-deleted', reloadSocial);
      };
    };

    setup();
    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [currentUserId, refresh]);

  const setFlag = async (flag: keyof ChatFlagState, chatId: string) => {
    setChatFlags(prev => {
      const next = toggleChatFlag(prev, flag, chatId);
      saveChatFlags(next).catch(() => {});
      return next;
    });
  };

  const filteredConversations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = conversations.filter(item => {
      const chatId = getEntityId(item.user);
      const name = item.conversation?.nicknames?.[chatId] || item.user?.name || item.user?.email || '';
      const matchesQuery = needle ? name.toLowerCase().includes(needle) : true;
      if (!matchesQuery) return false;
      if (conversationFilter === 'pinned') return hasChatFlag(chatFlags, 'pinned', chatId);
      if (conversationFilter === 'favorites') return hasChatFlag(chatFlags, 'favorites', chatId);
      if (conversationFilter === 'muted') return hasChatFlag(chatFlags, 'muted', chatId);
      if (conversationFilter === 'unread') return Boolean(item.unreadCount);
      return true;
    });

    return [...rows].sort((a, b) => {
      const aPinned = hasChatFlag(chatFlags, 'pinned', getEntityId(a.user)) ? 1 : 0;
      const bPinned = hasChatFlag(chatFlags, 'pinned', getEntityId(b.user)) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.lastTime || 0).getTime() - new Date(a.lastTime || 0).getTime();
    });
  }, [chatFlags, conversationFilter, conversations, query]);

  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = groups.filter(group => {
      const chatId = getEntityId(group);
      const name = group.name || '';
      const matchesQuery = needle ? name.toLowerCase().includes(needle) : true;
      if (!matchesQuery) return false;
      if (conversationFilter === 'pinned') return hasChatFlag(chatFlags, 'pinned', chatId);
      if (conversationFilter === 'favorites') return hasChatFlag(chatFlags, 'favorites', chatId);
      if (conversationFilter === 'muted') return hasChatFlag(chatFlags, 'muted', chatId);
      if (conversationFilter === 'unread') return false;
      return true;
    });

    return [...rows].sort((a, b) => {
      const aPinned = hasChatFlag(chatFlags, 'pinned', getEntityId(a)) ? 1 : 0;
      const bPinned = hasChatFlag(chatFlags, 'pinned', getEntityId(b)) ? 1 : 0;
      return bPinned - aPinned;
    });
  }, [chatFlags, conversationFilter, groups, query]);

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

  const groupMemberResults = useMemo(() => {
    const selectedIds = new Set(selectedGroupMembers.map(member => getEntityId(member)));
    const needle = groupMemberQuery.trim().toLowerCase();
    return contacts.filter(contact => {
      const id = getEntityId(contact);
      if (!id || selectedIds.has(id)) return false;
      const name = `${contact.name || ''} ${contact.email || ''}`.toLowerCase();
      return needle ? name.includes(needle) : true;
    }).slice(0, 40);
  }, [contacts, groupMemberQuery, selectedGroupMembers]);

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

  const saveNote = async () => {
    const text = noteDraft.trim();
    if (!text || savingNote) return;
    setSavingNote(true);
    try {
      const note = await saveMyNote(text);
      setMyNote(note);
      setActiveNotes(prev => [note, ...prev.filter(item => getEntityId(item) !== getEntityId(note))]);
      setNoteComposerOpen(false);
    } catch {
      Alert.alert('Note failed', 'Could not save your note.');
    } finally {
      setSavingNote(false);
    }
  };

  const removeMyNote = async () => {
    try {
      await deleteMyNote();
      setMyNote(null);
      setNoteDraft('');
      setNoteComposerOpen(false);
      refresh();
    } catch {
      Alert.alert('Delete failed', 'Could not delete your note.');
    }
  };

  const openNote = async (note: UserNote) => {
    setActiveNote(note);
    setNoteReplyText('');
    const noteId = getEntityId(note);
    if (noteId) viewNote(noteId).catch(() => {});
  };

  const submitNoteReaction = async (emoji: string) => {
    const noteId = getEntityId(activeNote);
    if (!noteId) return;
    try {
      const note = await reactToNote(noteId, emoji);
      setActiveNote(note);
      setActiveNotes(prev => prev.map(item => (getEntityId(item) === noteId ? note : item)));
    } catch {
      Alert.alert('Reaction failed', 'Could not react to this note.');
    }
  };

  const submitNoteReply = async () => {
    const noteId = getEntityId(activeNote);
    const text = noteReplyText.trim();
    if (!noteId || !text) return;
    try {
      const note = await replyToNote(noteId, text);
      setActiveNote(note);
      setNoteReplyText('');
    } catch {
      Alert.alert('Reply failed', 'Could not reply to this note.');
    }
  };

  const openStory = (group: StoryGroup) => {
    setActiveStoryGroup(group);
    setStoryIndex(0);
    setStoryReplyText('');
    const storyId = getEntityId(getStoryPreview(group));
    if (storyId) viewStory(storyId).catch(() => {});
  };

  const activeStory = activeStoryGroup?.stories?.[storyIndex] || activeStoryGroup?.preview;

  useEffect(() => {
    const storyId = getEntityId(activeStory);
    if (storyId) viewStory(storyId).catch(() => {});
  }, [activeStory]);

  const submitStoryReaction = async (emoji: string) => {
    const storyId = getEntityId(activeStory);
    if (!storyId) return;
    try {
      await reactToStory(storyId, emoji);
      refresh();
    } catch {
      Alert.alert('Reaction failed', 'Could not react to this story.');
    }
  };

  const submitStoryReply = async () => {
    const storyId = getEntityId(activeStory);
    const text = storyReplyText.trim();
    if (!storyId || !text) return;
    try {
      await replyToStory(storyId, text);
      setStoryReplyText('');
      setActiveStoryGroup(null);
      refresh();
    } catch {
      Alert.alert('Reply failed', 'Could not reply to this story.');
    }
  };

  const submitGroup = async () => {
    const name = groupDraftName.trim();
    if (!name || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const group = await createGroup({
        name,
        memberIds: selectedGroupMembers.map(member => getEntityId(member)).filter(Boolean)
      });
      setGroups(prev => [group, ...prev.filter(item => getEntityId(item) !== getEntityId(group))]);
      setGroupCreatorOpen(false);
      setGroupDraftName('');
      setGroupMemberQuery('');
      setSelectedGroupMembers([]);
      openGroup(group);
    } catch {
      Alert.alert('Group failed', 'Could not create this group chat.');
    } finally {
      setCreatingGroup(false);
    }
  };

  const showContacts = listMode === 'direct'
    && Boolean(query.trim())
    && filteredContacts.length > 0
    && filteredConversations.length === 0;

  const filters: Array<{ id: ConversationFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'pinned', label: 'Pinned' },
    { id: 'unread', label: 'Unread' },
    { id: 'favorites', label: 'Stars' },
    { id: 'muted', label: 'Muted' }
  ];

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

        <View className="mt-3 flex-row rounded-2xl bg-slate-100 p-1">
          {(['direct', 'groups'] as ListMode[]).map(mode => (
            <Pressable
              className={`h-9 flex-1 flex-row items-center justify-center gap-2 rounded-xl ${listMode === mode ? 'bg-white shadow-sm shadow-slate-200' : ''}`}
              key={mode}
              onPress={() => setListMode(mode)}
            >
              {mode === 'direct' ? <MessageCircle color={listMode === mode ? '#0A7CFF' : '#64748B'} size={16} /> : <Users color={listMode === mode ? '#0A7CFF' : '#64748B'} size={16} />}
              <Text className={`text-sm font-semibold ${listMode === mode ? 'text-slate-950' : 'text-slate-500'}`}>
                {mode === 'direct' ? 'Messages' : 'Groups'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView horizontal className="max-h-24 px-4" showsHorizontalScrollIndicator={false}>
        <Pressable className="mr-3 w-20 items-center" onPress={() => setNoteComposerOpen(true)}>
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-blue-600">
            {myNote ? <Edit3 color="#FFFFFF" size={20} /> : <Plus color="#FFFFFF" size={22} />}
          </View>
          <Text className="mt-1 text-center text-[11px] font-semibold text-slate-700" numberOfLines={1}>
            Your note
          </Text>
        </Pressable>

        {storyGroups.map(group => {
          const story = getStoryPreview(group);
          const owner = getStoryOwner(group);
          const uri = story?.fileType === 'image'
            ? resolveMediaVariantUrl({ fileUrl: story.fileUrl || '', fileType: 'image', variants: story.mediaVariants || story.variants })
            : resolveMediaUrl(story?.fileUrl || '');
          return (
            <Pressable className="mr-3 w-20 items-center" key={`story-${group.ownerId || getEntityId(owner)}`} onPress={() => openStory(group)}>
              <View className="h-14 w-14 overflow-hidden rounded-2xl border-2 border-blue-500 bg-slate-200">
                {uri && story?.fileType === 'image' ? <ExpoImage source={{ uri }} style={{ height: 56, width: 56 }} contentFit="cover" /> : <Avatar user={owner} size={56} />}
              </View>
              <Text className="mt-1 text-center text-[11px] font-semibold text-slate-700" numberOfLines={1}>
                {owner.name || 'Story'}
              </Text>
            </Pressable>
          );
        })}

        {activeNotes.filter(note => getEntityId(note.userId) !== currentUserId).slice(0, 20).map(note => {
          const owner = getNoteOwner(note);
          return (
            <Pressable className="mr-3 w-20 items-center" key={`note-${getEntityId(note)}`} onPress={() => openNote(note)}>
              <View>
                <Avatar user={owner} size={56} sharedTag={`note-${getEntityId(note)}`} />
                <View className="absolute -right-2 -top-1 max-w-[54px] rounded-2xl bg-white px-2 py-1 shadow-sm shadow-slate-200">
                  <Text className="text-[10px] font-semibold text-slate-700" numberOfLines={2}>
                    {note.text}
                  </Text>
                </View>
              </View>
              <Text className="mt-1 text-center text-[11px] font-semibold text-slate-700" numberOfLines={1}>
                {owner?.name || 'Note'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="px-4 pb-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filters.map(filter => (
            <Pressable
              className={`mr-2 h-9 justify-center rounded-full px-4 ${conversationFilter === filter.id ? 'bg-slate-950' : 'bg-slate-100'}`}
              key={filter.id}
              onPress={() => setConversationFilter(filter.id)}
            >
              <Text className={`text-sm font-semibold ${conversationFilter === filter.id ? 'text-white' : 'text-slate-600'}`}>
                {filter.label}
              </Text>
            </Pressable>
          ))}
          {listMode === 'groups' ? (
            <Pressable className="h-9 flex-row items-center gap-1 rounded-full bg-blue-600 px-4" onPress={() => setGroupCreatorOpen(true)}>
              <Plus color="#FFFFFF" size={16} />
              <Text className="text-sm font-semibold text-white">Create</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      {showContacts ? (
        <ContactsList contacts={filteredContacts} onSelect={openChat} />
      ) : listMode === 'groups' ? (
        <FlashList
          data={filteredGroups}
          keyExtractor={(item, index) => getEntityId(item) || `group-${index}`}
          ListEmptyComponent={
            <EmptyState
              title={loading ? 'Loading groups' : 'No group chats'}
              body={loading ? undefined : 'Create a group chat with classmates.'}
            />
          }
          onRefresh={refresh}
          refreshing={refreshing}
          renderItem={({ item }) => {
            const chatId = getEntityId(item);
            return (
              <GroupListItem
                favorite={hasChatFlag(chatFlags, 'favorites', chatId)}
                group={item}
                muted={hasChatFlag(chatFlags, 'muted', chatId)}
                onPress={() => openGroup(item)}
                pinned={hasChatFlag(chatFlags, 'pinned', chatId)}
              />
            );
          }}
        />
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
          renderItem={({ item }) => {
            const chatId = getEntityId(item.user);
            const nickname = item.conversation?.nicknames?.[chatId];
            return (
              <ChatListItem
                displayName={nickname}
                favorite={hasChatFlag(chatFlags, 'favorites', chatId)}
                item={item}
                muted={hasChatFlag(chatFlags, 'muted', chatId)}
                onDelete={() => removeConversation(item)}
                onPress={() => openChat(item.user, item)}
                online={onlineUserIds.has(chatId)}
                pinned={hasChatFlag(chatFlags, 'pinned', chatId)}
              />
            );
          }}
        />
      )}

      <Modal animationType="slide" transparent visible={noteComposerOpen} onRequestClose={() => setNoteComposerOpen(false)}>
        <View className="flex-1 justify-end bg-black/35">
          <View className="rounded-t-[28px] bg-white p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-slate-950">Your note</Text>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-slate-100" onPress={() => setNoteComposerOpen(false)}>
                <X color="#0F172A" size={18} />
              </Pressable>
            </View>
            <TextInput
              className="min-h-24 rounded-2xl bg-slate-100 px-4 py-3 text-[16px] text-slate-950"
              maxLength={140}
              multiline
              onChangeText={setNoteDraft}
              placeholder="Share a note"
              placeholderTextColor="#94A3B8"
              value={noteDraft}
            />
            <View className="mt-3 flex-row gap-2">
              {myNote ? (
                <Pressable className="h-12 w-12 items-center justify-center rounded-2xl bg-red-50" onPress={removeMyNote}>
                  <Trash2 color="#DC2626" size={18} />
                </Pressable>
              ) : null}
              <Pressable
                className={`h-12 flex-1 items-center justify-center rounded-2xl ${noteDraft.trim() ? 'bg-blue-600' : 'bg-slate-300'}`}
                disabled={!noteDraft.trim() || savingNote}
                onPress={saveNote}
              >
                {savingNote ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-bold text-white">Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={Boolean(activeNote)} onRequestClose={() => setActiveNote(null)}>
        <View className="flex-1 justify-end bg-black/45">
          <View className="rounded-t-[28px] bg-white p-4">
            <View className="flex-row items-center gap-3">
              <Avatar user={getNoteOwner(activeNote)} size={46} />
              <View className="min-w-0 flex-1">
                <Text className="font-bold text-slate-950" numberOfLines={1}>{getUserName(getNoteOwner(activeNote))}</Text>
                <Text className="text-xs text-slate-500" numberOfLines={1}>Note</Text>
              </View>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-slate-100" onPress={() => setActiveNote(null)}>
                <X color="#0F172A" size={18} />
              </Pressable>
            </View>
            <Text className="mt-5 text-2xl font-black text-slate-950">{activeNote?.text}</Text>
            <View className="mt-5 flex-row gap-2">
              {QUICK_REACTIONS.map(emoji => (
                <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-slate-100" key={emoji} onPress={() => submitNoteReaction(emoji)}>
                  <Text className="text-xl">{emoji}</Text>
                </Pressable>
              ))}
            </View>
            <View className="mt-4 flex-row items-center gap-2">
              <TextInput
                className="h-12 flex-1 rounded-3xl bg-slate-100 px-4 text-[15px] text-slate-950"
                onChangeText={setNoteReplyText}
                placeholder="Reply"
                placeholderTextColor="#94A3B8"
                value={noteReplyText}
              />
              <Pressable className={`h-12 px-5 items-center justify-center rounded-3xl ${noteReplyText.trim() ? 'bg-blue-600' : 'bg-slate-300'}`} onPress={submitNoteReply}>
                <Text className="font-bold text-white">Send</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={Boolean(activeStoryGroup)} onRequestClose={() => setActiveStoryGroup(null)}>
        <View className="flex-1 bg-black/90 px-4 pb-8 pt-14">
          <View className="mb-3 flex-row items-center gap-3">
            <Avatar user={getStoryOwner(activeStoryGroup)} size={42} />
            <View className="min-w-0 flex-1">
              <Text className="font-bold text-white" numberOfLines={1}>{getUserName(getStoryOwner(activeStoryGroup))}</Text>
              <Text className="text-xs text-white/60" numberOfLines={1}>{activeStory?.caption || 'My Day'}</Text>
            </View>
            <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-white/10" onPress={() => setActiveStoryGroup(null)}>
              <X color="#FFFFFF" size={20} />
            </Pressable>
          </View>
          <View className="flex-1 justify-center overflow-hidden rounded-[28px] bg-black">
            {activeStory?.fileType === 'video' ? (
              <StoryVideo uri={resolveMediaUrl(activeStory.fileUrl || '')} />
            ) : activeStory?.fileUrl ? (
              <ExpoImage
                contentFit="contain"
                source={{ uri: resolveMediaVariantUrl({ fileUrl: activeStory.fileUrl, fileType: 'image', variants: activeStory.mediaVariants || activeStory.variants }) }}
                style={{ flex: 1, width: '100%' }}
              />
            ) : null}
          </View>
          <View className="mt-3 flex-row justify-between">
            <Pressable
              className="h-10 justify-center rounded-full bg-white/10 px-4"
              disabled={storyIndex <= 0}
              onPress={() => setStoryIndex(index => Math.max(0, index - 1))}
            >
              <Text className="font-bold text-white/90">Prev</Text>
            </Pressable>
            <View className="flex-row gap-2">
              {QUICK_REACTIONS.slice(0, 4).map(emoji => (
                <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-white/10" key={emoji} onPress={() => submitStoryReaction(emoji)}>
                  <Text className="text-xl">{emoji}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              className="h-10 justify-center rounded-full bg-white/10 px-4"
              disabled={storyIndex >= ((activeStoryGroup?.stories?.length || 1) - 1)}
              onPress={() => setStoryIndex(index => Math.min((activeStoryGroup?.stories?.length || 1) - 1, index + 1))}
            >
              <Text className="font-bold text-white/90">Next</Text>
            </Pressable>
          </View>
          <View className="mt-3 flex-row items-center gap-2">
            <TextInput
              className="h-12 flex-1 rounded-3xl bg-white/12 px-4 text-[15px] text-white"
              onChangeText={setStoryReplyText}
              placeholder="Reply"
              placeholderTextColor="rgba(255,255,255,0.55)"
              value={storyReplyText}
            />
            <Pressable className={`h-12 px-5 items-center justify-center rounded-3xl ${storyReplyText.trim() ? 'bg-blue-600' : 'bg-white/15'}`} onPress={submitStoryReply}>
              <Text className="font-bold text-white">Send</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={groupCreatorOpen} onRequestClose={() => setGroupCreatorOpen(false)}>
        <View className="flex-1 justify-end bg-black/35">
          <View className="max-h-[82%] rounded-t-[28px] bg-white p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-slate-950">Create group chat</Text>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-slate-100" onPress={() => setGroupCreatorOpen(false)}>
                <X color="#0F172A" size={18} />
              </Pressable>
            </View>
            <TextInput
              className="h-12 rounded-2xl bg-slate-100 px-4 text-[15px] text-slate-950"
              onChangeText={setGroupDraftName}
              placeholder="Group name"
              placeholderTextColor="#94A3B8"
              value={groupDraftName}
            />
            {selectedGroupMembers.length ? (
              <ScrollView horizontal className="mt-3" showsHorizontalScrollIndicator={false}>
                {selectedGroupMembers.map(member => (
                  <Pressable
                    className="mr-2 flex-row items-center gap-2 rounded-full bg-blue-50 py-1 pl-1 pr-3"
                    key={getEntityId(member)}
                    onPress={() => setSelectedGroupMembers(prev => prev.filter(item => getEntityId(item) !== getEntityId(member)))}
                  >
                    <Avatar user={member} size={28} />
                    <Text className="text-xs font-semibold text-blue-700" numberOfLines={1}>{getUserName(member)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <TextInput
              className="mt-3 h-12 rounded-2xl bg-slate-100 px-4 text-[15px] text-slate-950"
              onChangeText={setGroupMemberQuery}
              placeholder="Search members"
              placeholderTextColor="#94A3B8"
              value={groupMemberQuery}
            />
            <View className="mt-3 h-72">
              <FlashList
                data={groupMemberResults}
                keyExtractor={(item, index) => getEntityId(item) || `member-${index}`}
                renderItem={({ item }) => (
                  <Pressable
                    className="h-14 flex-row items-center gap-3 rounded-2xl px-2"
                    onPress={() => setSelectedGroupMembers(prev => [...prev, item])}
                  >
                    <Avatar user={item} size={38} />
                    <Text className="flex-1 font-semibold text-slate-900" numberOfLines={1}>{getUserName(item)}</Text>
                    <Check color="#0A7CFF" size={18} />
                  </Pressable>
                )}
              />
            </View>
            <Pressable
              className={`mt-3 h-12 items-center justify-center rounded-2xl ${groupDraftName.trim() ? 'bg-blue-600' : 'bg-slate-300'}`}
              disabled={!groupDraftName.trim() || creatingGroup}
              onPress={submitGroup}
            >
              {creatingGroup ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-bold text-white">Create</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
