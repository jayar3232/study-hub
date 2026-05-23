import type { ImagePickerAsset } from 'expo-image-picker';
import api from './api';
import type { Conversation, Message, UploadedAttachment, User } from '../types';

export const fetchConversations = async () => {
  const res = await api.get<Conversation[]>('/messages/conversations');
  return Array.isArray(res.data) ? res.data : [];
};

export const fetchMessages = async (chatId: string, before?: string) => {
  const res = await api.get<{ items: Message[]; hasMore: boolean; nextCursor?: string | null } | Message[]>(
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
    return { items: res.data, hasMore: false, nextCursor: undefined };
  }

  return {
    items: Array.isArray(res.data?.items) ? res.data.items : [],
    hasMore: Boolean(res.data?.hasMore),
    nextCursor: res.data?.nextCursor || undefined
  };
};

export const markMessagesRead = (chatId: string) => api.put(`/messages/read/${chatId}`);

export const deleteConversation = (chatId: string) => api.delete(`/messages/conversation/${chatId}`);

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
