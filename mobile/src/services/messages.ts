import type { ImagePickerAsset } from 'expo-image-picker';
import api from './api';
import type {
  ChatStreak,
  Conversation,
  ConversationSettings,
  Group,
  GroupMessage,
  Message,
  Story,
  StoryGroup,
  UploadedAttachment,
  User,
  UserNote
} from '../types';

export const fetchConversations = async () => {
  const res = await api.get<Conversation[]>('/messages/conversations');
  return Array.isArray(res.data) ? res.data : [];
};

export const fetchMessages = async (chatId: string, before?: string) => {
  const res = await api.get<{
    items: Message[];
    hasMore: boolean;
    nextCursor?: string | null;
    conversation?: ConversationSettings;
  } | Message[]>(
    `/messages/${chatId}`,
    {
      params: {
        paginated: 1,
        limit: before ? 56 : 64,
        before
      }
    }
  );

  if (Array.isArray(res.data)) {
    return { items: res.data, hasMore: false, nextCursor: undefined, conversation: undefined };
  }

  return {
    items: Array.isArray(res.data?.items) ? res.data.items : [],
    hasMore: Boolean(res.data?.hasMore),
    nextCursor: res.data?.nextCursor || undefined,
    conversation: res.data?.conversation
  };
};

export const markMessagesRead = (chatId: string) => api.put(`/messages/read/${chatId}`);

export const deleteConversation = (chatId: string) => api.delete(`/messages/conversation/${chatId}`);

export const fetchChatStreak = async (chatId: string) => {
  const res = await api.get<ChatStreak>(`/messages/streak/${chatId}`);
  return res.data;
};

export const updateConversationBackground = async (chatId: string, backgroundId: string) => {
  const res = await api.put<{
    conversation?: ConversationSettings;
    backgroundId?: string;
    changed?: boolean;
    message?: Message | null;
  }>(`/messages/${chatId}/background`, { backgroundId });
  return res.data;
};

export const updateConversationNickname = async (chatId: string, nickname: string) => {
  const res = await api.put<{
    conversation?: ConversationSettings;
    nickname?: string;
    changed?: boolean;
    message?: Message | null;
  }>(`/messages/${chatId}/nickname`, { nickname });
  return res.data;
};

export const editMessage = async (messageId: string, text: string) => {
  const res = await api.put<Message>(`/messages/${messageId}`, { text });
  return res.data;
};

export const reactToMessage = async (messageId: string, emoji: string) => {
  const res = await api.post<Message>(`/messages/${messageId}/react`, { emoji });
  return res.data;
};

export const pinMessage = async (messageId: string) => {
  const res = await api.put<Message>(`/messages/${messageId}/pin`);
  return res.data;
};

export const hideMessageForMe = async (messageId: string) => api.delete(`/messages/${messageId}/me`);

export const unsendMessageForEveryone = async (messageId: string) => {
  const res = await api.delete<Message>(`/messages/${messageId}/everyone`);
  return res.data;
};

export const uploadMessageAsset = async (asset: ImagePickerAsset): Promise<UploadedAttachment> => {
  const fileName = asset.fileName || `syncrova-${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`;
  const mimeType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
  const formData = new FormData();

  formData.append('file', {
    uri: asset.uri,
    name: fileName,
    type: mimeType
  } as unknown as Blob);

  const res = await api.post<UploadedAttachment>('/messages/upload', formData);
  return res.data;
};

export const uploadLocalMessageAsset = async (asset: {
  uri: string;
  fileName: string;
  mimeType: string;
  fileType: string;
  durationMs?: number;
}): Promise<UploadedAttachment> => {
  const formData = new FormData();

  formData.append('file', {
    uri: asset.uri,
    name: asset.fileName,
    type: asset.mimeType
  } as unknown as Blob);

  const res = await api.post<UploadedAttachment>('/messages/upload', formData);
  return {
    ...res.data,
    fileName: res.data.fileName || asset.fileName,
    fileType: asset.fileType || res.data.fileType,
    mimeType: res.data.mimeType || asset.mimeType,
    durationMs: asset.durationMs || 0
  };
};

export const sendMessage = async (payload: {
  to: string;
  text?: string;
  replyTo?: string;
  attachments?: UploadedAttachment[];
}) => {
  const body: Record<string, unknown> = {
    to: payload.to,
    text: payload.text || ''
  };

  if (payload.replyTo) body.replyTo = payload.replyTo;
  if (payload.attachments?.length) {
    body.attachments = payload.attachments;
    Object.assign(body, payload.attachments[0]);
  }

  const res = await api.post<Message>('/messages', body);
  return res.data;
};

