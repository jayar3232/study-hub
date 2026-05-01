import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Check,
  Clock,
  Inbox,
  Loader2,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { resolveMediaUrl } from '../utils/media';
import UserProfileModal from './UserProfileModal';
import { CAMPUS_OPTIONS } from '../utils/academics';

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const emptySummary = {
  friends: [],
  incoming: [],
  outgoing: [],
  people: [],
  counts: { friends: 0, incoming: 0, outgoing: 0, people: 0 }
};

const statusCopy = {
  none: { label: 'Not connected', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  friends: { label: 'Friends', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/60' },
  outgoing: { label: 'Pending', className: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/60' },
  incoming: { label: 'Needs reply', className: 'bg-pink-50 text-pink-700 ring-pink-100 dark:bg-pink-950/30 dark:text-pink-200 dark:ring-pink-900/60' }
};

const formatSince = (value) => {
  if (!value) return 'Recently connected';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const matchesSearch = (person, query) => {
  const value = query.trim().toLowerCase();
  if (!value) return true;
  return [person?.name, person?.email, person?.course, person?.campus]
    .filter(Boolean)
    .some(field => field.toLowerCase().includes(value));
};

const matchesCampus = (person, campus) => !campus || person?.campus === campus;

const announceFriendUpdate = () => {
  window.dispatchEvent(new CustomEvent('friendsUpdated'));
};

function Avatar({ person, size = 'md' }) {
  const avatar = resolveMediaUrl(person?.avatar);
  const sizeClass = size === 'lg' ? 'h-14 w-14 text-lg' : 'h-11 w-11 text-sm';

  return (
    <div className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500 to-indigo-500 font-black text-white shadow-sm`}>
      {avatar ? (
        <img src={avatar} alt={person?.name || 'User'} className="h-full w-full object-cover" />
      ) : (
        (person?.name || 'U').charAt(0).toUpperCase()
      )}
    </div>
  );
}

function RelationshipPill({ status }) {
  const item = statusCopy[status] || statusCopy.none;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ring-1 ring-inset ${item.className}`}>
      {item.label}
    </span>
  );
}

function EmptyPanel({ icon: Icon, title, message }) {
  return (
    <div className="rounded-3xl border border-dashed border-gray-200 bg-white/70 px-5 py-12 text-center dark:border-gray-800 dark:bg-gray-900/60">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300">
        <Icon size={24} />
      </div>
      <h3 className="mt-4 text-lg font-black text-gray-950 dark:text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}

export default function Friends() {
  const [summary, setSummary] = useState(emptySummary);
  const [activeTab, setActiveTab] = useState('friends');
  const [query, setQuery] = useState('');
  const [campusFilter, setCampusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState('');
  const [profileUser, setProfileUser] = useState(null);
  const navigate = useNavigate();

  const loadFriends = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await api.get('/friends/summary');
      setSummary({
        ...emptySummary,
        ...res.data,
        counts: { ...emptySummary.counts, ...(res.data?.counts || {}) }
      });
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to load friends');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => loadFriends(false);
    socket.on('friend-request-updated', refresh);
    return () => socket.off('friend-request-updated', refresh);
  }, [loadFriends]);

  const friends = useMemo(
    () => (summary.friends || [])
      .filter(item => matchesSearch(item.user, query))
      .filter(item => matchesCampus(item.user, campusFilter)),
    [summary.friends, query, campusFilter]
  );

  const people = useMemo(
    () => (summary.people || [])
      .filter(person => matchesSearch(person, query))
      .filter(person => matchesCampus(person, campusFilter)),
    [summary.people, query, campusFilter]
  );

  const incoming = useMemo(
    () => (summary.incoming || [])
      .filter(item => matchesSearch(item.requester, query))
      .filter(item => matchesCampus(item.requester, campusFilter)),
    [summary.incoming, query, campusFilter]
  );

  const outgoing = useMemo(
    () => (summary.outgoing || [])
      .filter(item => matchesSearch(item.recipient, query))
      .filter(item => matchesCampus(item.recipient, campusFilter)),
    [summary.outgoing, query, campusFilter]
  );

  const sendRequest = async (person) => {
    const personId = getEntityId(person);
    setActionKey(`send-${personId}`);
    try {
      await api.post(`/friends/request/${personId}`);
      toast.success('Friend request sent');
      await loadFriends(false);
      announceFriendUpdate();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Request failed');
    } finally {
      setActionKey('');
    }
  };

  const acceptRequest = async (requestId) => {
    setActionKey(`accept-${requestId}`);
    try {
      await api.put(`/friends/requests/${requestId}/accept`);
      toast.success('Friend request accepted');
      await loadFriends(false);
      announceFriendUpdate();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Accept failed');
    } finally {
      setActionKey('');
    }
  };

  const declineRequest = async (requestId) => {
    setActionKey(`decline-${requestId}`);
    try {
      await api.put(`/friends/requests/${requestId}/decline`);
      toast.success('Friend request declined');
      await loadFriends(false);
      announceFriendUpdate();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Decline failed');
    } finally {
      setActionKey('');
    }
  };

  const removeFriend = async (friendshipId) => {
    setActionKey(`remove-${friendshipId}`);
    try {
      await api.delete(`/friends/${friendshipId}`);
      toast.success('Friend removed');
      await loadFriends(false);
      announceFriendUpdate();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Remove failed');
    } finally {
      setActionKey('');
    }
  };

  const openMessages = (person) => {
    const id = getEntityId(person);
    navigate(id ? `/messages?user=${id}` : '/messages');
  };

  const renderPersonAction = (person) => {
    const relation = person.friendship || { status: 'none' };
    const requestId = relation.requestId;
    const personId = getEntityId(person);

    if (relation.status === 'incoming') {
      return (
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => acceptRequest(requestId)}
            disabled={actionKey === `accept-${requestId}`}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {actionKey === `accept-${requestId}` ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Accept
          </button>
          <button
            type="button"
            onClick={() => declineRequest(requestId)}
            disabled={actionKey === `decline-${requestId}`}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <X size={14} />
            Decline
          </button>
        </div>
      );
    }

    if (relation.status === 'friends') {
      return (
        <button
          type="button"
          onClick={() => openMessages(person)}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gray-950 px-3 py-2 text-xs font-black text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100"
        >
          <MessageCircle size={14} />
          Message
        </button>
      );
    }

    if (relation.status === 'outgoing') {
      return (
        <button
          type="button"
          disabled
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 ring-1 ring-inset ring-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/60"
        >
          <Clock size={14} />
          Pending
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => sendRequest(person)}
        disabled={actionKey === `send-${personId}`}
        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-pink-600 px-3 py-2 text-xs font-black text-white transition hover:bg-pink-700 disabled:opacity-50"
      >
        {actionKey === `send-${personId}` ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
        Add
      </button>
    );
  };

  const tabs = [
    { key: 'friends', label: 'Friends', count: summary.counts?.friends || 0 },
    { key: 'add', label: 'Add Friend', count: summary.counts?.people || people.length },
    { key: 'requests', label: 'Requests', count: (summary.counts?.incoming || 0) + (summary.counts?.outgoing || 0) }
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gray-950 text-white shadow-2xl shadow-pink-500/10">
        <div className="relative p-5 sm:p-7">
          <div className="absolute -right-12 top-3 h-32 w-32 rounded-full border-[14px] border-cyan-300/20" />
          <div className="absolute -bottom-16 left-1/2 h-40 w-40 rounded-full border-[18px] border-pink-400/20" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                animate={{ y: [0, -4, 0], rotate: [0, 1, -1, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white text-gray-950 shadow-xl"
              >
                <Users size={30} />
              </motion.div>
              <div>
                <p className="text-sm font-black uppercase text-pink-200">WorkLoop Network</p>
                <h1 className="mt-1 text-3xl font-black tracking-normal sm:text-4xl">Friends</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                  Manage your trusted teammates, review requests, and start conversations faster.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
              {[
                ['Friends', summary.counts?.friends || 0],
                ['Requests', summary.counts?.incoming || 0],
                ['Pending', summary.counts?.outgoing || 0]
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10 backdrop-blur">
                  <p className="text-xs font-bold text-white/60">{label}</p>
                  <p className="mt-1 text-2xl font-black">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition ${
                  activeTab === tab.key
                    ? 'bg-gray-950 text-white shadow-lg shadow-gray-950/10 dark:bg-white dark:text-gray-950'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === tab.key ? 'bg-white/15' : 'bg-white dark:bg-gray-900'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_210px] lg:max-w-xl">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search people, course, campus"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-pink-500"
              />
            </div>
            <select
              value={campusFilter}
              onChange={event => setCampusFilter(event.target.value)}
              className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-bold text-gray-700 outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:focus:border-pink-500"
            >
              <option value="">All campuses</option>
              {CAMPUS_OPTIONS.map(campus => <option key={campus} value={campus}>{campus}</option>)}
            </select>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map(item => (
            <div key={item} className="h-36 animate-pulse rounded-3xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : (
        <>
          {activeTab === 'friends' && (
            <section className="space-y-4">
              {summary.incoming?.length > 0 && (
                <div className="rounded-3xl border border-pink-100 bg-pink-50 p-4 dark:border-pink-900/50 dark:bg-pink-950/20">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-pink-600 shadow-sm dark:bg-gray-900 dark:text-pink-300">
                        <Inbox size={20} />
                      </div>
                      <div>
                        <h2 className="font-black text-gray-950 dark:text-white">You have friend requests</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300">Review them before they join your friends list.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('requests')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-sm font-black text-white transition hover:bg-pink-700"
                    >
                      Review
                    </button>
                  </div>
                </div>
              )}

              {friends.length === 0 ? (
                <EmptyPanel icon={UserCheck} title="No friends yet" message="Open Add Friend to send requests to existing WorkLoop users." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {friends.map(item => (
                    <motion.article
                      key={item._id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-xl hover:shadow-pink-500/10 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-pink-900/60"
                    >
                      <div className="flex items-start gap-3">
                        <button type="button" onClick={() => setProfileUser(item.user)} className="shrink-0 rounded-2xl focus:outline-none focus:ring-4 focus:ring-pink-500/20">
                          <Avatar person={item.user} size="lg" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <button type="button" onClick={() => setProfileUser(item.user)} className="block max-w-full text-left">
                            <h3 className="truncate text-lg font-black text-gray-950 dark:text-white">{item.user?.name || 'User'}</h3>
                            <p className="truncate text-sm text-gray-500">{item.user?.email}</p>
                            <p className="truncate text-xs font-semibold text-gray-400">{[item.user?.course, item.user?.campus].filter(Boolean).join(' - ') || 'Academic details not set'}</p>
                          </button>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <RelationshipPill status="friends" />
                            <span className="text-xs font-semibold text-gray-500">Since {formatSince(item.since)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => openMessages(item.user)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-950 px-3 py-2.5 text-sm font-black text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100"
                        >
                          <MessageCircle size={16} />
                          Message
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFriend(item._id)}
                          disabled={actionKey === `remove-${item._id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-3 py-2.5 text-gray-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:border-gray-700 dark:hover:border-rose-900/60 dark:hover:bg-rose-950/20 dark:hover:text-rose-300"
                          title="Remove friend"
                        >
                          {actionKey === `remove-${item._id}` ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                        </button>
                      </div>
                    </motion.article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'add' && (
            <section className="space-y-3">
              {people.length === 0 ? (
                <EmptyPanel icon={Sparkles} title="Everyone is connected" message="No new people to add right now. New users will appear here automatically." />
              ) : (
                people.map(person => (
                  <motion.article
                    key={getEntityId(person)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-3 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-500/10 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-cyan-900/60 sm:flex-row sm:items-center"
                  >
                    <button type="button" onClick={() => setProfileUser(person)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <Avatar person={person} />
                      <div className="min-w-0">
                        <h3 className="truncate font-black text-gray-950 dark:text-white">{person.name}</h3>
                        <p className="truncate text-sm text-gray-500">{person.email}</p>
                        <p className="truncate text-xs font-semibold text-gray-400">{[person.course, person.campus].filter(Boolean).join(' - ') || 'Academic details not set'}</p>
                      </div>
                    </button>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <RelationshipPill status={person.friendship?.status || 'none'} />
                      {renderPersonAction(person)}
                    </div>
                  </motion.article>
                ))
              )}
            </section>
          )}

          {activeTab === 'requests' && (
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={20} className="text-pink-500" />
                  <h2 className="text-lg font-black text-gray-950 dark:text-white">Incoming Requests</h2>
                </div>
                {incoming.length === 0 ? (
                  <EmptyPanel icon={Inbox} title="No incoming requests" message="Friend requests from other users will appear here for confirmation." />
                ) : (
                  incoming.map(item => (
                    <article key={item._id} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex items-start gap-3">
                        <button type="button" onClick={() => setProfileUser(item.requester)} className="shrink-0">
                          <Avatar person={item.requester} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <button type="button" onClick={() => setProfileUser(item.requester)} className="block max-w-full text-left">
                            <h3 className="truncate font-black text-gray-950 dark:text-white">{item.requester?.name}</h3>
                            <p className="truncate text-sm text-gray-500">{item.requester?.email}</p>
                            <p className="truncate text-xs font-semibold text-gray-400">{[item.requester?.course, item.requester?.campus].filter(Boolean).join(' - ') || 'Academic details not set'}</p>
                          </button>
                          <p className="mt-1 text-xs font-semibold text-gray-400">Requested {formatSince(item.createdAt)}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => acceptRequest(item._id)}
                          disabled={actionKey === `accept-${item._id}`}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check size={16} />
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => declineRequest(item._id)}
                          disabled={actionKey === `decline-${item._id}`}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <UserX size={16} />
                          Decline
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock size={20} className="text-amber-500" />
                  <h2 className="text-lg font-black text-gray-950 dark:text-white">Sent Requests</h2>
                </div>
                {outgoing.length === 0 ? (
                  <EmptyPanel icon={Clock} title="No pending sent requests" message="Requests you send from Add Friend will stay here until accepted or declined." />
                ) : (
                  outgoing.map(item => (
                    <article key={item._id} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setProfileUser(item.recipient)} className="shrink-0">
                          <Avatar person={item.recipient} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <button type="button" onClick={() => setProfileUser(item.recipient)} className="block max-w-full text-left">
                            <h3 className="truncate font-black text-gray-950 dark:text-white">{item.recipient?.name}</h3>
                            <p className="truncate text-sm text-gray-500">{item.recipient?.email}</p>
                            <p className="truncate text-xs font-semibold text-gray-400">{[item.recipient?.course, item.recipient?.campus].filter(Boolean).join(' - ') || 'Academic details not set'}</p>
                          </button>
                          <p className="mt-1 text-xs font-semibold text-gray-400">Sent {formatSince(item.createdAt)}</p>
                        </div>
                        <RelationshipPill status="outgoing" />
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          )}
        </>
      )}

      <UserProfileModal isOpen={Boolean(profileUser)} user={profileUser} onClose={() => setProfileUser(null)} />
    </div>
  );
}
