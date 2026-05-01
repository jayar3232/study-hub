import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock,
  Code2,
  Crown,
  Lightbulb,
  Lock,
  MessageCircle,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Wrench,
  Zap
} from 'lucide-react';
import api from '../services/api';
import { resolveMediaUrl } from '../utils/media';
import GameRankBadge, { GameRankEmblem } from './GameRankBadge';
import UserProfileModal from './UserProfileModal';

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const severityStyles = {
  low: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/60',
  medium: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/60',
  high: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-200 dark:ring-rose-900/60',
  critical: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100 dark:bg-fuchsia-950/30 dark:text-fuchsia-200 dark:ring-fuchsia-900/60'
};

const statusStyles = {
  new: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-200 dark:ring-blue-900/60',
  reviewing: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/60',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/60',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-200 dark:ring-rose-900/60',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/60',
  closed: 'bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700'
};

const categories = [
  ['bug', 'Bug'],
  ['feature', 'Feature'],
  ['ui', 'UI/UX'],
  ['performance', 'Performance'],
  ['account', 'Account'],
  ['workspace', 'Workspace'],
  ['messages', 'Messages'],
  ['other', 'Other']
];

const statuses = ['new', 'reviewing', 'approved', 'rejected', 'resolved', 'closed'];

const initialReportForm = {
  type: 'problem',
  category: 'bug',
  severity: 'medium',
  title: '',
  details: '',
  expected: '',
  workspaceName: ''
};

