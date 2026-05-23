export type EntityId = string;

export type User = {
  _id?: EntityId;
  id?: EntityId;
  name?: string;
  email?: string;
  avatar?: string;
  coverPhoto?: string;
  lastSeen?: string;
  bio?: string;
  course?: string;
  campus?: string;
  isDeveloper?: boolean;
};

export type MessageAttachment = {
  fileUrl: string;
  fileType?: 'image' | 'video' | 'audio' | 'file' | string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  storagePath?: string;
  storageProvider?: string;
  variants?: Record<string, string | { fileUrl?: string; url?: string }>;
};

export type Message = {
  _id?: EntityId;
  id?: EntityId;
  clientId?: string;
  from?: User | EntityId;
  to?: User | EntityId;
  text?: string;
  createdAt?: string;
  read?: boolean;
  readAt?: string;
  editedAt?: string;
  unsent?: boolean;
  system?: boolean;
  replyTo?: Message | EntityId | null;
  reactions?: Array<{ emoji: string; userId?: User | EntityId }>;
  attachments?: MessageAttachment[];
  fileUrl?: string;
  fileType?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
};

export type Conversation = {
  user: User;
  lastMessage?: string;
  lastTime?: string;
  unreadCount?: number;
  conversation?: {
    backgroundId?: string;
    nicknames?: Record<string, string>;
  };
};

export type UploadedAttachment = {
  fileUrl: string;
  fileType: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  storagePath?: string;
  storageProvider?: string;
  variants?: Record<string, unknown>;
};

export type RootStackParamList = {
  Login: undefined;
  ChatList: undefined;
  ChatRoom: {
    chatId: string;
    userName: string;
    avatar?: string;
    user?: User;
  };
  Profile: undefined;
  Settings: undefined;
};
