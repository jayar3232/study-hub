import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CalendarDays,
  Camera,
  Clock3,
  CloudSun,
  MapPin,
  MessageCircle,
  PlayCircle,
  PlusCircle,
  Trophy,
  Users,
  Wind
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePresence } from '../context/PresenceContext';
import { resolveMediaUrl } from '../utils/media';
import { formatStoryAge, getStoryListForActiveStory, groupActiveStoriesByOwner } from '../utils/stories';
import RankBadge, { RankEmblem } from './RankBadge';
import GameRankBadge, { GameRankEmblem } from './GameRankBadge';
import OnlineRoster from './OnlineRoster';
import LoadingSpinner from './LoadingSpinner';
import { playUiSound } from '../utils/sound';
import StoryViewer from './StoryViewer';
import VideoThumbnail from './VideoThumbnail';
import HomeFeed from './HomeFeed';

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const DEFAULT_WEATHER_LOCATION = {
  latitude: 8.9167,
  longitude: 126.3,
  label: 'Cagwait, PH'
};

const WEATHER_CODE_LABELS = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  95: 'Thunderstorm',
  96: 'Storm with hail',
  99: 'Severe storm'
};

const getWeatherLabel = (code) => WEATHER_CODE_LABELS[Number(code)] || 'Weather update';

const formatDateLong = (date) => new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric'
}).format(date);

const formatTimeWithSeconds = (date) => new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
}).format(date);

const getGreeting = (date) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const compactNumber = (value = 0) => {
  const number = Number(value || 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return String(number);
};

function Avatar({ user, size = 'h-14 w-14' }) {
  const avatar = resolveMediaUrl(user?.avatar);
  return (
    <span className={`${size} grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#0b57d0] to-[#2387a8] text-lg font-black text-white`}>
      {avatar ? <img src={avatar} alt={user?.name || 'User'} className="h-full w-full object-cover" /> : (user?.name || 'U').charAt(0).toUpperCase()}
    </span>
  );
}

function Panel({ title, helper, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/55 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
      <div className="mb-3">
        <h2 className="text-base font-black text-slate-950 dark:text-white">{title}</h2>
        {helper && <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{helper}</p>}
      </div>
      {children}
    </section>
  );
}

function RankLeaderRow({ entry, index }) {
  const user = entry?.user || {};
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
      <span className="w-6 text-center text-sm font-black text-slate-500 dark:text-slate-400">#{index + 1}</span>
      <RankEmblem rank={entry?.stats?.rank} size="sm" animated />
      <Avatar user={user} size="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-950 dark:text-white">{user.name || 'Member'}</p>
        <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
          {entry?.stats?.rank?.shortName || 'Rookie'} - {entry?.stats?.completedTasks || 0} tasks
        </p>
      </div>
      <span className="text-sm font-black text-slate-950 dark:text-white">{compactNumber(entry?.stats?.xp)}</span>
    </div>
  );
}

function GameLeaderRow({ entry, index }) {
  const user = entry?.user || {};
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
      <span className="w-6 text-center text-sm font-black text-slate-500 dark:text-slate-400">#{index + 1}</span>
      <GameRankEmblem rank={entry?.stats?.rank} size="sm" animated stars={entry?.stats?.apexStars} />
      <Avatar user={user} size="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-950 dark:text-white">{user.name || 'Member'}</p>
        <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
          {entry?.stats?.rank?.shortName || 'Recruit'} - {entry?.stats?.totalPlays || 0} runs
        </p>
      </div>
      <span className="text-sm font-black text-slate-950 dark:text-white">{compactNumber(entry?.stats?.highScore)}</span>
    </div>
  );
}

