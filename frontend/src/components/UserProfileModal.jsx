import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Briefcase, Building2, Calendar, Clock, Loader2, Mail, MessageCircle, PlayCircle, User, UserCheck, UserPlus, UserX, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { resolveMediaUrl } from '../utils/media';
import { formatStoryAge, getStoryListForActiveStory, groupActiveStoriesByOwner } from '../utils/stories';
import { useNavigate } from 'react-router-dom';
import RankBadge, { RankEmblem } from './RankBadge';
import GameRankBadge, { GameRankEmblem, getProfileFrameClass } from './GameRankBadge';
import { useAuth } from '../context/AuthContext';
import StoryViewer from './StoryViewer';
import VideoThumbnail from './VideoThumbnail';

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
  const [stories, setStories] = useState([]);
  const [activeStory, setActiveStory] = useState(null);
  const [storyCommenting, setStoryCommenting] = useState(false);
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const profileId = userId || getEntityId(user);
  const isSelf = profileId && getEntityId(currentUser) === String(profileId);

  useEffect(() => {
    if (!isOpen) {
      setActiveStory(null);
      return;
    }
    setProfile(user || null);
    setFriendship(user?.friendship || { status: 'none' });

    if (!profileId) return;
    let cancelled = false;
    const loadProfile = async () => {
      setLoading(true);
      try {
        const [res, storiesRes] = await Promise.all([
          api.get(`/users/${profileId}/public`),
          api.get(`/stories/user/${profileId}/grouped`).catch(() => (
            api.get(`/stories/user/${profileId}`).catch(() => ({ data: [] }))
          ))
        ]);
        if (!cancelled) {
          setProfile(res.data);
          setFriendship(res.data?.friendship || { status: 'none' });
          setStories(Array.isArray(storiesRes.data) ? storiesRes.data : storiesRes.data?.stories || []);
        }
      } catch (err) {
        if (!cancelled && user) {
          setProfile(user);
          setFriendship(user?.friendship || { status: 'none' });
          setStories([]);
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
  const coverPhoto = resolveMediaUrl(profile?.coverPhoto);
  const storyGroups = groupActiveStoriesByOwner(stories);
  const activeStoryList = getStoryListForActiveStory(storyGroups, activeStory);
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

  const closeModal = (event) => {
    event?.stopPropagation?.();
    onClose?.();
  };

  const syncStory = (updatedStory) => {
    setStories(prev => prev.map(story => getEntityId(story) === getEntityId(updatedStory) ? updatedStory : story));
    setActiveStory(prev => getEntityId(prev) === getEntityId(updatedStory) ? updatedStory : prev);
    window.dispatchEvent(new CustomEvent('storiesUpdated'));
  };

  const openStory = async (story) => {
    setActiveStory(story);
    try {
      const res = await api.post(`/stories/${getEntityId(story)}/view`);
      syncStory(res.data);
    } catch {
      // Viewing should stay smooth even if the analytics request fails.
    }
  };

  const reactToStory = async (story, emoji) => {
    try {
      const res = await api.post(`/stories/${getEntityId(story)}/react`, { emoji });
      syncStory(res.data);
      toast.success('Reaction sent');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Reaction failed');
    }
  };

  const commentOnStory = async (story = activeStory, text = '') => {
    const reply = String(text || '').trim();
    if (!story || !reply || storyCommenting) return;
    setStoryCommenting(true);
    try {
      const res = await api.post(`/stories/${getEntityId(story)}/comment`, { text: reply });
      syncStory(res.data?.story || res.data);
      toast.success('Sent to messages');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Comment failed');
    } finally {
      setStoryCommenting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-4"
          onMouseDown={closeModal}
        >
          <div
            className="mobile-profile-modal h-auto max-h-[88svh] w-full max-w-[520px] overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="max-h-[88svh] overflow-y-auto">
              <div className="relative overflow-hidden bg-gray-950 p-4 text-white sm:p-5">
              {coverPhoto ? (
                <img src={coverPhoto} alt="Profile cover" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(34,211,238,0.28),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.28),transparent_34%),linear-gradient(135deg,#020617,#111827_58%,#172554)]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/45 to-black/15" />
              <button
                type="button"
                onClick={closeModal}
                className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.65rem)] z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-2xl backdrop-blur transition hover:-translate-x-0.5 hover:bg-white/20 hover:text-white sm:left-4 sm:top-4 sm:h-12 sm:w-12"
                aria-label="Back"
              >
                <ArrowLeft size={24} strokeWidth={2.8} />
              </button>
              <div className="relative z-10 flex items-end gap-3 pt-12">
                <div className={`flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white/15 bg-gradient-to-br from-pink-500 to-indigo-500 text-xl font-black text-white sm:h-20 sm:w-20 ${getProfileFrameClass(profile?.gameStats)} ${storyGroups.length ? 'ring-blue-400 shadow-blue-500/35' : ''}`}>
                  {avatar ? <img src={avatar} alt={profile?.name || 'User'} className="h-full w-full object-cover" /> : initials}
                </div>
                <div className="min-w-0 pb-1">
                  <p className="text-xs font-bold uppercase text-blue-100">Profile</p>
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

              {storyGroups.length > 0 && (
                <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-gray-950 dark:text-white">My Day</p>
                    <span className="rounded-full bg-pink-50 px-2 py-1 text-xs font-black text-pink-600 dark:bg-pink-950/30 dark:text-pink-200">{stories.length}</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {storyGroups.map(group => {
                      const story = group.preview;
                      const storyUrl = resolveMediaUrl(story.fileUrl);
                      return (
                        <button
                          key={group.ownerId}
                          type="button"
                          onClick={() => openStory(story)}
                          className="relative h-36 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-950"
                        >
                          {story.fileType === 'image' ? (
                            <img src={storyUrl} alt={story.caption || 'My Day'} className="h-full w-full object-cover" />
                          ) : (
                            <VideoThumbnail src={storyUrl} className="h-full w-full" iconSize={20} label={`${profile?.name || 'Member'} story video`} />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                          {group.count > 1 && (
                            <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-black text-white backdrop-blur">
                              {group.count}
                            </span>
                          )}
                          {formatStoryAge(story) && (
                            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-black text-white backdrop-blur">
                              {formatStoryAge(story)}
                            </span>
                          )}
                          {story.fileType === 'video' && <PlayCircle className={`absolute right-2 text-white ${group.count > 1 ? 'top-9' : 'top-2'}`} size={20} />}
                          <p className="absolute inset-x-2 bottom-2 line-clamp-2 text-left text-xs font-black text-white">{story.caption || 'View story'}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <RankEmblem rank={profile?.rankStats?.rank} size="sm" animated />
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
                  <GameRankEmblem rank={profile?.gameStats?.rank} size="sm" animated />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase text-gray-500 dark:text-gray-400">Division Rank</p>
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1877f2] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#0f63d5]"
                >
                  <MessageCircle size={18} />
                  Message
                </button>
              </div>
              </div>
            </div>
          </div>

          <StoryViewer
            story={activeStory}
            stories={activeStoryList}
            currentUser={currentUser}
            onClose={() => setActiveStory(null)}
            onNavigate={openStory}
            onReact={reactToStory}
            onComment={commentOnStory}
            zIndexClass="z-[130]"
          />
        </div>
  , document.body);
}
