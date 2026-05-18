import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { MousePointer2, Play, RotateCcw, Trophy, Zap } from 'lucide-react';
import api from '../services/api';
import GameOverModal from './GameOverModal';

const TARGET_POINTS = 20;
const RIVALS = [
  { name: 'Kai', delay: 650, color: '#38bdf8' },
  { name: 'Bea', delay: 760, color: '#f59e0b' },
  { name: 'Leo', delay: 880, color: '#22c55e' }
];

const randomTarget = () => ({
  x: 12 + Math.random() * 76,
  y: 16 + Math.random() * 68,
  size: 58 + Math.random() * 22,
  tone: ['#0b57d0', '#0891b2', '#16a34a', '#f59e0b'][Math.floor(Math.random() * 4)]
});

export default function ReactionTapGame({ stats, onScoreSaved, onExit }) {
  const canvasRef = useRef(null);
  const arenaRef = useRef(null);
  const aiTimerRef = useRef(null);
  const nextTimerRef = useRef(null);
  const matchStartedRef = useRef(0);
  const targetShownRef = useRef(0);
  const [running, setRunning] = useState(false);
  const [target, setTarget] = useState(null);
  const [playerPoints, setPlayerPoints] = useState(0);
  const [rivalPoints, setRivalPoints] = useState([0, 0, 0]);
  const [rounds, setRounds] = useState(0);
  const [wins, setWins] = useState(0);
  const [reactions, setReactions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(false);

  const bestReaction = reactions.length ? Math.min(...reactions) : 0;
  const averageReaction = reactions.length
    ? Math.round(reactions.reduce((sum, value) => sum + value, 0) / reactions.length)
    : 0;
  const leaderScore = Math.max(playerPoints, ...rivalPoints);

  const drawArena = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const width = rect.width;
    const height = rect.height;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f8fafc');
    gradient.addColorStop(1, '#dbeafe');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
    for (let x = 0; x < width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    if (target) {
      const x = (target.x / 100) * width;
      const y = (target.y / 100) * height;
      const radius = target.size / 2;
      ctx.fillStyle = target.tone;
      ctx.shadowColor = target.tone;
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [target]);

  useEffect(() => {
    drawArena();
  }, [drawArena]);

  const clearTimers = () => {
    window.clearTimeout(aiTimerRef.current);
    window.clearTimeout(nextTimerRef.current);
  };

  const saveScore = useCallback(async (finalState = {}) => {
    if (busy) return;
    setBusy(true);
    const elapsedMs = Math.max(1000, Date.now() - matchStartedRef.current);
    const finalPlayerPoints = finalState.playerPoints ?? playerPoints;
    const finalWins = finalState.wins ?? wins;
    const finalRounds = finalState.rounds ?? rounds;
    const finalReactions = finalState.reactions || reactions;
    const finalBest = finalReactions.length ? Math.min(...finalReactions) : 5000;
    const finalAverage = finalReactions.length
      ? Math.round(finalReactions.reduce((sum, value) => sum + value, 0) / finalReactions.length)
      : 5000;
    const score = Math.max(1, Math.round(
      finalPlayerPoints * 420
      + finalWins * 160
      + Math.max(0, 900 - finalAverage)
      + Math.max(0, 650 - finalBest)
      + (finalPlayerPoints >= TARGET_POINTS ? 1500 : 0)
    ));

    try {
      const res = await api.post('/games/reaction-tap/submit', {
        score,
        playerPoints: finalPlayerPoints,
        targetPoints: TARGET_POINTS,
        taps: finalReactions.length,
        wins: finalWins,
        rounds: finalRounds,
        bestReactionMs: finalBest,
        averageReactionMs: finalAverage,
        elapsedMs,
        wonMatch: finalPlayerPoints >= TARGET_POINTS
      });
      setResult(res.data?.result || null);
      setSaved(true);
      onScoreSaved?.();
      toast.success('Reaction Tap score saved');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not save Reaction Tap');
    } finally {
      setBusy(false);
    }
  }, [busy, onScoreSaved, playerPoints, reactions, rounds, wins]);

  const finishMatch = useCallback((finalState = {}) => {
    clearTimers();
    setTarget(null);
    setRunning(false);
    setGameOver(true);
    saveScore(finalState);
  }, [saveScore]);

  const scheduleTarget = useCallback((delay = 520) => {
    clearTimers();
    nextTimerRef.current = window.setTimeout(() => {
      const nextTarget = randomTarget();
      setTarget(nextTarget);
      targetShownRef.current = performance.now();
      const rivalIndex = Math.floor(Math.random() * RIVALS.length);
      const aiDelay = RIVALS[rivalIndex].delay + Math.random() * 260 - leaderScore * 4;
      aiTimerRef.current = window.setTimeout(() => {
        setTarget(current => {
          if (!current) return current;
          setRounds(prev => prev + 1);
          setRivalPoints(prev => {
            const next = [...prev];
            next[rivalIndex] += 1;
            if (next[rivalIndex] >= TARGET_POINTS) {
              window.setTimeout(() => finishMatch({ playerPoints, wins, rounds: rounds + 1, reactions }), 50);
            } else {
              scheduleTarget(430 + Math.random() * 480);
            }
            return next;
          });
          return null;
        });
      }, Math.max(280, aiDelay));
    }, delay);
  }, [finishMatch, leaderScore, playerPoints, reactions, rounds, wins]);

  const startGame = useCallback(() => {
    clearTimers();
    matchStartedRef.current = Date.now();
    setRunning(true);
    setTarget(null);
    setPlayerPoints(0);
    setRivalPoints([0, 0, 0]);
    setRounds(0);
    setWins(0);
    setReactions([]);
    setResult(null);
    setSaved(false);
    setGameOver(false);
    scheduleTarget(650);
  }, [scheduleTarget]);

  useEffect(() => () => clearTimers(), []);

  const tapTarget = () => {
    if (!target || !running) return;
    const reactionMs = Math.max(80, Math.round(performance.now() - targetShownRef.current));
    clearTimers();
    const nextPlayerPoints = playerPoints + 1;
    const nextWins = wins + 1;
    const nextRounds = rounds + 1;
    const nextReactions = [...reactions, reactionMs];
    setPlayerPoints(nextPlayerPoints);
    setWins(nextWins);
    setRounds(nextRounds);
    setReactions(nextReactions);
    setTarget(null);
    if (nextPlayerPoints >= TARGET_POINTS) {
      finishMatch({
        playerPoints: nextPlayerPoints,
        wins: nextWins,
        rounds: nextRounds,
        reactions: nextReactions
      });
    } else {
      scheduleTarget(360 + Math.random() * 460);
    }
  };

  const scoreboard = useMemo(() => [
    { name: 'You', points: playerPoints, color: '#0b57d0' },
    ...RIVALS.map((rival, index) => ({ ...rival, points: rivalPoints[index] || 0 }))
  ].sort((a, b) => b.points - a.points), [playerPoints, rivalPoints]);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="grid gap-4 border-b border-slate-100 p-4 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#0b57d0] text-white shadow-lg shadow-blue-500/20">
            <MousePointer2 size={26} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-[#0b57d0] dark:text-sky-300">Tap Battle</p>
            <h2 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">Reaction Tap</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Tap the random target before rivals. First to 20 points wins.</p>
          </div>
        </div>
        <button type="button" onClick={startGame} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0b57d0] px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60">
          {running ? <RotateCcw size={17} /> : <Play size={17} fill="currentColor" />}
          {running ? 'Restart' : 'Start'}
        </button>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div ref={arenaRef} className="relative min-h-[26rem] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Reaction tap arena" />
          {!running && !target && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                <Zap className="mx-auto text-[#0b57d0]" size={36} />
                <p className="mt-3 text-lg font-black text-slate-950 dark:text-white">Ready for a fast round</p>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Targets appear anywhere in the arena.</p>
              </div>
            </div>
          )}
          {target && (
            <button
              type="button"
              aria-label="Tap target"
              onClick={tapTarget}
              className="absolute grid place-items-center rounded-full text-sm font-black text-white shadow-2xl transition active:scale-95"
              style={{
                left: `${target.x}%`,
                top: `${target.y}%`,
                width: target.size,
                height: target.size,
                marginLeft: -(target.size / 2),
                marginTop: -(target.size / 2),
                background: target.tone,
                boxShadow: `0 18px 45px ${target.tone}55`
              }}
            >
              TAP
            </button>
          )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Scoreboard</p>
            <div className="mt-3 space-y-3">
              {scoreboard.map(entry => (
                <div key={entry.name}>
                  <div className="flex items-center justify-between text-sm font-black">
                    <span className="text-slate-800 dark:text-white">{entry.name}</span>
                    <span style={{ color: entry.color }}>{entry.points}/{TARGET_POINTS}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (entry.points / TARGET_POINTS) * 100)}%`, background: entry.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {[
            ['Best reaction', bestReaction ? `${bestReaction}ms` : '-'],
            ['Average', averageReaction ? `${averageReaction}ms` : '-'],
            ['Best score', stats?.reactionTapStats?.highScore || 0]
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <Trophy className="text-[#0b57d0]" size={18} />
              <p className="mt-2 text-xs font-black uppercase text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
            </div>
          ))}
        </aside>
      </div>

      <GameOverModal
        open={gameOver}
        title={playerPoints >= TARGET_POINTS ? 'You won Reaction Tap' : 'Reaction Tap finished'}
        score={result?.score || 0}
        detail={result ? `Best ${result.bestReactionMs}ms · Average ${result.averageReactionMs}ms · ${result.playerPoints}/${TARGET_POINTS} points` : 'Match ended.'}
        saving={busy}
        saved={saved}
        onRetry={startGame}
        onExit={onExit}
      />
    </section>
  );
}