function HeaderMetric({ icon: Icon, label, value, helper, accent = 'blue' }) {
  const accentClasses = {
    blue: 'bg-blue-50 text-[#0b57d0] ring-blue-100 dark:bg-blue-950/30 dark:text-sky-200 dark:ring-blue-900/50',
    teal: 'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/30 dark:text-teal-200 dark:ring-teal-900/50',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700'
  };

  return (
    <div className="dashboard-header-metric min-w-0 rounded-2xl border border-slate-200 bg-slate-50/85 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/65">
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${accentClasses[accent] || accentClasses.blue}`}>
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 truncate text-lg font-black text-slate-950 dark:text-white">{value}</p>
          {helper && <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{helper}</p>}
        </div>
      </div>
    </div>
  );
}

function DashboardWelcomeHeader({ user, now, weather, weatherLoading }) {
  const fullName = user?.name || 'Member';
  const firstName = fullName.split(' ')[0] || fullName;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone?.replace(/_/g, ' ') || 'Local time';
  const hasTemperature = Number.isFinite(weather?.temperature);
  const weatherValue = hasTemperature
    ? `${Math.round(weather.temperature)} deg C`
    : weatherLoading ? 'Updating' : 'Unavailable';
  const weatherHelper = weather && hasTemperature
    ? `${weather.label} - ${weather.locationLabel}`
    : weatherLoading ? 'Checking live weather' : 'Weather will retry on refresh';

  return (
    <section className="dashboard-welcome-card overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white/88 p-5 shadow-sm shadow-slate-200/55 dark:border-slate-800 dark:bg-slate-900/92 dark:shadow-black/25">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#0b57d0] ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-sky-200 dark:ring-blue-900/50">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Dashboard overview
          </div>
          <h1 className="dashboard-welcome-title mt-4 text-2xl font-black tracking-normal text-slate-950 dark:text-white sm:text-3xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
            {getGreeting(now)}, {fullName}. Your workspace activity, local time, date, and weather are synced in one place.
          </p>
        </div>

        <div className="dashboard-welcome-metrics grid gap-3 sm:grid-cols-3 xl:w-[38rem]">
          <HeaderMetric
            icon={Clock3}
            label="Local time"
            value={formatTimeWithSeconds(now)}
            helper={timezone}
            accent="blue"
          />
          <HeaderMetric
            icon={CalendarDays}
            label="Date"
            value={formatDateLong(now)}
            helper="Today"
            accent="slate"
          />
          <HeaderMetric
            icon={CloudSun}
            label="Weather"
            value={weatherValue}
            helper={weatherHelper}
            accent="teal"
          />
        </div>
      </div>

      {Number.isFinite(weather?.windSpeed) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-950/70">
            <MapPin size={13} />
            {weather.locationLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-950/70">
            <Wind size={13} />
            Wind {Math.round(weather.windSpeed)} km/h
          </span>
        </div>
      )}
    </section>
  );
}

function DashboardCommandCard({ icon: Icon, label, value, helper, onClick, accent = 'blue' }) {
  const accents = {
    blue: 'bg-blue-50 text-[#0b57d0] ring-blue-100 dark:bg-blue-950/30 dark:text-sky-200 dark:ring-blue-900/50',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/50',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/50',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700'
  };
  const Element = onClick ? 'button' : 'div';

  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="dashboard-command-card flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm shadow-slate-200/55 transition hover:border-blue-200 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/15"
    >
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ${accents[accent] || accents.blue}`}>
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
        <span className="mt-1 block truncate text-2xl font-black text-slate-950 dark:text-white">{value}</span>
        {helper && <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{helper}</span>}
      </span>
    </Element>
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
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const currentUserId = getEntityId(user);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadWeather = async ({ latitude, longitude, label }) => {
      setWeatherLoading(true);
      try {
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
          timezone: 'auto'
        });
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error('Weather request failed');
        const data = await res.json();
        if (cancelled) return;

        const current = data?.current || {};
        setWeather({
          temperature: Number(current.temperature_2m),
          apparentTemperature: Number(current.apparent_temperature),
          windSpeed: Number(current.wind_speed_10m),
          code: current.weather_code,
          label: getWeatherLabel(current.weather_code),
          locationLabel: label,
          updatedAt: current.time
        });
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') setWeather(null);
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    };

    const loadFallbackWeather = () => loadWeather(DEFAULT_WEATHER_LOCATION);

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => loadWeather({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: 'Your location'
        }),
        loadFallbackWeather,
        { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 6000 }
      );
    } else {
      loadFallbackWeather();
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
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
    <div className="mobile-page mx-auto max-w-7xl space-y-4 px-0 py-1 sm:px-6 sm:py-4 lg:px-8">
      <DashboardWelcomeHeader
        user={user}
        now={now}
        weather={weather}
        weatherLoading={weatherLoading}
      />

      <section className="dashboard-command-strip grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCommandCard
          icon={Users}
          label="Workspaces"
          value={groups.length}
          helper={`${completedTasks} completed tasks`}
          onClick={() => navigate('/groups')}
          accent="blue"
        />
        <DashboardCommandCard
          icon={MessageCircle}
          label="Unread chats"
          value={unreadMessages}
          helper={`${onlinePeople.length} active now`}
          onClick={() => navigate('/messages')}
          accent="emerald"
        />
        <DashboardCommandCard
          icon={Trophy}
          label="Network XP"
          value={compactNumber(rankStats?.xp)}
          helper={rankStats?.rank?.name || 'Rank progress'}
          onClick={() => navigate('/profile')}
          accent="amber"
        />
        <DashboardCommandCard
          icon={PlayCircle}
          label="My Day"
          value={storyRail.length}
          helper="Active story groups"
          onClick={() => navigate('/profile')}
          accent="slate"
        />
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-4">
          <section className="dashboard-story-panel rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/55 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-black text-slate-950 dark:text-white">Today at SYNCROVA</h1>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Stories, posts, active friends, and ranks.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#07036f] px-3 py-2 text-xs font-black text-white hover:bg-[#05004f]"
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
                <span className="mb-auto grid h-10 w-10 place-items-center rounded-full bg-[#0b57d0] text-white">
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
                    className="relative h-40 w-28 shrink-0 overflow-hidden rounded-2xl bg-gray-950 text-left shadow-sm ring-1 ring-slate-200 dark:ring-slate-800"
                  >
                    {story.fileType === 'image' ? (
                      <img src={storyUrl} alt={owner.name || 'Story'} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <VideoThumbnail src={storyUrl} className="h-full w-full" iconSize={20} label={`${owner.name || 'Member'} story video`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/10 to-black/25" />
                    <div className="absolute left-2 top-2 grid h-9 w-9 place-items-center overflow-hidden rounded-full border-2 border-[#0b57d0] bg-[#0b57d0] text-xs font-black text-white">
                      {owner.avatar ? <img src={resolveMediaUrl(owner.avatar)} alt={owner.name || 'User'} className="h-full w-full object-cover" /> : owner.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    {group.count > 1 && (
                      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-black text-white">
                        {group.count}
                      </span>
                    )}
                    {formatStoryAge(story) && (
                      <span className="absolute left-2 top-12 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-black text-white backdrop-blur">
                        {formatStoryAge(story)}
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
                  <p className="truncate text-base font-black text-slate-950 dark:text-white">{user?.name || 'Student'}</p>
                  <p className="truncate text-sm font-semibold text-slate-500 dark:text-slate-400">{user?.email || 'SYNCROVA member'}</p>
                </div>
              </div>
            </Panel>
            <Panel title="Quick status">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-slate-50 p-3 text-center dark:bg-slate-950/70">
                  <p className="text-lg font-black text-slate-950 dark:text-white">{groups.length}</p>
                  <p className="text-[11px] font-black text-slate-500 dark:text-slate-400">Spaces</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-center dark:bg-slate-950/70">
                  <p className="text-lg font-black text-slate-950 dark:text-white">{onlinePeople.length}</p>
                  <p className="text-[11px] font-black text-slate-500 dark:text-slate-400">Online</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-center dark:bg-slate-950/70">
                  <p className="text-lg font-black text-slate-950 dark:text-white">{unreadMessages}</p>
                  <p className="text-[11px] font-black text-slate-500 dark:text-slate-400">Unread</p>
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

        <aside className="space-y-4 xl:sticky xl:top-20">
          <OnlineRoster limit={12} title="Active now" />

          <Panel title="Network ranks" helper="Top workspace contributors">
            <div className="space-y-2">
              {rankLeaders.slice(0, 5).map((entry, index) => (
                <RankLeaderRow key={getEntityId(entry.user) || index} entry={entry} index={index} />
              ))}
              {!rankLeaders.length && (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
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
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
                  Play Fix Arena games to show ranks here.
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Shortcuts">
            <div className="grid gap-2">
              <button type="button" onClick={() => navigate('/messages')} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 text-left text-sm font-black text-slate-800 hover:bg-blue-50 hover:text-[#0b57d0] dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white">
                <MessageCircle size={18} />
                Messages
              </button>
              <button type="button" onClick={() => navigate('/friends')} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 text-left text-sm font-black text-slate-800 hover:bg-blue-50 hover:text-[#0b57d0] dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white">
                <Users size={18} />
                Friends
              </button>
              <button type="button" onClick={() => navigate('/arena')} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 text-left text-sm font-black text-slate-800 hover:bg-blue-50 hover:text-[#0b57d0] dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white">
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
