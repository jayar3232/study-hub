import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Camera,
  MessageCircle,
  PlayCircle,
  PlusCircle,
  Trophy,
  Users
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePresence } from '../context/PresenceContext';
import { resolveMediaUrl } from '../utils/media';
import { getStoryListForActiveStory, groupActiveStoriesByOwner } from '../utils/stories';
import RankBadge, { RankEmblem } from './RankBadge';
import GameRankBadge, { GameRankEmblem } from './GameRankBadge';
import OnlineRoster from './OnlineRoster';
import LoadingSpinner from './LoadingSpinner';
import { playUiSound } from '../utils/sound';
import StoryViewer from './StoryViewer';
import VideoThumbnail from './VideoThumbnail';
import HomeFeed from './HomeFeed';

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const compactNumber = (value = 0) => {
  const number = Number(value || 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return String(number);
};

function Avatar({ user, size = 'h-14 w-14' }) {
  const avatar = resolveMediaUrl(user?.avatar);
  return (
    <span className={`${size} grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#1877f2] to-[#00b2ff] text-lg font-black text-white`}>
      {avatar ? <img src={avatar} alt={user?.name || 'User'} className="h-full w-full object-cover" /> : (user?.name || 'U').charAt(0).toUpperCase()}
    </span>
  );
}

function Panel({ title, helper, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3">
        <h2 className="text-base font-black text-gray-950 dark:text-white">{title}</h2>
        {helper && <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{helper}</p>}
      </div>
      {children}
    </section>
  );
}

function RankLeaderRow({ entry, index }) {
  const user = entry?.user || {};
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/60">
      <span className="w-6 text-center text-sm font-black text-gray-500 dark:text-gray-400">#{index + 1}</span>
      <RankEmblem rank={entry?.stats?.rank} size="sm" animated />
      <Avatar user={user} size="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-gray-950 dark:text-white">{user.name || 'Member'}</p>
        <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">
          {entry?.stats?.rank?.shortName || 'Rookie'} - {entry?.stats?.completedTasks || 0} tasks
        </p>
      </div>
      <span className="text-sm font-black text-gray-950 dark:text-white">{compactNumber(entry?.stats?.xp)}</span>
    </div>
  );
}

