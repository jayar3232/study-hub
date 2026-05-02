import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Activity,
  ArrowRight,
  Camera,
  CloudSun,
  FolderKanban,
  Gauge,
  MapPin,
  MessageCircle,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Users
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePresence } from '../context/PresenceContext';
import { resolveMediaUrl } from '../utils/media';
import RankBadge from './RankBadge';
import GameRankBadge from './GameRankBadge';
import OnlineRoster from './OnlineRoster';
import LoadingSpinner from './LoadingSpinner';
import { playUiSound } from '../utils/sound';

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

const getWeatherLabel = (code) => weatherLabels[code] || 'Weather';

const StatCard = ({ icon: Icon, label, value, helper, tone = 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200' }) => (
  <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/10 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-900/60">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-3 text-3xl font-black text-gray-950 dark:text-white">{value}</p>
        <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{helper}</p>
      </div>
      <div className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}>
        <Icon size={22} />
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const { onlinePeople, stories } = usePresence();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [rankData, setRankData] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    playUiSound('welcome', 0.28);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [groupRes, rankRes, gameRes, conversationRes] = await Promise.all([
          api.get('/groups'),
          api.get('/users/rankings/me').catch(() => ({ data: null })),
          api.get('/games/summary/me').catch(() => ({ data: null })),
          api.get('/messages/conversations').catch(() => ({ data: [] }))
        ]);
        if (cancelled) return;
        setGroups(groupRes.data || []);
        setRankData(rankRes.data);
        setGameData(gameRes.data);
        setConversations(conversationRes.data || []);
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

  const summary = useMemo(() => {
    const totalMembers = groups.reduce((sum, group) => sum + (group.members?.length || 0), 0);
    const owned = groups.filter(group => getEntityId(group.creator) === getEntityId(user)).length;
    return {
      totalMembers,
      owned,
      activeGroups: groups.length,
      online: onlinePeople.length,
      rankStats: rankData?.me,
      gameStats: gameData?.stats
    };
  }, [gameData, groups, onlinePeople.length, rankData, user]);
  const recentConversations = useMemo(() => (
    [...conversations]
      .sort((a, b) => new Date(b.lastTime || 0) - new Date(a.lastTime || 0))
      .slice(0, 4)
  ), [conversations]);
  const storyRail = useMemo(() => (
    stories
      .filter(story => new Date(story.expiresAt || 0) > new Date())
      .slice(0, 8)
  ), [stories]);

  if (loading) {
    return (
      <div className="mobile-page mx-auto max-w-7xl px-0 py-1 sm:px-6 sm:py-4 lg:px-8">
        <LoadingSpinner label="Loading dashboard" />
      </div>
    );
  }

  const avatar = resolveMediaUrl(user?.avatar);

  return (
    <div className="mobile-page mx-auto max-w-7xl space-y-5 px-0 py-1 sm:px-6 sm:py-4 lg:px-8">
      <section className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px] lg:items-center">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative grid h-24 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-2xl font-black text-white shadow-lg ring-4 ring-white/70 dark:ring-gray-950/70">
              {avatar ? <img src={avatar} alt={user?.name || 'User'} className="h-full w-full object-cover" /> : user?.name?.charAt(0)?.toUpperCase()}
              <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-white bg-emerald-500 dark:border-gray-900" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black uppercase text-[#1877f2] dark:text-blue-300">SYNCROVA Dashboard</p>
              <h1 className="mt-1 text-3xl font-black tracking-normal text-gray-950 dark:text-white md:text-4xl">
                Welcome back, {user?.name?.split(' ')[0] || 'Student'}
              </h1>
              <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                {formatDate(now)} - <span className="tabular-nums">{formatTime(now)}</span>
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1 text-xs font-black uppercase text-gray-500 dark:text-gray-400">
                  <MapPin size={14} />
                  {weather?.label || 'Campus area'}
                </p>
                <p className="mt-2 text-2xl font-black text-gray-950 dark:text-white">
                  {weatherLoading ? 'Checking...' : weather ? `${weather.temperature} C` : 'Unavailable'}
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
                  {weatherLoading ? 'Loading weather' : weather ? `${weather.condition} - ${weather.humidity}% humidity` : 'Try again later'}
                </p>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200">
                {weatherLoading ? <RefreshCw size={22} className="animate-spin" /> : <CloudSun size={24} />}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-gray-950 dark:text-white">Social Pulse</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Stories and recent chats, tuned for the mobile app.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1877f2] px-3 py-2 text-xs font-black text-white transition hover:bg-[#0f63d5]"
          >
            <Camera size={15} />
            My Day
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {storyRail.length ? storyRail.map(story => {
            const owner = story.userId || {};
            const storyUrl = resolveMediaUrl(story.fileUrl);
            return (
              <button
                key={getEntityId(story)}
                type="button"
                onClick={() => navigate(`/messages?user=${getEntityId(owner)}`)}
                className="relative h-40 w-28 shrink-0 overflow-hidden rounded-2xl bg-gray-950 text-left shadow-sm ring-1 ring-gray-200 dark:ring-gray-800"
              >
                {story.fileType === 'image' ? (
                  <img src={storyUrl} alt={owner.name || 'Story'} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <video src={storyUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/10 to-black/25" />
                <div className="absolute left-2 top-2 grid h-9 w-9 place-items-center overflow-hidden rounded-full border-2 border-[#1877f2] bg-[#1877f2] text-xs font-black text-white">
                  {owner.avatar ? <img src={resolveMediaUrl(owner.avatar)} alt={owner.name || 'User'} className="h-full w-full object-cover" /> : owner.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                {story.fileType === 'video' && <PlayCircle className="absolute right-2 top-2 text-white" size={20} />}
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
                <span className="block font-black">Create the first My Day</span>
                <span className="block text-sm font-semibold opacity-75">Share a quick campus update.</span>
              </span>
            </button>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FolderKanban} label="Workspaces" value={summary.activeGroups} helper={`${summary.owned} owned by you`} tone="bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200" />
        <StatCard icon={Users} label="Network Members" value={summary.totalMembers} helper="Across joined spaces" tone="bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-200" />
        <StatCard icon={Activity} label="Online Now" value={summary.online} helper="Active friends/users" tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200" />
        <StatCard icon={Trophy} label="Arena Best" value={summary.gameStats?.highScore || 0} helper={`${summary.gameStats?.totalPlays || 0} ranked runs`} tone="bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-200" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <RankBadge stats={summary.rankStats} />
            <GameRankBadge stats={summary.gameStats} />
          </div>

          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-gray-950 dark:text-white">Quick Access</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Open the area you need without hunting through menus.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { icon: FolderKanban, title: 'Workspaces', detail: 'Projects and shared spaces', path: '/groups' },
                { icon: MessageCircle, title: 'Messages', detail: 'Realtime chat and media', path: '/messages' },
                { icon: ShieldCheck, title: 'Fix Arena', detail: 'Reports, games, and ranks', path: '/arena' }
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="group rounded-2xl border border-gray-200 bg-gray-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-lg hover:shadow-blue-500/10 dark:border-gray-800 dark:bg-gray-950/60 dark:hover:border-blue-900/60 dark:hover:bg-gray-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gray-950 text-white dark:bg-white dark:text-gray-950">
                        <Icon size={22} />
                      </span>
                      <ArrowRight size={17} className="text-gray-400 transition group-hover:translate-x-1 group-hover:text-[#1877f2]" />
                    </div>
                    <h3 className="mt-4 font-black text-gray-950 dark:text-white">{item.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{item.detail}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <OnlineRoster limit={12} title="Online users" />
          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="flex items-center gap-2 text-lg font-black text-gray-950 dark:text-white">
              <MessageCircle size={20} className="text-[#1877f2]" />
              Recent Chats
            </h2>
            <div className="mt-4 space-y-2">
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
          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="flex items-center gap-2 text-lg font-black text-gray-950 dark:text-white">
              <Gauge size={20} className="text-[#1877f2]" />
              Workspace Snapshot
            </h2>
            <div className="mt-4 space-y-3">
              {groups.slice(0, 5).map(group => (
                <button
                  key={group._id}
                  type="button"
                  onClick={() => navigate(`/group/${group._id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50 dark:border-gray-800 dark:bg-gray-950/60 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-gray-950 dark:text-white">{group.name}</span>
                    <span className="block truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{group.subject || 'Workspace'} - {group.members?.length || 0} members</span>
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-gray-400" />
                </button>
              ))}
              {groups.length === 0 && (
                <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-950/60 dark:text-gray-400">
                  No workspaces yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
