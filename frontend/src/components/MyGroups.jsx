import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  Calendar,
  Check,
  Copy,
  Crown,
  Grid3X3,
  ListFilter,
  LogOut,
  PlusCircle,
  Search,
  SortAsc,
  Users
} from 'lucide-react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import EmptyState from './EmptyState';

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const getGroupAccent = (value = '') => {
  const colors = ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
  }
  return colors[Math.abs(hash) % colors.length];
};

const formatDate = (value) => {
  if (!value) return 'Recently created';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const MemberStack = ({ members = [] }) => (
  <div className="flex -space-x-2">
    {members.slice(0, 4).map(member => (
      <div
        key={getEntityId(member)}
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-900 text-xs font-bold text-white dark:border-gray-900 dark:bg-gray-700"
        title={member.name || member.email}
      >
        {(member.name || member.email || '?').charAt(0).toUpperCase()}
      </div>
    ))}
    {members.length > 4 && (
      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-xs font-bold text-gray-600 dark:border-gray-900 dark:bg-gray-800 dark:text-gray-300">
        +{members.length - 4}
      </div>
    )}
  </div>
);

const StatCard = ({ icon: Icon, label, value, helper }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-2 text-3xl font-bold text-gray-950 dark:text-white">{value}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helper}</p>
      </div>
      <div className="rounded-lg bg-gray-100 p-3 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
        <Icon size={22} />
      </div>
    </div>
  </div>
);

export default function MyGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
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

  const copyJoinCode = async (code, event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success('Join code copied');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error('Could not copy code');
    }
  };

  const totalMembers = groups.reduce((sum, group) => sum + (group.members?.length || 0), 0);
  const createdCount = groups.filter(group => getEntityId(group.creator) === getEntityId(user)).length;
  const joinedCount = groups.length - createdCount;

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();

    return groups
      .filter(group => {
        const isCreator = getEntityId(group.creator) === getEntityId(user);
        const filterMatch = filter === 'all' || (filter === 'owned' ? isCreator : !isCreator);
        const searchMatch = !query
          || group.name?.toLowerCase().includes(query)
          || group.description?.toLowerCase().includes(query)
          || group.subject?.toLowerCase().includes(query)
          || group.joinCode?.toLowerCase().includes(query);
        return filterMatch && searchMatch;
      })
      .sort((a, b) => {
        if (sort === 'name') return (a.name || '').localeCompare(b.name || '');
        if (sort === 'members') return (b.members?.length || 0) - (a.members?.length || 0);
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [filter, groups, search, sort, user]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-pink-600 dark:text-pink-300">Group portfolio</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-950 dark:text-white">Your Groups</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              A cleaner workspace directory for every study circle you own or joined.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            <PlusCircle size={18} />
            Create or join
          </button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Grid3X3} label="Total Groups" value={groups.length} helper="All active workspaces" />
        <StatCard icon={Crown} label="Owned by You" value={createdCount} helper="Groups you created" />
        <StatCard icon={Users} label="Members Reached" value={totalMembers} helper={`${joinedCount} joined as member`} />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
          <label className="relative">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by name, code, subject..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
            />
          </label>
          <label className="relative">
            <ListFilter size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select value={filter} onChange={event => setFilter(event.target.value)} className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950">
              <option value="all">All groups</option>
              <option value="owned">Owned by me</option>
              <option value="joined">Joined groups</option>
            </select>
          </label>
          <label className="relative">
            <SortAsc size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select value={sort} onChange={event => setSort(event.target.value)} className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950">
              <option value="recent">Newest</option>
              <option value="name">Name</option>
              <option value="members">Members</option>
            </select>
          </label>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-gray-950 dark:text-white">Workspace directory</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{filteredGroups.length} visible of {groups.length}</p>
          </div>
        </div>

        {filteredGroups.length === 0 ? (
          <EmptyState type="groups" action={() => navigate('/dashboard')} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <AnimatePresence initial={false}>
              {filteredGroups.map((group, index) => {
                const memberCount = group.members?.length || 0;
                const accent = getGroupAccent(group.name);
                const isCreator = getEntityId(group.creator) === getEntityId(user);
                const isCopied = copiedCode === group.joinCode;

                return (
                  <motion.article
                    key={group._id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => navigate(`/group/${group._id}`)}
                    className="group cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className="grid md:grid-cols-[9px_minmax(0,1fr)]">
                      <div className="hidden md:block" style={{ backgroundColor: accent }} />
                      <div className="p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-xl font-bold text-gray-950 dark:text-white">{group.name}</h3>
                              {isCreator && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                  <Crown size={12} /> Owner
                                </span>
                              )}
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                              {group.description || 'No description yet.'}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-2 text-sm font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                              <Users size={16} /> {memberCount}
                            </span>
                            {!isCreator && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  leaveGroup(group._id, group.name);
                                }}
                                className="rounded-lg p-2 text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                                title="Leave group"
                              >
                                <LogOut size={18} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 flex flex-col gap-4 border-t border-gray-100 pt-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <MemberStack members={group.members || []} />
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <div className="flex items-center gap-1">
                                <Calendar size={13} />
                                {formatDate(group.createdAt)}
                              </div>
                              <div className="mt-1">Creator: {group.creator?.name || (isCreator ? 'You' : 'Member')}</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <button
                              type="button"
                              onClick={event => copyJoinCode(group.joinCode, event)}
                              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              {isCopied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                              {group.joinCode}
                            </button>
                            <span className="inline-flex items-center gap-1 rounded-lg bg-pink-600 px-3 py-2 text-sm font-semibold text-white transition group-hover:bg-pink-700">
                              Open <ArrowRight size={16} />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
