import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function NewChatModal({ onClose, onSelectUser }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchUsers = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const res = await api.get(`/users/search?q=${search}`);
      setResults(res.data);
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">New Chat</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Search by name or email"
            className="flex-1 p-2 rounded-lg border dark:bg-gray-700"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && searchUsers()}
          />
          <button onClick={searchUsers} className="bg-pink-500 text-white px-3 rounded-lg"><Search size={18} /></button>
        </div>
        {loading && <div className="text-center py-4">Searching...</div>}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {results.map(user => (
            <div
              key={user._id}
              onClick={() => onSelectUser(user)}
              className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
            >
              <div className="font-semibold">{user.name}</div>
              <div className="text-sm text-gray-500">{user.email}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}