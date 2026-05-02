import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Bug, CheckCircle2, Crosshair, Eye, RotateCcw, Save, Search, Trophy } from 'lucide-react';
import api from '../services/api';
import GameOverModal from './GameOverModal';

const ROUND_SECONDS = 45;

const bugTargets = [
  {
    id: 'overdue-done',
    label: 'Done task still overdue',
    hint: 'Status conflicts with deadline',
    x: 76,
    y: 32,
    w: 18,
    h: 12,
    points: 420
  },
  {
    id: 'missing-owner',
    label: 'Missing owner',
    hint: 'A task card has no accountable person',
    x: 36,
    y: 58,
    w: 26,
    h: 12,
    points: 360
  },
  {
    id: 'duplicate-cta',
    label: 'Duplicate action',
    hint: 'Two primary actions compete in one row',
    x: 70,
    y: 75,
    w: 24,
    h: 12,
    points: 340
  },
  {
    id: 'low-contrast',
    label: 'Low contrast note',
    hint: 'A notification is hard to read',
    x: 8,
    y: 74,
    w: 28,
    h: 12,
    points: 320
  },
  {
    id: 'bad-count',
    label: 'Incorrect unread count',
    hint: 'Badge count does not match the visible items',
    x: 9,
    y: 22,
    w: 18,
    h: 11,
    points: 300
  }
];

const formatSeconds = (seconds) => `${Math.max(0, seconds)}s`;

const scoreRound = ({ foundCount, mistakes, secondsLeft, totalPoints }) => {
  const accuracy = Math.max(0, Math.round((foundCount / Math.max(1, foundCount + mistakes)) * 100));
  const completionBonus = foundCount === bugTargets.length ? 850 : 0;
  const timeBonus = foundCount === bugTargets.length ? secondsLeft * 35 : secondsLeft * 8;
  const mistakePenalty = mistakes * 120;
  const score = Math.max(0, Math.round(totalPoints + completionBonus + timeBonus - mistakePenalty));
  return { score, accuracy };
};

export function BugHuntLogo({ compact = false }) {
  return (
    <div className={`${compact ? 'h-12 w-12 rounded-2xl' : 'h-16 w-16 rounded-3xl'} relative grid shrink-0 place-items-center overflow-hidden bg-gray-950 text-white shadow-xl shadow-rose-500/20 ring-1 ring-rose-300/20`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_22%,rgba(251,113,133,0.55),transparent_34%),radial-gradient(circle_at_78%_78%,rgba(34,211,238,0.35),transparent_35%)]" />
      <Bug size={compact ? 25 : 31} className="relative z-10 text-rose-100 drop-shadow" />
    </div>
  );
}

