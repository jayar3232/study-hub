import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, Crosshair, Gamepad2, Gauge, Maximize2, Minimize2, Orbit, Plane, Sparkles, Sword, Trophy } from 'lucide-react';
import api from '../services/api';
import GameRankBadge from './GameRankBadge';
import LoadingSpinner from './LoadingSpinner';

const BlockStackGame = lazy(() => import('./BlockStackGame'));
const BowDuelGame = lazy(() => import('./BowDuelGame'));
const FocusFlowGame = lazy(() => import('./FocusFlowGame'));
const JetFighterGame = lazy(() => import('./JetFighterGame'));
const NeonDriftGame = lazy(() => import('./NeonDriftGame'));
const SpaceRunnerGame = lazy(() => import('./SpaceRunnerGame'));

const gameRegistry = {
  blocks: {
    title: 'Swipe Ninja',
    eyebrow: 'Arcade Swipe',
    description: 'Slice real fruit sprites, dodge bombs, and chain clean combos.',
    Icon: Sword,
    Component: BlockStackGame,
    accent: 'from-cyan-400 via-blue-500 to-pink-500',
    statKey: 'blockStats'
  },
  'jet-fighter': {
    title: 'Jet Fighter',
    eyebrow: 'Air Combat',
    description: 'Fly the fighter in a larger arena with rival jets and tracer fire.',
    Icon: Plane,
    Component: JetFighterGame,
    accent: 'from-cyan-300 via-blue-500 to-rose-500',
    statKey: 'jetFighterStats'
  },
  'neon-drift': {
    title: 'Neon Drift',
    eyebrow: '3D Neon Racer',
    description: 'Steer a hovercar through glowing city lanes and dodge red barriers.',
    Icon: Gauge,
    Component: NeonDriftGame,
    accent: 'from-cyan-400 via-blue-600 to-pink-500',
    statKey: 'neonDriftStats'
  },
  'space-runner': {
    title: 'Space Runner',
    eyebrow: '3D Space Tunnel',
    description: 'Pilot through asteroid lanes, collect energy cores, and survive the tunnel.',
    Icon: Orbit,
    Component: SpaceRunnerGame,
    accent: 'from-blue-500 via-violet-600 to-cyan-400',
    statKey: 'spaceRunnerStats'
  },
  'focus-flow': {
    title: 'Focus Flow',
    eyebrow: 'Timing Challenge',
    description: 'Lock the signal on rhythm and keep the streak alive.',
    Icon: Activity,
    Component: FocusFlowGame,
    accent: 'from-emerald-400 via-teal-500 to-cyan-400',
    statKey: 'focusFlowStats'
  },
  'bow-duel': {
    title: 'Knife Duel',
    eyebrow: 'Online Knife Duel',
    description: 'HP-based multiplayer throwing with cinematic knife shots, head hits, leg trips, and blade upgrades.',
    Icon: Crosshair,
    Component: BowDuelGame,
    accent: 'from-emerald-500 via-sky-500 to-amber-400',
    statKey: 'bowDuelStats'
  },
};