function GameLeaderRow({ entry, index }) {
  const user = entry?.user || {};
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/60">
      <span className="w-6 text-center text-sm font-black text-gray-500 dark:text-gray-400">#{index + 1}</span>
      <GameRankEmblem rank={entry?.stats?.rank} size="sm" animated stars={entry?.stats?.apexStars} />
      <Avatar user={user} size="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-gray-950 dark:text-white">{user.name || 'Member'}</p>
        <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">
          {entry?.stats?.rank?.shortName || 'Recruit'} - {entry?.stats?.totalPlays || 0} runs
        </p>
      </div>
      <span className="text-sm font-black text-gray-950 dark:text-white">{compactNumber(entry?.stats?.highScore)}</span>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { onlinePeople, stories, storyGroups: presenceStoryGroups } = usePresence();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [rankData, setRankData] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStory, setActiveStory] = useState(null);

  const currentUserId = getEntityId(user);

  useEffect(() => {
    try {
      const lastPlayed = Number(window.sessionStorage.getItem('syncrova-welcome-sound-last') || 0);
      const currentTime = Date.now();
      if (currentTime - lastPlayed > 1500) {
        window.sessionStorage.setItem('syncrova-welcome-sound-last', String(currentTime));
        playUiSound('welcome', 0.28);
      }
    } catch {
      playUiSound('welcome', 0.28);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [dashboardRes, rankRes, gameRes] = await Promise.all([
          api.get('/dashboard/summary').catch(async () => {
            const [groupRes, conversationRes] = await Promise.all([
              api.get('/groups').catch(() => ({ data: [] })),
              api.get('/messages/conversations').catch(() => ({ data: [] }))
            ]);
            return {
              data: {
                groups: groupRes.data || [],
                tasks: [],
                conversations: conversationRes.data || []
              }
            };
          }),
          api.get('/users/rankings/me').catch(() => ({ data: null })),
          api.get('/games/summary/me').catch(() => ({ data: null }))
        ]);

        if (cancelled) return;
        setGroups(dashboardRes.data?.groups || []);
        setTasks(dashboardRes.data?.tasks || []);
        setConversations(dashboardRes.data?.conversations || []);
        setRankData(rankRes.data);
        setGameData(gameRes.data);
        window.dispatchEvent(new Event('groupsUpdated'));
      } catch (err) {
        if (!cancelled) toast.error('Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const storyRail = useMemo(() => (
    (presenceStoryGroups?.length ? presenceStoryGroups : groupActiveStoriesByOwner(stories)).slice(0, 12)
  ), [presenceStoryGroups, stories]);

  const activeStoryList = useMemo(() => (
    getStoryListForActiveStory(storyRail, activeStory)
  ), [activeStory, storyRail]);

  const unreadMessages = useMemo(() => (
    conversations.reduce((sum, conversation) => sum + (conversation.unreadCount || 0), 0)
  ), [conversations]);

  const completedTasks = useMemo(() => (
    tasks.filter(task => task.status === 'done').length
  ), [tasks]);

  const rankStats = rankData?.me;
  const gameStats = gameData?.stats || gameData?.typingStats;
  const rankLeaders = rankData?.leaderboard || [];
  const gameLeaders = gameData?.leaderboard || [];

  const openStory = async (story) => {
    setActiveStory(story);
    try {
      const res = await api.post(`/stories/${getEntityId(story)}/view`);
      setActiveStory(prev => getEntityId(prev) === getEntityId(story) ? res.data : prev);
      window.dispatchEvent(new CustomEvent('storiesUpdated'));
    } catch {
      // Viewing should stay instant even when the counter request fails.
    }
  };

  const syncActiveStory = (updatedStory) => {
    setActiveStory(prev => getEntityId(prev) === getEntityId(updatedStory) ? updatedStory : prev);
    window.dispatchEvent(new CustomEvent('storiesUpdated'));
  };

  const reactToStory = async (story, emoji) => {
    try {
      const res = await api.post(`/stories/${getEntityId(story)}/react`, { emoji });
      syncActiveStory(res.data);
      toast.success('Reaction sent');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Reaction failed');
    }
  };

  const commentOnStory = async (story, text) => {
    const reply = String(text || '').trim();
    if (!reply) return;
    try {
      const res = await api.post(`/stories/${getEntityId(story)}/comment`, { text: reply });
      syncActiveStory(res.data?.story || res.data);
      toast.success('Sent to messages');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Comment failed');
    }
  };

  const deleteStory = async (storyId) => {
    try {
      await api.delete(`/stories/${storyId}`);
      setActiveStory(null);
      window.dispatchEvent(new CustomEvent('storiesUpdated'));
      toast.success('My Day deleted');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Delete failed');
    }
  };

  if (loading) {
    return (
      <div className="mobile-page mx-auto max-w-7xl px-0 py-1 sm:px-6 sm:py-4 lg:px-8">
        <LoadingSpinner label="Loading home" />
      </div>
    );
  }

  return (
    <div className="mobile-page mx-auto max-w-7xl px-0 py-1 sm:px-6 sm:py-4 lg:px-8">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-black text-gray-950 dark:text-white">Home</h1>
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Stories, posts, active friends, and ranks.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1877f2] px-3 py-2 text-xs font-black text-white hover:bg-[#0f63d5]"
              >
                <PlusCircle size={15} />
                My Day
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex h-40 w-28 shrink-0 flex-col justify-end overflow-hidden rounded-2xl border border-blue-100 bg-blue-50 p-3 text-left text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-blue-100"
              >
                <span className="mb-auto grid h-10 w-10 place-items-center rounded-full bg-[#1877f2] text-white">
                  <Camera size={19} />
                </span>
                <span className="text-sm font-black leading-tight">Create My Day</span>
              </button>
              {storyRail.map(group => {
                const story = group.preview;
                const owner = group.owner || story.userId || {};
                const storyUrl = resolveMediaUrl(story.fileUrl);
                return (
                  <button
                    key={group.ownerId}
                    type="button"
                    onClick={() => openStory(story)}
                    className="relative h-40 w-28 shrink-0 overflow-hidden rounded-2xl bg-gray-950 text-left shadow-sm ring-1 ring-gray-200 dark:ring-gray-800"
                  >
                    {story.fileType === 'image' ? (
                      <img src={storyUrl} alt={owner.name || 'Story'} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <VideoThumbnail src={storyUrl} className="h-full w-full" iconSize={20} label={`${owner.name || 'Member'} story video`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/10 to-black/25" />
                    <div className="absolute left-2 top-2 grid h-9 w-9 place-items-center overflow-hidden rounded-full border-2 border-[#1877f2] bg-[#1877f2] text-xs font-black text-white">
                      {owner.avatar ? <img src={resolveMediaUrl(owner.avatar)} alt={owner.name || 'User'} className="h-full w-full object-cover" /> : owner.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    {group.count > 1 && (
                      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-black text-white">
                        {group.count}
                      </span>
                    )}
                    {story.fileType === 'video' && <PlayCircle className={`absolute right-2 text-white ${group.count > 1 ? 'top-9' : 'top-2'}`} size={20} />}
                    <p className="absolute inset-x-2 bottom-2 line-clamp-2 text-xs font-black text-white">{owner.name || 'Member'}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:hidden">
            <Panel title="Your profile" helper="Home overview">
              <div className="flex items-center gap-3">
                <Avatar user={user} size="h-14 w-14" />
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-gray-950 dark:text-white">{user?.name || 'Student'}</p>
                  <p className="truncate text-sm font-semibold text-gray-500 dark:text-gray-400">{user?.email || 'SYNCROVA member'}</p>
                </div>
              </div>
            </Panel>
            <Panel title="Quick status">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-gray-50 p-3 text-center dark:bg-gray-950/60">
                  <p className="text-lg font-black text-gray-950 dark:text-white">{groups.length}</p>
                  <p className="text-[11px] font-black text-gray-500 dark:text-gray-400">Spaces</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3 text-center dark:bg-gray-950/60">
                  <p className="text-lg font-black text-gray-950 dark:text-white">{onlinePeople.length}</p>
                  <p className="text-[11px] font-black text-gray-500 dark:text-gray-400">Online</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3 text-center dark:bg-gray-950/60">
                  <p className="text-lg font-black text-gray-950 dark:text-white">{unreadMessages}</p>
                  <p className="text-[11px] font-black text-gray-500 dark:text-gray-400">Unread</p>
                </div>
              </div>
            </Panel>
          </div>

          <HomeFeed currentUser={user} />

          <section className="grid gap-4 lg:grid-cols-2">
            <RankBadge stats={rankStats} />
            <GameRankBadge stats={gameStats} />
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <OnlineRoster limit={12} title="Active now" />

          <Panel title="Network ranks" helper="Top workspace contributors">
            <div className="space-y-2">
              {rankLeaders.slice(0, 5).map((entry, index) => (
                <RankLeaderRow key={getEntityId(entry.user) || index} entry={entry} index={index} />
              ))}
              {!rankLeaders.length && (
                <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-950/60 dark:text-gray-400">
                  Complete tasks to start the leaderboard.
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Arena ranks" helper="Best game performers">
            <div className="space-y-2">
              {gameLeaders.slice(0, 5).map((entry, index) => (
                <GameLeaderRow key={getEntityId(entry.user) || index} entry={entry} index={index} />
              ))}
              {!gameLeaders.length && (
                <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-950/60 dark:text-gray-400">
                  Play Fix Arena games to show ranks here.
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Shortcuts">
            <div className="grid gap-2">
              <button type="button" onClick={() => navigate('/messages')} className="flex items-center gap-3 rounded-2xl bg-gray-50 px-3 py-3 text-left text-sm font-black text-gray-800 hover:bg-blue-50 hover:text-[#1877f2] dark:bg-gray-950/60 dark:text-gray-100 dark:hover:bg-blue-950/20">
                <MessageCircle size={18} />
                Messages
              </button>
              <button type="button" onClick={() => navigate('/friends')} className="flex items-center gap-3 rounded-2xl bg-gray-50 px-3 py-3 text-left text-sm font-black text-gray-800 hover:bg-blue-50 hover:text-[#1877f2] dark:bg-gray-950/60 dark:text-gray-100 dark:hover:bg-blue-950/20">
                <Users size={18} />
                Friends
              </button>
              <button type="button" onClick={() => navigate('/arena')} className="flex items-center gap-3 rounded-2xl bg-gray-50 px-3 py-3 text-left text-sm font-black text-gray-800 hover:bg-blue-50 hover:text-[#1877f2] dark:bg-gray-950/60 dark:text-gray-100 dark:hover:bg-blue-950/20">
                <Trophy size={18} />
                Fix Arena
              </button>
            </div>
          </Panel>
        </aside>
      </div>

      <StoryViewer
        story={activeStory}
        stories={activeStoryList}
        currentUser={user}
        onClose={() => setActiveStory(null)}
        onNavigate={openStory}
        onReact={reactToStory}
        onComment={commentOnStory}
        onDelete={deleteStory}
      />
    </div>
  );
}
