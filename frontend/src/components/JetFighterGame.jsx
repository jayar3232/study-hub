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
const FRAME_INTERVAL = 1000 / 45;

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
  const lastFrameRef = useRef(null);
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
    setPlayerX(playerXRef.current);
    setBullets(bulletsRef.current);
    setEnemyBullets(enemyBulletsRef.current);
    setEnemies(enemiesRef.current);
    setPowerUps(powerUpsRef.current);
    setWeapon(weaponRef.current);
    setScore(scoreRef.current);
    setKills(killsRef.current);
    setLives(livesRef.current);
    setLevel(levelRef.current);
  };

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
  }, []);

  const movePlayerToClientX = (clientX, target) => {
    const rect = target.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * WIDTH;
    playerXRef.current = clamp(x, 28, WIDTH - 28);
    setPlayerX(playerXRef.current);
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
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameOver, resetGame]);

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
          ];
          fireClockRef.current = 0;
        }

        const spawnDelay = Math.max(420, 950 - levelRef.current * 55);
        if (spawnClockRef.current > spawnDelay) {
          enemiesRef.current = [...enemiesRef.current, makeEnemy(levelRef.current)];
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
              powerUpsRef.current = [...powerUpsRef.current, makePowerUp(enemiesNext[hitIndex].x, enemiesNext[hitIndex].y)];
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

        syncState();
        if (livesRef.current <= 0) endGame();
      }

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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.18),transparent_32%),linear-gradient(#020617,#0f172a_58%,#111827)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:38px_38px]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-cyan-500/12 to-transparent" />
          {hitFlash > 0 && <div key={hitFlash} className="absolute inset-0 animate-pulse bg-rose-500/15" />}

          {bullets.map(bullet => (
            <span
              key={bullet.id}
              className="absolute z-10 rounded-full bg-cyan-200 shadow-[0_0_14px_rgba(103,232,249,0.95)]"
              style={{
                left: `${((bullet.x - BULLET_W / 2) / WIDTH) * 100}%`,
                top: `${(bullet.y / HEIGHT) * 100}%`,
                width: `${(BULLET_W / WIDTH) * 100}%`,
                height: `${(BULLET_H / HEIGHT) * 100}%`
              }}
            />
          ))}

          {enemyBullets.map(bullet => (
            <span
              key={bullet.id}
              className="absolute z-10 rounded-full bg-rose-300 shadow-[0_0_14px_rgba(251,113,133,0.9)]"
              style={{
                left: `${((bullet.x - ENEMY_BULLET_W / 2) / WIDTH) * 100}%`,
                top: `${(bullet.y / HEIGHT) * 100}%`,
                width: `${(ENEMY_BULLET_W / WIDTH) * 100}%`,
                height: `${(ENEMY_BULLET_H / HEIGHT) * 100}%`
              }}
            />
          ))}

          {powerUps.map(powerUp => (
            <span
              key={powerUp.id}
              className={`absolute z-20 grid place-items-center rounded-full bg-gradient-to-br ${powerUp.tone} text-[10px] font-black text-slate-950 shadow-xl shadow-cyan-400/30 ring-2 ring-white/40`}
              style={{
                left: `${((powerUp.x - 14) / WIDTH) * 100}%`,
                top: `${((powerUp.y - 14) / HEIGHT) * 100}%`,
                width: `${(28 / WIDTH) * 100}%`,
                height: `${(28 / HEIGHT) * 100}%`
              }}
              title={powerUp.label}
            >
              {powerUp.key === 'machine' ? 'MG' : powerUp.key === 'spread' ? 'S' : '2X'}
            </span>
          ))}

          {enemies.map(enemy => (
            <span
              key={enemy.id}
              className={`absolute z-10 grid place-items-center bg-gradient-to-br ${enemy.tone} text-white shadow-xl shadow-rose-500/30`}
              style={{
                left: `${((enemy.x - (enemy.size || ENEMY_SIZE) / 2) / WIDTH) * 100}%`,
                top: `${((enemy.y - (enemy.size || ENEMY_SIZE) / 2) / HEIGHT) * 100}%`,
                width: `${((enemy.size || ENEMY_SIZE) / WIDTH) * 100}%`,
                height: `${((enemy.size || ENEMY_SIZE) / HEIGHT) * 100}%`,
                clipPath: 'polygon(50% 0%, 70% 28%, 100% 42%, 74% 56%, 66% 100%, 50% 78%, 34% 100%, 26% 56%, 0% 42%, 30% 28%)'
              }}
            >
              <Plane size={enemy.type === 'twin' ? 18 : 16} className="rotate-180 drop-shadow" />
            </span>
          ))}

          <span
            className="absolute z-20 grid place-items-center bg-gradient-to-br from-cyan-200 via-sky-500 to-indigo-700 text-white shadow-2xl shadow-cyan-300/50"
            style={{
              left: `${((playerX - PLAYER_SIZE / 2) / WIDTH) * 100}%`,
              top: `${((PLAYER_Y - PLAYER_SIZE / 2) / HEIGHT) * 100}%`,
              width: `${(PLAYER_SIZE / WIDTH) * 100}%`,
              height: `${(PLAYER_SIZE / HEIGHT) * 100}%`,
              clipPath: 'polygon(50% 0%, 63% 30%, 96% 45%, 63% 57%, 56% 100%, 50% 82%, 44% 100%, 37% 57%, 4% 45%, 37% 30%)'
            }}
          >
            <span className="absolute top-[18%] h-[16%] w-[18%] rounded-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
          </span>

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
