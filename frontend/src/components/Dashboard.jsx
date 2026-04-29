import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  Plus, Users, TrendingUp, Rocket, Sparkles, ArrowRight, Copy, Check, Clock, Trash2
} from 'lucide-react';
import api from '../services/api';
import EmptyState from './EmptyState';
import { GroupSkeleton } from './SkeletonLoader';
import FloatingActionButton from './FloatingActionButton';
import CreateGroupModal from './CreateGroupModal';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await api.get('/groups');
      setGroups(res.data);
    } catch (err) {
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (name, description) => {
    if (!name.trim()) {
      toast.error('Group name is required');
      return;
    }
    try {
      await api.post('/groups', { name, description });
      toast.success('Group created!');
      setShowCreate(false);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to create group');
    }
  };

  const joinGroup = async () => {
    if (!joinCode.trim()) {
      toast.error('Please enter a join code');
      return;
    }
    try {
      await api.post('/groups/join', { joinCode });
      toast.success('Joined group!');
      setJoinCode('');
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Invalid join code');
    }
  };

  const copyJoinCode = (code, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Join code copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const deleteGroup = async (groupId, groupName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete group "${groupName}"? This action cannot be undone. All posts, tasks and files will be permanently removed.`)) return;
    try {
      await api.delete(`/groups/${groupId}`);
      toast.success('Group deleted');
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to delete group');
    }
  };

  const totalMembers = groups.reduce((sum, g) => sum + (g.members?.length || 0), 0);
  const activeGroups = groups.filter(g => g.members?.length > 0).length;

  const stats = [
    { 
      icon: Users, 
      label: 'Study Groups', 
      value: groups.length, 
      gradient: 'from-pink-500 to-rose-500',
      bgGradient: 'from-pink-50 dark:from-pink-950/20 to-rose-50 dark:to-rose-950/20',
    },
    { 
      icon: TrendingUp, 
      label: 'Total Members', 
      value: totalMembers, 
      gradient: 'from-purple-500 to-indigo-500',
      bgGradient: 'from-purple-50 dark:from-purple-950/20 to-indigo-50 dark:to-indigo-950/20',
    },
    { 
      icon: Rocket, 
      label: 'Active Groups', 
      value: activeGroups, 
      gradient: 'from-green-500 to-emerald-500',
      bgGradient: 'from-green-50 dark:from-green-950/20 to-emerald-50 dark:to-emerald-950/20',
    },
  ];

  const getRandomColor = (str) => {
    const colors = ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
        <div className="h-32 bg-white dark:bg-gray-800 rounded-2xl animate-pulse"></div>
        <div className="grid md:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 animate-pulse h-36"></div>)}
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <GroupSkeleton key={i} />)}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-2xl shadow-xl"
      >
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"></div>
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                Welcome back, {user?.name?.split(' ')[0] || 'Student'}! 👋
              </h2>
              <p className="text-purple-100 max-w-md">
                You're managing <span className="font-semibold">{groups.length}</span> study group{groups.length !== 1 && 's'}. Keep it up!
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-white text-gray-800 px-5 py-2.5 rounded-xl font-medium shadow-md hover:shadow-lg transition-all"
            >
              <Plus size={18} /> New Group
            </motion.button>
          </div>
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, type: 'spring', stiffness: 200 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`relative overflow-hidden bg-gradient-to-br ${stat.bgGradient} backdrop-blur-sm rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl group`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{stat.label}</p>
                  <h3 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mt-1">
                    {stat.value}
                  </h3>
                </div>
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className={`p-3 rounded-2xl bg-gradient-to-br ${stat.gradient} shadow-lg`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </motion.div>
              </div>
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50"
      >
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Sparkles size={16} className="text-pink-500" />
          <span>Quick actions</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full font-medium transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-white text-gray-800 shadow-md hover:shadow-lg"
          >
            <Plus size={16} /> Create Group
          </button>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter join code"
              className="w-40 md:w-48 py-2 px-4 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500/50 outline-none transition-all text-sm"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
            />
            <button
              onClick={joinGroup}
              className="px-5 py-2 rounded-full font-medium transition-all duration-200 active:scale-95 bg-white text-gray-800 shadow-md hover:shadow-lg text-sm"
            >
              Join
            </button>
          </div>
        </div>
      </motion.div>

      {/* My Groups Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">My Groups</h3>
          <span className="text-sm text-gray-500">{groups.length} total</span>
        </div>

        {groups.length === 0 ? (
          <EmptyState type="groups" action={() => setShowCreate(true)} />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group, idx) => {
              const memberCount = group.members?.length || 0;
              const groupColor = getRandomColor(group.name);
              const isCopied = copiedCode === group.joinCode;
              const isCreator = group.creator === user?._id || group.creator?._id === user?._id;
              return (
                <motion.div
                  key={group._id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05, duration: 0.3 }}
                  whileHover={{ y: -4 }}
                  onClick={() => navigate(`/group/${group._id}`)}
                  className="group relative cursor-pointer bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700"
                >
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: groupColor }}></div>
                  <div className="p-5 pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1 flex-1">
                        {group.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        {isCreator && (
                          <button
                            onClick={(e) => deleteGroup(group._id, group.name, e)}
                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                            title="Delete group"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        <div className="flex items-center gap-1">
                          <Users size={14} className="text-gray-400" />
                          <span className="text-xs font-medium text-gray-500">{memberCount}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-3">
                      {group.description || 'No description yet'}
                    </p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Code:</span>
                        <code className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md text-gray-700 dark:text-gray-300">
                          {group.joinCode}
                        </code>
                        <button
                          onClick={(e) => copyJoinCode(group.joinCode, e)}
                          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                          title="Copy join code"
                        >
                          {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-400" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-1 text-pink-500 text-sm font-medium">
                        Enter <ArrowRight size={14} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
                      <Clock size={12} />
                      <span>Active {Math.floor(Math.random() * 24)}h ago</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <CreateGroupModal 
        isOpen={showCreate} 
        onClose={() => setShowCreate(false)} 
        onCreate={createGroup} 
      />

      <FloatingActionButton onGroupCreate={() => setShowCreate(true)} />
    </div>
  );
}