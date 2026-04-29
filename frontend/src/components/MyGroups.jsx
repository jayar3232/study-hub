import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  Users, Crown, LogOut, ChevronRight, Copy, Check, 
  TrendingUp, Sparkles, PlusCircle, ArrowRight, UserPlus
} from 'lucide-react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import EmptyState from './EmptyState';

export default function MyGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const leaveGroup = async (groupId, groupName) => {
    if (!window.confirm(`Leave group "${groupName}"? You can rejoin with the join code.`)) return;
    try {
      await api.delete(`/groups/${groupId}/leave`);
      toast.success(`Left ${groupName}`);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to leave group');
    }
  };

  const copyJoinCode = (code, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Join code copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const totalMembers = groups.reduce((sum, g) => sum + (g.members?.length || 0), 0);
  const createdCount = groups.filter(g => g.creator === user?._id || g.creator?._id === user?._id).length;

  const stats = [
    { icon: Users, label: 'Total Groups', value: groups.length, gradient: 'from-pink-500 to-rose-500', bgGradient: 'from-pink-50 dark:from-pink-950/20 to-rose-50 dark:to-rose-950/20' },
    { icon: TrendingUp, label: 'Total Members', value: totalMembers, gradient: 'from-purple-500 to-indigo-500', bgGradient: 'from-purple-50 dark:from-purple-950/20 to-indigo-50 dark:to-indigo-950/20' },
    { icon: Crown, label: 'Created by You', value: createdCount, gradient: 'from-amber-500 to-orange-500', bgGradient: 'from-amber-50 dark:from-amber-950/20 to-orange-50 dark:to-orange-950/20' },
  ];

  const getRandomColor = (str) => {
    const colors = ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) return <LoadingSpinner />;

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
              <h2 className="text-2xl md:text-3xl font-bold text-white">My Groups</h2>
              <p className="text-purple-100 max-w-md">
                Groups you've joined or created. Manage and collaborate with your study circle.
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 bg-white text-gray-800 px-5 py-2.5 rounded-xl font-medium shadow-md hover:shadow-lg transition-all"
            >
              <PlusCircle size={18} /> New Group
            </motion.button>
          </div>
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        </div>
      </motion.div>

      {/* Stats Cards (animated) */}
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

      {/* Groups Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Your Groups</h3>
          <span className="text-sm text-gray-500">{groups.length} total</span>
        </div>

        {groups.length === 0 ? (
          <EmptyState type="groups" action={() => navigate('/dashboard')} />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {groups.map((group, idx) => {
                const memberCount = group.members?.length || 0;
                const groupColor = getRandomColor(group.name);
                const isCreator = group.creator === user?._id || group.creator?._id === user?._id;
                const isCopied = copiedCode === group.joinCode;
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
                        <div className="flex items-center gap-1 ml-2">
                          <Users size={14} className="text-gray-400" />
                          <span className="text-xs font-medium text-gray-500">{memberCount}</span>
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
                        <div className="flex items-center gap-2">
                          {isCreator ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-full">
                              <Crown size={12} /> Creator
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                leaveGroup(group._id, group.name);
                              }}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                              title="Leave group"
                            >
                              <LogOut size={16} />
                            </button>
                          )}
                          <div className="flex items-center gap-1 text-pink-500 text-sm font-medium">
                            Open <ArrowRight size={14} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}