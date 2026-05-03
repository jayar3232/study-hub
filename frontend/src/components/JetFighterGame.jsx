import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plane, Shield, Trophy, Zap } from 'lucide-react';
import api from '../services/api';
import GameOverModal from './GameOverModal';

const WIDTH = 390;
const HEIGHT = 560;
const PLAYER_Y = HEIGHT - 72;
const PLAYER_SIZE = 42;
const ENEMY_SIZE = 34;
const BULLET_W = 5;
const BULLET_H = 16;
const ENEMY_BULLET_W = 6;
const ENEMY_BULLET_H = 14;
const FRAME_INTERVAL = 1000 / 60;

const enemyTypes = [
  { key: 'scout', label: 'Scout Jet', size: 30, hp: 1, speed: 0.084, drift: 0.034, points: 22, tone: 'from-rose-400 to-orange-500' },
  { key: 'fighter', label: 'Fighter Jet', size: 38, hp: 2, speed: 0.068, drift: 0.026, points: 44, tone: 'from-violet-400 to-fuchsia-600' },
  { key: 'twin', label: 'Twin Jet', size: 44, hp: 3, speed: 0.058, drift: 0.022, points: 70, tone: 'from-amber-300 to-red-600' }
];

const powerUpTypes = [
  { key: 'double', label: 'Double Shot', tone: 'from-cyan-300 to-blue-500' },
  { key: 'machine', label: 'Machine Gun', tone: 'from-emerald-300 to-lime-500' },
  { key: 'spread', label: 'Spread Fire', tone: 'from-pink-300 to-violet-500' }
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const makeEnemy = (level = 1) => {
  const type = level >= 6 && Math.random() > 0.68
    ? enemyTypes[2]
    : level >= 3 && Math.random() > 0.58
      ? enemyTypes[1]
      : enemyTypes[0];

  return {
    id: uid(),
    type: type.key,
    label: type.label,
    x: 28 + Math.random() * (WIDTH - 56),
    y: -45,
    size: type.size,
    maxHp: type.hp,
    hp: type.hp,
    points: type.points,
    tone: type.tone,
    speed: type.speed + Math.random() * 0.018 + level * 0.003,
    drift: (Math.random() - 0.5) * type.drift,
    shootCooldown: 720 + Math.random() * 1200
  };
};

const makePowerUp = (x, y) => {
  const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
  return { id: uid(), x, y, ...type };
};

export function JetFighterLogo({ compact = false }) {
  return (
    <div className={`${compact ? 'h-12 w-12 rounded-2xl' : 'h-16 w-16 rounded-3xl'} relative grid shrink-0 place-items-center overflow-hidden bg-slate-950 text-white shadow-xl shadow-cyan-500/20 ring-1 ring-cyan-300/20`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_20%,rgba(56,189,248,0.5),transparent_34%),radial-gradient(circle_at_76%_76%,rgba(244,63,94,0.38),transparent_35%)]" />
      <Plane size={compact ? 25 : 31} className="relative z-10 -rotate-45 text-cyan-100 drop-shadow" />
    </div>
  );
}

