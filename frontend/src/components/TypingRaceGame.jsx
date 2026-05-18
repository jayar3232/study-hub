import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Keyboard, Play, RotateCcw, Trophy, Zap } from 'lucide-react';
import api from '../services/api';
import GameOverModal from './GameOverModal';

const MODES = [
  { key: 'filipino', label: 'Filipino Words' },
  { key: 'programming', label: 'Programming Syntax' },
  { key: 'grammar', label: 'English Grammar' },
  { key: 'english', label: 'English Sprint' }
];

const RIVALS = [
  { name: 'Mika', speed: 0.72, color: '#22c55e' },
  { name: 'Ren', speed: 0.64, color: '#f59e0b' },
  { name: 'Jules', speed: 0.58, color: '#38bdf8' }
];

const normalizeSentence = (value = '') => String(value).replace(/\s+/g, ' ').trim();

const formatTime = (seconds) => `${Math.max(0, Math.ceil(seconds))}s`;

export default function TypingRaceGame({ stats, onScoreSaved, onExit }) {
  const canvasRef = useRef(null);
  const inputRef = useRef(null);
  const [mode, setMode] = useState('filipino');
  const [duration, setDuration] = useState(45);
  const [session, setSession] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [input, setInput] = useState('');
  const [typedSentences, setTypedSentences] = useState([]);
  const [startedAt, setStartedAt] = useState(0);
  const [remaining, setRemaining] = useState(duration);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const currentSentence = sentences[sentenceIndex] || '';
  const currentProgress = currentSentence
    ? Math.min(1, normalizeSentence(input).length / Math.max(1, currentSentence.length))
    : 0;
  const playerProgress = sentences.length
    ? Math.min(1, (typedSentences.length + currentProgress) / sentences.length)
    : 0;

  const rivals = useMemo(() => {
    if (!startedAt || !session) return RIVALS.map(rival => ({ ...rival, progress: 0 }));
    const elapsedRatio = Math.min(1, (duration - remaining) / Math.max(1, duration));
    return RIVALS.map((rival, index) => ({
      ...rival,
      progress: Math.min(0.98, elapsedRatio * rival.speed + Math.sin((elapsedRatio * 5) + index) * 0.018)
    }));
  }, [duration, remaining, session, startedAt]);

  const drawRace = useCallback(() => {
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
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(0.55, '#10243f');
    gradient.addColorStop(1, '#082f49');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const lanes = [
      { name: 'You', progress: playerProgress, color: '#ffffff' },
      ...rivals
    ];
    const laneHeight = height / lanes.length;
    lanes.forEach((lane, index) => {
      const y = laneHeight * index + laneHeight / 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.lineTo(width - 24, y);
      ctx.stroke();

      const x = 24 + (width - 48) * lane.progress;
      ctx.fillStyle = lane.color;
      ctx.shadowColor = lane.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - 11, y - 11, 22, 22, 7);
      else ctx.rect(x - 11, y - 11, 22, 22);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.76)';
      ctx.font = '700 12px system-ui';
      ctx.fillText(lane.name, 26, y - 16);
    });
  }, [playerProgress, rivals]);

  useEffect(() => {
    drawRace();
  }, [drawRace]);

  useEffect(() => {
    if (!session || gameOver) return undefined;
    const timer = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const nextRemaining = Math.max(0, duration - elapsed);
      setRemaining(nextRemaining);
      if (nextRemaining <= 0) {
        window.clearInterval(timer);
        submitRace();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [duration, gameOver, session, startedAt]);

  const startRace = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api.post('/games/typing-sprint/start', { mode, durationSeconds: duration });
      setSession(res.data);
      setSentences(res.data?.sentences || []);
      setSentenceIndex(0);
      setInput('');
      setTypedSentences([]);
      setRemaining(res.data?.durationSeconds || duration);
      setStartedAt(Date.now());
      setResult(null);
      setSaved(false);
      setGameOver(false);
      window.setTimeout(() => inputRef.current?.focus(), 80);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not start Typing Race');
    } finally {
      setBusy(false);
    }
  }, [duration, mode]);

  const submitRace = useCallback(async () => {
    if (!session?.sessionId || busy || gameOver) return;
    setBusy(true);
    const finalTyped = [...typedSentences];
    if (input.trim()) finalTyped.push(input);
    try {
      const res = await api.post(`/games/typing-sprint/${session.sessionId}/submit`, {
        mode: 'sentence-stream',
        typedSentences: finalTyped,
        text: finalTyped.join('\n')
      });
      setResult(res.data?.result || null);
      setSaved(true);
      setGameOver(true);
      onScoreSaved?.();
      toast.success('Typing Race score saved');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not save Typing Race');
      setGameOver(true);
    } finally {
      setBusy(false);
    }
  }, [busy, gameOver, input, onScoreSaved, session?.sessionId, typedSentences]);

  const handleInput = (event) => {
    const value = event.target.value;
    setInput(value);
    if (!currentSentence) return;
    if (normalizeSentence(value) === normalizeSentence(currentSentence)) {
      const nextTyped = [...typedSentences, currentSentence];
      setTypedSentences(nextTyped);
      setInput('');
      const nextIndex = sentenceIndex + 1;
      setSentenceIndex(nextIndex);
      if (nextIndex >= sentences.length) {
        window.setTimeout(() => submitRace(), 80);
      }
    }
  };

  const matchLength = [...input].filter((char, index) => char === currentSentence[index]).length;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="grid gap-4 border-b border-slate-100 p-4 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-sky-500/20">
            <Keyboard size={25} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-[#0b57d0] dark:text-sky-300">Race Mode</p>
            <h2 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">Typing Race</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Short rounds with live progress bars and focused word sets.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <select value={mode} onChange={event => setMode(event.target.value)} disabled={Boolean(session && !gameOver)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            {MODES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
          <select value={duration} onChange={event => setDuration(Number(event.target.value))} disabled={Boolean(session && !gameOver)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <option value={30}>30 sec</option>
            <option value={45}>45 sec</option>
            <option value={60}>60 sec</option>
          </select>
          <button type="button" onClick={startRace} disabled={busy} className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0b57d0] px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60 sm:col-span-1">
            {session && !gameOver ? <RotateCcw size={17} /> : <Play size={17} fill="currentColor" />}
            {session && !gameOver ? 'Restart' : 'Start'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-4">
          <canvas ref={canvasRef} className="h-48 w-full rounded-2xl bg-slate-950" aria-label="Typing race progress" />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Sentence {Math.min(sentenceIndex + 1, sentences.length || 1)} / {sentences.length || 0}</p>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-[#0b57d0] ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">{formatTime(remaining)}</span>
            </div>
            <p className="mt-3 rounded-xl bg-white p-4 text-lg font-black leading-8 text-slate-950 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-white dark:ring-slate-800">
              {currentSentence || 'Start a race to load sentences.'}
            </p>
            <input
              ref={inputRef}
              value={input}
              onChange={handleInput}
              disabled={!session || gameOver || busy}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              placeholder="Type the sentence here"
              className="mt-3 h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-black text-slate-900 outline-none transition focus:border-[#0b57d0] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-900"
            />
          </div>
        </div>

        <aside className="space-y-3">
          {[
            ['Progress', `${Math.round(playerProgress * 100)}%`, Trophy],
            ['Matched chars', `${matchLength}/${currentSentence.length || 0}`, Zap],
            ['Best score', stats?.typingStats?.highScore || 0, Trophy]
          ].map(([label, value, Icon]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <Icon className="text-[#0b57d0]" size={18} />
              <p className="mt-2 text-xs font-black uppercase text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
            </div>
          ))}
        </aside>
      </div>

      <GameOverModal
        open={gameOver}
        title="Typing Race finished"
        score={result?.score || 0}
        detail={result ? `${result.wpm} WPM · ${result.accuracy}% accuracy · ${result.correctCount}/${result.totalCount} correct` : 'Race ended.'}
        saving={busy}
        saved={saved}
        onRetry={startRace}
        onExit={onExit}
      />
    </section>
  );
}
