import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCheck, Image as ImageIcon, MoreVertical, Send, Users, Video, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { resolveMediaUrl } from '../utils/media';
import { playUiSound } from '../utils/sound';
import LoadingSpinner from './LoadingSpinner';

let socket;

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
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const currentUserId = getEntityId(user);

  const scrollToBottom = (behavior = 'smooth') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    });
  };

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/group-chat/${groupId}`);
      setMessages(res.data);
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
    setNewMessage('');

    try {
      const res = await api.post('/group-chat', { groupId, text: trimmedText });
      playUiSound('send');
      socket.emit('send-group-message', { groupId, message: res.data });
    } catch (err) {
      console.error('Send error', err);
      setNewMessage(trimmedText);
    }
  };

  const sendMediaMessage = async (file, type) => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadRes = await api.post(`/files/upload/${groupId}`, formData);
      const fileUrl = uploadRes.data.url || uploadRes.data.fileUrl || `/uploads/${uploadRes.data.filename}`;
      const text = type === 'image' ? 'Sent an image' : 'Sent a video';
      const res = await api.post('/group-chat', { groupId, text, fileUrl, fileType: type });
      playUiSound('send');
      socket.emit('send-group-message', { groupId, message: res.data });
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

  const renderMessageContent = (message) => {
    if (message.fileUrl && message.fileType === 'image') {
      const mediaUrl = resolveMediaUrl(message.fileUrl);
      return (
        <div className="space-y-2">
          {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
          <img
            src={mediaUrl}
            alt="attachment"
            className="mt-1 max-h-64 cursor-pointer rounded-xl object-contain"
            onClick={() => window.open(mediaUrl)}
          />
        </div>
      );
    }

    if (message.fileUrl && message.fileType === 'video') {
      return (
        <div className="space-y-2">
          {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
          <video controls className="mt-1 max-h-64 rounded-xl" src={resolveMediaUrl(message.fileUrl)} />
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
    socket.on('group-messages-seen', handleSeen);
    socket.on('message-deleted-for-everyone', handleDeleteForEveryone);

    return () => {
      socket.emit('leave-group', groupId);
      socket.off('receive-group-message', handleReceive);
      socket.off('group-messages-seen', handleSeen);
      socket.off('message-deleted-for-everyone', handleDeleteForEveryone);
    };
  }, [groupId, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const memberPreview = members.slice(0, 5);
  const memberCount = members.length || group?.members?.length || 0;

  if (loading) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-2xl border border-gray-200 bg-white/80 text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
        <LoadingSpinner compact label="Loading chat" />
      </div>
    );
  }

  return (
    <div className="flex h-[min(76vh,760px)] min-h-[560px] flex-col overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-xl shadow-pink-500/5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-4 border-b border-gray-200/80 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex -space-x-2">
            {memberPreview.length > 0 ? memberPreview.slice(0, 3).map(member => (
              <div key={getEntityId(member)} className="rounded-full border-2 border-white dark:border-gray-900">
                {renderAvatar(member, 'h-10 w-10', true)}
              </div>
            )) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-300">
                <Users size={21} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-bold text-gray-950 dark:text-white">{group?.name || 'Team Chat'}</h3>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {memberCount} member{memberCount === 1 ? '' : 's'} - {messages.length} message{messages.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300 sm:inline-flex">
          Live
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white p-4 dark:from-gray-950 dark:to-gray-900">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-pink-50 text-pink-500 dark:bg-pink-950/30 dark:text-pink-300">
              <Users size={28} />
            </div>
            <h3 className="mt-4 font-bold text-gray-950 dark:text-white">Start the team conversation</h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">Share quick updates, ask questions, or send project media here.</p>
          </div>
        ) : (
          <div className="space-y-4">
          {messages.map((message) => {
            const messageId = getEntityId(message);
            const isMe = getEntityId(message.userId) === currentUserId;

            return (
              <div key={messageId} className={`group flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && <div className="mr-2 mt-5">{renderAvatar(message.userId, 'h-9 w-9', true)}</div>}

                <div className={`relative max-w-[78%] md:max-w-[68%] ${isMe ? 'text-right' : 'text-left'}`}>
                  {!isMe && (
                    <button
                      type="button"
                      onClick={() => onUserClick?.(message.userId)}
                      className="mb-1 px-1 text-left text-xs font-semibold text-gray-500 transition hover:text-pink-600 dark:hover:text-pink-300"
                    >
                      {message.userId?.name}
                    </button>
                  )}

                  {isMe && (
                    <div className="absolute -left-10 top-2 z-10 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() => setActiveMenuMessageId(activeMenuMessageId === messageId ? null : messageId)}
                        className="rounded-full bg-white p-2 text-gray-500 shadow-md transition hover:bg-gray-100 hover:text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white"
                        aria-label="Message options"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {activeMenuMessageId === messageId && (
                        <div className="absolute left-10 top-0 z-20 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
                          <button
                            onClick={() => deleteForMe(messageId)}
                            className="block w-full px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            Delete for me
                          </button>
                          <button
                            onClick={() => deleteForEveryone(messageId)}
                            className="block w-full px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            Unsend for everyone
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`rounded-[1.35rem] px-4 py-3 shadow-sm ${
                    isMe
                      ? 'rounded-br-md bg-[#0084ff] text-white shadow-pink-500/20'
                      : 'rounded-bl-md border border-gray-200 bg-white text-gray-950 dark:border-gray-800 dark:bg-gray-800 dark:text-white'
                  }`}>
                    {renderMessageContent(message)}
                    <p className={`mt-1 text-xs ${isMe ? 'text-white/75' : 'text-gray-400'}`}>
                      {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                    </p>
                  </div>

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
        {mediaPreview && (
          <div className="mb-2 flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              {mediaType === 'image' && <img src={mediaPreview} alt="preview" className="h-12 w-12 rounded-xl object-cover" />}
              {mediaType === 'video' && <video src={mediaPreview} className="h-12 w-12 rounded-xl object-cover" />}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{mediaType === 'image' ? 'Image ready' : 'Video ready'}</span>
            </div>
            <button onClick={cancelMedia} className="rounded-full p-1 text-gray-500 transition hover:bg-white dark:hover:bg-gray-900" aria-label="Cancel media">
              <X size={18} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
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
            placeholder="Type a message..."
            className="min-h-10 flex-1 bg-transparent px-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
            disabled={uploading}
          />
          </div>

          {selectedMedia ? (
            <motion.button
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              animate={uploading ? { x: [0, 4, 0], rotate: [0, -10, 0] } : { x: 0, rotate: 0 }}
              transition={uploading ? { duration: 0.55, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.18 }}
              onClick={() => sendMediaMessage(selectedMedia, mediaType)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0084ff] text-white shadow-lg shadow-pink-500/20 transition hover:scale-105 disabled:opacity-50"
              disabled={uploading}
              aria-label="Send media"
            >
              <Send size={19} />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              animate={uploading ? { x: [0, 4, 0], rotate: [0, -10, 0] } : { x: 0, rotate: 0 }}
              transition={uploading ? { duration: 0.55, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.18 }}
              onClick={() => sendTextMessage(newMessage)}
              disabled={!newMessage.trim() || uploading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0084ff] text-white shadow-lg shadow-pink-500/20 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Send message"
            >
              <Send size={19} />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
