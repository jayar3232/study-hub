import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CloudSun,
  Clock,
  FolderKanban,
  Gauge,
  MapPin,
  MessageCircle,
  RefreshCw,
  Settings,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  Users
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import RankBadge, { RankEmblem } from './RankBadge';
import { resolveMediaUrl } from '../utils/media';
import UserProfileModal from './UserProfileModal';

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const cardVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 }
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatShortDate = (value) => {
  const date = parseDate(value);
  if (!date) return 'No due date';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getDueDateEnd = (value) => {
  const date = parseDate(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
};

const isOverdue = (task) => {
  if (task.status === 'done') return false;
  const dueDate = getDueDateEnd(task.dueDate);
  return Boolean(dueDate && dueDate < new Date());
};

const isDueSoon = (task) => {
  if (task.status === 'done') return false;
  const dueDate = getDueDateEnd(task.dueDate);
  if (!dueDate) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() + 3);
  limit.setHours(23, 59, 59, 999);
  return dueDate <= limit;
};

const priorityStyles = {
  high: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-200 dark:ring-rose-900/60',
  medium: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/60',
  low: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/60'
};

const statusLabels = {
  not_started: 'To do',
  in_progress: 'In progress',
  done: 'Done'
};

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

const getWeatherLabel = (code) => weatherLabels[code] || 'Weather';

const formatDashboardTime = (value) => value.toLocaleTimeString(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

const formatDashboardDate = (value) => value.toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric'
});