const formatDateTime = (value) => {
  if (!value) return 'Just now';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const formatElapsed = (elapsedMs = 0) => `${(elapsedMs / 1000).toFixed(1)}s`;

const ArenaMark = ({ compact = false }) => (
  <motion.div
    animate={{ y: [0, -4, 0], rotate: [0, 1, -1, 0] }}
    transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
    className={`${compact ? 'h-14 w-14 rounded-2xl' : 'h-24 w-24 rounded-[2rem]'} relative flex shrink-0 items-center justify-center overflow-hidden bg-gray-950 text-white shadow-2xl shadow-cyan-500/20 ring-1 ring-white/10`}
  >
    <div className="absolute -left-8 top-5 h-16 w-16 rounded-full border-[6px] border-cyan-300/80 shadow-[0_0_28px_rgba(34,211,238,0.45)]" />
    <div className="absolute -right-8 bottom-5 h-16 w-16 rounded-full border-[6px] border-pink-400/80 shadow-[0_0_28px_rgba(236,72,153,0.45)]" />
    <div className="absolute inset-4 rounded-2xl border border-white/15" />
    <Wrench size={compact ? 24 : 38} className="relative z-10" />
  </motion.div>
);

const StatCard = ({ icon: Icon, label, value, helper, tone }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-2 text-3xl font-black text-gray-950 dark:text-white">{value}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helper}</p>
      </div>
      <div className={`rounded-2xl bg-gradient-to-br ${tone} p-3 text-white shadow-lg`}>
        <Icon size={22} />
      </div>
    </div>
  </motion.div>
);

export default function OpsArena() {
  const [summary, setSummary] = useState(null);
  const [developerInfo, setDeveloperInfo] = useState({ isDeveloper: false, user: null });
  const [developerPassword, setDeveloperPassword] = useState('');
  const [issues, setIssues] = useState([]);
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [reportForm, setReportForm] = useState(initialReportForm);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [unlockingDeveloper, setUnlockingDeveloper] = useState(false);
  const [typingSession, setTypingSession] = useState(null);
  const [typingText, setTypingText] = useState('');
  const [typingResult, setTypingResult] = useState(null);
  const [typingSeconds, setTypingSeconds] = useState(0);
  const [typingBusy, setTypingBusy] = useState(false);
  const [profileUser, setProfileUser] = useState(null);

  const isDeveloper = Boolean(developerInfo?.isDeveloper);

  const selectedIssue = useMemo(
    () => issues.find(issue => getEntityId(issue) === selectedIssueId) || issues[0] || null,
    [issues, selectedIssueId]
  );

  const loadArena = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, developerRes, issuesRes] = await Promise.all([
        api.get('/games/summary/me').catch(() => ({ data: null })),
        api.get('/games/developers/me').catch(() => ({ data: { isDeveloper: false } })),
        api.get('/games/fix-arena/issues').catch(() => ({ data: { issues: [] } }))
      ]);

      setSummary(summaryRes.data);
      setDeveloperInfo(developerRes.data || { isDeveloper: false });
      setIssues(issuesRes.data?.issues || []);
      setSelectedIssueId(prev => prev || issuesRes.data?.issues?.[0]?._id || null);
    } catch (err) {
      toast.error('Failed to load Fix Arena');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArena();
  }, [loadArena]);

  const refreshIssues = async (selectId) => {
    const res = await api.get('/games/fix-arena/issues');
    const nextIssues = res.data?.issues || [];
    setIssues(nextIssues);
    setSelectedIssueId(selectId || nextIssues[0]?._id || null);
  };

  const unlockDeveloper = async (event) => {
    event.preventDefault();
    if (!developerPassword.trim()) return;
    setUnlockingDeveloper(true);
    try {
      const res = await api.post('/games/developers/access', { password: developerPassword });
      setDeveloperInfo(res.data);
      setDeveloperPassword('');
      toast.success('Developer access granted');
      await refreshIssues();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Developer access failed');
    } finally {
      setUnlockingDeveloper(false);
    }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (isDeveloper) {
      toast.error('Developer accounts cannot submit member reports');
      return;
    }

    if (!reportForm.title.trim() || !reportForm.details.trim()) {
      toast.error('Title and details are required');
      return;
    }

    setSubmittingReport(true);
    try {
      await api.post('/games/fix-arena/issues', reportForm);
      setReportForm(initialReportForm);
      setSelectedIssueId(null);
      toast.success('Submitted privately to developers');
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Backend is not updated yet. Redeploy Render backend first.');
      } else {
        toast.error(err.response?.data?.msg || 'Submit failed');
      }
    } finally {
      setSubmittingReport(false);
    }
  };

  const updateStatus = async (issueId, status) => {
    try {
      const res = await api.put(`/games/fix-arena/issues/${issueId}/status`, { status });
      setIssues(prev => prev.map(issue => getEntityId(issue) === issueId ? res.data : issue));
      toast.success('Status updated');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Status update failed');
    }
  };

  const sendIssueMessage = async (event) => {
    event.preventDefault();
    if (!selectedIssue || !messageText.trim()) return;

    setSendingMessage(true);
    try {
      const res = await api.post(`/games/fix-arena/issues/${selectedIssue._id}/messages`, { text: messageText });
      setIssues(prev => prev.map(issue => getEntityId(issue) === getEntityId(selectedIssue) ? res.data : issue));
      setMessageText('');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Message failed');
    } finally {
      setSendingMessage(false);
    }
  };

  const startTypingSprint = async () => {
    setTypingBusy(true);
    setTypingResult(null);
    setTypingText('');
    setTypingSeconds(0);
    try {
      const res = await api.post('/games/typing-sprint/start');
      setTypingSession(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Backend is not updated yet. Redeploy Render backend first.');
      } else {
        toast.error(err.response?.data?.msg || 'Could not start Typing Sprint');
      }
    } finally {
      setTypingBusy(false);
    }
  };

  const submitTypingSprint = async (event) => {
    event.preventDefault();
    if (!typingSession || !typingText.trim()) return;

    setTypingBusy(true);
    try {
      const res = await api.post(`/games/typing-sprint/${typingSession.sessionId}/submit`, { text: typingText });
      setTypingResult(res.data.result);
      setSummary(prev => ({ ...(prev || {}), typingStats: res.data.stats }));
      setTypingSession(null);
      setTypingSeconds(0);
      const summaryRes = await api.get('/games/summary/me');
      setSummary(summaryRes.data);
      toast.success('Typing score saved');
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Backend is not updated yet. Redeploy Render backend first.');
      } else {
        toast.error(err.response?.data?.msg || 'Typing Sprint failed');
      }
    } finally {
      setTypingBusy(false);
    }
  };

  useEffect(() => {
    if (!typingSession || typingResult) return undefined;
    const timer = setInterval(() => {
      const startedAt = new Date(typingSession.startedAt).getTime();
      setTypingSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 250);

    return () => clearInterval(timer);
  }, [typingResult, typingSession]);

  const issueStats = useMemo(() => {
    const open = issues.filter(issue => !['approved', 'rejected', 'resolved', 'closed'].includes(issue.status)).length;
    const critical = issues.filter(issue => issue.severity === 'critical' || issue.severity === 'high').length;
    const resolved = issues.filter(issue => ['approved', 'resolved'].includes(issue.status)).length;
    return { open, critical, resolved };
  }, [issues]);

  const statCards = [
    { icon: AlertTriangle, label: 'Pending Reports', value: issueStats.open, helper: isDeveloper ? 'Developer-only queue' : 'Visible to developers only', tone: 'from-rose-500 to-pink-600' },
    { icon: CheckCircle2, label: 'Approved', value: issueStats.resolved, helper: 'Accepted suggestions or fixes', tone: 'from-emerald-500 to-teal-600' },
    { icon: Trophy, label: 'Typing High Score', value: summary?.typingStats?.highScore || 0, helper: `${summary?.typingStats?.bestAccuracy || 0}% best accuracy`, tone: 'from-yellow-400 to-orange-600' },
    { icon: Zap, label: 'Best Speed', value: `${summary?.typingStats?.bestWpm || 0} WPM`, helper: summary?.typingStats?.fastestMs ? `${formatElapsed(summary.typingStats.fastestMs)} fastest finish` : 'No timed run yet', tone: 'from-cyan-400 to-blue-600' }
  ];

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:px-6 lg:px-8">
        <div className="h-56 animate-pulse rounded-3xl bg-white dark:bg-gray-800" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(item => <div key={item} className="h-32 animate-pulse rounded-2xl bg-white dark:bg-gray-800" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl bg-gray-950 shadow-2xl shadow-cyan-500/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.25),transparent_30%),radial-gradient(circle_at_82%_22%,rgba(236,72,153,0.25),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.9))]" />
        <div className="relative grid gap-6 p-6 text-white md:p-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ArenaMark />
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase text-cyan-100 backdrop-blur">
                <Code2 size={14} />
                Member reports + developer response
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-normal md:text-5xl">Fix Arena</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 md:text-base">
                Members can report problems or suggestions. Developers can review, reply, update status, and keep communication in one clean thread.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
            <GameRankBadge stats={summary?.typingStats} showProgress />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(card => <StatCard key={card.label} {...card} />)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-pink-500 to-cyan-500 p-3 text-white">
                <Bug size={22} />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-950 dark:text-white">Submit a Problem or Suggestion</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Send clear details so developers know what to improve.</p>
              </div>
            </div>

            {isDeveloper ? (
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm font-bold text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-200">
                Developer accounts review reports only. Suggestions and bug reports can be submitted by regular members.
              </div>
            ) : (
              <form onSubmit={submitReport} className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <select value={reportForm.type} onChange={event => setReportForm(prev => ({ ...prev, type: event.target.value }))} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
                    <option value="problem">Problem</option>
                    <option value="suggestion">Suggestion</option>
                  </select>
                  <select value={reportForm.category} onChange={event => setReportForm(prev => ({ ...prev, category: event.target.value }))} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
                    {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <select value={reportForm.severity} onChange={event => setReportForm(prev => ({ ...prev, severity: event.target.value }))} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
                  <option value="low">Low severity</option>
                  <option value="medium">Medium severity</option>
                  <option value="high">High severity</option>
                  <option value="critical">Critical severity</option>
                </select>
                <input value={reportForm.workspaceName} onChange={event => setReportForm(prev => ({ ...prev, workspaceName: event.target.value }))} placeholder="Related workspace or page (optional)" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                <input value={reportForm.title} onChange={event => setReportForm(prev => ({ ...prev, title: event.target.value }))} placeholder="Short title" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                <textarea value={reportForm.details} onChange={event => setReportForm(prev => ({ ...prev, details: event.target.value }))} rows="4" placeholder="What happened? Include steps, screen, or exact behavior." className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                <textarea value={reportForm.expected} onChange={event => setReportForm(prev => ({ ...prev, expected: event.target.value }))} rows="3" placeholder="What should happen instead? (optional)" className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                <button disabled={submittingReport} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-3 text-sm font-black text-white transition hover:bg-pink-700 disabled:opacity-60">
                  <Send size={17} />
                  {submittingReport ? 'Submitting...' : 'Submit Privately'}
                </button>
              </form>
            )}
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-gray-950 p-3 text-white dark:bg-white dark:text-gray-950">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-950 dark:text-white">Developer Access</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{isDeveloper ? 'You can review all member reports.' : 'Unlock developer console access.'}</p>
              </div>
            </div>

            {isDeveloper ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                Developer mode active for {developerInfo?.user?.name || 'this account'}.
              </div>
            ) : (
              <form onSubmit={unlockDeveloper} className="flex gap-2">
                <label className="relative flex-1">
                  <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="password" value={developerPassword} onChange={event => setDeveloperPassword(event.target.value)} placeholder="Developer password" className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                </label>
                <button disabled={unlockingDeveloper} className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-gray-800 disabled:opacity-60 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200">
                  Unlock
                </button>
              </form>
            )}
          </section>
        </div>

        <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-100 p-5 dark:border-gray-800">
              <h2 className="text-lg font-black text-gray-950 dark:text-white">{isDeveloper ? 'Developer Inbox' : 'Private Developer Queue'}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{isDeveloper ? `${issues.length} submitted items` : 'Member submissions are visible to developers only'}</p>
            </div>
            <div className="max-h-[680px] overflow-y-auto p-3">
              {issues.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950/50 dark:text-gray-400">
                  {isDeveloper ? 'No reports yet.' : 'Submit a report and the developer team will review it privately.'}
                </div>
              ) : issues.map(issue => {
                const isActive = getEntityId(issue) === getEntityId(selectedIssue);
                return (
                  <button
                    key={issue._id}
                    type="button"
                    onClick={() => setSelectedIssueId(issue._id)}
                    className={`mb-2 w-full rounded-2xl border p-4 text-left transition hover:border-pink-200 hover:bg-pink-50 dark:hover:border-pink-900/60 dark:hover:bg-pink-950/20 ${isActive ? 'border-pink-200 bg-pink-50 dark:border-pink-900/60 dark:bg-pink-950/20' : 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/50'}`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-black uppercase ring-1 ${severityStyles[issue.severity] || severityStyles.medium}`}>
                        {issue.severity}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-black uppercase ring-1 ${statusStyles[issue.status] || statusStyles.new}`}>
                        {issue.status}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm font-black text-gray-950 dark:text-white">{issue.title}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
                      {issue.type} · {issue.category} · {issue.userId?.name || 'Member'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            {selectedIssue ? (
              <>
                <div className="border-b border-gray-100 p-5 dark:border-gray-800">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ring-1 ${severityStyles[selectedIssue.severity] || severityStyles.medium}`}>{selectedIssue.severity}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ring-1 ${statusStyles[selectedIssue.status] || statusStyles.new}`}>{selectedIssue.status}</span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300">{selectedIssue.category}</span>
                      </div>
                      <h2 className="text-xl font-black text-gray-950 dark:text-white">{selectedIssue.title}</h2>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Submitted by {selectedIssue.userId?.name || 'Member'} · {formatDateTime(selectedIssue.createdAt)}</p>
                    </div>
                    {isDeveloper && (
                      <select value={selectedIssue.status} onChange={event => updateStatus(selectedIssue._id, event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-black text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
                        {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950/50">
                      <p className="text-sm font-black text-gray-950 dark:text-white">Problem details</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">{selectedIssue.details}</p>
                    </div>
                    {selectedIssue.expected && (
                      <div className="rounded-2xl bg-cyan-50 p-4 dark:bg-cyan-950/20">
                        <p className="text-sm font-black text-cyan-900 dark:text-cyan-100">Expected result</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-cyan-800 dark:text-cyan-200">{selectedIssue.expected}</p>
                      </div>
                    )}

                    <div className="rounded-2xl border border-gray-100 dark:border-gray-800">
                      <div className="border-b border-gray-100 p-4 dark:border-gray-800">
                        <h3 className="flex items-center gap-2 font-black text-gray-950 dark:text-white">
                          <MessageCircle size={18} />
                          Communication Thread
                        </h3>
                      </div>
                      <div className="max-h-80 space-y-3 overflow-y-auto p-4">
                        {(selectedIssue.messages || []).map(message => {
                          const avatar = resolveMediaUrl(message.senderId?.avatar);
                          const isDevMessage = message.role === 'developer';
                          return (
                            <div key={message._id || message.createdAt} className={`flex gap-3 ${isDevMessage ? 'justify-end' : ''}`}>
                              {!isDevMessage && (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-sm font-bold text-white">
                                  {avatar ? <img src={avatar} alt={message.senderId?.name || 'User'} className="h-full w-full object-cover" /> : message.senderId?.name?.charAt(0)?.toUpperCase()}
                                </div>
                              )}
                              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isDevMessage ? 'bg-gray-950 text-white dark:bg-white dark:text-gray-950' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'}`}>
                                <p className="text-xs font-black uppercase opacity-70">{isDevMessage ? 'Developer' : message.senderId?.name || 'Member'}</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                                <p className="mt-2 text-[11px] opacity-60">{formatDateTime(message.createdAt)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <form onSubmit={sendIssueMessage} className="flex gap-2 border-t border-gray-100 p-3 dark:border-gray-800">
                        <input value={messageText} onChange={event => setMessageText(event.target.value)} placeholder={isDeveloper ? 'Reply as developer...' : 'Message the developers...'} className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                        <button disabled={sendingMessage || !messageText.trim()} className="rounded-xl bg-pink-600 px-4 text-white transition hover:bg-pink-700 disabled:opacity-50" aria-label="Send message">
                          <Send size={18} />
                        </button>
                      </form>
                    </div>
                  </div>

                  <aside className="space-y-4">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/50">
                      <p className="text-sm font-black text-gray-950 dark:text-white">Reporter</p>
                      <button type="button" onClick={() => setProfileUser(selectedIssue.userId)} className="mt-3 flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left transition hover:bg-pink-50 dark:bg-gray-900 dark:hover:bg-pink-950/20">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-sm font-bold text-white">
                          {resolveMediaUrl(selectedIssue.userId?.avatar) ? <img src={resolveMediaUrl(selectedIssue.userId?.avatar)} alt={selectedIssue.userId?.name || 'User'} className="h-full w-full object-cover" /> : selectedIssue.userId?.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-gray-950 dark:text-white">{selectedIssue.userId?.name || 'Member'}</p>
                          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{selectedIssue.userId?.email || 'No email'}</p>
                        </div>
                      </button>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm dark:border-gray-800 dark:bg-gray-950/50">
                      <p className="font-black text-gray-950 dark:text-white">Report metadata</p>
                      <div className="mt-3 space-y-2 text-gray-600 dark:text-gray-300">
                        <p>Type: <span className="font-bold capitalize">{selectedIssue.type}</span></p>
                        <p>Workspace: <span className="font-bold">{selectedIssue.workspaceName || 'Not specified'}</span></p>
                        <p>Updated: <span className="font-bold">{formatDateTime(selectedIssue.updatedAt)}</span></p>
                      </div>
                    </div>
                  </aside>
                </div>
              </>
            ) : (
              <div className="grid min-h-[480px] place-items-center p-8 text-center">
                <div>
                  <Lightbulb className="mx-auto text-pink-500" size={38} />
                  <h2 className="mt-3 text-xl font-black text-gray-950 dark:text-white">{isDeveloper ? 'No selected report' : 'Reports are developer-only'}</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {isDeveloper ? 'Select a report to review the details and decide approve or reject.' : 'Members can submit suggestions or bugs, then developers review them privately.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-gray-950 dark:text-white">
                <Sparkles className="text-yellow-500" size={22} />
                Typing Sprint
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Fun mode: type the developer prompt quickly and accurately.</p>
            </div>
            {typingSession && (
              <span className="inline-flex items-center gap-2 rounded-xl bg-cyan-50 px-3 py-2 text-sm font-black text-cyan-700 ring-1 ring-cyan-100 dark:bg-cyan-950/30 dark:text-cyan-200 dark:ring-cyan-900/60">
                <Clock size={16} />
                {formatElapsed(typingSeconds * 1000)}
              </span>
            )}
            <button onClick={startTypingSprint} disabled={typingBusy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-gray-800 disabled:opacity-60 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200">
              <Play size={17} fill="currentColor" />
              {typingSession ? 'Restart' : 'Start'}
            </button>
          </div>

          <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-950/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black uppercase text-gray-500 dark:text-gray-400">Prompt</p>
              <p className="rounded-full bg-white px-3 py-1 text-xs font-black text-gray-600 ring-1 ring-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-800">
                Ranking uses best score, accuracy, WPM, then fastest time
              </p>
            </div>
            <p className="mt-2 text-lg font-black leading-8 text-gray-950 dark:text-white">
              {typingSession?.prompt || 'Start a sprint to receive a professional project prompt.'}
            </p>
          </div>

          <form onSubmit={submitTypingSprint} className="mt-4 space-y-3">
            <textarea value={typingText} onChange={event => setTypingText(event.target.value)} disabled={!typingSession || typingBusy} rows="4" placeholder="Type the prompt here..." className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-cyan-950 dark:disabled:bg-gray-900" />
            <button disabled={!typingSession || typingBusy || !typingText.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-black text-white transition hover:bg-cyan-700 disabled:opacity-50">
              <Zap size={17} />
              Submit Typing Score
            </button>
          </form>

          {typingResult && (
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-yellow-50 p-4 dark:bg-yellow-950/20">
                <p className="text-xs font-black uppercase text-yellow-700 dark:text-yellow-200">Score</p>
                <p className="mt-1 text-2xl font-black text-gray-950 dark:text-white">{typingResult.score}</p>
              </div>
              <div className="rounded-2xl bg-cyan-50 p-4 dark:bg-cyan-950/20">
                <p className="text-xs font-black uppercase text-cyan-700 dark:text-cyan-200">WPM</p>
                <p className="mt-1 text-2xl font-black text-gray-950 dark:text-white">{typingResult.wpm}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/20">
                <p className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-200">Accuracy</p>
                <p className="mt-1 text-2xl font-black text-gray-950 dark:text-white">{typingResult.accuracy}%</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950/50">
                <p className="text-xs font-black uppercase text-gray-500 dark:text-gray-400">Time</p>
                <p className="mt-1 text-2xl font-black text-gray-950 dark:text-white">{formatElapsed(typingResult.elapsedMs)}</p>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <GameRankBadge stats={summary?.typingStats} />
          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-950 dark:text-white">Typing Leaderboard</h2>
              <Crown className="text-yellow-500" size={22} />
            </div>
            <div className="space-y-2">
              {(summary?.typingLeaderboard || []).slice(0, 8).map(entry => {
                const avatar = resolveMediaUrl(entry.user?.avatar);
                return (
                  <button key={entry.user?._id || entry.position} type="button" onClick={() => setProfileUser(entry.user)} className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-left transition hover:border-cyan-200 hover:bg-cyan-50 dark:border-gray-800 dark:bg-gray-950/50 dark:hover:border-cyan-900/60 dark:hover:bg-cyan-950/20">
                    <span className="w-7 text-center text-sm font-black text-gray-500 dark:text-gray-400">#{entry.position}</span>
                    <GameRankEmblem rank={entry.stats?.rank} size="sm" />
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-500 to-pink-500 text-sm font-bold text-white">
                      {avatar ? <img src={avatar} alt={entry.user?.name || 'User'} className="h-full w-full object-cover" /> : entry.user?.name?.charAt(0)?.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-gray-950 dark:text-white">{entry.user?.name || 'User'}</span>
                      <span className="block truncate text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {entry.stats?.bestAccuracy || 0}% · {entry.stats?.bestWpm || 0} WPM · {entry.stats?.fastestMs ? formatElapsed(entry.stats.fastestMs) : 'no time'}
                      </span>
                    </span>
                    <span className="text-sm font-black text-gray-950 dark:text-white">{entry.stats?.highScore || 0}</span>
                  </button>
                );
              })}
              {(summary?.typingLeaderboard || []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950/50 dark:text-gray-400">
                  No typing scores yet.
                </div>
              )}
            </div>
          </section>
        </aside>
      </section>

      <UserProfileModal isOpen={Boolean(profileUser)} user={profileUser} onClose={() => setProfileUser(null)} />
    </div>
  );
}