export default function JetFighterGame({ stats, onScoreSaved, onExit }) {
  const frameRef = useRef(null);
  const canvasRef = useRef(null);
  const lastFrameRef = useRef(null);
  const lastStatsSyncRef = useRef(0);
  const playerXRef = useRef(WIDTH / 2);
  const bulletsRef = useRef([]);
  const enemyBulletsRef = useRef([]);
  const enemiesRef = useRef([]);
  const scoreRef = useRef(0);
  const killsRef = useRef(0);
  const livesRef = useRef(3);
  const levelRef = useRef(1);
  const spawnClockRef = useRef(0);
  const fireClockRef = useRef(0);
  const survivalScoreRef = useRef(0);
  const powerUpsRef = useRef([]);
  const weaponRef = useRef('single');
  const weaponUntilRef = useRef(0);
  const startedAtRef = useRef(Date.now());
  const runningRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playerX, setPlayerX] = useState(WIDTH / 2);
  const [bullets, setBullets] = useState([]);
  const [enemyBullets, setEnemyBullets] = useState([]);
  const [enemies, setEnemies] = useState([]);
  const [score, setScore] = useState(0);
  const [kills, setKills] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [powerUps, setPowerUps] = useState([]);
  const [weapon, setWeapon] = useState('single');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hitFlash, setHitFlash] = useState(0);

  const syncState = () => {
    setWeapon(weaponRef.current);
    setScore(scoreRef.current);
    setKills(killsRef.current);
    setLives(livesRef.current);
    setLevel(levelRef.current);
  };

  const drawArena = useCallback((time = 0) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context) return;

    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== WIDTH * pixelRatio || canvas.height !== HEIGHT * pixelRatio) {
      canvas.width = WIDTH * pixelRatio;
      canvas.height = HEIGHT * pixelRatio;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, WIDTH, HEIGHT);

    const bg = context.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, '#020617');
    bg.addColorStop(0.58, '#0f172a');
    bg.addColorStop(1, '#111827');
    context.fillStyle = bg;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.save();
    context.globalAlpha = 0.22;
    context.strokeStyle = 'rgba(148, 163, 184, 0.34)';
    context.lineWidth = 1;
    const gridOffset = (time * 0.035) % 38;
    for (let y = -38 + gridOffset; y < HEIGHT; y += 38) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(WIDTH, y);
      context.stroke();
    }
    for (let x = 0; x < WIDTH; x += 38) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, HEIGHT);
      context.stroke();
    }
    context.restore();

    context.save();
    context.globalAlpha = 0.36;
    context.fillStyle = '#bae6fd';
    for (let index = 0; index < 34; index += 1) {
      const x = (index * 83) % WIDTH;
      const y = ((index * 149) + time * 0.08) % HEIGHT;
      const size = index % 5 === 0 ? 1.8 : 1.1;
      context.beginPath();
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();

    const drawGlowRect = (x, y, width, height, color) => {
      context.save();
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.fillStyle = color;
      context.fillRect(x, y, width, height);
      context.restore();
    };

    bulletsRef.current.forEach(bullet => {
      drawGlowRect(bullet.x - BULLET_W / 2, bullet.y, BULLET_W, BULLET_H, '#a5f3fc');
    });

    enemyBulletsRef.current.forEach(bullet => {
      drawGlowRect(bullet.x - ENEMY_BULLET_W / 2, bullet.y, ENEMY_BULLET_W, ENEMY_BULLET_H, '#fda4af');
    });

    powerUpsRef.current.forEach(powerUp => {
      context.save();
      context.shadowColor = '#67e8f9';
      context.shadowBlur = 16;
      context.fillStyle = powerUp.key === 'machine' ? '#86efac' : powerUp.key === 'spread' ? '#f0abfc' : '#67e8f9';
      context.beginPath();
      context.arc(powerUp.x, powerUp.y, 14, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#020617';
      context.font = 'bold 10px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(powerUp.key === 'machine' ? 'MG' : powerUp.key === 'spread' ? 'S' : '2X', powerUp.x, powerUp.y + 0.5);
      context.restore();
    });

    const drawPlane = (x, y, size, fill, rotation = 0) => {
      context.save();
      context.translate(x, y);
      context.rotate(rotation);
      context.shadowColor = fill;
      context.shadowBlur = 18;
      context.fillStyle = fill;
      context.beginPath();
      context.moveTo(0, -size * 0.55);
      context.lineTo(size * 0.18, -size * 0.15);
      context.lineTo(size * 0.5, 0);
      context.lineTo(size * 0.2, size * 0.14);
      context.lineTo(size * 0.1, size * 0.52);
      context.lineTo(0, size * 0.32);
      context.lineTo(-size * 0.1, size * 0.52);
      context.lineTo(-size * 0.2, size * 0.14);
      context.lineTo(-size * 0.5, 0);
      context.lineTo(-size * 0.18, -size * 0.15);
      context.closePath();
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.85)';
      context.beginPath();
      context.arc(0, -size * 0.19, size * 0.08, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    enemiesRef.current.forEach(enemy => {
      const color = enemy.type === 'twin' ? '#fb923c' : enemy.type === 'fighter' ? '#c084fc' : '#fb7185';
      drawPlane(enemy.x, enemy.y, enemy.size || ENEMY_SIZE, color, Math.PI);
    });

    drawPlane(playerXRef.current, PLAYER_Y, PLAYER_SIZE, '#38bdf8', 0);
  }, []);

  const saveScore = useCallback(async () => {
    const finalScore = scoreRef.current;
    if (finalScore <= 0) return;
    setSaving(true);
    try {
      await api.post('/games/jet-fighter/submit', {
        score: finalScore,
        kills: killsRef.current,
        level: levelRef.current,
        lives: livesRef.current,
        elapsedMs: Date.now() - startedAtRef.current
      });
      setSaved(true);
      toast.success('Jet Fighter score saved');
      onScoreSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not save Jet Fighter score');
    } finally {
      setSaving(false);
    }
  }, [onScoreSaved]);

  const endGame = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setGameOver(true);
    saveScore();
  }, [saveScore]);

  const resetGame = useCallback(() => {
    playerXRef.current = WIDTH / 2;
    bulletsRef.current = [];
    enemyBulletsRef.current = [];
    enemiesRef.current = [makeEnemy(1), makeEnemy(1)];
    scoreRef.current = 0;
    killsRef.current = 0;
    livesRef.current = 3;
    levelRef.current = 1;
    spawnClockRef.current = 0;
    fireClockRef.current = 0;
    survivalScoreRef.current = 0;
    powerUpsRef.current = [];
    weaponRef.current = 'single';
    weaponUntilRef.current = 0;
    startedAtRef.current = Date.now();
    lastFrameRef.current = null;
    runningRef.current = true;
    setGameOver(false);
    setSaved(false);
    setRunning(true);
    syncState();
    requestAnimationFrame(time => drawArena(time));
  }, [drawArena]);

  const movePlayerToClientX = (clientX, target) => {
    const rect = target.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * WIDTH;
    playerXRef.current = clamp(x, 28, WIDTH - 28);
    if (!runningRef.current) setPlayerX(playerXRef.current);
    if (!runningRef.current) drawArena(performance.now());
    if (!runningRef.current && !gameOver) resetGame();
  };

  useEffect(() => {
    const handleKey = (event) => {
      if (!runningRef.current && (event.code === 'Space' || event.code === 'ArrowLeft' || event.code === 'ArrowRight')) {
        resetGame();
      }
      if (event.code === 'ArrowLeft') playerXRef.current = clamp(playerXRef.current - 24, 28, WIDTH - 28);
      if (event.code === 'ArrowRight') playerXRef.current = clamp(playerXRef.current + 24, 28, WIDTH - 28);
      setPlayerX(playerXRef.current);
      drawArena(performance.now());
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [drawArena, gameOver, resetGame]);

  useEffect(() => {
    const tick = (time) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = time;
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      const last = lastFrameRef.current;
      if (time - last < FRAME_INTERVAL) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      const delta = Math.min(42, time - last);
      lastFrameRef.current = time;

      if (runningRef.current) {
        fireClockRef.current += delta;
        spawnClockRef.current += delta;

        if (weaponUntilRef.current && time > weaponUntilRef.current) {
          weaponRef.current = 'single';
          weaponUntilRef.current = 0;
        }

        const fireDelay = weaponRef.current === 'machine' ? 115 : 220;
        if (fireClockRef.current > fireDelay) {
          const patterns = weaponRef.current === 'spread'
            ? [{ x: -13, vx: -0.09 }, { x: 0, vx: 0 }, { x: 13, vx: 0.09 }]
            : weaponRef.current === 'double'
              ? [{ x: -10, vx: 0 }, { x: 10, vx: 0 }]
              : [{ x: 0, vx: 0 }];
          bulletsRef.current = [
            ...bulletsRef.current,
            ...patterns.map(pattern => ({ id: uid(), x: playerXRef.current + pattern.x, y: PLAYER_Y - 18, vx: pattern.vx }))
          ].slice(-64);
          fireClockRef.current = 0;
        }

        const spawnDelay = Math.max(420, 950 - levelRef.current * 55);
        if (spawnClockRef.current > spawnDelay) {
          enemiesRef.current = [...enemiesRef.current, makeEnemy(levelRef.current)].slice(-16);
          spawnClockRef.current = 0;
        }

        bulletsRef.current = bulletsRef.current
          .map(bullet => ({ ...bullet, x: bullet.x + (bullet.vx || 0) * delta, y: bullet.y - delta * 0.42 }))
          .filter(bullet => bullet.y > -24);

        const nextEnemyShots = [];
        enemiesRef.current = enemiesRef.current
          .map(enemy => {
            const nextEnemy = {
              ...enemy,
              x: clamp(enemy.x + enemy.drift * delta, 18, WIDTH - 18),
              y: enemy.y + enemy.speed * delta,
              shootCooldown: (enemy.shootCooldown ?? 900) - delta
            };
            const canShoot = nextEnemy.y > 26 && nextEnemy.y < HEIGHT * 0.72 && nextEnemy.shootCooldown <= 0;
            if (canShoot) {
              const patterns = nextEnemy.type === 'twin'
                ? [{ x: -8, vx: -0.025 }, { x: 8, vx: 0.025 }]
                : nextEnemy.type === 'fighter'
                  ? [{ x: 0, vx: 0 }, { x: 10, vx: 0.018 }]
                  : [{ x: 0, vx: 0 }];
              nextEnemyShots.push(...patterns.map(pattern => ({
                id: uid(),
                x: nextEnemy.x + pattern.x,
                y: nextEnemy.y + (nextEnemy.size || ENEMY_SIZE) * 0.35,
                vx: pattern.vx,
                speed: 0.22 + levelRef.current * 0.012
              })));
              nextEnemy.shootCooldown = Math.max(420, 1180 - levelRef.current * 55) + Math.random() * 720;
            }
            return nextEnemy;
          })
          .filter(enemy => {
            if (enemy.y < HEIGHT + 48) return true;
            livesRef.current -= 1;
            setHitFlash(value => value + 1);
            return false;
          });

        if (nextEnemyShots.length) {
          enemyBulletsRef.current = [...enemyBulletsRef.current, ...nextEnemyShots].slice(-36);
        }

        enemyBulletsRef.current = enemyBulletsRef.current
          .map(bullet => ({
            ...bullet,
            x: bullet.x + (bullet.vx || 0) * delta,
            y: bullet.y + delta * (bullet.speed || 0.24)
          }))
          .filter(bullet => bullet.y < HEIGHT + 28 && bullet.x > -18 && bullet.x < WIDTH + 18);

        const remainingBullets = [];
        const enemiesNext = enemiesRef.current.map(enemy => ({ ...enemy }));

        bulletsRef.current.forEach(bullet => {
          const hitIndex = enemiesNext.findIndex(enemy => (
            Math.abs(enemy.x - bullet.x) < ((enemy.size || ENEMY_SIZE) / 2)
            && Math.abs(enemy.y - bullet.y) < ((enemy.size || ENEMY_SIZE) / 2)
          ));

          if (hitIndex === -1) {
            remainingBullets.push(bullet);
            return;
          }

          enemiesNext[hitIndex].hp -= 1;
          scoreRef.current += 4 + levelRef.current;
          if (enemiesNext[hitIndex].hp <= 0) {
            killsRef.current += 1;
            scoreRef.current += (enemiesNext[hitIndex].points || 24) + levelRef.current * 2;
            if (Math.random() < 0.18) {
              powerUpsRef.current = [...powerUpsRef.current, makePowerUp(enemiesNext[hitIndex].x, enemiesNext[hitIndex].y)].slice(-5);
            }
          }
        });

        bulletsRef.current = remainingBullets;
        enemiesRef.current = enemiesNext.filter(enemy => enemy.hp > 0);
        levelRef.current = Math.min(12, Math.floor(killsRef.current / 6) + 1);
        survivalScoreRef.current += delta * (0.007 + levelRef.current * 0.001);
        if (survivalScoreRef.current >= 1) {
          const gained = Math.floor(survivalScoreRef.current);
          scoreRef.current += gained;
          survivalScoreRef.current -= gained;
        }

        powerUpsRef.current = powerUpsRef.current
          .map(powerUp => ({ ...powerUp, y: powerUp.y + delta * 0.09 }))
          .filter(powerUp => powerUp.y < HEIGHT + 32);

        powerUpsRef.current = powerUpsRef.current.filter(powerUp => {
          const collected = Math.abs(powerUp.x - playerXRef.current) < 34 && Math.abs(powerUp.y - PLAYER_Y) < 36;
          if (!collected) return true;
          weaponRef.current = powerUp.key;
          weaponUntilRef.current = time + 8000;
          scoreRef.current += 15;
          return false;
        });

        let bulletHitPlayer = false;
        enemyBulletsRef.current = enemyBulletsRef.current.filter(bullet => {
          const hit = Math.abs(bullet.x - playerXRef.current) < 24 && Math.abs(bullet.y - PLAYER_Y) < 28;
          if (hit) bulletHitPlayer = true;
          return !hit;
        });
        if (bulletHitPlayer) {
          livesRef.current -= 1;
          setHitFlash(value => value + 1);
        }

        const crashed = enemiesRef.current.some(enemy => (
          Math.abs(enemy.x - playerXRef.current) < 34
          && Math.abs(enemy.y - PLAYER_Y) < 34
        ));

        if (crashed) {
          livesRef.current -= 1;
          enemiesRef.current = enemiesRef.current.filter(enemy => Math.abs(enemy.y - PLAYER_Y) >= 34);
          setHitFlash(value => value + 1);
        }

        if (time - lastStatsSyncRef.current > 80) {
          lastStatsSyncRef.current = time;
          syncState();
        }
        if (livesRef.current <= 0) endGame();
      }

      drawArena(time);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [endGame]);

  return (
    <section className="overflow-hidden rounded-3xl border border-cyan-900/60 bg-slate-950 text-white shadow-2xl shadow-cyan-500/10">
      <div className="relative overflow-hidden border-b border-white/10 p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(34,211,238,0.24),transparent_30%),radial-gradient(circle_at_86%_12%,rgba(244,63,94,0.2),transparent_32%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <JetFighterLogo />
            <div>
              <p className="text-xs font-black uppercase text-cyan-200">Arcade Defense</p>
              <h2 className="text-2xl font-black tracking-normal">Jet Fighter</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-white/65">Drag the fighter, dodge enemy fire, clear rival jets, and survive the longest launch run.</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-black">
            {[
              ['Score', score],
              ['Kills', kills],
              ['Lives', lives],
              ['Level', level]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2">
                <p className="uppercase text-white/40">{label}</p>
                <p className="mt-1 text-lg text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <button
          type="button"
          onPointerDown={event => {
            event.currentTarget.setPointerCapture?.(event.pointerId);
            movePlayerToClientX(event.clientX, event.currentTarget);
          }}
          onPointerMove={event => movePlayerToClientX(event.clientX, event.currentTarget)}
          className="jet-arena-stage relative mx-auto aspect-[39/56] w-full max-w-[370px] touch-none overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 text-left shadow-2xl shadow-cyan-500/20"
          aria-label="Jet Fighter arena"
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
          {hitFlash > 0 && <div key={hitFlash} className="absolute inset-0 animate-pulse bg-rose-500/15" />}

          {!running && !gameOver && (
            <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/38 p-6 text-center backdrop-blur-[1px]">
              <div className="rounded-3xl border border-white/15 bg-white/90 p-5 text-slate-950 shadow-2xl">
                <p className="text-2xl font-black">Tap to launch</p>
                <p className="mt-2 text-sm font-bold text-slate-700">Drag left or right. The jet fires automatically.</p>
              </div>
            </div>
          )}
        </button>

        <aside className="grid gap-4 md:grid-cols-2 xl:block xl:space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
            <p className="flex items-center gap-2 text-sm font-black text-white">
              <Trophy size={17} className="text-yellow-200" />
              Jet Best
            </p>
            <p className="mt-2 text-3xl font-black">{stats?.jetFighterStats?.highScore || 0}</p>
            <p className="mt-2 text-xs leading-5 text-white/45">Score rewards survival time, rival jet takedowns, and higher levels.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <p className="flex items-center gap-2 text-sm font-black text-white">
              <Shield size={17} className="text-cyan-200" />
              Controls
            </p>
            <p className="mt-2 text-xs leading-5 text-white/45">Drag on mobile. Arrow keys work on laptop. Avoid bullets, collisions, and missed rival jets.</p>
            <p className="mt-3 rounded-2xl bg-white/5 px-3 py-2 text-xs font-black text-cyan-100">Weapon: {weapon === 'single' ? 'Single Bullet' : weapon === 'double' ? 'Double Shot' : weapon === 'machine' ? 'Machine Gun' : 'Spread Fire'}</p>
          </div>
        </aside>
      </div>

      <GameOverModal
        open={gameOver}
        title="Mission ended"
        score={score}
        detail={`${kills} rival jets cleared at level ${level}.`}
        saving={saving}
        saved={saved}
        onRetry={resetGame}
        onExit={() => setGameOver(false)}
      />
    </section>
  );
}
