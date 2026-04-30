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
  Clock,
  FolderKanban,
  Gauge,
  MessageCircle,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Users
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

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

const StatCard = ({ icon: Icon, label, value, helper, tone, delay }) => (
  <motion.div
    variants={cardVariants}
    initial="hidden"
    animate="visible"
    transition={{ delay, type: 'spring', damping: 22, stiffness: 240 }}
    whileHover={{ y: -5, scale: 1.01 }}
    className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white p-5 shadow-lg shadow-gray-200/60 transition dark:border-gray-700/50 dark:bg-gray-900 dark:shadow-black/10"
  >
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
      whileHover={{ x: 4 }}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left transition hover:border-pink-200 hover:bg-pink-50/40 dark:border-gray-800 dark:bg-gray-950/60 dark:hover:border-pink-900/60 dark:hover:bg-pink-950/20"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${overdue ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300' : dueSoon ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300'}`}>
        {overdue ? <AlertTriangle size={18} /> : <ClipboardCheck size={18} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-gray-950 dark:text-white">{task.description}</span>
        <span className="mt-1 block truncate text-xs text-gray-500 dark:text-gray-400">
          {task.group?.name || 'Project'} - {formatShortDate(task.dueDate)}
        </span>
      </span>
      <span className={`hidden rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 sm:inline-flex ${priorityStyles[task.priority] || priorityStyles.medium}`}>
        {task.priority || 'medium'}
      </span>
      <ArrowRight size={16} className="shrink-0 text-gray-400" />
    </motion.button>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const groupRes = await api.get('/groups');
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <motion.button
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/groups')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-950 shadow-lg shadow-black/10 transition hover:bg-pink-50"
            >
              <FolderKanban size={18} />
              Open Projects
            </motion.button>
            <motion.button
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/messages')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              <MessageCircle size={18} />
              Messages
            </motion.button>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard key={stat.label} {...stat} delay={index * 0.06} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">Operations Snapshot</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Progress and team scale.</p>
            </div>
            <Gauge className="text-pink-500" size={24} />
          </div>

          <div className="mt-6">
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

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-950/60">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <Users size={17} className="text-cyan-500" />
                Team members reached
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">{summary.totalMembers}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-950/60">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <Activity size={17} className="text-emerald-500" />
                Finished tasks
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">{summary.doneTasks}</p>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          {
            icon: FolderKanban,
            title: 'Project Directory',
            detail: 'Create, join, invite, and open team spaces from one clean page.',
            action: 'Open directory',
            path: '/groups'
          },
          {
            icon: MessageCircle,
            title: 'Realtime Inbox',
            detail: 'Check direct messages, media, voice notes, and conversation updates.',
            action: 'Open inbox',
            path: '/messages'
          },
          {
            icon: Settings,
            title: 'Account Controls',
            detail: 'Manage profile, password, avatar, and personal preferences.',
            action: 'Open profile',
            path: '/profile'
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
              whileHover={{ y: -5, scale: 1.01 }}
              onClick={() => navigate(item.path)}
              className="group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-pink-200 hover:shadow-xl hover:shadow-pink-500/10 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-pink-900/60"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-xl bg-gradient-to-br from-pink-500 to-indigo-500 p-3 text-white shadow-lg shadow-pink-500/20">
                  <Icon size={22} />
                </div>
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
        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-950 dark:text-white">Recent Task Movement</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Latest tasks created across your projects.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/groups')}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-pink-200 hover:bg-pink-50 dark:border-gray-700 dark:text-gray-200 dark:hover:border-pink-900/60 dark:hover:bg-pink-950/20"
          >
            View all
            <ArrowRight size={15} />
          </button>
        </div>

        {summary.recentTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-950/50">
            <TrendingUp className="mx-auto text-pink-500" size={34} />
            <h3 className="mt-3 font-bold text-gray-950 dark:text-white">No task activity yet</h3>
            <p className="mt-1 text-sm text-gray-500">Open the directory when you are ready to set up project tasks.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
            {summary.recentTasks.map((task, index) => (
              <button
                key={task._id}
                type="button"
                onClick={() => navigate(`/group/${task.group?._id || task.groupId}`)}
                className={`flex w-full flex-col gap-2 px-4 py-3 text-left transition hover:bg-pink-50/50 dark:hover:bg-pink-950/20 sm:flex-row sm:items-center sm:justify-between ${index ? 'border-t border-gray-100 dark:border-gray-800' : ''}`}
              >
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
              </button>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
