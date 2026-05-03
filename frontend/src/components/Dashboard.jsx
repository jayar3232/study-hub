import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  CloudSun,
  FolderKanban,
  ListTodo,
  MapPin,
  MessageCircle,
  PlayCircle,
  PlusCircle,
  RefreshCw,
  Users
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePresence } from '../context/PresenceContext';
import { resolveMediaUrl } from '../utils/media';
import { getStoryListForActiveStory, groupActiveStoriesByOwner } from '../utils/stories';
import RankBadge from './RankBadge';
import GameRankBadge from './GameRankBadge';
import OnlineRoster from './OnlineRoster';
import LoadingSpinner from './LoadingSpinner';
import { playUiSound } from '../utils/sound';
import StoryViewer from './StoryViewer';
import VideoThumbnail from './VideoThumbnail';

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const weatherLabels = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Cloudy',
  45: 'Foggy',
  48: 'Foggy',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Heavy showers',
  95: 'Thunderstorm'
};

const priorityStyles = {
  high: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-200 dark:ring-rose-900/60',
  medium: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/60',
  low: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700'
};

const formatTime = (value) => value.toLocaleTimeString(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true
});

const formatDate = (value) => value.toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric'
});

const formatShortDate = (value) => {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getWeatherLabel = (code) => weatherLabels[code] || 'Weather';
const getTaskGroupId = (task) => getEntityId(task?.groupId || task?.dashboardGroup);
const isTaskOpen = (task) => task?.status !== 'done';

const endOfToday = () => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

const endOfWeek = () => {
  const date = endOfToday();
  date.setDate(date.getDate() + 7);
  return date;
};

const isOverdueTask = (task) => {
  if (!task?.dueDate || !isTaskOpen(task)) return false;
  const dueDate = new Date(task.dueDate);
  if (Number.isNaN(dueDate.getTime())) return false;
  dueDate.setHours(23, 59, 59, 999);
  return dueDate < new Date();
};

const isDueSoonTask = (task) => {
  if (!task?.dueDate || !isTaskOpen(task)) return false;
  const dueDate = new Date(task.dueDate);
  if (Number.isNaN(dueDate.getTime())) return false;
  return dueDate <= endOfWeek();
};

const SectionHeader = ({ title, helper, action }) => (
  <div className="mb-4 flex items-center justify-between gap-3">
    <div className="min-w-0">
      <h2 className="text-lg font-black text-gray-950 dark:text-white">{title}</h2>
      {helper && <p className="text-sm text-gray-500 dark:text-gray-400">{helper}</p>}
    </div>
    {action}
  </div>
);

const StatCard = ({ icon: Icon, label, value, helper, tone = 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200' }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-900/60">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-2 text-3xl font-black text-gray-950 dark:text-white">{value}</p>
        <p className="mt-1 truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{helper}</p>
      </div>
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone}`}>
        <Icon size={21} />
      </div>
    </div>
  </div>
);

const EmptyPanel = ({ icon: Icon, title, helper }) => (
  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-800 dark:bg-gray-950/60">
    <Icon className="mx-auto text-[#1877f2]" size={30} />
    <p className="mt-3 font-black text-gray-950 dark:text-white">{title}</p>
    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helper}</p>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const { onlinePeople, stories, storyGroups: presenceStoryGroups } = usePresence();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [rankData, setRankData] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeStory, setActiveStory] = useState(null);

  const currentUserId = getEntityId(user);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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
              api.get('/groups'),
              api.get('/messages/conversations').catch(() => ({ data: [] }))
            ]);
            const loadedGroups = groupRes.data || [];
            const taskCollections = await Promise.all(
              loadedGroups.map(group => (
                api.get(`/tasks/group/${getEntityId(group)}`)
                  .then(res => (res.data || []).map(task => ({ ...task, dashboardGroup: group })))
                  .catch(() => [])
              ))
            );
            return {
              data: {
                groups: loadedGroups,
                tasks: taskCollections.flat(),
                conversations: conversationRes.data || []
              }
            };
          }),
          api.get('/users/rankings/me').catch(() => ({ data: null })),
          api.get('/games/summary/me').catch(() => ({ data: null }))
        ]);

        const loadedGroups = dashboardRes.data?.groups || [];
        const groupMap = new Map(loadedGroups.map(group => [getEntityId(group), group]));
        const loadedTasks = (dashboardRes.data?.tasks || []).map(task => ({
          ...task,
          dashboardGroup: task.dashboardGroup || groupMap.get(getTaskGroupId(task)) || null
        }));

        if (cancelled) return;
        setGroups(loadedGroups);
        setTasks(loadedTasks);
        setRankData(rankRes.data);
        setGameData(gameRes.data);
        setConversations(dashboardRes.data?.conversations || []);
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

  useEffect(() => {
    let cancelled = false;
    const fetchWeather = async (latitude, longitude, label) => {
      setWeatherLoading(true);
      try {
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
          timezone: 'auto'
        });
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
        if (!res.ok) throw new Error('Weather request failed');
        const data = await res.json();
        if (!cancelled) {
          setWeather({
            label,
            temperature: Math.round(data.current?.temperature_2m ?? 0),
            humidity: Math.round(data.current?.relative_humidity_2m ?? 0),
            wind: Math.round(data.current?.wind_speed_10m ?? 0),
            condition: getWeatherLabel(data.current?.weather_code)
          });
        }
      } catch {
        if (!cancelled) setWeather(null);
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    };
    const fallback = () => fetchWeather(8.978, 126.303, 'Cagwait area');

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => fetchWeather(position.coords.latitude, position.coords.longitude, 'Your area'),
        fallback,
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 600000 }
      );
    } else {
      fallback();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const taskSummary = useMemo(() => {
    const assignedTasks = tasks.filter(task => getEntityId(task.assignedTo) === currentUserId);
    const assignedOpen = assignedTasks.filter(isTaskOpen);
    const openTasks = tasks.filter(isTaskOpen);
    const focusTasks = assignedOpen.length ? assignedOpen : openTasks;
    const priorityTasks = focusTasks
      .filter(task => isOverdueTask(task) || isDueSoonTask(task) || task.priority === 'high')
      .sort((a, b) => {
        const aOverdue = Number(isOverdueTask(a));
        const bOverdue = Number(isOverdueTask(b));
        if (aOverdue !== bOverdue) return bOverdue - aOverdue;
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      });
    const doneTasks = tasks.filter(task => task.status === 'done').length;

    return {
      assignedOpen: assignedOpen.length,
      open: openTasks.length,
      overdue: focusTasks.filter(isOverdueTask).length,
      dueSoon: focusTasks.filter(isDueSoonTask).length,
      priorityTasks,
      completion: tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0
    };
  }, [currentUserId, tasks]);

  const summary = useMemo(() => {
    const totalMembers = groups.reduce((sum, group) => sum + (group.members?.length || 0), 0);
    const owned = groups.filter(group => getEntityId(group.creator) === currentUserId).length;
    const unreadMessages = conversations.reduce((sum, conversation) => sum + (conversation.unreadCount || 0), 0);
    return {
      totalMembers,
      owned,
      activeGroups: groups.length,
      online: onlinePeople.length,
      unreadMessages,
      rankStats: rankData?.me,
      gameStats: gameData?.stats
    };
  }, [conversations, currentUserId, gameData, groups, onlinePeople.length, rankData]);

  const workspaceRows = useMemo(() => (
    groups.map(group => {
      const groupId = getEntityId(group);
      const groupTasks = tasks.filter(task => getTaskGroupId(task) === groupId);
      const done = groupTasks.filter(task => task.status === 'done').length;
      const open = groupTasks.filter(isTaskOpen).length;
      const overdue = groupTasks.filter(isOverdueTask).length;
      const progress = groupTasks.length ? Math.round((done / groupTasks.length) * 100) : 0;
      return { group, done, open, overdue, progress, total: groupTasks.length };
    }).sort((a, b) => (b.overdue - a.overdue) || (b.open - a.open) || (b.total - a.total))
  ), [groups, tasks]);

  const recentConversations = useMemo(() => (
    [...conversations]
      .sort((a, b) => new Date(b.lastTime || 0) - new Date(a.lastTime || 0))
      .slice(0, 5)
  ), [conversations]);

  const storyRail = useMemo(() => (
    (presenceStoryGroups?.length ? presenceStoryGroups : groupActiveStoriesByOwner(stories)).slice(0, 10)
  ), [presenceStoryGroups, stories]);

  const activeStoryList = useMemo(() => (
    getStoryListForActiveStory(storyRail, activeStory)
  ), [activeStory, storyRail]);

  const openStory = async (story) => {
    setActiveStory(story);
    try {
      const res = await api.post(`/stories/${getEntityId(story)}/view`);
      setActiveStory(prev => getEntityId(prev) === getEntityId(story) ? res.data : prev);
      window.dispatchEvent(new CustomEvent('storiesUpdated'));
    } catch {
      // Viewing should not be blocked when the view counter request fails.
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
        <LoadingSpinner label="Loading dashboard" />
      </div>
    );
  }

  const avatar = resolveMediaUrl(user?.avatar);
  const firstName = user?.name?.split(' ')[0] || 'Student';
  const welcomeMetrics = [
    { label: 'Due soon', value: taskSummary.dueSoon, helper: `${taskSummary.overdue} overdue`, tone: 'text-amber-600 dark:text-amber-200' },
    { label: 'Unread', value: summary.unreadMessages, helper: 'chats', tone: 'text-emerald-600 dark:text-emerald-200' },
    { label: 'Stories', value: storyRail.length, helper: 'active', tone: 'text-blue-600 dark:text-blue-200' }
  ];
  const topWorkspace = workspaceRows[0];
  const todaySnapshot = [
    {
      icon: ListTodo,
      label: 'Priority load',
      value: taskSummary.priorityTasks.length ? `${taskSummary.priorityTasks.length} task${taskSummary.priorityTasks.length === 1 ? '' : 's'} need attention` : 'No priority tasks',
      tone: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200'
    },
    {
      icon: FolderKanban,
      label: 'Workspace health',
      value: topWorkspace ? `${topWorkspace.group?.name || 'Workspace'} is ${topWorkspace.progress}% complete` : 'No workspace activity yet',
      tone: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-200'
    },
    {
      icon: Users,
      label: 'Presence',
      value: summary.online ? `${summary.online} active user${summary.online === 1 ? '' : 's'} now` : 'No active users right now',
      tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200'
    }
  ];

  return (
    <div className="mobile-page mx-auto max-w-7xl space-y-5 px-0 py-1 sm:px-6 sm:py-4 lg:px-8">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="dashboard-welcome-card rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-6">
          <div className="flex min-w-0 flex-col gap-5 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#1877f2] to-[#00b2ff] text-2xl font-black text-white ring-4 ring-blue-50 dark:ring-blue-950/40">
                {avatar ? <img src={avatar} alt={user?.name || 'User'} className="h-full w-full object-cover" /> : user?.name?.charAt(0)?.toUpperCase()}
                <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-emerald-500 dark:border-gray-900" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black uppercase text-[#1877f2] dark:text-blue-300">Dashboard</p>
                <h1 className="dashboard-welcome-title mt-1 text-3xl font-black leading-tight tracking-normal text-gray-950 dark:text-white lg:text-4xl">
                  Welcome back, {firstName}
                </h1>
                <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
                  {formatDate(now)} - <span className="tabular-nums">{formatTime(now)}</span>
                </p>
              </div>
            </div>
            <div className="dashboard-welcome-metrics grid w-full grid-cols-3 gap-2 2xl:w-[25rem]">
              {welcomeMetrics.map(item => (
                <div key={item.label} className="min-w-0 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-950/60">
                  <p className={`text-xl font-black leading-none ${item.tone}`}>{item.value}</p>
                  <p className="mt-1 truncate text-xs font-black text-gray-800 dark:text-gray-100">{item.label}</p>
                  <p className="truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">{item.helper}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1 text-xs font-black uppercase text-gray-500 dark:text-gray-400">
                <MapPin size={14} />
                {weather?.label || 'Campus area'}
              </p>
              <p className="mt-2 text-3xl font-black text-gray-950 dark:text-white">
                {weatherLoading ? 'Checking...' : weather ? `${weather.temperature} C` : 'Unavailable'}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
                {weatherLoading ? 'Loading weather' : weather ? `${weather.condition} - ${weather.humidity}% humidity - ${weather.wind} km/h wind` : 'Try again later'}
              </p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200">
              {weatherLoading ? <RefreshCw size={22} className="animate-spin" /> : <CloudSun size={24} />}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FolderKanban} label="Workspaces" value={summary.activeGroups} helper={`${summary.owned} owned by you`} />
        <StatCard icon={ListTodo} label="Open Tasks" value={taskSummary.assignedOpen || taskSummary.open} helper={taskSummary.assignedOpen ? 'Assigned to you' : 'Across workspaces'} tone="bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-200" />
        <StatCard icon={AlertTriangle} label="Due Soon" value={taskSummary.dueSoon} helper={`${taskSummary.overdue} overdue`} tone="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200" />
        <StatCard icon={MessageCircle} label="Unread Chats" value={summary.unreadMessages} helper={`${summary.online} active now`} tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200" />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <SectionHeader
          title="Stories"
          helper="My Day updates from your network."
          action={(
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1877f2] px-3 py-2 text-xs font-black text-white transition hover:bg-[#0f63d5]"
            >
              <PlusCircle size={15} />
              Add
            </button>
          )}
        />
        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {storyRail.length ? storyRail.map(group => {
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
                  <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-black text-white backdrop-blur">
                    {group.count}
                  </span>
                )}
                {story.fileType === 'video' && <PlayCircle className={`absolute right-2 text-white ${group.count > 1 ? 'top-9' : 'top-2'}`} size={20} />}
                <p className="absolute inset-x-2 bottom-2 line-clamp-2 text-xs font-black text-white">{owner.name || 'Member'}</p>
              </button>
            );
          }) : (
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="flex h-28 min-w-[15rem] items-center gap-3 rounded-2xl border border-dashed border-blue-200 bg-blue-50 px-4 text-left text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-blue-100"
            >
              <Camera size={24} />
              <span>
                <span className="block font-black">Create My Day</span>
                <span className="block text-sm font-semibold opacity-75">Share a photo or video update.</span>
              </span>
            </button>
          )}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <SectionHeader title="Priority Work" helper="Tasks that need attention first." />
            {taskSummary.priorityTasks.length ? (
              <div className="space-y-2">
                {taskSummary.priorityTasks.slice(0, 6).map(task => {
                  const group = task.dashboardGroup || groups.find(item => getEntityId(item) === getTaskGroupId(task)) || {};
                  const overdue = isOverdueTask(task);
                  return (
                    <button
                      key={getEntityId(task)}
                      type="button"
                      onClick={() => navigate(`/group/${getTaskGroupId(task)}`)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50 dark:border-gray-800 dark:bg-gray-950/60 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20"
                    >
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${overdue ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-200' : 'bg-blue-50 text-[#1877f2] dark:bg-blue-950/30 dark:text-blue-200'}`}>
                        {overdue ? <AlertTriangle size={19} /> : <CalendarDays size={19} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-gray-950 dark:text-white">{task.description}</span>
                        <span className="block truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{group.name || 'Workspace'} - {formatShortDate(task.dueDate)}</span>
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black capitalize ring-1 ${priorityStyles[task.priority] || priorityStyles.medium}`}>
                        {overdue ? 'Overdue' : task.priority || 'medium'}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyPanel icon={CheckCircle2} title="No priority tasks" helper="Assigned and due-soon tasks will appear here." />
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <SectionHeader
              title="Workspace Progress"
              helper={`${taskSummary.completion}% of tracked tasks are complete.`}
              action={<button type="button" onClick={() => navigate('/groups')} className="text-sm font-black text-[#1877f2]">View all</button>}
            />
            {workspaceRows.length ? (
              <div className="space-y-3">
                {workspaceRows.slice(0, 5).map(({ group, open, overdue, progress, total }) => (
                  <button
                    key={getEntityId(group)}
                    type="button"
                    onClick={() => navigate(`/group/${getEntityId(group)}`)}
                    className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50 dark:border-gray-800 dark:bg-gray-950/60 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-gray-950 dark:text-white">{group.name}</p>
                        <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{group.subject || 'Workspace'} - {open} open - {overdue} overdue</p>
                      </div>
                      <span className="text-sm font-black text-gray-700 dark:text-gray-200">{progress}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                      <div className="h-full rounded-full bg-[#1877f2] transition-all" style={{ width: `${total ? progress : 0}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyPanel icon={FolderKanban} title="No workspaces yet" helper="Created and joined workspaces will appear here." />
            )}
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <RankBadge stats={summary.rankStats} />
            <GameRankBadge stats={summary.gameStats} />
          </section>
        </div>

        <div className="space-y-5">
          <OnlineRoster limit={12} title="Active now" />

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <SectionHeader title="Chats" helper="Recent conversations." />
            <div className="space-y-2">
              {recentConversations.length ? recentConversations.map(conversation => {
                const person = conversation.user || {};
                const avatarUrl = resolveMediaUrl(person.avatar);
                return (
                  <button
                    key={getEntityId(person)}
                    type="button"
                    onClick={() => navigate(`/messages?user=${getEntityId(person)}`)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50 dark:border-gray-800 dark:bg-gray-950/60 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#1877f2] to-[#00b2ff] text-sm font-black text-white">
                      {avatarUrl ? <img src={avatarUrl} alt={person.name || 'User'} className="h-full w-full object-cover" /> : person.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-gray-950 dark:text-white">{person.name || 'Member'}</span>
                      <span className="block truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{conversation.lastMessage || 'Open chat'}</span>
                    </span>
                    {conversation.unreadCount > 0 && (
                      <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#1877f2] px-1.5 text-xs font-black text-white">
                        {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                      </span>
                    )}
                  </button>
                );
              }) : (
                <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-950/60 dark:text-gray-400">
                  Recent chats will show here.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <SectionHeader title="Today Snapshot" helper="Signals worth checking." />
            <div className="grid gap-3">
              {todaySnapshot.map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-left dark:border-gray-800 dark:bg-gray-950/60"
                  >
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${item.tone}`}>
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-gray-950 dark:text-white">{item.label}</span>
                      <span className="block text-xs font-semibold leading-snug text-gray-500 dark:text-gray-400">{item.value}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </section>

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
