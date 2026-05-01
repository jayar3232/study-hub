import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Briefcase, Building2, Calendar, Clock, Loader2, Mail, MessageCircle, User, UserCheck, UserPlus, UserX, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { resolveMediaUrl } from '../utils/media';
import { useNavigate } from 'react-router-dom';
import RankBadge, { RankEmblem } from './RankBadge';
import GameRankBadge, { GameRankEmblem } from './GameRankBadge';
import { useAuth } from '../context/AuthContext';

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const formatMemberSince = (value) => {
  if (!value) return 'Recently joined';
  return new Date(value).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

export default function UserProfileModal({ isOpen, user, userId, onClose }) {
  const [profile, setProfile] = useState(user || null);
  const [friendship, setFriendship] = useState(user?.friendship || { status: 'none' });
  const [loading, setLoading] = useState(false);
  const [friendAction, setFriendAction] = useState('');
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const profileId = userId || getEntityId(user);
  const isSelf = profileId && getEntityId(currentUser) === String(profileId);

  useEffect(() => {
    if (!isOpen) return;
    setProfile(user || null);
    setFriendship(user?.friendship || { status: 'none' });

    if (!profileId) return;
    let cancelled = false;
    const loadProfile = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/users/${profileId}/public`);
        if (!cancelled) {
          setProfile(res.data);
          setFriendship(res.data?.friendship || { status: 'none' });
        }
      } catch (err) {
        if (!cancelled && user) {
          setProfile(user);
          setFriendship(user?.friendship || { status: 'none' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [isOpen, profileId, user]);

  const avatar = resolveMediaUrl(profile?.avatar);
  const initials = useMemo(() => {
    const name = profile?.name || 'User';
    return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  }, [profile]);

  const lastSeen = profile?.lastSeen
    ? `Last active ${formatDistanceToNow(new Date(profile.lastSeen), { addSuffix: true })}`
    : 'Activity not available';

  const openMessages = () => {
    onClose?.();
    navigate(profileId ? `/messages?user=${profileId}` : '/messages');
  };

  const syncFriendBadge = () => {
    window.dispatchEvent(new CustomEvent('friendsUpdated'));
  };

  const updateFriendship = (nextFriendship) => {
    const next = nextFriendship || { status: 'none' };
    setFriendship(next);
    setProfile(prev => prev ? { ...prev, friendship: next } : prev);
    syncFriendBadge();
  };

  const sendFriendRequest = async () => {
    if (!profileId || isSelf) return;
    setFriendAction('send');
    try {
      const res = await api.post(`/friends/request/${profileId}`);
      updateFriendship(res.data?.friendship || { status: 'outgoing' });
      toast.success('Friend request sent');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Friend request failed');
    } finally {
      setFriendAction('');
    }
  };

  const acceptFriendRequest = async () => {
    if (!friendship?.requestId) return;
    setFriendAction('accept');
    try {
      const res = await api.put(`/friends/requests/${friendship.requestId}/accept`);
      updateFriendship(res.data?.friendship || { status: 'friends', requestId: friendship.requestId });
      toast.success('Friend request accepted');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Accept failed');
    } finally {
      setFriendAction('');
    }
  };

  const declineFriendRequest = async () => {
    if (!friendship?.requestId) return;
    setFriendAction('decline');
    try {
      await api.put(`/friends/requests/${friendship.requestId}/decline`);
      updateFriendship({ status: 'none' });
      toast.success('Friend request declined');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Decline failed');
    } finally {
      setFriendAction('');
    }
  };

  const renderFriendAction = () => {
    if (isSelf) return null;

    if (friendship?.status === 'friends') {
      return (
        <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/60">
          <UserCheck size={16} />
          Friends
        </div>
      );
    }

    if (friendship?.status === 'incoming') {
      return (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={acceptFriendRequest}
            disabled={friendAction === 'accept'}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {friendAction === 'accept' ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
            Accept
          </button>
          <button
            type="button"
            onClick={declineFriendRequest}
            disabled={friendAction === 'decline'}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <UserX size={16} />
            Decline
          </button>
        </div>
      );
    }

    if (friendship?.status === 'outgoing') {
      return (
        <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-black text-amber-700 ring-1 ring-inset ring-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/60">
          <Clock size={16} />
          Request pending
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={sendFriendRequest}
        disabled={friendAction === 'send'}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-pink-200 bg-pink-50 px-3 py-2.5 text-sm font-black text-pink-700 transition hover:bg-pink-100 disabled:opacity-50 dark:border-pink-900/60 dark:bg-pink-950/20 dark:text-pink-200 dark:hover:bg-pink-950/40"
      >
        {friendAction === 'send' ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
        Add Friend
      </button>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="max-h-[90vh] w-full max-w-[420px] overflow-hidden rounded-t-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:rounded-3xl"
          >
            <div className="max-h-[90vh] overflow-y-auto">
              <div className="relative bg-gray-950 p-5 text-white">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Close profile"
              >
                <X size={18} />
              </button>
              <div className="flex items-end gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white/15 bg-gradient-to-br from-pink-500 to-indigo-500 text-xl font-black text-white shadow-xl">
                  {avatar ? <img src={avatar} alt={profile?.name || 'User'} className="h-full w-full object-cover" /> : initials}
                </div>
                <div className="min-w-0 pb-1">
                  <p className="text-xs font-bold uppercase text-pink-200">Member profile</p>
                  <h2 className="mt-1 break-words text-xl font-black">{profile?.name || (loading ? 'Loading...' : 'User')}</h2>
                  <p className="mt-1 truncate text-sm text-white/70">{profile?.course || 'No course added'}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-white/55">
                    <Building2 size={13} />
                    {profile?.campus || 'Campus not set'}
                  </p>
                </div>
              </div>
              </div>

              <div className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                    <Briefcase size={14} />
                    Shared spaces
                  </p>
                  <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">{profile?.sharedWorkspaces ?? '-'}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                    <Calendar size={14} />
                    Member since
                  </p>
                  <p className="mt-2 text-sm font-bold text-gray-950 dark:text-white">{formatMemberSince(profile?.createdAt)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <RankEmblem rank={profile?.rankStats?.rank} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase text-gray-500 dark:text-gray-400">Work Rank</p>
                    <p className="truncate text-sm font-black text-gray-950 dark:text-white">{profile?.rankStats?.rank?.name || 'Rookie Operator'}</p>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{profile?.rankStats?.xp || 0} XP · {profile?.rankStats?.completedTasks || 0} completed tasks</p>
                  </div>
                  <RankBadge stats={profile?.rankStats} compact />
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <GameRankEmblem rank={profile?.gameStats?.rank} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase text-gray-500 dark:text-gray-400">Game Rank</p>
                    <p className="truncate text-sm font-black text-gray-950 dark:text-white">{profile?.gameStats?.rank?.name || 'Arena Recruit'}</p>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{profile?.gameStats?.highScore || 0} high score · {profile?.gameStats?.totalPlays || 0} runs</p>
                  </div>
                  <GameRankBadge stats={profile?.gameStats} compact />
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-950 dark:text-white">
                  <User size={16} className="text-pink-500" />
                  About
                </p>
                <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">{profile?.bio || 'No bio added yet.'}</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-gray-700 dark:bg-gray-950 dark:text-gray-300">
                  <Mail size={15} className="text-pink-500" />
                  <span className="min-w-0 truncate">{profile?.email || 'No email'}</span>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2 text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                  {lastSeen}
                </div>
              </div>

              <div className="grid gap-2">
                {renderFriendAction()}
                <button
                  type="button"
                  onClick={openMessages}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-pink-700"
                >
                  <MessageCircle size={18} />
                  Open Messages
                </button>
              </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
