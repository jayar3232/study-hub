import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Grid3X3, MousePointerClick, RotateCcw, Save, Sparkles, Trophy, Zap } from 'lucide-react';
import api from '../services/api';

const BOARD_SIZE = 8;

const shapeBank = [
  { name: 'Task Duo', cells: [[0, 0], [0, 1]], tone: 'from-cyan-300 to-blue-500', color: 'bg-cyan-400' },
  { name: 'Sprint Trio', cells: [[0, 0], [0, 1], [0, 2]], tone: 'from-pink-400 to-rose-500', color: 'bg-pink-400' },
  { name: 'Review Line', cells: [[0, 0], [1, 0], [2, 0]], tone: 'from-emerald-300 to-teal-500', color: 'bg-emerald-400' },
  { name: 'Standup Block', cells: [[0, 0], [0, 1], [1, 0], [1, 1]], tone: 'from-amber-300 to-orange-500', color: 'bg-amber-400' },
  { name: 'Launch L', cells: [[0, 0], [1, 0], [2, 0], [2, 1]], tone: 'from-violet-400 to-fuchsia-500', color: 'bg-violet-400' },
  { name: 'QA Corner', cells: [[0, 0], [0, 1], [1, 0]], tone: 'from-sky-300 to-cyan-600', color: 'bg-sky-400' },
  { name: 'Deploy Bar', cells: [[0, 0], [0, 1], [0, 2], [0, 3]], tone: 'from-lime-300 to-emerald-500', color: 'bg-lime-400' },
  { name: 'Focus Pillar', cells: [[0, 0], [1, 0], [2, 0], [3, 0]], tone: 'from-indigo-400 to-blue-600', color: 'bg-indigo-400' },
  { name: 'Bug Fix', cells: [[0, 1], [1, 0], [1, 1], [1, 2]], tone: 'from-red-400 to-pink-600', color: 'bg-red-400' }
];

const emptyBoard = () => Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));

const randomPiece = () => {
  const base = shapeBank[Math.floor(Math.random() * shapeBank.length)];
  return {
    ...base,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`
  };
};

const createTray = () => [randomPiece(), randomPiece(), randomPiece()];

const canPlace = (board, piece, row, col) => {
  if (!piece) return false;
  return piece.cells.every(([cellRow, cellCol]) => {
    const nextRow = row + cellRow;
    const nextCol = col + cellCol;
    return nextRow >= 0
      && nextRow < BOARD_SIZE
      && nextCol >= 0
      && nextCol < BOARD_SIZE
      && !board[nextRow][nextCol];
  });
};

const findPlacement = (board, piece, row, col) => {
  if (!piece) return null;
  const candidates = [
    [row, col],
    ...piece.cells.map(([cellRow, cellCol]) => [row - cellRow, col - cellCol])
  ];
  const seen = new Set();

  for (const [candidateRow, candidateCol] of candidates) {
    const key = `${candidateRow}-${candidateCol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (canPlace(board, piece, candidateRow, candidateCol)) {
      return { row: candidateRow, col: candidateCol };
    }
  }

  return null;
};

const hasAnyMove = (board, pieces) => pieces.some(piece => {
  if (!piece) return false;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (canPlace(board, piece, row, col)) return true;
    }
  }
  return false;
});

const placePiece = (board, piece, row, col) => {
  const nextBoard = board.map(line => [...line]);
  piece.cells.forEach(([cellRow, cellCol]) => {
    nextBoard[row + cellRow][col + cellCol] = piece.tone;
  });
  return nextBoard;
};

const clearCompletedLanes = (board) => {
  const rows = [];
  const cols = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    if (board[row].every(Boolean)) rows.push(row);
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    if (board.every(row => row[col])) cols.push(col);
  }

  if (!rows.length && !cols.length) return { board, cleared: 0, cells: [] };

  const flashCells = new Set();
  const nextBoard = board.map(line => [...line]);

  rows.forEach(row => {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      nextBoard[row][col] = null;
      flashCells.add(`${row}-${col}`);
    }
  });

  cols.forEach(col => {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      nextBoard[row][col] = null;
      flashCells.add(`${row}-${col}`);
    }
  });

  return { board: nextBoard, cleared: rows.length + cols.length, cells: Array.from(flashCells) };
};

const filledPercent = (board) => {
  const filled = board.flat().filter(Boolean).length;
  return Math.round((filled / (BOARD_SIZE * BOARD_SIZE)) * 100);
};

