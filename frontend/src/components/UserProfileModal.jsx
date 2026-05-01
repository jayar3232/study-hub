import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Briefcase, Calendar, Mail, MessageCircle, User, X } from 'lucide-react';
import api from '../services/api';
import { resolveMediaUrl } from '../utils/media';
import { useNavigate } from 'react-router-dom';
import RankBadge, { RankEmblem } from './RankBadge';
import GameRankBadge, { GameRankEmblem } from './GameRankBadge';

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const formatMemberSince = (value) => {
  if (!value) return 'Recently joined';
  return new Date(value).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

export default function UserProfileModal({ isOpen, user, userId, onClose }) {
  const [profile, setProfile] = useState(user || null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const profileId = userId || getEntityId(user);

  useEffect(() => {
    if (!isOpen) return;
    setProfile(user || null);

    if (!profileId) return;
    let cancelled = false;
    const loadProfile = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/users/${profileId}/public`);
        if (!cancelled) setProfile(res.data);
      } catch (err) {
        if (!cancelled && user) setProfile(user);
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="relative bg-gray-950 p-6 text-white">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Close profile"
              >
                <X size={18} />
              </button>
              <div className="flex items-end gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white/15 bg-gradient-to-br from-pink-500 to-indigo-500 text-2xl font-black text-white shadow-xl">
                  {avatar ? <img src={avatar} alt={profile?.name || 'User'} className="h-full w-full object-cover" /> : initials}
                </div>
                <div className="min-w-0 pb-1">
                  <p className="text-xs font-bold uppercase text-pink-200">Member profile</p>
                  <h2 className="mt-1 break-words text-2xl font-bold">{profile?.name || (loading ? 'Loading...' : 'User')}</h2>
                  <p className="mt-1 truncate text-sm text-white/70">{profile?.course || 'No course added'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
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

              <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
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

              <button
                type="button"
                onClick={openMessages}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-pink-700"
              >
                <MessageCircle size={18} />
                Open Messages
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
