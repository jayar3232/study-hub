import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCheck,
  FileText,
  Image as ImageIcon,
  Info,
  MoreVertical,
  Pin,
  PinOff,
  Reply,
  Search,
  Send,
  Smile,
  Users,
  Video,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { optimizeImageFile, resolveMediaUrl } from '../utils/media';
import { playUiSound } from '../utils/sound';
import LoadingSpinner from './LoadingSpinner';
import MediaViewer from './MediaViewer';
import VideoThumbnail from './VideoThumbnail';

let socket;

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🔥', '👏', '✅'];
const GROUP_MESSAGE_RENDER_BATCH = 140;
const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');
const getUserInitial = (name) => (name ? name.charAt(0).toUpperCase() : '?');
const getFileName = (value = '') => {
  try {
    const cleanValue = value.split('?')[0];
    return decodeURIComponent(cleanValue.split('/').pop() || 'Attachment');
  } catch {
    return value.split('/').pop() || 'Attachment';
  }
};

export default function GroupChat({ groupId, group, members = [], onUserClick }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [visibleMessageCount, setVisibleMessageCount] = useState(GROUP_MESSAGE_RENDER_BATCH);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [viewerMedia, setViewerMedia] = useState(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [search, setSearch] = useState('');
  const [showPinned, setShowPinned] = useState(true);
  const messagesEndRef = useRef(null);
  const currentUserId = getEntityId(user);

  const scrollToBottom = (behavior = 'smooth') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    });
  };

  const upsertMessage = (nextMessage) => {
    setMessages(prev => prev.map(message => (
      getEntityId(message) === getEntityId(nextMessage) ? nextMessage : message
    )));
  };

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/group-chat/${groupId}`);
      setMessages(res.data || []);
      scrollToBottom('auto');
    } catch (err) {
      console.error('Fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesSeen = async (messageIds = []) => {
    if (!groupId || !currentUserId) return;
    try {
      await api.put(`/group-chat/${groupId}/seen`, { messageIds });
    } catch (err) {
      console.error('Seen update error', err);
    }
  };

  const sendTextMessage = async (text) => {
    if (!text.trim()) return;

    const trimmedText = text.trim();
    const replyTo = getEntityId(replyingTo);
    setNewMessage('');
    setReplyingTo(null);

    try {
      const res = await api.post('/group-chat', { groupId, text: trimmedText, replyTo: replyTo || undefined });
      playUiSound('send');
      socket.emit('send-group-message', { groupId, message: res.data });
    } catch (err) {
      console.error('Send error', err);
      setNewMessage(trimmedText);
      setReplyingTo(replyingTo);
    }
  };

  const sendMediaMessage = async (file, type) => {
    if (!file) return;

    setUploading(true);
    const uploadFile = type === 'image' ? await optimizeImageFile(file) : file;
    const formData = new FormData();
    formData.append('file', uploadFile);
    const replyTo = getEntityId(replyingTo);

    try {
      const uploadRes = await api.post(`/files/upload/${groupId}`, formData);
      const fileUrl = uploadRes.data.url || uploadRes.data.fileUrl || `/uploads/${uploadRes.data.filename}`;
      const text = type === 'image' ? 'Sent an image' : 'Sent a video';
      const res = await api.post('/group-chat', { groupId, text, fileUrl, fileType: type, replyTo: replyTo || undefined });
      playUiSound('send');
      socket.emit('send-group-message', { groupId, message: res.data });
      setReplyingTo(null);
    } catch (err) {
      console.error('Media upload error', err);
    } finally {
      setUploading(false);
      setSelectedMedia(null);
      setMediaPreview(null);
      setMediaType(null);
    }
  };

  const handleFileSelect = (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setSelectedMedia(file);
    setMediaType(type);
    setMediaPreview(URL.createObjectURL(file));
    event.target.value = '';
  };

  const cancelMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setSelectedMedia(null);
    setMediaPreview(null);
    setMediaType(null);
  };

  const deleteForMe = async (messageId) => {
    try {
      await api.delete(`/group-chat/me/${messageId}`);
      setMessages(prev => prev.filter(message => getEntityId(message) !== messageId));
      setActiveMenuMessageId(null);
    } catch (err) {
      console.error('Delete for me error', err);
    }
  };

  const deleteForEveryone = async (messageId) => {
    if (!window.confirm('Unsend this message for everyone? It will be removed for all members.')) return;

    try {
      await api.delete(`/group-chat/everyone/${messageId}`);
      socket.emit('delete-message-for-everyone', { messageId, groupId });
      setActiveMenuMessageId(null);
    } catch (err) {
      console.error('Delete for everyone error', err);
    }
  };

  const reactToMessage = async (messageId, emoji) => {
    try {
      const res = await api.post(`/group-chat/${messageId}/react`, { emoji });
      upsertMessage(res.data);
      setReactionPickerMessageId(null);
    } catch (err) {
      console.error('React error', err);
    }
  };

  const togglePinMessage = async (messageId) => {
    try {
      const res = await api.put(`/group-chat/${messageId}/pin`);
      upsertMessage(res.data);
      setActiveMenuMessageId(null);
    } catch (err) {
      console.error('Pin error', err);
    }
  };

  const renderAvatar = (person, sizeClass = 'h-8 w-8', clickable = false) => {
    const avatar = resolveMediaUrl(person?.avatar);
    const content = avatar ? (
      <img src={avatar} alt={person?.name || 'User'} className="h-full w-full object-cover" />
    ) : (
      getUserInitial(person?.name)
    );

    if (clickable && person) {
      return (
        <button
          type="button"
          onClick={() => onUserClick?.(person)}
          className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-xs font-bold text-white shadow-sm ring-2 ring-transparent transition hover:ring-pink-300`}
          title={`View ${person?.name || 'profile'}`}
        >
          {content}
        </button>
      );
    }

    return (
      <div className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-xs font-bold text-white shadow-sm`}>
        {content}
      </div>
    );
  };

  const getSeenUsers = (message) => {
    const senderId = getEntityId(message.userId);
    return (message.seenBy || [])
      .map(entry => entry?.userId || entry)
      .filter(person => {
        const personId = getEntityId(person);
        return personId && personId !== senderId && personId !== currentUserId;
      });
  };

  const filteredMessages = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return messages;

    return messages.filter(message => {
      const senderName = message.userId?.name || '';
      const replyText = message.replyTo?.text || '';
      const fileName = getFileName(message.fileUrl || '');
      return [message.text, senderName, replyText, fileName]
        .some(value => String(value || '').toLowerCase().includes(term));
    });
  }, [messages, search]);

  const groupSearchActive = Boolean(search.trim());
  const renderedMessages = useMemo(() => {
    if (groupSearchActive) return filteredMessages;
    return filteredMessages.slice(-visibleMessageCount);
  }, [filteredMessages, groupSearchActive, visibleMessageCount]);
  const hiddenMessageCount = Math.max(0, filteredMessages.length - renderedMessages.length);

  const pinnedMessages = useMemo(
    () => messages.filter(message => message.pinned).sort((a, b) => new Date(b.pinnedAt || b.createdAt) - new Date(a.pinnedAt || a.createdAt)),
    [messages]
  );

  const sharedMediaCount = useMemo(
    () => messages.filter(message => ['image', 'video'].includes(message.fileType)).length,
    [messages]
  );

  const ReactionSummary = ({ message }) => {
    if (!message.reactions?.length) return null;
    const counts = message.reactions.reduce((map, reaction) => {
      map[reaction.emoji] = (map[reaction.emoji] || 0) + 1;
      return map;
    }, {});

    return (
      <div className="mt-1.5 flex flex-wrap gap-1">
        {Object.entries(counts).map(([emoji, count]) => (
          <button
            key={emoji}
            type="button"
            onClick={() => reactToMessage(getEntityId(message), emoji)}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-bold text-gray-700 shadow-sm transition hover:border-pink-200 hover:bg-pink-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-pink-900/60 dark:hover:bg-pink-950/20"
          >
            <span>{emoji}</span>
            <span>{count}</span>
          </button>
        ))}
      </div>
    );
  };

  const SeenStatus = ({ message }) => {
    const seenUsers = getSeenUsers(message);
    if (seenUsers.length === 0) {
      return (
        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] font-medium text-gray-400">
          <CheckCheck size={13} />
          <span>Sent</span>
        </div>
      );
    }

    const names = seenUsers.slice(0, 2).map(person => person.name || 'Someone').join(', ');
    const extraCount = seenUsers.length - 2;
    const label = extraCount > 0 ? `${names} +${extraCount}` : names;

    return (
      <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] font-medium text-sky-500">
        <div className="flex -space-x-1">
          {seenUsers.slice(0, 3).map(person => (
            <div key={getEntityId(person)} className="rounded-full border border-white dark:border-gray-950">
              {renderAvatar(person, 'h-4 w-4', true)}
            </div>
          ))}
        </div>
        <span>Seen by {label}</span>
      </div>
    );
  };

  const ReplyPreview = ({ message, compact = false }) => {
    if (!message) return null;
    const mediaLabel = message.fileType === 'image' ? 'Photo' : message.fileType === 'video' ? 'Video' : 'Message';
    return (
      <div className={`mb-2 rounded-xl border-l-4 border-pink-400 bg-black/5 px-3 py-2 text-left dark:bg-white/10 ${compact ? 'text-xs' : 'text-sm'}`}>
        <p className="font-bold text-gray-700 dark:text-gray-100">{message.userId?.name || 'Member'}</p>
        <p className="line-clamp-1 text-gray-500 dark:text-gray-300">{message.text || mediaLabel}</p>
      </div>
    );
  };

  const renderMessageContent = (message) => {
    if (message.fileUrl && message.fileType === 'image') {
      const mediaUrl = resolveMediaUrl(message.fileUrl);
      return (
        <div className="space-y-2">
          {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
          <img
            src={mediaUrl}
            alt="attachment"
            loading="lazy"
            decoding="async"
            className="mt-1 max-h-72 w-full cursor-pointer rounded-2xl object-contain"
            onClick={() => setViewerMedia({ type: 'image', url: mediaUrl, name: getFileName(message.fileUrl) })}
          />
        </div>
      );
    }

    if (message.fileUrl && message.fileType === 'video') {
      const mediaUrl = resolveMediaUrl(message.fileUrl);
      return (
        <div className="space-y-2">
          {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
          <button
            type="button"
            onClick={() => setViewerMedia({ type: 'video', url: mediaUrl, name: getFileName(message.fileUrl) || 'Video' })}
            className="relative mt-1 block max-h-72 w-full overflow-hidden rounded-2xl bg-black"
            aria-label="View video"
          >
            <VideoThumbnail
              src={mediaUrl}
              className="max-h-72 w-full"
              videoClassName="max-h-72 object-contain opacity-95"
              iconSize={23}
              label={getFileName(message.fileUrl) || 'Video attachment'}
            />
          </button>
        </div>
      );
    }

    if (message.fileUrl) {
      const mediaUrl = resolveMediaUrl(message.fileUrl);
      return (
        <div className="space-y-2">
          {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center justify-between gap-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm transition hover:bg-white/15"
          >
            <span className="truncate">{getFileName(message.fileUrl)}</span>
            <span className="font-semibold">Open</span>
          </a>
        </div>
      );
    }

    return <p className="whitespace-pre-wrap break-words">{message.text}</p>;
  };

  useEffect(() => {
    socket = getSocket();
    setVisibleMessageCount(GROUP_MESSAGE_RENDER_BATCH);
    socket.emit('join-group', groupId);
    fetchMessages();

    const handleReceive = (message) => {
      if (getEntityId(message.groupId) !== getEntityId(groupId)) return;

      setMessages(prev => {
        if (prev.some(item => getEntityId(item) === getEntityId(message))) return prev;
        return [...prev, message];
      });
      scrollToBottom();

      if (getEntityId(message.userId) !== currentUserId) {
        playUiSound('message');
        markMessagesSeen([getEntityId(message)]);
      }
    };

    const handleUpdate = (message) => {
      if (getEntityId(message.groupId) !== getEntityId(groupId)) return;
      upsertMessage(message);
    };

    const handleSeen = ({ groupId: seenGroupId, messageIds = [], seenBy }) => {
      if (getEntityId(seenGroupId) !== getEntityId(groupId) || !seenBy?.userId) return;

      const seenMessageIds = new Set(messageIds.map(String));
      const readerId = getEntityId(seenBy.userId);

      setMessages(prev => prev.map(message => {
        if (!seenMessageIds.has(getEntityId(message))) return message;

        const existingSeen = message.seenBy || [];
        const alreadySeen = existingSeen.some(entry => getEntityId(entry?.userId || entry) === readerId);
        if (alreadySeen) return message;

        return { ...message, seenBy: [...existingSeen, seenBy] };
      }));
    };

    const handleDeleteForEveryone = (messageId) => {
      setMessages(prev => prev.filter(message => getEntityId(message) !== getEntityId(messageId)));
    };

    socket.on('receive-group-message', handleReceive);
    socket.on('group-message-updated', handleUpdate);
    socket.on('group-messages-seen', handleSeen);
    socket.on('message-deleted-for-everyone', handleDeleteForEveryone);

    return () => {
      socket.emit('leave-group', groupId);
      socket.off('receive-group-message', handleReceive);
      socket.off('group-message-updated', handleUpdate);
      socket.off('group-messages-seen', handleSeen);
      socket.off('message-deleted-for-everyone', handleDeleteForEveryone);
    };
  }, [groupId, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const memberPreview = members.slice(0, 5);
  const memberCount = members.length || group?.members?.length || 0;
  const groupPhotoUrl = resolveMediaUrl(group?.photo);

  if (loading) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-2xl border border-gray-200 bg-white/80 text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
        <LoadingSpinner compact label="Loading chat" />
      </div>
    );
  }

  return (
    <div className="group-chat-shell flex h-[calc(100svh-8rem)] min-h-[500px] flex-col overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-xl shadow-pink-500/5 dark:border-gray-800 dark:bg-gray-900 sm:h-[min(78vh,820px)]">
      <div className="border-b border-gray-200/80 bg-white/95 p-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-pink-50 text-pink-600 shadow-sm ring-1 ring-gray-200 dark:bg-pink-950/30 dark:text-pink-300 dark:ring-gray-800">
              {groupPhotoUrl ? (
                <img src={groupPhotoUrl} alt={group?.name || 'Team Chat'} className="h-full w-full object-cover" />
              ) : memberPreview.length > 0 ? (
                <div className="flex -space-x-3">
                  {memberPreview.slice(0, 3).map(member => (
                    <div key={getEntityId(member)} className="rounded-full border-2 border-white dark:border-gray-900">
                      {renderAvatar(member, 'h-8 w-8', true)}
                    </div>
                  ))}
                </div>
              ) : (
                <Users size={21} />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-gray-950 dark:text-white">{group?.name || 'Team Chat'}</h3>
              <p className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">
                {memberCount} members - {messages.length} messages - {sharedMediaCount} media
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setShowPinned(value => !value)}
              className="grid h-10 w-10 place-items-center rounded-full border border-gray-200 text-gray-600 transition hover:border-pink-200 hover:bg-pink-50 hover:text-pink-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-pink-900/60 dark:hover:bg-pink-950/20"
              title="Pinned messages"
            >
              <Pin size={17} />
            </button>
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300 sm:inline-flex">
              Live
            </span>
          </div>
        </div>

        <label className="relative mt-3 block">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search team chat, files, or members"
            className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm font-medium text-gray-900 outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-pink-500"
          />
        </label>

        {showPinned && pinnedMessages.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {pinnedMessages.slice(0, 8).map(message => (
              <button
                key={getEntityId(message)}
                type="button"
                onClick={() => setSearch(message.text || getFileName(message.fileUrl || ''))}
                className="flex min-w-[13rem] max-w-[16rem] items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800 transition hover:border-amber-200 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200"
              >
                <Pin size={14} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate font-black">{message.userId?.name || 'Member'}</span>
                  <span className="block truncate">{message.text || getFileName(message.fileUrl || '')}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 via-white to-gray-50 p-3 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 sm:p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-pink-50 text-pink-500 dark:bg-pink-950/30 dark:text-pink-300">
              <Users size={28} />
            </div>
            <h3 className="mt-4 font-bold text-gray-950 dark:text-white">Start the team conversation</h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">Share quick updates, ask questions, reply to messages, pin decisions, or send project media here.</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <Search className="h-12 w-12 text-gray-300 dark:text-gray-600" />
            <h3 className="mt-4 font-bold text-gray-950 dark:text-white">No matching chat results</h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">Try another keyword or clear the search.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {hiddenMessageCount > 0 && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleMessageCount(count => Math.min(filteredMessages.length, count + GROUP_MESSAGE_RENDER_BATCH))}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-600 shadow-sm transition hover:border-pink-200 hover:text-pink-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-pink-900/60 dark:hover:text-pink-200"
                >
                  Show earlier messages ({hiddenMessageCount})
                </button>
              </div>
            )}

            {renderedMessages.map((message) => {
              const messageId = getEntityId(message);
              const isMe = getEntityId(message.userId) === currentUserId;

              return (
                <div key={messageId} className={`group flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && <div className="mr-2 mt-7">{renderAvatar(message.userId, 'h-9 w-9', true)}</div>}

                  <div className={`relative max-w-[86%] md:max-w-[68%] ${isMe ? 'text-right' : 'text-left'}`}>
                    {!isMe && (
                      <button
                        type="button"
                        onClick={() => onUserClick?.(message.userId)}
                        className="mb-1 px-1 text-left text-xs font-semibold text-gray-500 transition hover:text-pink-600 dark:hover:text-pink-300"
                      >
                        {message.userId?.name}
                      </button>
                    )}

                    <div className={`rounded-[1.35rem] px-4 py-3 shadow-sm ${
                      isMe
                        ? 'rounded-br-md bg-[#0084ff] text-white shadow-pink-500/20'
                        : 'rounded-bl-md border border-gray-200 bg-white text-gray-950 dark:border-gray-800 dark:bg-gray-800 dark:text-white'
                    }`}>
                      {message.pinned && (
                        <span className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${isMe ? 'bg-white/15 text-white' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200'}`}>
                          <Pin size={12} />
                          Pinned
                        </span>
                      )}
                      <ReplyPreview message={message.replyTo} compact />
                      {renderMessageContent(message)}
                      <p className={`mt-1 text-xs ${isMe ? 'text-white/75' : 'text-gray-400'}`}>
                        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                      </p>
                    </div>

                    <div className={`mt-1 flex flex-wrap items-center gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(message)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm ring-1 ring-gray-100 transition hover:text-pink-600 dark:bg-gray-800 dark:ring-gray-700"
                        title="Reply"
                      >
                        <Reply size={14} />
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setReactionPickerMessageId(reactionPickerMessageId === messageId ? null : messageId)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm ring-1 ring-gray-100 transition hover:text-pink-600 dark:bg-gray-800 dark:ring-gray-700"
                          title="React"
                        >
                          <Smile size={14} />
                        </button>
                        {reactionPickerMessageId === messageId && (
                          <div className={`absolute bottom-9 z-30 flex gap-1 rounded-full border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-900 ${isMe ? 'right-0' : 'left-0'}`}>
                            {QUICK_REACTIONS.map(emoji => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => reactToMessage(messageId, emoji)}
                                className="grid h-8 w-8 place-items-center rounded-full text-base transition hover:bg-pink-50 dark:hover:bg-pink-950/30"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePinMessage(messageId)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm ring-1 ring-gray-100 transition hover:text-amber-600 dark:bg-gray-800 dark:ring-gray-700"
                        title={message.pinned ? 'Unpin' : 'Pin'}
                      >
                        {message.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActiveMenuMessageId(activeMenuMessageId === messageId ? null : messageId)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm ring-1 ring-gray-100 transition hover:text-gray-900 dark:bg-gray-800 dark:ring-gray-700 dark:hover:text-white"
                          aria-label="Message options"
                        >
                          <MoreVertical size={14} />
                        </button>
                        {activeMenuMessageId === messageId && (
                          <div className={`absolute bottom-9 z-20 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-xl dark:border-gray-700 dark:bg-gray-800 ${isMe ? 'right-0' : 'left-0'}`}>
                            <button
                              onClick={() => deleteForMe(messageId)}
                              className="block w-full px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                              Remove for me
                            </button>
                            {isMe && (
                              <button
                                onClick={() => deleteForEveryone(messageId)}
                                className="block w-full px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                              >
                                Unsend for everyone
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <ReactionSummary message={message} />
                    {isMe && <SeenStatus message={message} />}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-gray-200/80 bg-white/95 p-3 dark:border-gray-800 dark:bg-gray-900/95">
        {replyingTo && (
          <div className="mb-2 flex items-start justify-between gap-2 rounded-2xl border border-pink-100 bg-pink-50 px-3 py-2 dark:border-pink-900/50 dark:bg-pink-950/20">
            <ReplyPreview message={replyingTo} />
            <button type="button" onClick={() => setReplyingTo(null)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-pink-600 transition hover:bg-white dark:text-pink-200 dark:hover:bg-gray-900">
              <X size={15} />
            </button>
          </div>
        )}

        {mediaPreview && (
          <div className="mb-2 flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              {mediaType === 'image' && <img src={mediaPreview} alt="preview" className="h-12 w-12 rounded-xl object-cover" />}
              {mediaType === 'video' && <VideoThumbnail src={mediaPreview} className="h-12 w-12" rounded="rounded-xl" iconSize={16} label="Selected video preview" />}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{mediaType === 'image' ? 'Image ready' : 'Video ready'}</span>
            </div>
            <button onClick={cancelMedia} className="rounded-full p-1 text-gray-500 transition hover:bg-white dark:hover:bg-gray-900" aria-label="Cancel media">
              <X size={18} />
            </button>
          </div>
        )}

        <div className="group-message-composer-grid">
          <div className="flex flex-1 items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 transition focus-within:border-pink-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-800 dark:focus-within:border-pink-500">
            <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-pink-500 transition hover:bg-pink-50 dark:hover:bg-pink-950/30" aria-label="Attach image">
              <ImageIcon size={19} />
              <input type="file" accept="image/*" className="hidden" onChange={(event) => handleFileSelect(event, 'image')} disabled={uploading} />
            </label>

            <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-pink-500 transition hover:bg-pink-50 dark:hover:bg-pink-950/30" aria-label="Attach video">
              <Video size={19} />
              <input type="file" accept="video/*" className="hidden" onChange={(event) => handleFileSelect(event, 'video')} disabled={uploading} />
            </label>

            <input
              type="text"
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !uploading) {
                  event.preventDefault();
                  sendTextMessage(newMessage);
                }
              }}
              placeholder="Message this workspace..."
              className="min-h-10 flex-1 bg-transparent px-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
              disabled={uploading}
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => selectedMedia ? sendMediaMessage(selectedMedia, mediaType) : sendTextMessage(newMessage)}
            disabled={uploading || (!selectedMedia && !newMessage.trim())}
            className="message-composer-send"
            aria-label="Send message"
          >
            {uploading ? <Info size={19} /> : <Send size={19} />}
          </motion.button>
        </div>

        <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold text-gray-400">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800"><FileText size={13} /> Searchable chat</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800"><Pin size={13} /> Pins</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800"><Reply size={13} /> Replies</span>
        </div>
      </div>
      <MediaViewer media={viewerMedia} onClose={() => setViewerMedia(null)} />
    </div>
  );
}
