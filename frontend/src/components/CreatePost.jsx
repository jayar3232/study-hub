import React, { useState } from 'react';
import api from '../services/api';

export default function CreatePost({ groupId, onPostCreated }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/posts', { groupId, title, content });
      setTitle('');
      setContent('');
      onPostCreated();
    } catch (err) {
      alert('Failed to create post');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow mb-6">
      <input type="text" placeholder="Post title" className="w-full border p-2 rounded mb-2" value={title} onChange={e => setTitle(e.target.value)} required />
      <textarea placeholder="What's on your mind?" className="w-full border p-2 rounded mb-2" rows="3" value={content} onChange={e => setContent(e.target.value)} required />
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Create Post</button>
    </form>
  );
}