export function BlockGameLogo({ compact = false }) {
  return (
    <div className={`${compact ? 'h-12 w-12 rounded-2xl' : 'h-16 w-16 rounded-3xl'} relative grid shrink-0 place-items-center overflow-hidden bg-gray-950 text-white shadow-xl shadow-cyan-500/20 ring-1 ring-cyan-300/20`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.5),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(236,72,153,0.45),transparent_35%)]" />
      <div className="relative grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }).map((_, index) => (
          <span
            key={index}
            className={`h-2.5 w-2.5 rounded-[4px] ${
              [0, 1, 3, 4, 5, 8].includes(index)
                ? 'bg-gradient-to-br from-cyan-300 to-pink-500 shadow-[0_0_12px_rgba(34,211,238,0.6)]'
                : 'bg-white/15'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function BlockStackGame({ stats, onScoreSaved }) {
  const [board, setBoard] = useState(() => emptyBoard());
  const [pieces, setPieces] = useState(() => createTray());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [linesCleared, setLinesCleared] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [gameOver, setGameOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedScore, setSavedScore] = useState(null);
  const [scoreBursts, setScoreBursts] = useState([]);
  const [flashCells, setFlashCells] = useState(() => new Set());
  const [comboBanner, setComboBanner] = useState(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [clearPulseKey, setClearPulseKey] = useState(0);

  const selectedPiece = pieces[selectedIndex];
  const fill = useMemo(() => filledPercent(board), [board]);

  const resetGame = () => {
    setBoard(emptyBoard());
    setPieces(createTray());
    setSelectedIndex(0);
    setScore(0);
    setMoves(0);
    setLinesCleared(0);
    setCombo(0);
    setMaxCombo(0);
    setStartedAt(Date.now());
    setGameOver(false);
    setSaving(false);
    setSavedScore(null);
    setScoreBursts([]);
    setFlashCells(new Set());
    setComboBanner(null);
    setClearPulseKey(0);
  };

  const saveScore = async (payload) => {
    if (!payload.score || payload.score <= 0) return;
    setSaving(true);
    try {
      const res = await api.post('/games/block-stack/submit', payload);
      setSavedScore(res.data?.result?.score || payload.score);
      toast.success('WorkGrid score saved');
      onScoreSaved?.();
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Backend is not updated yet. Redeploy Render backend first.');
      } else {
        toast.error(err.response?.data?.msg || 'Could not save block score');
      }
    } finally {
      setSaving(false);
    }
  };

  const finishGame = (finalBoard, finalScore, finalMoves, finalLines, finalMaxCombo) => {
    setGameOver(true);
    saveScore({
      score: finalScore,
      moves: finalMoves,
      linesCleared: finalLines,
      maxCombo: finalMaxCombo,
      boardFill: filledPercent(finalBoard),
      durationMs: Date.now() - startedAt
    });
  };

  const addScoreBurst = (row, col, gained, cleared, nextCombo) => {
    const burst = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      row,
      col,
      text: `+${gained}`,
      detail: `${cleared} clear${cleared > 1 ? 's' : ''}${nextCombo > 1 ? ` x${nextCombo}` : ''}`
    };

    setScoreBursts(prev => [burst, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setScoreBursts(prev => prev.filter(item => item.id !== burst.id));
    }, 950);
  };

  const handleCellClick = (row, col) => {
    if (gameOver || !selectedPiece) return;
    const placement = findPlacement(board, selectedPiece, row, col);
    if (!placement) {
      setShakeKey(value => value + 1);
      return;
    }

    const placed = placePiece(board, selectedPiece, placement.row, placement.col);
    const clearedResult = clearCompletedLanes(placed);
    const nextCombo = clearedResult.cleared ? combo + 1 : 0;
    const nextMaxCombo = Math.max(maxCombo, nextCombo);
    const gained = clearedResult.cleared
      ? (clearedResult.cleared * 420)
        + (clearedResult.cells.length * 18)
        + (nextCombo * 180)
        + (clearedResult.cleared > 1 ? 260 : 0)
      : 0;
    const nextScore = score + gained;
    const nextMoves = moves + 1;
    const nextLines = linesCleared + clearedResult.cleared;

    let nextPieces = pieces.map((piece, index) => (index === selectedIndex ? null : piece));
    if (nextPieces.every(piece => !piece)) nextPieces = createTray();
    const nextSelectedIndex = Math.max(0, nextPieces.findIndex(Boolean));
    const noMovesLeft = !hasAnyMove(clearedResult.board, nextPieces);

    if (clearedResult.cleared) {
      addScoreBurst(row, col, gained, clearedResult.cleared, nextCombo);
      setClearPulseKey(value => value + 1);
      setFlashCells(new Set(clearedResult.cells));
      setComboBanner({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        text: nextCombo > 1 ? `Combo x${nextCombo}` : 'Line clear',
        detail: `${clearedResult.cleared} sprint lane${clearedResult.cleared > 1 ? 's' : ''} completed`
      });
      window.setTimeout(() => setFlashCells(new Set()), 520);
      window.setTimeout(() => setComboBanner(null), 1150);
    }

    setBoard(clearedResult.board);
    setPieces(nextPieces);
    setSelectedIndex(nextSelectedIndex);
    setScore(nextScore);
    setMoves(nextMoves);
    setLinesCleared(nextLines);
    setCombo(nextCombo);
    setMaxCombo(nextMaxCombo);

    if (noMovesLeft) finishGame(clearedResult.board, nextScore, nextMoves, nextLines, nextMaxCombo);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-950 text-white shadow-2xl shadow-cyan-500/10">
      <div className="relative overflow-hidden border-b border-white/10 p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(34,211,238,0.22),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(236,72,153,0.22),transparent_32%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <BlockGameLogo />
            <div>
              <p className="text-xs font-black uppercase text-cyan-200">Puzzle Game</p>
              <h2 className="text-2xl font-black tracking-normal">WorkGrid Blocks</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-white/65">Place workload blocks, clear sprint lanes, build combos, and keep the project board alive.</p>
            </div>
          </div>
          <button type="button" onClick={resetGame} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15">
            <RotateCcw size={16} />
            New Round
          </button>
        </div>
      </div>

      <div className="grid gap-5 p-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['Score', score],
              ['Moves', moves],
              ['Clears', linesCleared],
              ['Best Combo', `x${maxCombo}`]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-center shadow-lg shadow-black/10">
                <p className="text-[11px] font-black uppercase text-white/45">{label}</p>
                <motion.p key={value} initial={{ scale: 0.82, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className="mt-1 text-xl font-black text-white">
                  {value}
                </motion.p>
              </div>
            ))}
          </div>

          <motion.div
            key={`${shakeKey}-${clearPulseKey}`}
            animate={{
              x: shakeKey ? [0, -8, 8, -5, 5, 0] : 0,
              boxShadow: clearPulseKey
                ? [
                    '0 25px 50px -12px rgba(34,211,238,0.12)',
                    '0 0 58px rgba(34,211,238,0.42), 0 0 84px rgba(236,72,153,0.28)',
                    '0 25px 50px -12px rgba(34,211,238,0.12)'
                  ]
                : '0 25px 50px -12px rgba(34,211,238,0.12)'
            }}
            transition={{ duration: clearPulseKey ? 0.62 : 0.28 }}
            className="relative mx-auto aspect-square w-full max-w-[640px] rounded-[2rem] bg-gray-900 p-3 shadow-2xl shadow-cyan-500/10 ring-1 ring-white/10"
          >
            <div className="absolute inset-3 rounded-[1.45rem] bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:12.5%_12.5%]" />

            <div className="relative grid h-full w-full grid-cols-8 gap-1">
              {board.map((row, rowIndex) => row.map((cell, colIndex) => {
                const valid = selectedPiece && Boolean(findPlacement(board, selectedPiece, rowIndex, colIndex));
                const flash = flashCells.has(`${rowIndex}-${colIndex}`);
                return (
                  <motion.button
                    key={`${rowIndex}-${colIndex}`}
                    type="button"
                    initial={false}
                    animate={{
                      scale: flash ? [1, 1.22, 0.72, 1] : 1,
                      opacity: cell || flash ? 1 : 0.88
                    }}
                    whileHover={!cell && valid ? { scale: 1.06 } : undefined}
                    whileTap={{ scale: 0.92 }}
                    transition={{ duration: flash ? 0.45 : 0.16 }}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                    className={`relative aspect-square overflow-hidden rounded-xl border ${
                      flash
                        ? 'border-white bg-white shadow-[0_0_28px_rgba(255,255,255,0.75)]'
                        : cell
                          ? `border-white/25 bg-gradient-to-br ${cell} shadow-lg shadow-black/30`
                          : valid
                            ? 'border-cyan-300/35 bg-cyan-300/10 hover:bg-cyan-300/25'
                            : 'border-white/5 bg-white/[0.04] hover:bg-white/[0.07]'
                    }`}
                    aria-label={`Board cell ${rowIndex + 1}, ${colIndex + 1}`}
                  >
                    {cell && <span className="absolute inset-1 rounded-lg border border-white/20 bg-white/10" />}
                  </motion.button>
                );
              }))}
            </div>

            <AnimatePresence>
              {comboBanner && (
                <motion.div
                  key={comboBanner.id}
                  initial={{ opacity: 0, scale: 0.7, y: 18 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.88, y: -12 }}
                  className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[min(78%,340px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-yellow-200/40 bg-gray-950/90 p-5 text-center shadow-2xl shadow-yellow-400/20 backdrop-blur"
                >
                  <p className="text-3xl font-black text-yellow-200">{comboBanner.text}</p>
                  <p className="mt-1 text-sm font-bold text-white/70">{comboBanner.detail}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {scoreBursts.map(burst => (
                <motion.div
                  key={burst.id}
                  initial={{ opacity: 0, y: 18, scale: 0.75 }}
                  animate={{ opacity: 1, y: -28, scale: 1 }}
                  exit={{ opacity: 0, y: -60, scale: 0.9 }}
                  transition={{ duration: 0.75 }}
                  className="pointer-events-none absolute z-30 rounded-2xl border border-white/20 bg-white px-3 py-2 text-center text-gray-950 shadow-2xl"
                  style={{
                    left: `${Math.min(82, Math.max(8, ((burst.col + 0.5) / BOARD_SIZE) * 100))}%`,
                    top: `${Math.min(82, Math.max(8, ((burst.row + 0.5) / BOARD_SIZE) * 100))}%`
                  }}
                >
                  <p className="text-lg font-black">{burst.text}</p>
                  <p className="text-[10px] font-black uppercase text-gray-500">{burst.detail}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {gameOver && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">
              Board locked. Final score {score}. {score <= 0 ? 'Clear at least one lane to save a ranked score.' : savedScore ? 'Saved to rankings.' : saving ? 'Saving score...' : 'Score save pending.'}
            </motion.div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-black text-white">Block Tray</p>
              <MousePointerClick size={17} className="text-cyan-300" />
            </div>
            <div className="space-y-3">
              {pieces.map((piece, index) => (
                <motion.button
                  key={piece?.id || index}
                  type="button"
                  disabled={!piece || gameOver}
                  onClick={() => piece && setSelectedIndex(index)}
                  whileHover={piece && !gameOver ? { y: -2 } : undefined}
                  whileTap={piece && !gameOver ? { scale: 0.98 } : undefined}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    selectedIndex === index && piece
                      ? 'border-pink-300/60 bg-pink-400/15 shadow-lg shadow-pink-500/10'
                      : 'border-white/10 bg-white/[0.05] hover:border-cyan-300/45 hover:bg-cyan-300/10'
                  } disabled:opacity-40`}
                >
                  {piece ? (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-white">{piece.name}</p>
                        <p className="text-xs font-semibold text-white/45">{piece.cells.length} workload cells</p>
                      </div>
                      <div className="grid grid-cols-4 gap-0.5 rounded-xl bg-gray-950/60 p-1.5">
                        {Array.from({ length: 16 }).map((_, cellIndex) => {
                          const row = Math.floor(cellIndex / 4);
                          const col = cellIndex % 4;
                          const active = piece.cells.some(([pieceRow, pieceCol]) => pieceRow === row && pieceCol === col);
                          return <span key={cellIndex} className={`h-2.5 w-2.5 rounded-[3px] ${active ? `bg-gradient-to-br ${piece.tone}` : 'bg-white/10'}`} />;
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-white/35">Placed</p>
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
            <p className="flex items-center gap-2 text-sm font-black text-white">
              <Grid3X3 size={17} className="text-cyan-300" />
              Board Pressure
            </p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
              <motion.div animate={{ width: `${fill}%` }} className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-pink-400 to-yellow-300" />
            </div>
            <p className="mt-2 text-xs font-semibold text-white/45">{fill}% occupied. Keep space open for larger blocks.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase text-cyan-100">
                <Trophy size={15} />
                Block Best
              </p>
              <p className="mt-1 text-3xl font-black text-white">{stats?.blockStats?.highScore || 0}</p>
            </div>
            <div className="rounded-3xl border border-pink-300/20 bg-pink-300/10 p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase text-pink-100">
                <Sparkles size={15} />
                Saved Run
              </p>
              <p className="mt-1 text-3xl font-black text-white">{savedScore || '-'}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={!gameOver || saving || savedScore || score <= 0}
            onClick={() => saveScore({ score, moves, linesCleared, maxCombo, boardFill: fill, durationMs: Date.now() - startedAt })}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-gray-950 transition hover:-translate-y-0.5 hover:bg-cyan-100 disabled:opacity-50"
          >
            {saving ? <Zap size={17} className="animate-pulse" /> : <Save size={17} />}
            {saving ? 'Saving...' : savedScore ? 'Saved' : score <= 0 ? 'No Clear Score' : 'Save Score'}
          </button>
        </aside>
      </div>
    </section>
  );
}
