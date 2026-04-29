import React, { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Video, X, MoreVertical } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import io from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';

let socket;

export default function GroupChat({ groupId }) {
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/group-chat/${groupId}`);
      setMessages(res.data);
    } catch (err) {
      console.error('Fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  const sendTextMessage = async (text) => {
    if (!text.trim()) return;
    setNewMessage('');
    try {
      const res = await api.post('/group-chat', { groupId, text });
      socket.emit('send-group-message', { groupId, message: res.data });
    } catch (err) {
      console.error('Send error', err);
      setNewMessage(text);
    }
  };

  const sendMediaMessage = async (file, type) => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const uploadRes = await api.post(`/files/upload/${groupId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // ✅ Use relative path instead of localhost
      const fileUrl = `/uploads/${uploadRes.data.filename}`;
      let text = type === 'image' ? '📷 Sent an image' : '🎥 Sent a video';
      const res = await api.post('/group-chat', { groupId, text, fileUrl, fileType: type });
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

  const handleFileSelect = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedMedia(file);
    setMediaType(type);
    const preview = URL.createObjectURL(file);
    setMediaPreview(preview);
    e.target.value = '';
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
      setMessages(prev => prev.filter(m => m._id !== messageId));
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

  const getUserInitial = (name) => (name ? name.charAt(0).toUpperCase() : '?');

  const renderMessageContent = (msg) => {
    if (msg.fileUrl && msg.fileType === 'image') {
      return <img src={msg.fileUrl} alt="attachment" className="max-h-64 rounded-lg mt-1 cursor-pointer" onClick={() => window.open(msg.fileUrl)} />;
    }
    if (msg.fileUrl && msg.fileType === 'video') {
      return <video controls className="max-h-64 rounded-lg mt-1" src={msg.fileUrl} />;
    }
    return <p className="whitespace-pre-wrap break-words">{msg.text}</p>;
  };

  useEffect(() => {
    if (!socket) {
      // ✅ Connect to current origin (works through proxy)
      socket = io('', { transports: ['websocket'] });
    }
    socket.emit('join-group', groupId);
    fetchMessages();

    const handleReceive = (message) => {
      if (message.groupId === groupId) {
        setMessages(prev => {
          if (prev.some(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
        scrollToBottom();
      }
    };
    const handleDeleteForEveryone = (messageId) => {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    };

    socket.on('receive-group-message', handleReceive);
    socket.on('message-deleted-for-everyone', handleDeleteForEveryone);

    return () => {
      socket.emit('leave-group', groupId);
      socket.off('receive-group-message', handleReceive);
      socket.off('message-deleted-for-everyone', handleDeleteForEveryone);
    };
  }, [groupId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (loading) return <div className="p-4 text-gray-500 dark:text-gray-400">Loading chat...</div>;

  return (
    <div className="flex flex-col h-[500px] bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.userId?._id === user?._id;
          return (
            <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
              {!isMe && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center text-white text-sm mr-2 flex-shrink-0 overflow-hidden">
                  {msg.userId?.avatar ? (
                    // ✅ Use relative avatar URL
                    <img src={msg.userId.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getUserInitial(msg.userId?.name)
                  )}
                </div>
              )}
              <div className="relative max-w-[70%]">
                {isMe && (
                  <div className="absolute -left-10 top-1/2 transform -translate-y-1/2 z-10">
                    <button
                      onClick={() => setActiveMenuMessageId(activeMenuMessageId === msg._id ? null : msg._id)}
                      className="p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition shadow-md focus:outline-none"
                      aria-label="Message options"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {activeMenuMessageId === msg._id && (
                      <div className="absolute left-10 top-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 w-40">
                        <button
                          onClick={() => deleteForMe(msg._id)}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Delete for me
                        </button>
                        <button
                          onClick={() => deleteForEveryone(msg._id)}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Unsend for everyone
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className={`${isMe ? 'bg-pink-500 text-white rounded-br-none' : 'bg-gray-200 dark:bg-gray-700 rounded-bl-none'} rounded-2xl px-4 py-2 shadow-sm`}>
                  {!isMe && <p className="text-xs font-semibold mb-1">{msg.userId?.name}</p>}
                  {renderMessageContent(msg)}
                  <p className="text-xs mt-1 opacity-70 text-right">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {mediaPreview && (
          <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              {mediaType === 'image' && <img src={mediaPreview} alt="preview" className="h-10 w-10 object-cover rounded" />}
              {mediaType === 'video' && <video src={mediaPreview} className="h-10 w-10 object-cover rounded" />}
            </div>
            <button onClick={cancelMedia} className="text-gray-500"><X size={18} /></button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !uploading && sendTextMessage(newMessage)}
            placeholder="Type a message..."
            className="flex-1 p-2 rounded-full border dark:bg-gray-700 focus:ring-2 focus:ring-pink-500 outline-none"
            disabled={uploading}
          />
          <label className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer">
            <ImageIcon size={20} className="text-pink-500" />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'image')} disabled={uploading} />
          </label>
          <label className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer">
            <Video size={20} className="text-pink-500" />
            <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileSelect(e, 'video')} disabled={uploading} />
          </label>
          {selectedMedia ? (
            <button onClick={() => sendMediaMessage(selectedMedia, mediaType)} className="bg-pink-500 text-white p-2 rounded-full disabled:opacity-50 hover:bg-pink-600 transition" disabled={uploading}>
              <Send size={20} />
            </button>
          ) : (
            <button onClick={() => sendTextMessage(newMessage)} disabled={!newMessage.trim() || uploading} className="bg-pink-500 text-white p-2 rounded-full disabled:opacity-50 hover:bg-pink-600 transition">
              <Send size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}