export default function BugHuntGame({ stats, onScoreSaved, onExit }) {
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [found, setFound] = useState([]);
  const [mistakes, setMistakes] = useState(0);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pulse, setPulse] = useState(null);

  const foundSet = useMemo(() => new Set(found), [found]);
  const totalPoints = useMemo(
    () => bugTargets.filter(target => foundSet.has(target.id)).reduce((sum, target) => sum + target.points, 0),
    [foundSet]
  );

  const resetRound = () => {
    setRunning(true);
    setSecondsLeft(ROUND_SECONDS);
    setFound([]);
    setMistakes(0);
    setResult(null);
    setPulse(null);
  };

  const saveScore = async (payload) => {
    if (!payload.score) return;
    setSaving(true);
    try {
      await api.post('/games/bug-hunt/submit', payload);
      toast.success('Bug Hunt score saved');
      onScoreSaved?.();
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Backend is not updated yet. Redeploy Render backend first.');
      } else {
        toast.error(err.response?.data?.msg || 'Could not save Bug Hunt score');
      }
    } finally {
      setSaving(false);
    }
  };

  const finishRound = useCallback((override = {}) => {
    setRunning(false);
    const foundCount = override.foundCount ?? found.length;
    const nextTotalPoints = override.totalPoints ?? totalPoints;
    const nextSeconds = override.secondsLeft ?? secondsLeft;
    const nextMistakes = override.mistakes ?? mistakes;
    const scored = scoreRound({ foundCount, mistakes: nextMistakes, secondsLeft: nextSeconds, totalPoints: nextTotalPoints });
    const nextResult = {
      ...scored,
      foundCount,
      totalCount: bugTargets.length,
      mistakes: nextMistakes,
      secondsLeft: nextSeconds
    };
    setResult(nextResult);
    saveScore(nextResult);
  }, [found.length, mistakes, secondsLeft, totalPoints]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => {
      setSecondsLeft(value => {
        if (value <= 1) {
          window.setTimeout(() => finishRound({ secondsLeft: 0 }), 0);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [finishRound, running]);

  const markBug = (target) => {
    if (!running || foundSet.has(target.id)) return;
    const nextFound = [...found, target.id];
    const nextPoints = totalPoints + target.points;
    setFound(nextFound);
    setPulse({ id: `${target.id}-${Date.now()}`, x: target.x + target.w / 2, y: target.y + target.h / 2, text: `+${target.points}` });
    window.setTimeout(() => setPulse(null), 850);

    if (nextFound.length === bugTargets.length) {
      window.setTimeout(() => finishRound({ foundCount: nextFound.length, totalPoints: nextPoints }), 120);
    }
  };

  const registerMiss = () => {
    if (!running) return;
    setMistakes(value => value + 1);
    toast.error('No issue there');
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-950 text-white shadow-2xl shadow-rose-500/10">
      <div className="relative overflow-hidden border-b border-white/10 p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(251,113,133,0.24),transparent_30%),radial-gradient(circle_at_90%_12%,rgba(34,211,238,0.2),transparent_32%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <BugHuntLogo />
            <div>
              <p className="text-xs font-black uppercase text-rose-200">QA Challenge</p>
              <h2 className="text-2xl font-black tracking-normal">Bug Hunt</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-white/65">Inspect the fake workspace screen and click every UI or workflow issue before time runs out.</p>
            </div>
          </div>
          <button type="button" onClick={resetRound} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15">
            <RotateCcw size={16} />
            {running ? 'Restart' : 'Start Hunt'}
          </button>
        </div>
      </div>

      <div className="grid gap-5 p-4 2xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['Found', `${found.length}/${bugTargets.length}`],
              ['Time', formatSeconds(secondsLeft)],
              ['Mistakes', mistakes],
              ['Points', totalPoints]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-center shadow-lg shadow-black/10">
                <p className="text-[11px] font-black uppercase text-white/45">{label}</p>
                <motion.p key={value} initial={{ scale: 0.84, opacity: 0.45 }} animate={{ scale: 1, opacity: 1 }} className="mt-1 text-xl font-black text-white">
                  {value}
                </motion.p>
              </div>
            ))}
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={registerMiss}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') registerMiss();
            }}
            className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 p-4 shadow-2xl shadow-rose-500/10"
            aria-label="Bug hunt stage"
          >

            <div className="relative z-10 pointer-events-none grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-sm font-black text-white">StudentHub</p>
                <div className="mt-4 space-y-2">
                  {['Dashboard', 'Workspaces', 'Messages 4', 'Fix Arena'].map(item => (
                    <div key={item} className="rounded-2xl bg-white/[0.07] px-3 py-2 text-xs font-bold text-white/65">{item}</div>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl bg-rose-300/10 p-3 text-xs font-black text-rose-100">Low contrast alert</div>
              </aside>

              <main className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {['Open Tasks', 'Due Today', 'Unread'].map((label, index) => (
                    <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-xs font-black uppercase text-white/45">{label}</p>
                      <p className="mt-2 text-2xl font-black">{index === 2 ? '2' : index === 1 ? '7' : '14'}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black">Launch checklist</p>
                      <p className="text-xs text-white/45">Project board review</p>
                    </div>
                    <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black text-emerald-100">Done</span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white/[0.07] p-3">
                      <p className="text-sm font-black">Fix avatar upload</p>
                      <p className="mt-1 text-xs text-white/45">Owner: Ervin - Due yesterday</p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.07] p-3">
                      <p className="text-sm font-black">Mobile panel spacing</p>
                      <p className="mt-1 text-xs text-white/45">Owner: Unassigned - Due today</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-black">Report Actions</p>
                    <div className="flex gap-2">
                      <span className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-black text-gray-950">Submit</span>
                      <span className="rounded-xl bg-pink-400 px-3 py-2 text-xs font-black text-gray-950">Submit</span>
                    </div>
                  </div>
                </div>
              </main>
            </div>

            {bugTargets.map(target => {
              const isFound = foundSet.has(target.id);
              return (
                <button
                  key={target.id}
                  type="button"
                  disabled={!running || isFound}
                  onClick={(event) => {
                    event.stopPropagation();
                    markBug(target);
                  }}
                  className={`absolute z-20 rounded-2xl border transition ${
                    isFound
                      ? 'border-emerald-300 bg-emerald-300/25 shadow-[0_0_24px_rgba(52,211,153,0.55)]'
                      : running
                        ? 'border-transparent bg-transparent hover:border-rose-200/50 hover:bg-rose-300/10'
                        : 'border-transparent bg-transparent'
                  }`}
                  style={{ left: `${target.x}%`, top: `${target.y}%`, width: `${target.w}%`, height: `${target.h}%` }}
                  aria-label={target.label}
                >
                  {isFound && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-300 px-2 py-1 text-[10px] font-black text-gray-950">
                      <CheckCircle2 size={12} />
                      Found
                    </span>
                  )}
                </button>
              );
            })}

            <AnimatePresence>
              {pulse && (
                <motion.div
                  key={pulse.id}
                  initial={{ opacity: 0, scale: 0.7, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: -22 }}
                  exit={{ opacity: 0, scale: 0.9, y: -46 }}
                  className="pointer-events-none absolute z-30 rounded-2xl border border-white/20 bg-white px-3 py-2 text-center text-gray-950 shadow-2xl"
                  style={{ left: `${pulse.x}%`, top: `${pulse.y}%` }}
                >
                  <p className="text-lg font-black">{pulse.text}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 rounded-3xl border border-white/10 bg-gray-950 p-4 text-white sm:grid-cols-4">
              <div><p className="text-xs font-black uppercase text-white/45">Score</p><p className="text-2xl font-black">{result.score}</p></div>
              <div><p className="text-xs font-black uppercase text-white/45">Accuracy</p><p className="text-2xl font-black">{result.accuracy}%</p></div>
              <div><p className="text-xs font-black uppercase text-white/45">Found</p><p className="text-2xl font-black">{result.foundCount}/{result.totalCount}</p></div>
              <div><p className="text-xs font-black uppercase text-white/45">Saved</p><p className="text-2xl font-black">{saving ? '...' : <Save size={24} />}</p></div>
            </motion.div>
          )}
        </div>

        <aside className="grid gap-4 md:grid-cols-3 2xl:block 2xl:space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
            <p className="flex items-center gap-2 text-sm font-black text-white">
              <Search size={17} className="text-rose-200" />
              Bug Checklist
            </p>
            <div className="mt-3 space-y-2">
              {bugTargets.map(target => {
                const isFound = foundSet.has(target.id);
                return (
                  <div key={target.id} className={`rounded-2xl border p-3 ${isFound ? 'border-emerald-300/30 bg-emerald-300/10' : 'border-white/10 bg-white/[0.04]'}`}>
                    <div className="flex items-center gap-2">
                      {isFound ? <CheckCircle2 size={16} className="text-emerald-200" /> : <Eye size={16} className="text-white/35" />}
                      <p className="text-sm font-black text-white">{isFound ? target.label : target.hint}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
            <p className="flex items-center gap-2 text-sm font-black text-white">
              <Trophy size={17} className="text-yellow-200" />
              Bug Hunt Best
            </p>
            <p className="mt-2 text-3xl font-black">{stats?.bugHuntStats?.highScore || 0}</p>
            <p className="mt-2 text-xs leading-5 text-white/45">Score uses bugs found, accuracy, remaining time, and mistake penalties.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <p className="flex items-center gap-2 text-sm font-black text-white">
              <Crosshair size={17} className="text-cyan-200" />
              Goal
            </p>
            <p className="mt-2 text-xs leading-5 text-white/45">Click only real problems. Random clicks reduce accuracy and lower your final score.</p>
          </div>
        </aside>
      </div>

      <GameOverModal
        open={Boolean(result)}
        title="Hunt complete"
        score={result?.score || 0}
        detail={result ? `Found ${result.foundCount}/${result.totalCount} issues with ${result.accuracy}% accuracy.` : ''}
        saving={saving}
        saved={Boolean(result && !saving)}
        onRetry={resetRound}
        onExit={onExit}
      />
    </section>
  );
}