const StatCard = ({ icon: Icon, label, value, helper, tone, delay }) => (
  <motion.div
    variants={cardVariants}
    initial="hidden"
    animate="visible"
    transition={{ delay, type: 'spring', damping: 22, stiffness: 240 }}
    whileHover={{ y: -5, scale: 1.01 }}
    className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white p-5 shadow-lg shadow-gray-200/60 transition hover:border-pink-200 hover:shadow-2xl hover:shadow-pink-500/15 dark:border-gray-700/50 dark:bg-gray-900 dark:shadow-black/10 dark:hover:border-pink-900/60"
  >
    <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone} opacity-80`} />
    <div className="pointer-events-none absolute right-0 top-0 h-14 w-14 rounded-tr-2xl border-r-2 border-t-2 border-pink-300 opacity-0 shadow-[10px_-10px_30px_rgba(236,72,153,0.2)] transition duration-300 group-hover:opacity-100 dark:border-pink-800" />
    <div className="pointer-events-none absolute bottom-0 left-0 h-14 w-14 rounded-bl-2xl border-b-2 border-l-2 border-cyan-300 opacity-0 shadow-[-10px_10px_30px_rgba(34,211,238,0.18)] transition duration-300 group-hover:opacity-100 dark:border-cyan-800" />
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-2 text-3xl font-bold text-gray-950 dark:text-white">{value}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helper}</p>
      </div>
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay }}
        className={`rounded-xl bg-gradient-to-br ${tone} p-3 text-white shadow-lg`}
      >
        <Icon size={22} />
      </motion.div>
    </div>
    <div className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-pink-100/45 to-transparent transition-transform duration-1000 group-hover:translate-x-full dark:via-white/10" />
  </motion.div>
);

const TaskRow = ({ task, onOpen }) => {
  const overdue = isOverdue(task);
  const dueSoon = isDueSoon(task);

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ x: 5, scale: 1.006 }}
      whileTap={{ scale: 0.996 }}
      className="group/row relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-gray-100 bg-white p-3 text-left transition hover:border-pink-200 hover:bg-pink-50/50 hover:shadow-lg hover:shadow-pink-500/10 dark:border-gray-800 dark:bg-gray-950/60 dark:hover:border-pink-900/60 dark:hover:bg-pink-950/20"
    >
      <span className="pointer-events-none absolute inset-y-2 left-0 w-1 rounded-r-full bg-gradient-to-b from-cyan-400 to-pink-500 opacity-0 transition group-hover/row:opacity-100" />
      <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg ${overdue ? 'bg-rose-100 text-rose-600 shadow-rose-500/10 dark:bg-rose-950/40 dark:text-rose-300' : dueSoon ? 'bg-amber-100 text-amber-600 shadow-amber-500/10 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-cyan-100 text-cyan-600 shadow-cyan-500/10 dark:bg-cyan-950/40 dark:text-cyan-300'}`}>
        {overdue ? <AlertTriangle size={18} /> : <ClipboardCheck size={18} />}
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-gray-950 dark:text-white">{task.description}</span>
        <span className="mt-1 block truncate text-xs text-gray-500 dark:text-gray-400">
          {task.group?.name || 'Project'} - {formatShortDate(task.dueDate)}
        </span>
      </span>
      <span className={`relative hidden rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 sm:inline-flex ${priorityStyles[task.priority] || priorityStyles.medium}`}>
        {task.priority || 'medium'}
      </span>
      <ArrowRight size={16} className="relative shrink-0 text-gray-400 transition group-hover/row:translate-x-1 group-hover/row:text-pink-500" />
    </motion.button>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [rankData, setRankData] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
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
        if (cancelled) return;

        setWeather({
          label,
          temperature: Math.round(data.current?.temperature_2m ?? 0),
          humidity: Math.round(data.current?.relative_humidity_2m ?? 0),
          wind: Math.round(data.current?.wind_speed_10m ?? 0),
          condition: getWeatherLabel(data.current?.weather_code)
        });
      } catch (err) {
        if (!cancelled) setWeather(null);
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    };

    const useFallback = () => fetchWeather(14.5995, 120.9842, 'Manila');

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => fetchWeather(position.coords.latitude, position.coords.longitude, 'Your area'),
        useFallback,
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 600000 }
      );
    } else {
      useFallback();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [groupRes, rankRes] = await Promise.all([
          api.get('/groups'),
          api.get('/users/rankings/me').catch(() => ({ data: null }))
        ]);
        const groupData = groupRes.data || [];

        const taskResults = await Promise.allSettled(
          groupData.map(group => api.get(`/tasks/group/${group._id}`))
        );

        const taskData = taskResults.flatMap((result, index) => {
          if (result.status !== 'fulfilled') return [];
          const group = groupData[index];
          return (result.value.data || []).map(task => ({ ...task, group }));
        });

        if (!cancelled) {
          setGroups(groupData);
          setTasks(taskData);
          setRankData(rankRes.data);
          window.dispatchEvent(new Event('groupsUpdated'));
        }
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

  const rankStats = rankData?.me;
  const leaderboard = rankData?.leaderboard || [];

  const summary = useMemo(() => {
    const doneTasks = tasks.filter(task => task.status === 'done').length;
    const openTasks = tasks.filter(task => task.status !== 'done');
    const overdueTasks = openTasks.filter(isOverdue);
    const dueSoonTasks = openTasks.filter(isDueSoon);
    const needsApproval = tasks.filter(task => task.approvalStatus === 'pending' || task.approvalStatus === 'changes_requested');
    const completionRate = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0;
    const totalMembers = groups.reduce((sum, group) => sum + (group.members?.length || 0), 0);
    const ownedProjects = groups.filter(group => getEntityId(group.creator) === getEntityId(user)).length;

    const focusTasks = openTasks
      .filter(task => isOverdue(task) || isDueSoon(task) || task.priority === 'high')
      .sort((a, b) => {
        const aDate = parseDate(a.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        const bDate = parseDate(b.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        if (aDate !== bDate) return aDate - bDate;
        return (b.priority === 'high') - (a.priority === 'high');
      })
      .slice(0, 5);

    const recentTasks = [...tasks]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);

    return {
      doneTasks,
      openTasks,
      overdueTasks,
      dueSoonTasks,
      needsApproval,
      completionRate,
      totalMembers,
      ownedProjects,
      focusTasks,
      recentTasks
    };
  }, [groups, tasks, user]);

  const stats = [
    {
      icon: FolderKanban,
      label: 'Active Projects',
      value: groups.length,
      helper: `${summary.ownedProjects} owned by you`,
      tone: 'from-pink-500 to-rose-500'
    },
    {
      icon: Target,
      label: 'Open Tasks',
      value: summary.openTasks.length,
      helper: `${summary.completionRate}% completion rate`,
      tone: 'from-cyan-500 to-blue-500'
    },
    {
      icon: CalendarDays,
      label: 'Due Soon',
      value: summary.dueSoonTasks.length,
      helper: `${summary.overdueTasks.length} overdue`,
      tone: 'from-amber-500 to-orange-500'
    },
    {
      icon: CheckCircle2,
      label: 'Needs Approval',
      value: summary.needsApproval.length,
      helper: 'Pending review items',
      tone: 'from-emerald-500 to-teal-500'
    }
  ];

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:px-6 lg:px-8">
        <div className="h-44 animate-pulse rounded-2xl bg-white dark:bg-gray-800" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(item => <div key={item} className="h-36 animate-pulse rounded-2xl bg-white dark:bg-gray-800" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="h-80 animate-pulse rounded-2xl bg-white dark:bg-gray-800" />
          <div className="h-80 animate-pulse rounded-2xl bg-white dark:bg-gray-800" />
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-950 via-fuchsia-950 to-indigo-950 shadow-xl shadow-pink-500/15"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.35),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.2),transparent_34%)]" />
        <div className="relative flex flex-col gap-6 p-6 md:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase text-pink-100/80">
              <Sparkles size={16} />
              Command Center
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-white md:text-4xl">
              Welcome back, {user?.name?.split(' ')[0] || 'teammate'}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 md:text-base">
              See deadlines, approvals, and team momentum at a glance before jumping into project work.
            </p>
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase text-cyan-100/80">Today</p>
                <p className="mt-1 text-3xl font-black tabular-nums">{formatDashboardTime(now)}</p>
                <p className="mt-1 text-sm text-white/70">{formatDashboardDate(now)}</p>
              </div>
              <CloudSun className="text-yellow-200" size={34} />
            </div>
            <div className="mt-4 rounded-xl bg-white/10 p-3">
              {weatherLoading ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-white/75">
                  <RefreshCw size={15} className="animate-spin" />
                  Loading weather
                </p>
              ) : weather ? (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1 text-xs font-bold text-white/60">
                      <MapPin size={13} />
                      {weather.label}
                    </p>
                    <p className="mt-1 text-sm font-black">{weather.condition}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black">{weather.temperature} C</p>
                    <p className="text-xs text-white/60">{weather.humidity}% humidity - {weather.wind} km/h</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-semibold text-white/70">Weather unavailable</p>
              )}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <motion.button
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/groups')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-950 shadow-lg shadow-black/10 transition hover:bg-pink-50"
              >
                <FolderKanban size={17} />
                Projects
              </motion.button>
              <motion.button
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/messages')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                <MessageCircle size={17} />
                Messages
              </motion.button>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard key={stat.label} {...stat} delay={index * 0.06} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <RankBadge stats={rankStats} />
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          whileHover={{ y: -5, scale: 1.006 }}
          className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-pink-200 hover:shadow-2xl hover:shadow-pink-500/15 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-pink-900/60"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-yellow-300 via-pink-500 to-cyan-400 opacity-80" />
          <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-tr-2xl border-r-2 border-t-2 border-pink-300 opacity-0 shadow-[10px_-10px_34px_rgba(236,72,153,0.24)] transition duration-300 group-hover:opacity-100 dark:border-pink-800" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-16 w-16 rounded-bl-2xl border-b-2 border-l-2 border-cyan-300 opacity-0 shadow-[-10px_10px_34px_rgba(34,211,238,0.2)] transition duration-300 group-hover:opacity-100 dark:border-cyan-800" />
          <div className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-pink-100/45 to-transparent transition-transform duration-1000 group-hover:translate-x-full dark:via-white/10" />
          <div className="relative mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">Contributor Rankings</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">XP is based on completed assigned tasks across your workspace network.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-yellow-50 px-3 py-1 text-xs font-black text-yellow-700 ring-1 ring-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-200 dark:ring-yellow-900/60">
              <Trophy size={13} />
              Top {Math.min(leaderboard.length, 5)}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {leaderboard.slice(0, 5).map(entry => {
              const avatar = resolveMediaUrl(entry.user?.avatar);
              return (
                <motion.button
                  key={entry.user?._id || entry.position}
                  type="button"
                  onClick={() => setProfileUser(entry.user)}
                  whileHover={{ y: -5, scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="group/rank relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-3 text-left transition hover:border-pink-200 hover:bg-pink-50 hover:shadow-xl hover:shadow-pink-500/10 dark:border-gray-800 dark:bg-gray-950/50 dark:hover:border-pink-900/60 dark:hover:bg-pink-950/20"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-yellow-300 via-pink-500 to-cyan-400 opacity-0 transition group-hover/rank:opacity-100" />
                  <div className="relative flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-gray-500 dark:text-gray-400">#{entry.position}</span>
                    <RankEmblem rank={entry.stats?.rank} size="sm" />
                  </div>
                  <div className="relative mt-3 flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-sm font-bold text-white">
                      {avatar ? <img src={avatar} alt={entry.user?.name || 'User'} className="h-full w-full object-cover" /> : entry.user?.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-950 dark:text-white">{entry.user?.name || 'User'}</p>
                      <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{entry.stats?.xp || 0} XP</p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
            {leaderboard.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950/50 dark:text-gray-400 md:col-span-2 xl:col-span-5">
                Finish assigned tasks to activate rankings.
              </div>
            )}
          </div>
        </motion.div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          whileHover={{ y: -5, scale: 1.006 }}
          className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-pink-200 hover:shadow-2xl hover:shadow-pink-500/15 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-pink-900/60"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-emerald-400 opacity-80" />
          <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-tr-2xl border-r-2 border-t-2 border-pink-300 opacity-0 shadow-[12px_-12px_42px_rgba(236,72,153,0.24)] transition duration-300 group-hover:opacity-100 dark:border-pink-800" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-20 w-20 rounded-bl-2xl border-b-2 border-l-2 border-cyan-300 opacity-0 shadow-[-12px_12px_42px_rgba(34,211,238,0.2)] transition duration-300 group-hover:opacity-100 dark:border-cyan-800" />
          <div className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-pink-100/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full dark:via-white/10" />
          <div className="relative mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">Today's Focus</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">High priority, overdue, and upcoming work.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-pink-600 dark:bg-pink-950/30 dark:text-pink-300">
              <Clock size={13} />
              {summary.focusTasks.length} items
            </span>
          </div>

          {summary.focusTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-950/50">
              <CheckCircle2 className="mx-auto text-emerald-500" size={34} />
              <h3 className="mt-3 font-bold text-gray-950 dark:text-white">Nothing urgent right now</h3>
              <p className="mt-1 text-sm text-gray-500">Your near-term tasks are clear. Good place to plan the next move.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {summary.focusTasks.map(task => (
                <TaskRow
                  key={task._id}
                  task={task}
                  onOpen={() => navigate(`/group/${task.group?._id || task.groupId}`)}
                />
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          whileHover={{ y: -5, scale: 1.006 }}
          className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-cyan-200 hover:shadow-2xl hover:shadow-cyan-500/15 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-cyan-900/60"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-pink-500 to-emerald-400 opacity-80" />
          <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-tr-2xl border-r-2 border-t-2 border-cyan-300 opacity-0 shadow-[12px_-12px_42px_rgba(34,211,238,0.22)] transition duration-300 group-hover:opacity-100 dark:border-cyan-800" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-20 w-20 rounded-bl-2xl border-b-2 border-l-2 border-pink-300 opacity-0 shadow-[-12px_12px_42px_rgba(236,72,153,0.18)] transition duration-300 group-hover:opacity-100 dark:border-pink-800" />
          <div className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-cyan-100/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full dark:via-white/10" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">Operations Snapshot</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Progress and team scale.</p>
            </div>
            <motion.div
              animate={{ y: [0, -4, 0], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              className="rounded-xl bg-gradient-to-br from-cyan-400 to-pink-500 p-3 text-white shadow-lg shadow-cyan-500/20"
            >
              <Gauge size={22} />
            </motion.div>
          </div>

          <div className="relative mt-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-700 dark:text-gray-200">Task completion</span>
              <span className="font-bold text-gray-950 dark:text-white">{summary.completionRate}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${summary.completionRate}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-pink-500 via-cyan-400 to-emerald-400"
              />
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-xl bg-gray-50 p-4 transition hover:-translate-y-0.5 hover:bg-cyan-50 dark:bg-gray-950/60 dark:hover:bg-cyan-950/20">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <Users size={17} className="text-cyan-500" />
                Team members reached
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">{summary.totalMembers}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 transition hover:-translate-y-0.5 hover:bg-emerald-50 dark:bg-gray-950/60 dark:hover:bg-emerald-950/20">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <Activity size={17} className="text-emerald-500" />
                Finished tasks
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">{summary.doneTasks}</p>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          {
            icon: FolderKanban,
            title: 'Project Directory',
            detail: 'Create, join, invite, and open team spaces from one clean page.',
            action: 'Open directory',
            path: '/groups',
            tone: 'from-cyan-400 via-pink-500 to-indigo-500'
          },
          {
            icon: MessageCircle,
            title: 'Realtime Inbox',
            detail: 'Check direct messages, media, voice notes, and conversation updates.',
            action: 'Open inbox',
            path: '/messages',
            tone: 'from-pink-400 via-violet-500 to-cyan-400'
          },
          {
            icon: Trophy,
            title: 'Fix Arena',
            detail: 'Submit member reports, review fixes, and play Typing Sprint.',
            action: 'Open arena',
            path: '/arena',
            tone: 'from-yellow-300 via-pink-500 to-cyan-400'
          },
          {
            icon: Settings,
            title: 'Account Controls',
            detail: 'Manage profile, password, avatar, and personal preferences.',
            action: 'Open profile',
            path: '/profile',
            tone: 'from-emerald-300 via-cyan-500 to-pink-500'
          }
        ].map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.title}
              type="button"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.06 }}
              whileHover={{ y: -8, scale: 1.018 }}
              onClick={() => navigate(item.path)}
              className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-pink-200 hover:shadow-2xl hover:shadow-pink-500/15 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-pink-900/60"
            >
              <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.tone} opacity-80`} />
              <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-tr-2xl border-r-2 border-t-2 border-pink-300 opacity-0 shadow-[10px_-10px_34px_rgba(236,72,153,0.24)] transition duration-300 group-hover:opacity-100 dark:border-pink-800" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-16 w-16 rounded-bl-2xl border-b-2 border-l-2 border-cyan-300 opacity-0 shadow-[-10px_10px_34px_rgba(34,211,238,0.2)] transition duration-300 group-hover:opacity-100 dark:border-cyan-800" />
              <div className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-pink-100/50 to-transparent transition-transform duration-1000 group-hover:translate-x-full dark:via-white/10" />
              <div className="flex items-start justify-between gap-4">
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: index * 0.18 }}
                  className={`rounded-xl bg-gradient-to-br ${item.tone} p-3 text-white shadow-lg shadow-pink-500/20`}
                >
                  <Icon size={22} />
                </motion.div>
                <ArrowRight size={18} className="text-gray-400 transition group-hover:translate-x-1 group-hover:text-pink-500" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-950 dark:text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{item.detail}</p>
              <p className="mt-4 text-sm font-bold text-pink-600 dark:text-pink-300">{item.action}</p>
            </motion.button>
          );
        })}
      </section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26 }}
        whileHover={{ y: -4 }}
        className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-pink-200 hover:shadow-2xl hover:shadow-pink-500/15 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-pink-900/60"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-pink-500 to-emerald-400 opacity-80" />
        <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-tr-2xl border-r-2 border-t-2 border-pink-300 opacity-0 shadow-[12px_-12px_42px_rgba(236,72,153,0.24)] transition duration-300 group-hover:opacity-100 dark:border-pink-800" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-20 w-20 rounded-bl-2xl border-b-2 border-l-2 border-cyan-300 opacity-0 shadow-[-12px_12px_42px_rgba(34,211,238,0.2)] transition duration-300 group-hover:opacity-100 dark:border-cyan-800" />
        <div className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-pink-100/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full dark:via-white/10" />

        <div className="relative mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              className="hidden rounded-xl bg-gradient-to-br from-cyan-400 via-pink-500 to-indigo-500 p-3 text-white shadow-lg shadow-pink-500/20 sm:block"
            >
              <TrendingUp size={21} />
            </motion.div>
            <div>
            <h2 className="text-xl font-bold text-gray-950 dark:text-white">Recent Task Movement</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Latest tasks created across your projects.</p>
            </div>
          </div>
          <motion.button
            whileHover={{ y: -2, scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => navigate('/groups')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-pink-200 hover:bg-pink-50 hover:text-pink-700 dark:border-gray-700 dark:bg-gray-950/60 dark:text-gray-200 dark:hover:border-pink-900/60 dark:hover:bg-pink-950/20 dark:hover:text-pink-200"
          >
            View all
            <ArrowRight size={15} className="transition group-hover:translate-x-1" />
          </motion.button>
        </div>

        {summary.recentTasks.length === 0 ? (
          <div className="relative rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-950/50">
            <TrendingUp className="mx-auto text-pink-500" size={34} />
            <h3 className="mt-3 font-bold text-gray-950 dark:text-white">No task activity yet</h3>
            <p className="mt-1 text-sm text-gray-500">Open the directory when you are ready to set up project tasks.</p>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-white/70 dark:border-gray-800 dark:bg-gray-950/30">
            {summary.recentTasks.map((task, index) => (
              <motion.button
                key={task._id}
                type="button"
                whileHover={{ x: 4, scale: 1.006 }}
                whileTap={{ scale: 0.996 }}
                onClick={() => navigate(`/group/${task.group?._id || task.groupId}`)}
                className={`group/row relative flex w-full flex-col gap-2 px-4 py-3 text-left transition hover:bg-pink-50/70 dark:hover:bg-pink-950/20 sm:flex-row sm:items-center sm:justify-between ${index ? 'border-t border-gray-100 dark:border-gray-800' : ''}`}
              >
                <span className="pointer-events-none absolute inset-y-2 left-0 w-1 rounded-r-full bg-gradient-to-b from-cyan-400 to-pink-500 opacity-0 transition group-hover/row:opacity-100" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-gray-950 dark:text-white">{task.description}</span>
                  <span className="mt-1 block truncate text-xs text-gray-500 dark:text-gray-400">{task.group?.name || 'Project'}</span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {statusLabels[task.status] || task.status}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 font-bold ring-1 ${priorityStyles[task.priority] || priorityStyles.medium}`}>
                    {task.priority || 'medium'}
                  </span>
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </motion.section>

      <UserProfileModal
        isOpen={Boolean(profileUser)}
        user={profileUser}
        onClose={() => setProfileUser(null)}
      />
    </div>
  );
}
