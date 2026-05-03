import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Bomb, RotateCcw, Save, Sword, Timer, Trophy, XCircle, Zap } from 'lucide-react';
import api from '../services/api';
import GameOverModal from './GameOverModal';

const GAME_DURATION_MS = 60_000;
const MAX_STRIKES = 3;
const FRUIT_POOL = ['Mango', 'Berry', 'Apple', 'Kiwi', 'Melon', 'Peach'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const pickFruitStyle = () => {
  const styles = [
    { top: '#22d3ee', bottom: '#3b82f6' },
    { top: '#f472b6', bottom: '#ec4899' },
    { top: '#fb7185', bottom: '#ef4444' },
    { top: '#34d399', bottom: '#10b981' },
    { top: '#fbbf24', bottom: '#f97316' },
    { top: '#a78bfa', bottom: '#8b5cf6' }
  ];
  return styles[Math.floor(Math.random() * styles.length)];
};

const buildEntity = (bounds, now, difficulty) => {
  const isBomb = Math.random() < clamp(0.14 + difficulty * 0.02, 0.14, 0.26);
  const radius = isBomb ? 20 + Math.random() * 5 : 22 + Math.random() * 8;
  const xPadding = radius + 18;
  const x = xPadding + Math.random() * Math.max(1, bounds.width - xPadding * 2);
  const y = bounds.height + radius + 14;
  const upwardBase = bounds.height * (0.7 + Math.random() * 0.22);
  const vx = (Math.random() - 0.5) * (110 + difficulty * 18);
  const vy = -upwardBase;
  const style = pickFruitStyle();
  const label = FRUIT_POOL[Math.floor(Math.random() * FRUIT_POOL.length)];
  return {
    id: `${now}-${Math.random().toString(36).slice(2)}`,
    type: isBomb ? 'bomb' : 'fruit',
    x,
    y,
    vx,
    vy,
    gravity: 470 + Math.random() * 120,
    radius,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 2.8,
    topColor: isBomb ? '#94a3b8' : style.top,
    bottomColor: isBomb ? '#334155' : style.bottom,
    label,
    sliced: false
  };
};

const distancePointToSegment = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (!dx && !dy) return Math.hypot(px - x1, py - y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1);
  const nx = x1 + t * dx;
  const ny = y1 + t * dy;
  return Math.hypot(px - nx, py - ny);
};

export function BlockGameLogo({ compact = false }) {
  return (
    <div className={`${compact ? 'h-12 w-12 rounded-2xl' : 'h-16 w-16 rounded-3xl'} relative grid shrink-0 place-items-center overflow-hidden bg-slate-950 text-white shadow-xl shadow-cyan-500/20 ring-1 ring-cyan-300/20`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(34,211,238,0.45),transparent_35%),radial-gradient(circle_at_82%_80%,rgba(236,72,153,0.4),transparent_38%)]" />
      <Sword size={compact ? 22 : 28} className="relative text-white drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]" />
    </div>
  );
}