export default function GamePlayPage() {
  const { gameKey = '' } = useParams();
  const navigate = useNavigate();
  const game = gameRegistry[gameKey];
  const shellRef = useRef(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [focusMode, setFocusMode] = useState(false);

  const triggerGameFeedback = useCallback((duration = 10) => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if (typeof navigator.vibrate !== 'function') return;
    const isTouchViewport = window.matchMedia?.('(max-width: 767px), (pointer: coarse)')?.matches;
    if (isTouchViewport) navigator.vibrate(duration);
  }, []);

  const loadSummary = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/games/summary/me');
      setSummary(res.data);
    } catch {
      setSummary(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, gameKey]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setFocusMode(false);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!focusMode) {
      root.classList.remove('game-focus-lock');
      return undefined;
    }

    root.classList.add('game-focus-lock');
    return () => root.classList.remove('game-focus-lock');
  }, [focusMode]);

  useEffect(() => () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const enterFocusMode = useCallback(async () => {
    triggerGameFeedback(14);
    setFocusMode(true);
    const shell = shellRef.current;
    if (shell?.requestFullscreen) {
      await shell.requestFullscreen().catch(() => {});
    }
  }, [triggerGameFeedback]);

  const exitFocusMode = useCallback(async () => {
    triggerGameFeedback(8);
    if (document.fullscreenElement) {
      await document.exitFullscreen?.().catch(() => {});
    }
    setFocusMode(false);
  }, [triggerGameFeedback]);

  const backToHub = useCallback(async () => {
    await exitFocusMode();
    navigate('/arena');
  }, [exitFocusMode, navigate]);

  const gameStats = useMemo(() => summary?.[game?.statKey] || null, [game?.statKey, summary]);

  if (!game) return <Navigate to="/arena" replace />;

  const Icon = game.Icon || Gamepad2;
  const GameComponent = game.Component;

  return (
    <div
      ref={shellRef}
      className={`game-play-page mobile-page mobile-tab-dock-page mx-auto max-w-7xl space-y-4 px-0 py-1 sm:space-y-5 sm:px-6 sm:py-4 lg:px-8 ${focusMode ? 'is-game-fullscreen' : ''}`}
    >
      {focusMode ? (
        <div className="game-fullscreen-bar">
          <button
            type="button"
            onClick={backToHub}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 text-sm font-black text-white transition hover:bg-white/15"
          >
            <ArrowLeft size={18} /> Back
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[11px] font-black uppercase text-white/45">{game.eyebrow}</p>
            <p className="truncate text-base font-black text-white">{game.title}</p>
          </div>
          <button
            type="button"
            onClick={exitFocusMode}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-sm font-black text-gray-950 transition hover:bg-slate-100"
          >
            <Minimize2 size={18} /> Exit
          </button>
        </div>
      ) : null}

      {!focusMode && (
      <section className="game-play-hero overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className={`h-1.5 bg-gradient-to-r ${game.accent}`} />
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/arena')}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-gray-200 bg-gray-50 text-gray-700 transition hover:bg-blue-50 hover:text-[#1877f2] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              aria-label="Back to Game Hub"
            >
              <ArrowLeft size={20} />
            </button>
            <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${game.accent} text-white shadow-lg shadow-blue-500/10`}>
              <Icon size={26} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-[#0b57d0] dark:text-blue-200">{game.eyebrow}</p>
              <h1 className="truncate text-2xl font-black tracking-normal text-gray-950 dark:text-white sm:text-3xl">{game.title}</h1>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-gray-500 dark:text-gray-400">{game.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs font-black">
            <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-100 dark:bg-gray-950 dark:ring-gray-800">
              <Trophy className="mx-auto text-yellow-500" size={18} />
              <p className="mt-1 uppercase text-gray-500 dark:text-gray-400">Best</p>
              <p className="text-lg text-gray-950 dark:text-white">{gameStats?.highScore || 0}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-100 dark:bg-gray-950 dark:ring-gray-800">
              <Sparkles className="mx-auto text-cyan-500" size={18} />
              <p className="mt-1 uppercase text-gray-500 dark:text-gray-400">Runs</p>
              <p className="text-lg text-gray-950 dark:text-white">{gameStats?.totalPlays || 0}</p>
            </div>
            <button
              type="button"
              onClick={enterFocusMode}
              className="rounded-2xl bg-gray-950 p-3 text-center text-white ring-1 ring-gray-950 transition hover:bg-blue-700 dark:bg-white dark:text-gray-950 dark:ring-white"
            >
              <Maximize2 className="mx-auto" size={18} />
              <span className="mt-1 block uppercase">Full</span>
              <span className="block text-lg">Screen</span>
            </button>
          </div>
        </div>
      </section>
      )}

      <div className="game-play-layout grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <main className="game-play-frame min-w-0">
          {loading ? (
            <section className="grid min-h-[24rem] place-items-center rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <LoadingSpinner label={`Loading ${game.title}`} />
            </section>
          ) : (
            <Suspense fallback={<LoadingSpinner label="Loading game" />}>
              <GameComponent
                stats={summary}
                onScoreSaved={() => loadSummary({ silent: true })}
                onExit={backToHub}
                isFullscreen={focusMode}
              />
            </Suspense>
          )}
        </main>

        {!focusMode && (
        <aside className="game-play-side grid min-w-0 gap-4 md:grid-cols-2 xl:block xl:space-y-4">
          <GameRankBadge stats={summary?.stats} showProgress />
          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-black text-gray-950 dark:text-white">Game Hub</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-gray-500 dark:text-gray-400">
              Scores from this run update your season rank after the game saves.
            </p>
          </div>
        </aside>
        )}
      </div>
    </div>
  );
}
