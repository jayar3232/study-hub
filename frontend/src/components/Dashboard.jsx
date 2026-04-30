import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  Plus,
  Rocket,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Users
} from 'lucide-react';
import api from '../services/api';
import EmptyState from './EmptyState';
import { GroupSkeleton } from './SkeletonLoader';
import FloatingActionButton from './FloatingActionButton';
import CreateGroupModal from './CreateGroupModal';
import { useAuth } from '../context/AuthContext';

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const cardVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 }
};

const getGroupColor = (value = '') => {
  const colors = ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
  }

  return colors[Math.abs(hash) % colors.length];
};

const formatGroupDate = (date) => {
  if (!date) return 'Ready now';
  return `Created ${new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [search, setSearch] = useState('');
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
      toast.success('Group created');
      setShowCreate(false);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to create group');
    }
  };

  const joinGroup = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      toast.error('Please enter a join code');
      return;
    }

    try {
      await api.post('/groups/join', { joinCode: code });
      toast.success('Joined group');
      setJoinCode('');
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Invalid join code');
    }
  };

  const copyJoinCode = (code, event) => {
    event.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Join code copied');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const deleteGroup = async (groupId, groupName, event) => {
    event.stopPropagation();
    if (!window.confirm(`Delete group "${groupName}"? This action cannot be undone. All posts, tasks and files will be permanently removed.`)) return;

    try {
      await api.delete(`/groups/${groupId}`);
      toast.success('Group deleted');
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to delete group');
    }
  };

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;

    return groups.filter(group => (
      group.name?.toLowerCase().includes(query) ||
      group.description?.toLowerCase().includes(query) ||
      group.subject?.toLowerCase().includes(query) ||
      group.joinCode?.toLowerCase().includes(query)
    ));
  }, [groups, search]);

  const totalMembers = groups.reduce((sum, group) => sum + (group.members?.length || 0), 0);
  const createdCount = groups.filter(group => getEntityId(group.creator) === getEntityId(user)).length;
  const activeGroups = groups.filter(group => (group.members?.length || 0) > 0).length;

  const stats = [
    {
      icon: Users,
      label: 'Study Groups',
      value: groups.length,
      detail: `${createdCount} created by you`,
      gradient: 'from-pink-500 to-rose-500',
      bgGradient: 'from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20'
    },
    {
      icon: TrendingUp,
      label: 'Total Members',
      value: totalMembers,
      detail: `${groups.length ? Math.round(totalMembers / groups.length) : 0} average per group`,
      gradient: 'from-violet-500 to-indigo-500',
      bgGradient: 'from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20'
    },
    {
      icon: Rocket,
      label: 'Active Groups',
      value: activeGroups,
      detail: 'Ready for collaboration',
      gradient: 'from-emerald-500 to-cyan-500',
      bgGradient: 'from-emerald-50 to-cyan-50 dark:from-emerald-950/20 dark:to-cyan-950/20'
    }
  ];

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
        <div className="h-36 rounded-2xl bg-white dark:bg-gray-800 animate-pulse" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map(item => <div key={item} className="h-36 rounded-2xl bg-white dark:bg-gray-800 animate-pulse" />)}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(item => <GroupSkeleton key={item} />)}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-500 via-violet-500 to-indigo-500 shadow-xl shadow-pink-500/15"
      >
        <div className="absolute inset-0 bg-black/15" />
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-white/75">StudyHub Dashboard</p>
              <h1 className="text-2xl font-bold tracking-normal text-white md:text-3xl">
                Welcome back, {user?.name?.split(' ')[0] || 'Student'}
              </h1>
              <p className="text-sm leading-6 text-white/85 md:text-base">
                You are managing <span className="font-semibold text-white">{groups.length}</span> study group{groups.length === 1 ? '' : 's'}. Keep your class work organized and easy to follow.
              </p>
            </div>
            <motion.button
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCreate(true)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 shadow-lg shadow-black/10 transition hover:bg-pink-50"
            >
              <Plus size={18} /> New Group
            </motion.button>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-6 md:grid-cols-3">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: index * 0.08, type: 'spring', damping: 22, stiffness: 240 }}
              whileHover={{ y: -5, scale: 1.01 }}
              className={`group relative overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-br ${stat.bgGradient} p-6 shadow-lg shadow-gray-200/60 dark:border-gray-700/50 dark:shadow-black/10`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                  <h2 className="mt-1 text-3xl font-bold text-gray-950 dark:text-white md:text-4xl">{stat.value}</h2>
                  <p className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">{stat.detail}</p>
                </div>
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: index * 0.2 }}
                  className={`rounded-2xl bg-gradient-to-br ${stat.gradient} p-3 text-white shadow-lg`}
                >
                  <Icon size={24} />
                </motion.div>
              </div>
              <div className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </motion.div>
          );
        })}
      </section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col gap-4 rounded-2xl border border-gray-200/70 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-gray-700/50 dark:bg-gray-800/60 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
          <Sparkles size={17} className="text-pink-500" />
          <span>Quick actions</span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-gray-900 dark:text-gray-100"
          >
            <Plus size={16} /> Create Group
          </button>
          <div className="flex rounded-full border border-gray-200 bg-white p-1 shadow-md dark:border-gray-700 dark:bg-gray-900">
            <input
              value={joinCode}
              onChange={event => setJoinCode(event.target.value.toUpperCase())}
              onKeyDown={event => {
                if (event.key === 'Enter') joinGroup();
              }}
              placeholder="Enter join code"
              className="w-44 bg-transparent px-4 text-sm font-medium uppercase tracking-wide text-gray-900 outline-none placeholder:normal-case placeholder:tracking-normal dark:text-white"
            />
            <button
              onClick={joinGroup}
              className="rounded-full bg-gray-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-pink-600 dark:bg-white dark:text-gray-950 dark:hover:bg-pink-200"
            >
              Join
            </button>
          </div>
        </div>
      </motion.section>

      <section>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-950 dark:text-white">My Groups</h2>
            <p className="text-sm text-gray-500">{filteredGroups.length} visible of {groups.length}</p>
          </div>
          <div className="relative">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search groups"
              className="w-full rounded-full border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-pink-300 focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white sm:w-72"
            />
          </div>
        </div>

        {filteredGroups.length === 0 ? (
          <EmptyState type="groups" action={() => setShowCreate(true)} />
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            <AnimatePresence>
              {filteredGroups.map((group, index) => {
                const memberCount = group.members?.length || 0;
                const groupColor = getGroupColor(group.name);
                const isCopied = copiedCode === group.joinCode;
                const isCreator = getEntityId(group.creator) === getEntityId(user);

                return (
                  <motion.article
                    key={group._id}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    transition={{ delay: index * 0.04, type: 'spring', damping: 24, stiffness: 260 }}
                    whileHover={{ y: -4 }}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/group/${group._id}`)}
                    onKeyDown={event => {
                      if (event.currentTarget === event.target && event.key === 'Enter') navigate(`/group/${group._id}`);
                    }}
                    className="group relative flex min-h-52 cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-xl dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="h-1.5" style={{ backgroundColor: groupColor }} />
                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="line-clamp-1 text-lg font-bold text-gray-950 dark:text-white">{group.name}</h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                            {group.description || 'No description yet'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {isCreator && (
                            <button
                              onClick={event => deleteGroup(group._id, group.name, event)}
                              className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                              title="Delete group"
                              aria-label={`Delete ${group.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                            <Users size={13} /> {memberCount}
                          </span>
                        </div>
                      </div>

                      <div className="mt-auto space-y-3">
                        <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                          {isCreator && (
                            <span className="rounded-full bg-yellow-50 px-2.5 py-1 font-semibold text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300">
                              Owner
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 dark:bg-gray-900">
                            <Clock size={12} /> {formatGroupDate(group.createdAt)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-700">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-xs text-gray-400">Code</span>
                            <code className="rounded-md bg-gray-100 px-2 py-1 font-mono text-sm font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                              {group.joinCode}
                            </code>
                            <button
                              onClick={event => copyJoinCode(group.joinCode, event)}
                              className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-pink-600 dark:hover:bg-gray-700"
                              title="Copy join code"
                              aria-label="Copy join code"
                            >
                              {isCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                          </div>
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-pink-600 transition group-hover:translate-x-1 dark:text-pink-400">
                            Enter <ArrowRight size={14} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      <CreateGroupModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={createGroup}
      />

      <FloatingActionButton onGroupCreate={() => setShowCreate(true)} />
    </div>
  );
}