export default function BlockStackGame({ stats, onScoreSaved, onExit }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [runActive, setRunActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedScore, setSavedScore] = useState(null);

  const engineRef = useRef({
    rafId: 0,
    running: false,
    lastTs: 0,
    startedAt: 0,
    endedAt: 0,
    spawnClock: 0,
    nextSpawnInMs: 520,
    entities: [],
    particles: [],
    swipeTrail: [],
    score: 0,
    hits: 0,
    strikes: 0,
    combo: 0,
    maxCombo: 0,
    lastSliceAt: 0,
    pointerActive: false,
    pointerId: null,
    gameOver: false,
    overReason: ''
  });

  const highScore = stats?.blockStats?.highScore || 0;

  const resetHud = useCallback(() => {
    setScore(0);
    setHits(0);
    setStrikes(0);
    setCombo(0);
    setMaxCombo(0);
    setTimeLeft(Math.ceil(GAME_DURATION_MS / 1000));
    setRunActive(false);
    setGameOver(false);
    setSaving(false);
    setSavedScore(null);
  }, []);

  const pushParticles = useCallback((x, y, colorA, colorB) => {
    const engine = engineRef.current;
    for (let i = 0; i < 14; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 130 + Math.random() * 180;
      engine.particles.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 360 + Math.random() * 220,
        maxLife: 540,
        color: Math.random() > 0.5 ? colorA : colorB
      });
    }
  }, []);

  const endGame = useCallback((reason = 'Run complete') => {
    const engine = engineRef.current;
    if (engine.gameOver) return;
    engine.running = false;
    engine.gameOver = true;
    engine.overReason = reason;
    engine.endedAt = Date.now();
    if (engine.rafId) cancelAnimationFrame(engine.rafId);
    engine.rafId = 0;
    setRunActive(false);
    setGameOver(true);
  }, []);

  const saveScore = useCallback(async (payload) => {
    if (!payload.score || payload.score <= 0) return;
    setSaving(true);
    try {
      const res = await api.post('/games/block-stack/submit', payload);
      setSavedScore(res.data?.result?.score || payload.score);
      toast.success('Swipe Ninja score saved');
      onScoreSaved?.();
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Backend is not updated yet. Redeploy Render backend first.');
      } else {
        toast.error(err.response?.data?.msg || 'Could not save swipe score');
      }
    } finally {
      setSaving(false);
    }
  }, [onScoreSaved]);

  useEffect(() => {
    if (!gameOver) return;
    const engine = engineRef.current;
    if (engine.score <= 0 || saving || savedScore) return;
    const totalActions = engine.hits + engine.strikes;
    const accuracy = totalActions ? Math.round((engine.hits / totalActions) * 100) : 0;
    saveScore({
      score: engine.score,
      moves: Math.max(1, engine.hits),
      linesCleared: engine.hits,
      maxCombo: engine.maxCombo,
      boardFill: accuracy,
      durationMs: Math.max(1000, engine.endedAt - engine.startedAt)
    });
  }, [gameOver, saveScore, savedScore, saving]);

  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const host = canvas.parentElement;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const width = clamp(rect.width, 290, 640);
    const height = Math.round(width * 1.32);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.4);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    engineRef.current.bounds = { width, height };
  }, []);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const engine = engineRef.current;
    const bounds = engine.bounds;
    if (!ctx || !bounds) return;

    ctx.clearRect(0, 0, bounds.width, bounds.height);

    const bg = ctx.createLinearGradient(0, 0, bounds.width, bounds.height);
    bg.addColorStop(0, '#020617');
    bg.addColorStop(0.55, '#0f172a');
    bg.addColorStop(1, '#111827');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, bounds.width, bounds.height);

    ctx.fillStyle = 'rgba(34,211,238,0.1)';
    ctx.beginPath();
    ctx.arc(bounds.width * 0.18, bounds.height * 0.22, bounds.width * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(236,72,153,0.08)';
    ctx.beginPath();
    ctx.arc(bounds.width * 0.82, bounds.height * 0.3, bounds.width * 0.25, 0, Math.PI * 2);
    ctx.fill();

    for (const item of engine.entities) {
      if (item.sliced) continue;
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rotation);

      const fill = ctx.createLinearGradient(-item.radius, -item.radius, item.radius, item.radius);
      fill.addColorStop(0, item.topColor);
      fill.addColorStop(1, item.bottomColor);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.stroke();

      if (item.type === 'bomb') {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(0, 0, item.radius * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(item.radius * 0.2, -item.radius * 0.7);
        ctx.lineTo(item.radius * 0.45, -item.radius * 1.04);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = `${Math.max(10, Math.round(item.radius * 0.55))}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.label.slice(0, 1), 0, 1);
      }
      ctx.restore();
    }

    for (const particle of engine.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = `${particle.color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    if (engine.swipeTrail.length > 1) {
      ctx.lineCap = 'round';
      for (let i = 1; i < engine.swipeTrail.length; i += 1) {
        const prev = engine.swipeTrail[i - 1];
        const point = engine.swipeTrail[i];
        const alpha = i / engine.swipeTrail.length;
        ctx.strokeStyle = `rgba(56,189,248,${(0.2 + alpha * 0.75).toFixed(3)})`;
        ctx.lineWidth = 2 + alpha * 8;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
    }

    ctx.fillStyle = 'rgba(15,23,42,0.75)';
    ctx.fillRect(12, 12, 145, 58);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 13px Inter, system-ui, sans-serif';
    ctx.fillText(`Time ${Math.max(0, Math.ceil((GAME_DURATION_MS - (Date.now() - engine.startedAt)) / 1000))}s`, 24, 35);
    ctx.fillText(`Combo x${engine.combo}`, 24, 54);
  }, []);

  const startGame = useCallback(() => {
    const engine = engineRef.current;
    if (engine.rafId) cancelAnimationFrame(engine.rafId);

    engine.running = true;
    engine.lastTs = 0;
    engine.startedAt = Date.now();
    engine.endedAt = 0;
    engine.spawnClock = 0;
    engine.nextSpawnInMs = 520;
    engine.entities = [];
    engine.particles = [];
    engine.swipeTrail = [];
    engine.score = 0;
    engine.hits = 0;
    engine.strikes = 0;
    engine.combo = 0;
    engine.maxCombo = 0;
    engine.lastSliceAt = 0;
    engine.pointerActive = false;
    engine.pointerId = null;
    engine.gameOver = false;
    engine.overReason = '';

    resetHud();
    setRunActive(true);
    drawScene();

    const tick = (ts) => {
      const game = engineRef.current;
      if (!game.running) return;
      if (!game.lastTs) game.lastTs = ts;
      const delta = Math.min(34, ts - game.lastTs);
      game.lastTs = ts;

      const elapsed = Date.now() - game.startedAt;
      const remaining = Math.max(0, GAME_DURATION_MS - elapsed);
      const sec = Math.ceil(remaining / 1000);
      setTimeLeft(prev => (prev === sec ? prev : sec));

      if (remaining <= 0) {
        endGame('Time is up');
        drawScene();
        return;
      }

      const difficulty = Math.min(8, Math.floor(elapsed / 7_500));
      game.spawnClock += delta;
      if (game.spawnClock >= game.nextSpawnInMs) {
        game.entities.push(buildEntity(game.bounds, Date.now(), difficulty));
        game.spawnClock = 0;
        const nextMin = Math.max(130, 490 - difficulty * 24 - game.hits * 0.35);
        const nextMax = Math.max(nextMin + 40, 730 - difficulty * 18);
        game.nextSpawnInMs = nextMin + Math.random() * (nextMax - nextMin);
      }

      const dt = delta / 1000;
      game.entities = game.entities.filter((item) => {
        if (!item.sliced) {
          item.vy += item.gravity * dt;
          item.x += item.vx * dt;
          item.y += item.vy * dt;
          item.rotation += item.spin * dt;
        }

        const goneBottom = item.y - item.radius > game.bounds.height + 20;
        if (goneBottom && !item.sliced && item.type === 'fruit') {
          game.strikes += 1;
          game.combo = 0;
          setStrikes(game.strikes);
          setCombo(0);
          if (game.strikes >= MAX_STRIKES) {
            endGame('Too many missed targets');
          }
        }
        return !goneBottom;
      });

      game.particles = game.particles.filter((particle) => {
        particle.life -= delta;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 360 * dt;
        return particle.life > 0;
      });

      game.swipeTrail = game.swipeTrail.filter(point => Date.now() - point.t <= 150);
      drawScene();

      if (game.running) {
        game.rafId = requestAnimationFrame(tick);
      }
    };

    engine.rafId = requestAnimationFrame(tick);
  }, [drawScene, endGame, resetHud]);

  const sliceTargets = useCallback(() => {
    const game = engineRef.current;
    if (!game.pointerActive || game.swipeTrail.length < 2 || !game.running) return;
    const curr = game.swipeTrail[game.swipeTrail.length - 1];
    const prev = game.swipeTrail[game.swipeTrail.length - 2];
    const dt = Math.max(1, curr.t - prev.t);
    const speed = Math.hypot(curr.x - prev.x, curr.y - prev.y) / dt;
    if (speed < 0.34) return;

    for (const item of game.entities) {
      if (item.sliced) continue;
      const distance = distancePointToSegment(item.x, item.y, prev.x, prev.y, curr.x, curr.y);
      if (distance > item.radius + 9) continue;

      item.sliced = true;
      if (item.type === 'bomb') {
        pushParticles(item.x, item.y, '#94a3b8', '#ef4444');
        endGame('Bomb sliced');
        break;
      }

      const now = Date.now();
      game.combo = now - game.lastSliceAt <= 750 ? game.combo + 1 : 1;
      game.maxCombo = Math.max(game.maxCombo, game.combo);
      game.lastSliceAt = now;
      const gained = 12 + Math.min(110, game.combo * 4);
      game.score += gained;
      game.hits += 1;
      pushParticles(item.x, item.y, item.topColor, item.bottomColor);

      setScore(game.score);
      setHits(game.hits);
      setCombo(game.combo);
      setMaxCombo(game.maxCombo);
    }
  }, [endGame, pushParticles]);

  const toCanvasPoint = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height),
      t: Date.now()
    };
  }, []);

  const handlePointerDown = useCallback((event) => {
    if (!runActive) return;
    const game = engineRef.current;
    game.pointerActive = true;
    game.pointerId = event.pointerId;
    const point = toCanvasPoint(event);
    if (!point) return;
    game.swipeTrail = [point];
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }, [runActive, toCanvasPoint]);

  const handlePointerMove = useCallback((event) => {
    const game = engineRef.current;
    if (!game.pointerActive) return;
    if (game.pointerId !== null && event.pointerId !== game.pointerId) return;
    const point = toCanvasPoint(event);
    if (!point) return;
    game.swipeTrail.push(point);
    if (game.swipeTrail.length > 14) game.swipeTrail.splice(0, game.swipeTrail.length - 14);
    sliceTargets();
    event.preventDefault();
  }, [sliceTargets, toCanvasPoint]);

  const handlePointerUp = useCallback((event) => {
    const game = engineRef.current;
    if (game.pointerId !== null && event.pointerId !== undefined && event.pointerId !== game.pointerId) return;
    game.pointerActive = false;
    game.pointerId = null;
    game.swipeTrail = [];
    event.preventDefault();
  }, []);

  useEffect(() => {
    syncCanvasSize();
    drawScene();
    const onResize = () => {
      syncCanvasSize();
      drawScene();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [drawScene, syncCanvasSize]);

  useEffect(() => {
    startGame();
    return () => {
      const engine = engineRef.current;
      engine.running = false;
      if (engine.rafId) cancelAnimationFrame(engine.rafId);
    };
  }, [startGame]);

  const safeRatio = useMemo(() => {
    const total = hits + strikes;
    return total ? Math.round((hits / total) * 100) : 100;
  }, [hits, strikes]);

  const retry = useCallback(() => {
    startGame();
  }, [startGame]);

  const manualSave = useCallback(() => {
    const engine = engineRef.current;
    if (saving || savedScore || engine.score <= 0) return;
    saveScore({
      score: engine.score,
      moves: Math.max(1, engine.hits),
      linesCleared: engine.hits,
      maxCombo: engine.maxCombo,
      boardFill: safeRatio,
      durationMs: Math.max(1000, (engine.endedAt || Date.now()) - engine.startedAt)
    });
  }, [safeRatio, saveScore, savedScore, saving]);

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="relative overflow-hidden border-b border-gray-200 px-5 py-5 dark:border-gray-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(34,211,238,0.14),transparent_30%),radial-gradient(circle_at_90%_20%,rgba(236,72,153,0.14),transparent_35%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <BlockGameLogo />
            <div>
              <p className="text-xs font-black uppercase text-cyan-600 dark:text-cyan-200">Arcade Swipe Game</p>
              <h2 className="text-2xl font-black text-gray-950 dark:text-white">Swipe Ninja</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                Slice flying targets, avoid bombs, and chain combos for higher score.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onExit && (
              <button type="button" onClick={onExit} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
                Back
              </button>
            )}
            <button type="button" onClick={retry} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100">
              <RotateCcw size={16} />
              New Run
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_270px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-5">
            <StatCard label="Score" value={score} icon={Trophy} />
            <StatCard label="Sliced" value={hits} icon={Sword} />
            <StatCard label="Combo" value={`x${combo}`} icon={Zap} />
            <StatCard label="Misses" value={`${strikes}/${MAX_STRIKES}`} icon={XCircle} />
            <StatCard label="Time" value={`${timeLeft}s`} icon={Timer} />
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-gray-950 p-3 shadow-2xl shadow-cyan-500/15">
            <div className="mx-auto w-full max-w-[640px]">
              <canvas
                ref={canvasRef}
                className="touch-none select-none rounded-[1.3rem] ring-1 ring-white/10"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerUp}
                aria-label="Swipe Ninja game canvas"
              />
            </div>
          </div>

          {gameOver && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:border-amber-400/30 dark:bg-amber-900/20 dark:text-amber-100">
              Run ended. Score {score}. {score <= 0 ? 'Slice at least one target to save score.' : savedScore ? 'Saved to rankings.' : saving ? 'Saving score...' : 'Save pending.'}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
            <p className="text-sm font-black text-gray-800 dark:text-gray-100">Run status</p>
            <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <p className="flex items-center justify-between"><span>Active run</span><span className="font-black">{runActive ? 'Live' : 'Stopped'}</span></p>
              <p className="flex items-center justify-between"><span>Highest combo</span><span className="font-black">x{maxCombo}</span></p>
              <p className="flex items-center justify-between"><span>Precision</span><span className="font-black">{safeRatio}%</span></p>
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900/60 dark:bg-cyan-950/25">
            <p className="flex items-center gap-2 text-xs font-black uppercase text-cyan-700 dark:text-cyan-200">
              <Trophy size={15} />
              Swipe Ninja Best
            </p>
            <p className="mt-1 text-3xl font-black text-gray-950 dark:text-white">{highScore}</p>
          </div>

          <div className="rounded-3xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/60 dark:bg-violet-950/25">
            <p className="flex items-center gap-2 text-xs font-black uppercase text-violet-700 dark:text-violet-200">
              <Bomb size={15} />
              Saved run
            </p>
            <p className="mt-1 text-3xl font-black text-gray-950 dark:text-white">{savedScore || '-'}</p>
          </div>

          <button
            type="button"
            disabled={saving || savedScore || score <= 0}
            onClick={manualSave}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-black text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
          >
            {saving ? <Zap size={17} className="animate-pulse" /> : <Save size={17} />}
            {saving ? 'Saving...' : savedScore ? 'Saved' : score <= 0 ? 'No score yet' : 'Save score'}
          </button>
        </aside>
      </div>

      <GameOverModal
        open={gameOver}
        title="Swipe Ninja run ended"
        score={score}
        detail={score <= 0 ? 'Slice targets to record a ranked score.' : 'Great run. You can restart instantly for a better combo.'}
        saving={saving}
        saved={Boolean(savedScore)}
        onRetry={retry}
        onExit={() => setGameOver(false)}
      />
    </section>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800/60">
      <p className="inline-flex items-center gap-1 text-[11px] font-black uppercase text-gray-500 dark:text-gray-400">
        {Icon ? <Icon size={13} /> : null}
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-gray-950 dark:text-white">{value}</p>
    </div>
  );
}
