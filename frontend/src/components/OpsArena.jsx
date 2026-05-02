import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  CheckCircle2,
  Clock,
  Code2,
  Crown,
  Feather,
  Gamepad2,
  Keyboard,
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
import LoadingSpinner from './LoadingSpinner';

const BlockStackGame = lazy(() => import('./BlockStackGame'));
const BugHuntGame = lazy(() => import('./BugHuntGame'));
const FocusFlowGame = lazy(() => import('./FocusFlowGame'));
const FlappyBirdGame = lazy(() => import('./FlappyBirdGame'));

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const severityStyles = {
  low: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/60',
  medium: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/60',
  high: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-200 dark:ring-rose-900/60',
  critical: 'bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-200 dark:ring-indigo-900/60'
};

const statusStyles = {
  new: 'bg-pink-50 text-pink-700 ring-pink-100 dark:bg-pink-950/30 dark:text-pink-200 dark:ring-pink-900/60',
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

const TypingGameLogo = ({ compact = false }) => (
  <div className={`${compact ? 'h-12 w-12 rounded-2xl' : 'h-16 w-16 rounded-3xl'} relative grid shrink-0 place-items-center overflow-hidden bg-gray-950 text-white shadow-xl shadow-yellow-500/20 ring-1 ring-yellow-300/20`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(250,204,21,0.5),transparent_34%),radial-gradient(circle_at_78%_75%,rgba(34,211,238,0.36),transparent_35%)]" />
    <Keyboard size={compact ? 24 : 30} className="relative z-10 text-yellow-100 drop-shadow" />
  </div>
);

const FlappyGameLogo = ({ compact = false }) => (
  <div className={`${compact ? 'h-12 w-12 rounded-2xl' : 'h-16 w-16 rounded-3xl'} relative grid shrink-0 place-items-center overflow-hidden bg-sky-950 text-white shadow-xl shadow-sky-500/20 ring-1 ring-sky-300/20`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(250,204,21,0.5),transparent_34%),radial-gradient(circle_at_80%_74%,rgba(34,211,238,0.38),transparent_35%)]" />
    <Feather size={compact ? 24 : 30} className="relative z-10 rotate-12 text-yellow-100 drop-shadow" />
  </div>
);

const BlockGameLogo = ({ compact = false }) => (
  <div className={`${compact ? 'h-12 w-12 rounded-2xl' : 'h-16 w-16 rounded-3xl'} relative grid shrink-0 place-items-center overflow-hidden bg-gray-950 text-white shadow-xl shadow-cyan-500/20 ring-1 ring-cyan-300/20`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.45),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(236,72,153,0.38),transparent_35%)]" />
    <div className="relative grid grid-cols-3 gap-1">
      {Array.from({ length: 9 }).map((_, index) => (
        <span key={index} className={`h-2.5 w-2.5 rounded-[4px] ${[0, 1, 3, 4, 5, 8].includes(index) ? 'bg-gradient-to-br from-cyan-300 to-pink-500' : 'bg-white/15'}`} />
      ))}
    </div>
  </div>
);

const BugHuntLogo = ({ compact = false }) => (
  <div className={`${compact ? 'h-12 w-12 rounded-2xl' : 'h-16 w-16 rounded-3xl'} relative grid shrink-0 place-items-center overflow-hidden bg-gray-950 text-white shadow-xl shadow-rose-500/20 ring-1 ring-rose-300/20`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_22%,rgba(251,113,133,0.46),transparent_34%),radial-gradient(circle_at_78%_78%,rgba(34,211,238,0.3),transparent_35%)]" />
    <Bug size={compact ? 25 : 31} className="relative z-10 text-rose-100 drop-shadow" />
  </div>
);

const FocusFlowLogo = ({ compact = false }) => (
  <div className={`${compact ? 'h-12 w-12 rounded-2xl' : 'h-16 w-16 rounded-3xl'} relative grid shrink-0 place-items-center overflow-hidden bg-gray-950 text-white shadow-xl shadow-emerald-500/20 ring-1 ring-emerald-300/20`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(52,211,153,0.42),transparent_34%),radial-gradient(circle_at_75%_80%,rgba(34,211,238,0.3),transparent_35%)]" />
    <Target size={compact ? 25 : 31} className="relative z-10 text-emerald-100 drop-shadow" />
  </div>
);

