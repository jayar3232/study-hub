import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  Bell,
  Calendar,
  Check,
  Copy,
  Crown,
  Grid3X3,
  Image as ImageIcon,
  KeyRound,
  ListFilter,
  Loader2,
  LogOut,
  MailCheck,
  PlusCircle,
  Search,
  SortAsc,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import EmptyState from './EmptyState';
import { resolveMediaUrl } from '../utils/media';
import CreateGroupModal from './CreateGroupModal';

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
  <motion.div whileHover={{ y: -4, scale: 1.01 }} className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white p-5 shadow-lg shadow-gray-200/60 dark:border-gray-700/50 dark:bg-gray-900 dark:shadow-black/10">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-2 text-3xl font-bold text-gray-950 dark:text-white">{value}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helper}</p>
      </div>
      <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="rounded-xl bg-gradient-to-br from-pink-500 to-indigo-500 p-3 text-white shadow-lg shadow-pink-500/20">
        <Icon size={22} />
      </motion.div>
    </div>
    <div className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-pink-100/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full dark:via-white/10" />
  </motion.div>
);

export default function MyGroups() {
  const [groups, setGroups] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondingInviteIds, setRespondingInviteIds] = useState({});
  const [copiedCode, setCopiedCode] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const [groupsRes, invitesRes] = await Promise.all([
        api.get('/groups'),
        api.get('/groups/invites/me').catch(() => ({ data: [] }))
      ]);
      setGroups(groupsRes.data);
      setInvites(invitesRes.data || []);
      window.dispatchEvent(new Event('groupsUpdated'));
    } catch (err) {
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (name, description) => {
    if (!name.trim()) {
      toast.error('Workspace name is required');
      return false;
    }

    try {
      await api.post('/groups', { name, description });
      toast.success('Workspace created');
      await fetchGroups();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to create workspace');
      return false;
    }
  };

  const joinGroup = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      toast.error('Please enter an access code');
      return;
    }

    setJoining(true);
    try {
      await api.post('/groups/join', { joinCode: code });
      toast.success('Joined workspace');
      setJoinCode('');
      await fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Invalid access code');
    } finally {
      setJoining(false);
    }
  };

  const respondToInvite = async (inviteId, action) => {
    setRespondingInviteIds(prev => ({ ...prev, [inviteId]: true }));
    try {
      await api.put(`/groups/invites/${inviteId}/respond`, { action });
      toast.success(action === 'accept' ? 'Joined workspace' : 'Invitation declined');
      await fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to update invitation');
    } finally {
      setRespondingInviteIds(prev => {
        const next = { ...prev };
        delete next[inviteId];
        return next;
      });
    }
  };

  const leaveGroup = async (groupId, groupName) => {
    if (!window.confirm(`Leave workspace "${groupName}"? You can rejoin with the access code.`)) return;

    try {
      await api.delete(`/groups/${groupId}/leave`);
      toast.success(`Left ${groupName}`);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to leave workspace');
    }
  };

  const copyJoinCode = async (code, event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success('Access code copied');
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
      <motion.section
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-500 via-violet-500 to-indigo-500 shadow-xl shadow-pink-500/15"
      >
        <div className="absolute inset-0 bg-black/15" />
        <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase text-white/75">
              <Sparkles size={16} />
              Workspace portfolio
            </p>
            <h1 className="mt-1 text-3xl font-bold text-white">Workspaces</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">
              A polished directory for projects, teams, client spaces, and active collaboration.
            </p>
          </div>
          <motion.button
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-lg shadow-black/10 transition hover:bg-pink-50"
          >
            <PlusCircle size={18} />
            New workspace
          </motion.button>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-gray-950 dark:text-white">
              <PlusCircle size={17} className="text-pink-500" />
              Create a project space
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Set up a dedicated room for posts, tasks, files, chat, and shared assets.
            </p>
          </div>
          <motion.button
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-gray-900/10 transition hover:bg-pink-600 dark:bg-white dark:text-gray-950 dark:hover:bg-pink-100"
          >
            <PlusCircle size={18} />
            Create
          </motion.button>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/50">
          <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
            <KeyRound size={14} className="text-cyan-500" />
            Join with access code
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={joinCode}
              onChange={event => setJoinCode(event.target.value.toUpperCase())}
              onKeyDown={event => {
                if (event.key === 'Enter') joinGroup();
              }}
              placeholder="Example: A1B2C3"
              className="min-h-11 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold uppercase tracking-wide text-gray-900 outline-none transition placeholder:normal-case placeholder:font-normal placeholder:tracking-normal focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:ring-pink-950"
            />
            <button
              type="button"
              onClick={joinGroup}
              disabled={joining}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-pink-600 px-4 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {joining ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}
              Join
            </button>
          </div>
        </div>
      </motion.section>

      <AnimatePresence>
        {invites.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-pink-100 bg-white p-4 shadow-lg shadow-pink-500/10 dark:border-pink-900/50 dark:bg-gray-900"
          >
            <div className="mb-3 flex items-center gap-2">
              <Bell size={18} className="text-pink-500" />
              <h2 className="font-bold text-gray-950 dark:text-white">Workspace invitations</h2>
              <span className="rounded-full bg-pink-500 px-2 py-0.5 text-xs font-bold text-white">{invites.length}</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {invites.map(invite => (
                <div key={invite._id} className="flex flex-col gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-950 dark:text-white">{invite.groupId?.name || 'Workspace invitation'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Invited by {invite.invitedBy?.name || 'a workspace admin'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => respondToInvite(invite._id, 'decline')}
                      disabled={respondingInviteIds[invite._id]}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <X size={15} />
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => respondToInvite(invite._id, 'accept')}
                      disabled={respondingInviteIds[invite._id]}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-pink-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50"
                    >
                      <MailCheck size={15} />
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Grid3X3} label="Total Workspaces" value={groups.length} helper="All active project spaces" />
        <StatCard icon={Crown} label="Owned by You" value={createdCount} helper="Workspaces you created" />
        <StatCard icon={Users} label="Members Reached" value={totalMembers} helper={`${joinedCount} joined as member`} />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
          <label className="relative">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by name, access code, project..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
            />
          </label>
          <label className="relative">
            <ListFilter size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select value={filter} onChange={event => setFilter(event.target.value)} className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950">
              <option value="all">All workspaces</option>
              <option value="owned">Owned by me</option>
              <option value="joined">Joined workspaces</option>
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
          <EmptyState type="groups" action={() => setShowCreate(true)} />
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
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_0_0_1px_rgba(236,72,153,0.05)] transition hover:-translate-y-0.5 hover:border-pink-200 hover:shadow-[0_16px_45px_rgba(236,72,153,0.16)] dark:border-gray-700 dark:bg-gray-900 dark:hover:border-pink-900/60"
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-emerald-400 opacity-80" />
                    <div className="pointer-events-none absolute right-0 top-0 h-12 w-12 rounded-tr-xl border-r-2 border-t-2 border-pink-300 opacity-0 shadow-[8px_-8px_24px_rgba(236,72,153,0.22)] transition group-hover:opacity-100 dark:border-pink-800" />
                    <div className="pointer-events-none absolute bottom-0 left-0 h-12 w-12 rounded-bl-xl border-b-2 border-l-2 border-cyan-300 opacity-0 shadow-[-8px_8px_24px_rgba(6,182,212,0.18)] transition group-hover:opacity-100 dark:border-cyan-800" />
                    <div className="grid md:grid-cols-[120px_minmax(0,1fr)]">
                      <div className="h-32 bg-gray-950 md:hidden">
                        {group.photo ? (
                          <img src={resolveMediaUrl(group.photo)} alt={group.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: accent }}>
                            <ImageIcon size={30} className="text-white/90" />
                          </div>
                        )}
                      </div>
                      <div className="relative hidden bg-gray-950 md:block">
                        {group.photo ? (
                          <img src={resolveMediaUrl(group.photo)} alt={group.name} className="h-full min-h-[210px] w-full object-cover opacity-90 transition duration-300 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full min-h-[210px] w-full items-center justify-center" style={{ backgroundColor: accent }}>
                            <ImageIcon size={28} className="text-white/90" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                      </div>
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
                                title="Leave workspace"
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
                              <div className="mt-1">Owner: {group.creator?.name || (isCreator ? 'You' : 'Member')}</div>
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

      <CreateGroupModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={createGroup}
      />
    </div>
  );
}