export const fetchContacts = async () => {
  const res = await api.get<{ friends?: Array<{ user?: User } | User> }>('/friends/summary');
  const rows = Array.isArray(res.data?.friends) ? res.data.friends : [];
  return rows
    .map(item => ('user' in item ? item.user : item))
    .filter(Boolean) as User[];
};

export const fetchOnlineUsers = async () => {
  const res = await api.get<string[] | { users?: string[]; userIds?: string[] }>('/presence/online');
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.data?.userIds)) return res.data.userIds;
  if (Array.isArray(res.data?.users)) return res.data.users;
  return [];
};

export const fetchUserPresence = async (userId: string) => {
  const res = await api.get<{ online?: boolean; lastSeen?: string | null }>(`/presence/online/${userId}`);
  return {
    online: Boolean(res.data?.online),
    lastSeen: res.data?.lastSeen || null
  };
};

export const fetchGroups = async () => {
  const res = await api.get<Group[]>('/groups');
  return Array.isArray(res.data) ? res.data : [];
};

export const createGroup = async (payload: { name: string; memberIds: string[] }) => {
  const res = await api.post<Group>('/groups', payload);
  return res.data;
};

export const updateGroupBackground = async (groupId: string, backgroundId: string) => {
  const res = await api.put<{ group?: Group; backgroundId?: string; changed?: boolean; message?: GroupMessage | null }>(
    `/groups/${groupId}/background`,
    { backgroundId }
  );
  return res.data;
};

export const fetchGroupMessages = async (groupId: string) => {
  const res = await api.get<GroupMessage[]>(`/group-chat/${groupId}`);
  return Array.isArray(res.data) ? res.data : [];
};

export const markGroupMessagesSeen = (groupId: string, messageIds?: string[]) => (
  api.put(`/group-chat/${groupId}/seen`, { messageIds: messageIds || [] })
);

export const sendGroupMessage = async (payload: {
  groupId: string;
  text?: string;
  fileUrl?: string;
  fileType?: string;
  replyTo?: string;
}) => {
  const res = await api.post<GroupMessage>('/group-chat', payload);
  return res.data;
};

export const reactToGroupMessage = async (messageId: string, emoji: string) => {
  const res = await api.post<GroupMessage>(`/group-chat/${messageId}/react`, { emoji });
  return res.data;
};

export const pinGroupMessage = async (messageId: string) => {
  const res = await api.put<GroupMessage>(`/group-chat/${messageId}/pin`);
  return res.data;
};

export const hideGroupMessageForMe = async (messageId: string) => api.delete(`/group-chat/me/${messageId}`);

export const deleteGroupMessageForEveryone = async (messageId: string) => (
  api.delete(`/group-chat/everyone/${messageId}`)
);

export const fetchMyNote = async () => {
  const res = await api.get<UserNote | null>('/notes/me');
  return res.data || null;
};

export const fetchActiveNotes = async () => {
  const res = await api.get<UserNote[]>('/notes/active');
  return Array.isArray(res.data) ? res.data : [];
};

export const saveMyNote = async (text: string) => {
  const res = await api.post<UserNote>('/notes/me', { text });
  return res.data;
};

export const deleteMyNote = () => api.delete('/notes/me');

export const reactToNote = async (noteId: string, emoji: string) => {
  const res = await api.post<UserNote>(`/notes/${noteId}/react`, { emoji });
  return res.data;
};

export const viewNote = async (noteId: string) => {
  const res = await api.post<UserNote>(`/notes/${noteId}/view`);
  return res.data;
};

export const replyToNote = async (noteId: string, text: string) => {
  const res = await api.post<UserNote>(`/notes/${noteId}/comments`, { text });
  return res.data;
};

export const fetchStoryGroups = async () => {
  const res = await api.get<{ groups?: StoryGroup[]; stories?: Story[] }>('/stories/active/grouped');
  return Array.isArray(res.data?.groups) ? res.data.groups : [];
};

export const viewStory = async (storyId: string) => {
  const res = await api.post<Story>(`/stories/${storyId}/view`);
  return res.data;
};

export const reactToStory = async (storyId: string, emoji: string) => {
  const res = await api.post<Story>(`/stories/${storyId}/react`, { emoji });
  return res.data;
};

export const replyToStory = async (storyId: string, text: string) => {
  const res = await api.post<{ story?: Story; message?: Message }>(`/stories/${storyId}/comment`, { text });
  return res.data;
};
