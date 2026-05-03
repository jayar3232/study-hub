import React, { useEffect, useMemo, useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { Crown, Star, Target, Trophy, Zap } from 'lucide-react';

const fallbackRank = {
  key: 'recruit',
  name: 'Arena Recruit',
  shortName: 'Recruit'
};

const palettes = {
  recruit: {
    gradient: 'from-slate-500 via-gray-700 to-gray-950',
    ring: 'ring-slate-300/70 dark:ring-slate-500/50',
    soft: 'bg-slate-50 text-slate-700 dark:bg-slate-950/40 dark:text-slate-200',
    glow: 'rgba(100,116,139,0.28)',
    spark: 'bg-slate-200'
  },
  iron: {
    gradient: 'from-stone-300 via-stone-600 to-zinc-950',
    ring: 'ring-stone-300/70 dark:ring-stone-500/50',
    soft: 'bg-stone-50 text-stone-800 dark:bg-stone-950/40 dark:text-stone-100',
    glow: 'rgba(120,113,108,0.32)',
    spark: 'bg-stone-200'
  },
  bronze: {
    gradient: 'from-orange-300 via-amber-700 to-stone-950',
    ring: 'ring-orange-300/70 dark:ring-orange-500/50',
    soft: 'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200',
    glow: 'rgba(249,115,22,0.36)',
    spark: 'bg-orange-200'
  },
  silver: {
    gradient: 'from-zinc-100 via-zinc-400 to-zinc-950',
    ring: 'ring-zinc-300/80 dark:ring-zinc-400/50',
    soft: 'bg-zinc-50 text-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-100',
    glow: 'rgba(161,161,170,0.4)',
    spark: 'bg-zinc-100'
  },
  gold: {
    gradient: 'from-yellow-200 via-amber-500 to-orange-950',
    ring: 'ring-yellow-300/80 dark:ring-yellow-500/50',
    soft: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-100',
    glow: 'rgba(245,158,11,0.48)',
    spark: 'bg-yellow-200'
  },
  platinum: {
    gradient: 'from-cyan-200 via-sky-500 to-blue-950',
    ring: 'ring-cyan-300/80 dark:ring-cyan-500/50',
    soft: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100',
    glow: 'rgba(34,211,238,0.54)',
    spark: 'bg-cyan-200'
  },
  diamond: {
    gradient: 'from-sky-100 via-blue-400 to-indigo-950',
    ring: 'ring-sky-300/80 dark:ring-sky-500/50',
    soft: 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-100',
    glow: 'rgba(96,165,250,0.6)',
    spark: 'bg-sky-200'
  },
  epic: {
    gradient: 'from-fuchsia-300 via-violet-600 to-indigo-950',
    ring: 'ring-fuchsia-300/80 dark:ring-fuchsia-500/50',
    soft: 'bg-fuchsia-50 text-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-100',
    glow: 'rgba(217,70,239,0.66)',
    spark: 'bg-fuchsia-200'
  },
  legend: {
    gradient: 'from-violet-200 via-purple-600 to-indigo-950',
    ring: 'ring-violet-300/80 dark:ring-violet-500/50',
    soft: 'bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-100',
    glow: 'rgba(139,92,246,0.7)',
    spark: 'bg-violet-200'
  },
  mythic: {
    gradient: 'from-rose-300 via-pink-600 to-purple-950',
    ring: 'ring-rose-300/80 dark:ring-rose-500/50',
    soft: 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-100',
    glow: 'rgba(244,63,94,0.76)',
    spark: 'bg-rose-200'
  },
  dragon: {
    gradient: 'from-orange-200 via-red-500 to-zinc-950',
    ring: 'ring-orange-300/80 dark:ring-orange-500/60',
    soft: 'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-100',
    glow: 'rgba(249,115,22,0.82)',
    spark: 'bg-orange-200'
  },
  inferno: {
    gradient: 'from-yellow-200 via-orange-500 to-red-950',
    ring: 'ring-orange-300/90 dark:ring-orange-500/70',
    soft: 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-100',
    glow: 'rgba(251,146,60,0.88)',
    spark: 'bg-yellow-200'
  },
  celestial: {
    gradient: 'from-amber-100 via-fuchsia-500 to-cyan-950',
    ring: 'ring-amber-200/90 dark:ring-amber-400/70',
    soft: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
    glow: 'rgba(251,191,36,0.9)',
    spark: 'bg-amber-100'
  },
  apex: {
    gradient: 'from-yellow-100 via-orange-400 to-fuchsia-950',
    ring: 'ring-yellow-200/90 dark:ring-yellow-400/80',
    soft: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-100',
    glow: 'rgba(250,204,21,0.95)',
    spark: 'bg-yellow-100'
  },
  'mythical-vanguard': {
    gradient: 'from-orange-200 via-red-500 to-amber-950',
    ring: 'ring-orange-200/90 dark:ring-orange-400/80',
    soft: 'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-100',
    glow: 'rgba(249,115,22,0.96)',
    spark: 'bg-orange-100'
  },
  'mythical-legend': {
    gradient: 'from-cyan-200 via-violet-500 to-indigo-950',
    ring: 'ring-violet-200/90 dark:ring-violet-400/80',
    soft: 'bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-100',
    glow: 'rgba(139,92,246,0.98)',
    spark: 'bg-cyan-100'
  },
  'mythic-warden': {
    gradient: 'from-pink-200 via-rose-500 to-slate-950',
    ring: 'ring-pink-200/90 dark:ring-pink-400/80',
    soft: 'bg-pink-50 text-pink-800 dark:bg-pink-950/40 dark:text-pink-100',
    glow: 'rgba(236,72,153,0.98)',
    spark: 'bg-pink-100'
  },
  'mythic-guardian': {
    gradient: 'from-sky-100 via-cyan-500 to-blue-950',
    ring: 'ring-sky-200/90 dark:ring-sky-400/80',
    soft: 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-100',
    glow: 'rgba(14,165,233,0.98)',
    spark: 'bg-sky-100'
  },
  'mythic-ascendant': {
    gradient: 'from-fuchsia-200 via-purple-600 to-slate-950',
    ring: 'ring-fuchsia-200/90 dark:ring-fuchsia-400/80',
    soft: 'bg-fuchsia-50 text-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-100',
    glow: 'rgba(217,70,239,0.98)',
    spark: 'bg-fuchsia-100'
  },
  'mythic-immortal': {
    gradient: 'from-amber-100 via-red-500 to-black',
    ring: 'ring-red-200/90 dark:ring-red-400/80',
    soft: 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-100',
    glow: 'rgba(239,68,68,1)',
    spark: 'bg-amber-100'
  },
  'eternal-legend': {
    gradient: 'from-violet-100 via-indigo-500 to-black',
    ring: 'ring-violet-200/90 dark:ring-violet-400/80',
    soft: 'bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-100',
    glow: 'rgba(99,102,241,1)',
    spark: 'bg-violet-100'
  },
  'radiant-overlord': {
    gradient: 'from-yellow-100 via-orange-400 to-fuchsia-950',
    ring: 'ring-yellow-200/90 dark:ring-yellow-400/80',
    soft: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-100',
    glow: 'rgba(250,204,21,1)',
    spark: 'bg-yellow-100'
  },
  'celestial-monarch': {
    gradient: 'from-cyan-100 via-fuchsia-500 to-indigo-950',
    ring: 'ring-cyan-200/90 dark:ring-cyan-400/80',
    soft: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100',
    glow: 'rgba(34,211,238,1)',
    spark: 'bg-cyan-100'
  },
  'sovereign-origin': {
    gradient: 'from-white via-yellow-300 to-fuchsia-950',
    ring: 'ring-yellow-100 dark:ring-yellow-300/90',
    soft: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-100',
    glow: 'rgba(255,255,255,1)',
    spark: 'bg-white'
  }
};

const sizeMap = {
  sm: { shell: 'h-12 w-12', icon: 22, crown: 10, star: 8 },
  md: { shell: 'h-16 w-16', icon: 30, crown: 13, star: 10 },
  lg: { shell: 'h-24 w-24', icon: 45, crown: 18, star: 13 }
};

const rankPower = {
  recruit: 0,
  iron: 1,
  bronze: 2,
  silver: 3,
  gold: 4,
  platinum: 5,
  diamond: 6,
  epic: 7,
  legend: 8,
  mythic: 9,
  dragon: 10,
  inferno: 11,
  celestial: 12,
  apex: 13,
  'mythical-vanguard': 14,
  'mythical-legend': 15,
  'mythic-warden': 16,
  'mythic-guardian': 17,
  'mythic-ascendant': 18,
  'mythic-immortal': 19,
  'eternal-legend': 20,
  'radiant-overlord': 21,
  'celestial-monarch': 22,
  'sovereign-origin': 24
};

const MAX_APEX_STARS = 1000;
const starDivisionKeys = new Set(['mythic-warden', 'mythic-guardian', 'mythic-ascendant', 'mythic-immortal', 'eternal-legend', 'radiant-overlord', 'celestial-monarch', 'sovereign-origin']);
const starRankKeys = new Set(['apex', 'mythical-vanguard', 'mythical-legend', ...starDivisionKeys]);
const cycloneRankKeys = new Set(['mythical-legend', 'mythic-ascendant', 'mythic-immortal', 'eternal-legend', 'radiant-overlord', 'celestial-monarch', 'sovereign-origin']);
const wingRankKeys = new Set(['mythical-vanguard', 'mythical-legend', 'mythic-immortal', 'eternal-legend', 'radiant-overlord', 'celestial-monarch', 'sovereign-origin']);

export const getGamePalette = (rank) => palettes[rank?.key] || palettes.recruit;

export const getProfileFrameClass = (stats) => {
  const tier = Math.min(10, Math.max(0, Number(stats?.profileBorderTier ?? stats?.rank?.profileBorderTier ?? Math.floor((stats?.apexStars || stats?.rank?.apexStars || 0) / 100))));
  const frames = [
    'ring-gray-200 dark:ring-gray-700',
    'ring-cyan-300 shadow-cyan-500/20',
    'ring-blue-400 shadow-blue-500/25',
    'ring-pink-400 shadow-pink-500/30',
    'ring-violet-400 shadow-violet-500/35',
    'ring-fuchsia-400 shadow-fuchsia-500/40',
    'ring-orange-400 shadow-orange-500/45',
    'ring-red-400 shadow-red-500/50',
    'ring-yellow-300 shadow-yellow-500/55',
    'ring-cyan-200 shadow-cyan-300/60',
    'ring-white shadow-white/70'
  ];
  return `${frames[tier] || frames[0]} ring-4 shadow-xl`;
};

export function GameRankEmblem({ rank = fallbackRank, size = 'md', animated = false, stars }) {
  const palette = getGamePalette(rank);
  const sizes = sizeMap[size] || sizeMap.md;
  const MotionTag = animated ? motion.div : 'div';
  const apexStars = Number(stars ?? rank?.apexStars ?? 0);
  const apexBoost = starRankKeys.has(rank?.key) ? Math.min(18, apexStars / 18) : 0;
  const power = (rankPower[rank?.key] || 0) + (apexBoost * 0.28);
  const hasGlow = power >= 5;
  const isCycloneRank = cycloneRankKeys.has(rank?.key);
  const hasWingAura = wingRankKeys.has(rank?.key);
  const isLegendStar = rank?.key === 'mythical-legend' || starDivisionKeys.has(rank?.key);
  const isMythic = power >= 9;
  const lowScale = size === 'sm' ? 0.78 : size === 'lg' ? 0.86 : 0.82;
  const midScale = size === 'sm' ? 0.9 : size === 'lg' ? 1 : 0.94;
  const maxScale = size === 'sm' ? 1.2 : size === 'lg' ? 1.42 : 1.32;
  const scale = power <= 2
    ? lowScale
    : power <= 4
      ? midScale
      : power <= 6
        ? 1
        : Math.min(maxScale, 1 + ((power - 6) * (size === 'sm' ? 0.025 : 0.035)));
  const glowOpacity = !hasGlow ? 0 : isCycloneRank ? Math.min(0.95, 0.42 + ((power - 10) * 0.07)) : Math.min(0.28, 0.08 + (power * 0.018));
  const sparkCount = isLegendStar ? Math.min(14, 8 + Math.floor(apexStars / 50)) : isCycloneRank ? 6 : 0;
  const visibleStars = Math.min(5, apexStars);
  const emblemShape = 'rounded-[1.35rem]';
  const shouldAnimate = animated && hasGlow;

  const icon = (
    <Target
      size={sizes.icon + (power >= 7 ? 6 : 2)}
      className="relative z-20 drop-shadow-[0_0_10px_rgba(255,255,255,0.42)]"
      strokeWidth={2.65}
    />
  );

  return (
    <MotionConfig reducedMotion="never">
      <MotionTag
        {...(animated ? {
          animate: shouldAnimate
            ? { y: [0, -3, 0], scale: [scale, scale + 0.025, scale] }
            : { scale },
          transition: shouldAnimate
            ? { duration: 3, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.2 }
        } : { style: { transform: `scale(${scale})` } })}
        className={`rank-motion-zone relative isolate ${sizes.shell} shrink-0 overflow-visible`}
        style={{ willChange: shouldAnimate ? 'transform' : 'auto' }}
        title={rank?.name || fallbackRank.name}
      >
      {hasGlow && (
        <div
          className="absolute inset-[-30%] rounded-full"
          style={{
            background: `radial-gradient(circle, ${palette.glow}, transparent 68%)`,
            opacity: glowOpacity
          }}
        />
      )}

      {isCycloneRank && (
        <motion.div
          animate={shouldAnimate ? { rotate: 360, scale: [1, 1.08, 1] } : undefined}
          transition={shouldAnimate ? {
            rotate: { duration: Math.max(5.8, 9.5 - (power * 0.25)), repeat: Infinity, ease: 'linear' },
            scale: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
          } : undefined}
          className="absolute inset-[-28%] rounded-full bg-[conic-gradient(from_90deg,transparent_0deg,rgba(34,211,238,0.72)_48deg,transparent_100deg,rgba(236,72,153,0.74)_164deg,transparent_220deg,rgba(250,204,21,0.78)_288deg,transparent_360deg)] opacity-80"
        />
      )}

      {hasWingAura && (
        <>
          {['left', 'right'].map(side => (
            <motion.span
              key={side}
              animate={shouldAnimate ? { opacity: [0.62, 1, 0.62], scaleX: [0.92, 1.08, 0.92] } : undefined}
              transition={shouldAnimate ? { duration: isLegendStar ? 2.4 : 2.8, repeat: Infinity, ease: 'easeInOut' } : undefined}
              className={`absolute top-[18%] z-10 h-[64%] w-[58%] rounded-full blur-[1px] ${
                isLegendStar
                  ? 'bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.8),rgba(34,211,238,0.25)_54%,transparent_72%)]'
                  : 'bg-[radial-gradient(ellipse_at_center,rgba(251,146,60,0.8),rgba(239,68,68,0.25)_54%,transparent_72%)]'
              }`}
              style={{
                [side]: '-34%',
                clipPath: side === 'left'
                  ? 'polygon(100% 10%, 10% 30%, 0 70%, 100% 92%)'
                  : 'polygon(0 10%, 90% 30%, 100% 70%, 0 92%)'
              }}
            />
          ))}
        </>
      )}

      {sparkCount > 0 && Array.from({ length: sparkCount }).map((_, index) => (
        <motion.span
          key={`spark-${index}`}
          animate={shouldAnimate ? { opacity: [0.18, 1, 0.18], scale: [0.7, 1.28, 0.7], y: [0, -5, 0] } : undefined}
          transition={shouldAnimate ? { duration: 1.4 + (index * 0.05), repeat: Infinity, ease: 'easeInOut', delay: index * 0.08 } : undefined}
          className={`absolute z-30 rounded-full ${palette.spark} shadow-[0_0_10px_rgba(250,204,21,0.78)]`}
          style={{
            width: Math.max(2, sizes.star * 0.34),
            height: Math.max(2, sizes.star * 0.34),
            left: `${7 + ((index * 23) % 86)}%`,
            top: `${7 + ((index * 31) % 82)}%`
          }}
        />
      ))}

      <div
        className={`relative z-20 flex h-full w-full items-center justify-center ${emblemShape} bg-gradient-to-br ${palette.gradient} text-white ${hasGlow ? 'shadow-2xl' : 'shadow-md shadow-black/10 dark:shadow-black/40'} ring-2 ${palette.ring}`}
        style={hasGlow ? { boxShadow: isCycloneRank ? `0 0 ${18 + (power * 2)}px ${palette.glow}` : `0 0 12px ${palette.glow}` } : undefined}
      >
        <div className="absolute inset-1 rounded-[inherit] border border-white/25" />
        <div className="absolute inset-[17%] rounded-[inherit] border border-white/20" />
        <div className="absolute left-[18%] top-[13%] h-[18%] w-[64%] rounded-full bg-white/35" />
        <div className="absolute top-[11%] z-20 flex items-center justify-center gap-0.5">
          {(power >= 5 ? [0, 1, 2] : [0]).map(item => (
            <Star
              key={item}
              size={sizes.star + (power >= 7 ? 1 : 0)}
              className={item === 1 ? 'text-yellow-100' : 'text-white/85'}
              fill="currentColor"
            />
          ))}
        </div>
        {isMythic && <Crown size={sizes.crown + 2} className="absolute -top-[8%] right-[8%] z-30 text-yellow-100 drop-shadow" fill="currentColor" />}
        {icon}
        <Zap size={sizes.star} className="absolute bottom-[18%] right-[21%] z-20 text-yellow-100" fill="currentColor" />
      </div>

      {apexStars > 0 && (
        <span className="absolute -bottom-2 -right-2 z-30 inline-flex min-w-6 items-center justify-center gap-0.5 rounded-full border border-yellow-200 bg-gray-950 px-1.5 py-1 text-[10px] font-black text-yellow-100 shadow-lg shadow-yellow-500/30">
          <Star size={10} fill="currentColor" />
          {apexStars >= MAX_APEX_STARS ? `${MAX_APEX_STARS}` : apexStars}
        </span>
      )}

      {visibleStars > 0 && Array.from({ length: visibleStars }).map((_, index) => (
        <motion.span
          key={`apex-${index}`}
          animate={shouldAnimate ? { opacity: [0.45, 1, 0.45], scale: [0.9, 1.25, 0.9] } : undefined}
          transition={shouldAnimate ? { duration: 1.6 + (index * 0.15), repeat: Infinity, ease: 'easeInOut' } : undefined}
          className="absolute rounded-full bg-yellow-200 shadow-[0_0_12px_rgba(250,204,21,0.95)]"
          style={{
            width: sizes.star * 0.45,
            height: sizes.star * 0.45,
            left: `${18 + (index * 15)}%`,
            bottom: `${10 + ((index % 2) * 8)}%`
          }}
        />
      ))}
      </MotionTag>
    </MotionConfig>
  );
}

export default function GameRankBadge({ stats, compact = false, showProgress = true }) {
  const rank = stats?.rank || fallbackRank;
  const highestRank = stats?.highestRank;
  const nextRank = stats?.nextRank;
  const palette = getGamePalette(rank);
  const apexStars = Number(stats?.apexStars ?? rank?.apexStars ?? 0);
  const isApex = starRankKeys.has(rank?.key);
  const maxApexStars = Number(stats?.maxApexStars || rank?.maxApexStars || MAX_APEX_STARS);
  const cardPower = (rankPower[rank?.key] || 0) + (isApex ? Math.min(18, apexStars / 18) * 0.28 : 0);
  const showCardAura = cardPower >= 7;
  const progressValue = nextRank ? (stats?.progress ?? 0) : isApex ? Math.min(100, stats?.apexStarProgress ?? rank?.apexStarProgress ?? 0) : 100;
  const progressLabel = nextRank
    ? `${stats?.xpToNext || 0} pts to ${nextRank.shortName}`
    : isApex
      ? apexStars >= maxApexStars
        ? `Max star power reached (${maxApexStars})`
        : `${stats?.apexStarXpToNext || rank?.apexStarXpToNext || 0} pts to Star ${apexStars + 1}`
      : 'Max game rank reached';
  const milestone = useMemo(() => Math.floor(apexStars / 100) * 100, [apexStars]);
  const [rankUpMilestone, setRankUpMilestone] = useState(null);

  useEffect(() => {
    if (compact || milestone < 100) return undefined;
    const seasonId = stats?.season?.id || 'current';
    const storageKey = `syncrova-rank-milestone-${seasonId}`;
    const legacyStorageKey = `studenthub-rank-milestone-${seasonId}`;
    const previous = Number(localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey) || 0);
    if (milestone <= previous) return undefined;

    localStorage.setItem(storageKey, String(milestone));
    setRankUpMilestone(milestone);
    const timer = window.setTimeout(() => setRankUpMilestone(null), 4200);
    return () => window.clearTimeout(timer);
  }, [compact, milestone, stats?.season?.id]);

  if (compact) {
    return (
      <span className={`rank-motion-zone inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ring-1 ${palette.soft} ${palette.ring}`}>
        <Trophy size={13} />
        {rank.shortName || rank.name}
        {isApex && apexStars > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-400/20 px-1.5 py-0.5 text-[10px] text-yellow-700 dark:text-yellow-200">
            <Star size={10} fill="currentColor" />
            {apexStars}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="rank-motion-zone relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {rankUpMilestone && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] border border-white/15 bg-gray-950 p-6 text-center text-white shadow-2xl shadow-pink-500/25">
            <div className="mx-auto grid h-28 w-28 place-items-center">
              <GameRankEmblem rank={rank} size="lg" animated stars={apexStars} />
            </div>
            <p className="mt-5 text-xs font-black uppercase text-pink-200">Rank milestone reached</p>
            <h2 className="mt-2 text-3xl font-black tracking-normal">You reached {rankUpMilestone} stars</h2>
            <p className="mt-2 text-sm font-semibold text-white/65">Keep it up. Your profile border and rank aura just got stronger.</p>
            <button
              type="button"
              onClick={() => setRankUpMilestone(null)}
              className="mt-5 rounded-2xl bg-white px-5 py-3 text-sm font-black text-gray-950 transition hover:bg-pink-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}
      {showCardAura && (
        <div
          className="pointer-events-none absolute -left-12 -top-14 h-36 w-36 rounded-full"
          style={{ background: `radial-gradient(circle, ${palette.glow}, transparent 72%)`, opacity: 0.42 }}
        />
      )}
      <div className="relative z-10 flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center">
          <GameRankEmblem rank={rank} size="md" animated stars={apexStars} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-normal text-gray-500 dark:text-gray-400">
            <Star size={14} className="text-yellow-500" fill="currentColor" />
            Division Rank
          </p>
          <h3 className="mt-1 truncate text-xl font-black text-gray-950 dark:text-white">
            {rank.name}{isApex && apexStars > 0 ? ` - Star ${apexStars}` : ''}
          </h3>
          <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
            {stats?.season?.label || 'Current Season'} - {stats?.highScore || 0} best score
          </p>
        </div>
      </div>

      <div className={`relative z-10 mt-4 grid gap-2 ${isApex ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950/50">
          <p className="text-xs font-black uppercase text-gray-500 dark:text-gray-400">Highest Rank</p>
          <p className="mt-1 truncate text-sm font-black text-gray-950 dark:text-white">{highestRank?.name || rank.name}</p>
        </div>
        {isApex && (
          <div className="rounded-xl bg-yellow-50 p-3 ring-1 ring-yellow-100 dark:bg-yellow-950/20 dark:ring-yellow-900/50">
            <p className="text-xs font-black uppercase text-yellow-700 dark:text-yellow-200">Apex Stars</p>
            <p className="mt-1 truncate text-sm font-black text-gray-950 dark:text-white">{apexStars || 1} glowing star{(apexStars || 1) > 1 ? 's' : ''}</p>
          </div>
        )}
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950/50">
          <p className="text-xs font-black uppercase text-gray-500 dark:text-gray-400">Season Reward</p>
          <p className="mt-1 truncate text-sm font-black text-gray-950 dark:text-white">{stats?.rewards?.current?.title || 'Starter Badge'}</p>
        </div>
      </div>

      {showProgress && (
        <div className="relative z-10 mt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
            <span>{progressLabel}</span>
            <span>{progressValue}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressValue}%` }}
              transition={{ duration: 0.75, ease: 'easeOut' }}
              className={`h-full rounded-full bg-gradient-to-r ${palette.gradient}`}
            />
          </div>
          <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
            Reset floor: {stats?.resetRank?.shortName || 'Recruit'} after the previous 2-month season.
          </p>
        </div>
      )}
    </div>
  );
}