const ComingSoonLogo = ({ compact = false }) => (
  <div className={`${compact ? 'h-12 w-12 rounded-2xl' : 'h-16 w-16 rounded-3xl'} relative grid shrink-0 place-items-center overflow-hidden bg-gray-950 text-white shadow-xl shadow-violet-500/20 ring-1 ring-violet-300/20`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(79,70,229,0.5),transparent_34%),radial-gradient(circle_at_75%_80%,rgba(236,72,153,0.35),transparent_35%)]" />
    <Gamepad2 size={compact ? 24 : 30} className="relative z-10 text-violet-100 drop-shadow" />
  </div>
);

const getTypingSentences = (session) => {
  if (Array.isArray(session?.sentences) && session.sentences.length) return session.sentences;
  return String(session?.prompt || '').split(/\n+/).map(item => item.trim()).filter(Boolean);
};

const normalizeTypingSentence = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

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
  const [typingEntries, setTypingEntries] = useState([]);
  const [typingResult, setTypingResult] = useState(null);
  const [typingSeconds, setTypingSeconds] = useState(0);
  const [typingBusy, setTypingBusy] = useState(false);
  const [activeGame, setActiveGame] = useState('blocks');
  const [arenaView, setArenaView] = useState('home');
  const [profileUser, setProfileUser] = useState(null);

  const isDeveloper = Boolean(developerInfo?.isDeveloper);

  const selectedIssue = useMemo(
    () => issues.find(issue => getEntityId(issue) === selectedIssueId) || issues[0] || null,
    [issues, selectedIssueId]
  );

  const loadArena = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
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

  useEffect(() => {
    if (loading) return undefined;
    const timer = window.setInterval(() => {
      refreshIssues(selectedIssueId).catch(() => {});
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loading, selectedIssueId]);

  const unlockDeveloper = async (event) => {
    event.preventDefault();
    if (!developerPassword.trim()) return;
    setUnlockingDeveloper(true);
    try {
      const res = await api.post('/games/developers/access', { password: developerPassword });
      setDeveloperInfo(res.data);
      setDeveloperPassword('');
      window.dispatchEvent(new CustomEvent('developerAccessUpdated', { detail: { isDeveloper: true } }));
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
      const res = await api.post('/games/fix-arena/issues', reportForm);
      setReportForm(initialReportForm);
      await refreshIssues(res.data?.issueId);
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
      loadArena({ silent: true });
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
      if (isDeveloper) loadArena({ silent: true });
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
    setTypingEntries([]);
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

  const submitTypingSprint = useCallback(async (event, overrideEntries = null) => {
    event?.preventDefault?.();
    if (!typingSession || typingBusy) return;

    const sentences = getTypingSentences(typingSession);
    let finalEntries = overrideEntries || typingEntries;
    const currentTyped = typingText.trim();

    if (!overrideEntries && currentTyped && sentences[finalEntries.length]) {
      const expected = sentences[finalEntries.length];
      finalEntries = [
        ...finalEntries,
        {
          expected,
          typed: currentTyped,
          correct: normalizeTypingSentence(currentTyped) === normalizeTypingSentence(expected)
        }
      ];
    }

    if (!finalEntries.length) return;

    setTypingBusy(true);
    try {
      const typedSentences = finalEntries.map(entry => entry.typed);
      const res = await api.post(`/games/typing-sprint/${typingSession.sessionId}/submit`, {
        mode: 'sentence-stream',
        text: typedSentences.join('\n'),
        typedSentences
      });
      setTypingResult(res.data.result);
      setSummary(prev => ({ ...(prev || {}), typingStats: res.data.stats }));
      setTypingSession(null);
      setTypingSeconds(0);
      setTypingEntries([]);
      setTypingText('');
      const summaryRes = await api.get('/games/summary/me');
      setSummary(summaryRes.data);
      toast.success('Typing Sprint saved');
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Backend is not updated yet. Redeploy Render backend first.');
      } else {
        toast.error(err.response?.data?.msg || 'Typing Sprint failed');
      }
    } finally {
      setTypingBusy(false);
    }
  }, [typingBusy, typingEntries, typingSession, typingText]);

  const advanceTypingSentence = useCallback((rawSentence, expectedIndex = null) => {
    if (!typingSession || typingBusy) return;
    const typed = String(rawSentence || '').trim();
    if (!typed) return;

    const sentences = getTypingSentences(typingSession);
    setTypingEntries(prev => {
      if (expectedIndex !== null && prev.length !== expectedIndex) return prev;
      const expected = sentences[prev.length];
      if (!expected) return prev;
      const next = [
        ...prev,
        {
          expected,
          typed,
          correct: normalizeTypingSentence(typed) === normalizeTypingSentence(expected)
        }
      ];
      if (next.length >= sentences.length) {
        window.setTimeout(() => submitTypingSprint(null, next), 0);
      }
      return next;
    });
    setTypingText('');
  }, [submitTypingSprint, typingBusy, typingSession]);

  const handleTypingTextChange = (event) => {
    const value = event.target.value;
    if (!typingSession || typingBusy) return;
    if (value.length < typingText.length) return;
    const sentences = getTypingSentences(typingSession);
    const expected = sentences[typingEntries.length] || '';
    const normalizedValue = normalizeTypingSentence(value);
    const normalizedExpected = normalizeTypingSentence(expected);

    setTypingText(value);

    if (normalizedValue && normalizedValue === normalizedExpected) {
      window.setTimeout(() => advanceTypingSentence(value, typingEntries.length), 120);
      return;
    }
  };

  const handleTypingKeyDown = (event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      advanceTypingSentence(typingText, typingEntries.length);
    }
  };

  const handleTypingBeforeInput = (event) => {
    if (event.inputType?.startsWith('delete')) {
      event.preventDefault();
    }
  };

  const renderTypingPrompt = () => {
    if (!typingProgress.prompt) return 'Done';

    const promptChars = typingProgress.prompt.split('');
    const typedChars = typingProgress.typed.split('');
    const extraChars = typedChars.slice(promptChars.length);

    return (
      <>
        {promptChars.map((char, index) => {
          const typedChar = typedChars[index];
          const hasTyped = typeof typedChar === 'string';
          const isWrong = hasTyped && typedChar.toLowerCase() !== char.toLowerCase();
          const isCurrent = index === typedChars.length;

          return (
            <span
              key={`${char}-${index}`}
              className={`typing-prompt-char ${
                isWrong
                  ? 'is-wrong'
                  : hasTyped
                    ? 'is-correct'
                    : isCurrent
                      ? 'is-current'
                      : ''
              }`}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          );
        })}
        {extraChars.map((char, index) => (
          <span key={`extra-${char}-${index}`} className="typing-prompt-char is-wrong">
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </>
    );
  };

  useEffect(() => {
    if (!typingSession || typingResult) return undefined;
    const timer = setInterval(() => {
      const startedAt = new Date(typingSession.startedAt).getTime();
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setTypingSeconds(elapsed);
      if (elapsed >= (typingSession.durationSeconds || 60)) {
        submitTypingSprint(null);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [submitTypingSprint, typingResult, typingSession]);

  const typingProgress = useMemo(() => {
    const sentences = getTypingSentences(typingSession);
    const prompt = sentences[typingEntries.length] || '';
    const typed = typingText || '';
    let mistakes = 0;

    for (let index = 0; index < typed.length; index += 1) {
      if ((typed[index] || '').toLowerCase() !== (prompt[index] || '').toLowerCase()) mistakes += 1;
    }

    const accuracy = typed.length
      ? Math.max(0, Math.round(((typed.length - mistakes) / typed.length) * 100))
      : 100;

    return {
      prompt,
      sentences,
      typed,
      mistakes,
      accuracy,
      correctCount: typingEntries.filter(entry => entry.correct).length,
      attemptedCount: typingEntries.length,
      remainingCount: Math.max(0, sentences.length - typingEntries.length),
      complete: Boolean(prompt) && normalizeTypingSentence(typed) === normalizeTypingSentence(prompt)
    };
  }, [typingEntries, typingSession, typingText]);
  const typingRemainingSeconds = typingSession
    ? Math.max(0, (typingSession.durationSeconds || 60) - typingSeconds)
    : 0;
  const typingInputWrong = Boolean(
    typingProgress.typed
    && typingProgress.prompt
    && !normalizeTypingSentence(typingProgress.prompt).startsWith(normalizeTypingSentence(typingProgress.typed))
  );

  const issueStats = useMemo(() => {
    const open = issues.filter(issue => !['approved', 'rejected', 'resolved', 'closed'].includes(issue.status)).length;
    const critical = issues.filter(issue => issue.severity === 'critical' || issue.severity === 'high').length;
    const resolved = issues.filter(issue => ['approved', 'resolved'].includes(issue.status)).length;
    return { open, critical, resolved };
  }, [issues]);

  const statCards = [
    { icon: AlertTriangle, label: 'Pending Reports', value: issueStats.open, helper: isDeveloper ? 'Developer-only queue' : 'Visible to developers only', tone: 'from-rose-500 to-pink-600' },
    { icon: CheckCircle2, label: 'Approved', value: issueStats.resolved, helper: 'Accepted suggestions or fixes', tone: 'from-emerald-500 to-cyan-600' },
    { icon: Trophy, label: 'Arena Rank Score', value: summary?.stats?.highScore || 0, helper: `${summary?.stats?.totalPlays || 0} saved game runs`, tone: 'from-yellow-400 to-orange-600' },
    { icon: Zap, label: 'Flappy Best', value: summary?.flappyStats?.highScore || 0, helper: summary?.flappyStats?.totalPlays ? `${summary.flappyStats.totalPlays} ranked flights` : 'No flight yet', tone: 'from-cyan-400 to-pink-600' }
  ];

  const gameCards = [
    {
      key: 'blocks',
      title: 'WorkGrid Blocks',
      label: 'Puzzle Game',
      description: 'Clear sprint lanes with workload blocks.',
      status: 'Live',
      best: summary?.blockStats?.highScore || 0,
      Logo: BlockGameLogo,
      accent: 'from-cyan-400 to-pink-500'
    },
    {
      key: 'flappy',
      title: 'Flappy Scholar',
      label: 'Arcade Challenge',
      description: 'Tap through study gates and keep the scholar flying.',
      status: 'Live',
      best: summary?.flappyStats?.highScore || 0,
      Logo: FlappyGameLogo,
      accent: 'from-yellow-300 to-sky-400'
    },
    {
      key: 'bug-hunt',
      title: 'Bug Hunt',
      label: 'QA Challenge',
      description: 'Find UI and workflow issues before time runs out.',
      status: 'Live',
      best: summary?.bugHuntStats?.highScore || 0,
      Logo: BugHuntLogo,
      accent: 'from-rose-400 to-cyan-400'
    },
    {
      key: 'focus-flow',
      title: 'Focus Flow',
      label: 'Timing Challenge',
      description: 'Lock the signal inside the focus zone.',
      status: 'Live',
      best: summary?.focusFlowStats?.highScore || 0,
      Logo: FocusFlowLogo,
      accent: 'from-emerald-400 to-cyan-400'
    },
    {
      key: 'coming',
      title: 'More Games',
      label: 'Coming Soon',
      description: 'More games will be added soon.',
      status: 'Soon',
      best: null,
      Logo: ComingSoonLogo,
      accent: 'from-violet-400 to-pink-500',
      disabled: true
    }
  ];

  const openArenaView = (view) => {
    setArenaView(view);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const activeGameInfo = gameCards.find(game => game.key === activeGame) || gameCards[0];
  const viewMeta = {
    home: {
      eyebrow: 'Member reports + developer response',
      title: 'Fix Arena',
      description: 'Choose one workspace action at a time: play, submit a report, or review developer conversations without digging through one long page.'
    },
    games: {
      eyebrow: 'Game panel',
      title: activeGameInfo?.title || 'Games',
      description: 'Play one live challenge at a time. Scores from every game contribute to your Division Rank.'
    },
    report: {
      eyebrow: 'Private member report',
      title: 'Submit Report',
      description: 'Send a bug, problem, or suggestion privately to the developer team and track the response thread.'
    },
    developer: {
      eyebrow: 'Developer-only console',
      title: 'Developer Console',
      description: 'Review member submissions, reply privately, and approve, reject, or resolve reports in one focused workspace.'
    }
  }[arenaView] || {};

  const arenaActions = [
    {
      key: 'games',
      title: 'Enter Games',
      description: 'WorkGrid Blocks, Flappy Scholar, Bug Hunt, and Focus Flow.',
      icon: Gamepad2,
      tone: 'from-cyan-400 to-pink-500',
      meta: `${summary?.stats?.highScore || 0} best score`
    },
    {
      key: 'report',
      title: isDeveloper ? 'Member Reports' : 'Submit Report',
      description: isDeveloper ? 'Open member threads and developer decisions.' : 'Send a private problem or suggestion to developers.',
      icon: Bug,
      tone: 'from-pink-500 to-rose-500',
      meta: isDeveloper ? `${issues.length} total reports` : `${issues.length} submitted`
    },
    {
      key: 'developer',
      title: isDeveloper ? 'Developer Console' : 'Developer Access',
      description: isDeveloper ? 'Review, reply, approve, reject, and resolve reports.' : 'Unlock the private developer tools when needed.',
      icon: ShieldCheck,
      tone: 'from-violet-500 to-cyan-500',
      meta: isDeveloper ? `${issueStats.open} pending` : 'Password protected'
    }
  ];

  if (loading) {
    return (
      <div className="mobile-page mx-auto max-w-7xl space-y-4 px-0 py-1 sm:space-y-5 sm:px-6 sm:py-4 lg:px-8">
        <LoadingSpinner label="Loading Fix Arena" />
      </div>
    );
  }

  return (
    <div className="mobile-page mx-auto max-w-7xl space-y-4 px-0 py-1 sm:space-y-6 sm:px-6 sm:py-4 lg:px-8">
      <section className="mobile-hero-panel mobile-arena-hero relative overflow-hidden rounded-3xl bg-gray-950 shadow-2xl shadow-cyan-500/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.25),transparent_30%),radial-gradient(circle_at_82%_22%,rgba(236,72,153,0.25),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.9))]" />
        <div className="relative grid gap-6 p-6 text-white md:p-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ArenaMark />
            <div>
              {arenaView !== 'home' && (
                <button
                  type="button"
                  onClick={() => openArenaView('home')}
                  className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-black uppercase text-white backdrop-blur transition hover:-translate-x-0.5 hover:bg-white/15"
                >
                  <ArrowLeft size={15} />
                  Back to arena
                </button>
              )}
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase text-cyan-100 backdrop-blur">
                <Code2 size={14} />
                {viewMeta.eyebrow}
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-normal md:text-5xl">{viewMeta.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 md:text-base">
                {viewMeta.description}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
            <GameRankBadge stats={summary?.stats} showProgress />
          </div>
        </div>
      </section>

      {arenaView === 'home' && (
        <>
          <section className="mobile-metric-strip grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map(card => <StatCard key={card.label} {...card} />)}
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            {arenaActions.map(action => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.key}
                  type="button"
                  onClick={() => openArenaView(action.key)}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-pink-200 hover:shadow-2xl hover:shadow-pink-500/10 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-pink-900/60"
                >
                  <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${action.tone} opacity-80`} />
                  <div className="flex min-h-[11rem] flex-col justify-between gap-5">
                    <div>
                      <div className={`mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${action.tone} text-white shadow-lg shadow-pink-500/10`}>
                        <Icon size={25} />
                      </div>
                      <h2 className="text-xl font-black text-gray-950 dark:text-white">{action.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{action.description}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600 dark:bg-gray-950 dark:text-gray-300">{action.meta}</span>
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-950 text-white transition group-hover:translate-x-1 dark:bg-white dark:text-gray-950">
                        <ArrowLeft size={18} className="rotate-180" />
                      </span>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </section>
        </>
      )}

      {arenaView === 'games' && (
      <section className="mobile-game-shell overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 p-5 dark:border-gray-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-pink-500">Game Panel</p>
              <h2 className="mt-1 text-2xl font-black tracking-normal text-gray-950 dark:text-white">Choose a game to play</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Scores from all live games contribute to your arena rank.</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-2xl bg-gray-100 px-3 py-2 text-xs font-black uppercase text-gray-600 dark:bg-gray-950 dark:text-gray-300">
              <Gamepad2 size={16} />
              More games will be added soon
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="mobile-game-tabs grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {gameCards.map(game => {
              const Logo = game.Logo;
              const isActive = activeGame === game.key;
              return (
                <button
                  key={game.key}
                  type="button"
                  disabled={game.disabled}
                  onClick={() => !game.disabled && setActiveGame(game.key)}
                  className={`group relative min-w-0 overflow-hidden rounded-2xl border p-3 text-left transition ${
                    isActive
                      ? 'border-pink-200 bg-pink-50 shadow-lg shadow-pink-500/10 ring-1 ring-pink-200/70 dark:border-pink-900/70 dark:bg-pink-950/20 dark:ring-pink-500/20'
                      : 'border-gray-100 bg-gray-50 hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-50 dark:border-gray-800 dark:bg-gray-950/50 dark:hover:border-cyan-900/70 dark:hover:bg-cyan-950/20'
                  } disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${game.accent} ${isActive ? 'opacity-100' : 'opacity-0'} transition group-hover:opacity-100`} />
                  <div className="flex items-center gap-3">
                    <Logo compact />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full bg-gradient-to-r ${game.accent} px-2 py-0.5 text-[10px] font-black uppercase text-white`}>
                          {game.status}
                        </span>
                        <span className="truncate text-[11px] font-black uppercase text-gray-400">{game.label}</span>
                      </div>
                      <h3 className="mt-1 truncate text-base font-black text-gray-950 dark:text-white">{game.title}</h3>
                      <p className="mt-1 line-clamp-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{game.description}</p>
                    </div>
                  </div>
                  {game.best !== null && (
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-black text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                      <span>Best score</span>
                      <span className="text-gray-950 dark:text-white">{game.best}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mobile-game-active grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
            <Suspense fallback={<LoadingSpinner label="Loading game" />}>
            {activeGame === 'blocks' && (
              <BlockStackGame stats={summary} onScoreSaved={() => loadArena({ silent: true })} onExit={() => openArenaView('home')} />
            )}

            {activeGame === 'flappy' && (
              <FlappyBirdGame stats={summary} onScoreSaved={() => loadArena({ silent: true })} onExit={() => openArenaView('home')} />
            )}

            {activeGame === 'typing' && (
              <section className="mobile-typing-game overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="border-b border-gray-100 p-5 dark:border-gray-800">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                      <TypingGameLogo />
                      <div>
                        <p className="text-xs font-black uppercase text-yellow-500">Speed Challenge</p>
                        <h2 className="text-2xl font-black tracking-normal text-gray-950 dark:text-white">Typing Sprint</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Type the live sentence. Wrong letters turn red and the next sentence appears automatically.</p>
                      </div>
                    </div>
                    <button onClick={startTypingSprint} disabled={typingBusy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-gray-800 disabled:opacity-60 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200">
                      <Play size={17} fill="currentColor" />
                      {typingSession ? 'Restart' : 'Start'}
                    </button>
                  </div>
                </div>

                <div className="p-5">
                  <div className="rounded-3xl bg-gray-50 p-5 dark:bg-gray-950/50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase text-gray-500 dark:text-gray-400">Live Sentence Stream</p>
                      {typingSession && (
                        <span className="inline-flex items-center gap-2 rounded-xl bg-cyan-50 px-3 py-2 text-sm font-black text-cyan-700 ring-1 ring-cyan-100 dark:bg-cyan-950/30 dark:text-cyan-200 dark:ring-cyan-900/60">
                          <Clock size={16} />
                          {typingRemainingSeconds}s left
                        </span>
                      )}
                    </div>
                    {typingSession ? (
                      <>
                        <div className="mt-3 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                          <div className="flex flex-wrap gap-2">
                            {typingEntries.slice(-10).map((entry, index) => (
                              <span key={`${entry.expected}-${index}`} className={`rounded-xl px-3 py-1.5 text-sm font-black ring-1 ${
                                entry.correct
                                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/60'
                                  : 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-200 dark:ring-rose-900/60'
                              }`}>
                                {entry.typed}
                              </span>
                            ))}
                          </div>
                          <div className="mt-5 text-center">
                            <p className="text-xs font-black uppercase text-gray-400">Current sentence</p>
                            <motion.div
                              key={typingProgress.prompt}
                              initial={{ opacity: 0, y: 10, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              className="mobile-typing-prompt mx-auto mt-2 w-full max-w-none rounded-3xl bg-white px-4 py-4 text-left text-xl font-black leading-9 tracking-normal text-gray-950 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:text-white dark:ring-gray-800 md:text-3xl md:leading-10"
                            >
                              {renderTypingPrompt()}
                            </motion.div>
                            <div className="mx-auto mt-4 h-2 max-w-md overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                              <motion.div
                                animate={{ width: `${Math.min(100, (typingEntries.length / Math.max(1, typingProgress.sentences.length)) * 100)}%` }}
                                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-pink-500 to-emerald-400"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-2xl bg-white p-3 text-sm dark:bg-gray-900">
                            <p className="text-xs font-black uppercase text-gray-400">Accuracy</p>
                            <p className={`mt-1 text-xl font-black ${typingInputWrong ? 'text-rose-500' : 'text-emerald-500'}`}>{typingProgress.attemptedCount ? Math.round((typingProgress.correctCount / typingProgress.attemptedCount) * 100) : 100}%</p>
                          </div>
                          <div className="rounded-2xl bg-white p-3 text-sm dark:bg-gray-900">
                            <p className="text-xs font-black uppercase text-gray-400">Correct</p>
                            <p className="mt-1 text-xl font-black text-gray-950 dark:text-white">{typingProgress.correctCount}/{typingProgress.attemptedCount}</p>
                          </div>
                          <div className="rounded-2xl bg-white p-3 text-sm dark:bg-gray-900">
                            <p className="text-xs font-black uppercase text-gray-400">Sentences left</p>
                            <p className="mt-1 text-xl font-black text-gray-950 dark:text-white">{typingProgress.remainingCount}</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="mt-3 text-lg font-black leading-8 text-gray-950 dark:text-white">
                        Start a sprint to receive a professional project prompt.
                      </p>
                    )}
                  </div>

                  <form onSubmit={submitTypingSprint} className="mt-4 space-y-3">
                    <input value={typingText} onChange={handleTypingTextChange} onKeyDown={handleTypingKeyDown} onBeforeInput={handleTypingBeforeInput} disabled={!typingSession || typingBusy} type="text" autoCapitalize="none" autoCorrect="off" spellCheck="false" inputMode="text" placeholder="Type here..." className={`mobile-typing-input w-full rounded-2xl border bg-white px-4 py-4 text-lg font-black leading-8 text-gray-900 outline-none disabled:bg-gray-50 dark:bg-gray-950 dark:text-white dark:disabled:bg-gray-900 ${
                      typingInputWrong
                        ? 'border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-rose-900/70 dark:focus:ring-rose-950'
                        : 'border-gray-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-gray-700 dark:focus:ring-cyan-950'
                    }`} />
                    <p className={`text-xs font-bold ${typingInputWrong ? 'text-rose-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      Backspace is locked during a sprint. Keep going until the timer ends.
                    </p>
                    <button disabled={!typingSession || typingBusy || (!typingEntries.length && !typingText.trim())} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-black text-white transition hover:bg-cyan-700 disabled:opacity-50">
                      <Zap size={17} />
                      Finish Early
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
              </section>
            )}

            {activeGame === 'bug-hunt' && (
              <BugHuntGame stats={summary} onScoreSaved={() => loadArena({ silent: true })} onExit={() => openArenaView('home')} />
            )}

            {activeGame === 'focus-flow' && (
              <FocusFlowGame stats={summary} onScoreSaved={() => loadArena({ silent: true })} onExit={() => openArenaView('home')} />
            )}
            </Suspense>
            </div>

            <aside className="grid min-w-0 gap-4 md:grid-cols-2 2xl:block 2xl:space-y-4">
              <GameRankBadge stats={summary?.stats} />
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/50">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-gradient-to-br from-cyan-400 to-pink-500 p-3 text-white shadow-lg shadow-cyan-500/10">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-950 dark:text-white">Arena Progress</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Play live games to raise your rank.</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black">
                  <div className="rounded-xl bg-white p-3 dark:bg-gray-900">
                    <p className="text-gray-500 dark:text-gray-400">Runs</p>
                    <p className="mt-1 text-lg text-gray-950 dark:text-white">{summary?.stats?.totalPlays || 0}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 dark:bg-gray-900">
                    <p className="text-gray-500 dark:text-gray-400">Best</p>
                    <p className="mt-1 text-lg text-gray-950 dark:text-white">{summary?.stats?.highScore || 0}</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div className="border-t border-gray-100 p-4 dark:border-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-gray-950 dark:text-white">Arena Leaderboard</h2>
            <Crown className="text-yellow-500" size={22} />
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {(summary?.leaderboard || []).slice(0, 8).map(entry => {
              const avatar = resolveMediaUrl(entry.user?.avatar);
              return (
                <button key={entry.user?._id || entry.position} type="button" onClick={() => setProfileUser(entry.user)} className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-left transition hover:border-cyan-200 hover:bg-cyan-50 dark:border-gray-800 dark:bg-gray-950/50 dark:hover:border-cyan-900/60 dark:hover:bg-cyan-950/20">
                  <span className="w-7 text-center text-sm font-black text-gray-500 dark:text-gray-400">#{entry.position}</span>
                  <GameRankEmblem rank={entry.stats?.rank} size="sm" animated stars={entry.stats?.apexStars} />
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-500 to-pink-500 text-sm font-bold text-white">
                    {avatar ? <img src={avatar} alt={entry.user?.name || 'User'} className="h-full w-full object-cover" /> : entry.user?.name?.charAt(0)?.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-gray-950 dark:text-white">{entry.user?.name || 'User'}</span>
                    <span className="block truncate text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {entry.stats?.totalPlays || 0} runs - {entry.stats?.bestAccuracy || 0}% best
                    </span>
                  </span>
                  <span className="text-sm font-black text-gray-950 dark:text-white">{entry.stats?.highScore || 0}</span>
                </button>
              );
            })}
            {(summary?.leaderboard || []).length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950/50 dark:text-gray-400 md:col-span-2 xl:col-span-4">
                No game scores yet.
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      {(arenaView === 'report' || arenaView === 'developer') && (
      <section className={`grid gap-5 ${arenaView === 'report' ? 'lg:grid-cols-[minmax(0,1fr)_380px]' : '2xl:grid-cols-[minmax(0,1fr)_360px]'}`}>
        <div className={`space-y-5 ${arenaView === 'developer' ? '2xl:order-2 2xl:sticky 2xl:top-4 2xl:self-start' : 'lg:order-2 lg:sticky lg:top-4 lg:self-start'}`}>
          {arenaView === 'report' && (
          <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-pink-500 to-cyan-500 p-2.5 text-white">
                <Bug size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-gray-950 dark:text-white">Submit a Report</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Send clear details so developers know what to improve.</p>
              </div>
            </div>

            {isDeveloper ? (
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm font-bold text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-200">
                Developer accounts review reports only. Suggestions and bug reports can be submitted by regular members.
              </div>
            ) : (
              <form onSubmit={submitReport} className="space-y-2.5">
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
                <textarea value={reportForm.details} onChange={event => setReportForm(prev => ({ ...prev, details: event.target.value }))} rows="3" placeholder="What happened? Include steps, screen, or exact behavior." className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                <textarea value={reportForm.expected} onChange={event => setReportForm(prev => ({ ...prev, expected: event.target.value }))} rows="2" placeholder="What should happen instead? (optional)" className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                <button disabled={submittingReport} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-3 text-sm font-black text-white transition hover:bg-pink-700 disabled:opacity-60">
                  <Send size={17} />
                  {submittingReport ? 'Submitting...' : 'Submit Privately'}
                </button>
              </form>
            )}
          </section>
          )}

          {arenaView === 'developer' && (
          <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-3 flex items-center gap-3">
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
          )}
        </div>

        <section className="grid min-w-0 gap-5 2xl:order-1 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          <div className="min-w-0 rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-100 p-5 dark:border-gray-800">
              <h2 className="text-lg font-black text-gray-950 dark:text-white">{isDeveloper ? 'Developer Inbox' : 'My Submitted Reports'}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{isDeveloper ? `${issues.length} submitted items` : 'Track developer status, approval, and replies'}</p>
            </div>
            <div className="max-h-[680px] overflow-y-auto p-3">
              {issues.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950/50 dark:text-gray-400">
                  {isDeveloper ? 'No reports yet.' : 'No submitted reports yet. Send a problem or suggestion to start a private developer thread.'}
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
                      {issue.type} - {issue.category} - {isDeveloper ? issue.userId?.name || 'Member' : `${(issue.messages || []).length} thread updates`}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
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
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Submitted by {selectedIssue.userId?.name || 'Member'} - {formatDateTime(selectedIssue.createdAt)}</p>
                    </div>
                    {isDeveloper && (
                      <select value={selectedIssue.status} onChange={event => updateStatus(selectedIssue._id, event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-black text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
                        {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid min-w-0 gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_280px]">
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
                      <p className="text-sm font-black text-gray-950 dark:text-white">Developer decision</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1.5 text-xs font-black uppercase ring-1 ${statusStyles[selectedIssue.status] || statusStyles.new}`}>
                          {selectedIssue.status}
                        </span>
                        <span className={`rounded-full px-3 py-1.5 text-xs font-black uppercase ring-1 ${severityStyles[selectedIssue.severity] || severityStyles.medium}`}>
                          {selectedIssue.severity}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">
                        Status changes and developer replies appear in the communication thread automatically.
                      </p>
                    </div>
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
                  <h2 className="mt-3 text-xl font-black text-gray-950 dark:text-white">{isDeveloper ? 'No selected report' : 'No submitted report selected'}</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {isDeveloper ? 'Select a report to review the details and decide approve or reject.' : 'Submit a suggestion or bug, then you can view its status and conversation with developers here.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </section>
      )}

      <UserProfileModal isOpen={Boolean(profileUser)} user={profileUser} onClose={() => setProfileUser(null)} />
    </div>
  );
}
