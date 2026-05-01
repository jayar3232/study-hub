import React from 'react';
import { motion } from 'framer-motion';
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
  apex: 13
};

const cycloneRankKeys = new Set(['celestial', 'apex']);

export const getGamePalette = (rank) => palettes[rank?.key] || palettes.recruit;

export function GameRankEmblem({ rank = fallbackRank, size = 'md', animated = false, stars }) {
  const palette = getGamePalette(rank);
  const sizes = sizeMap[size] || sizeMap.md;
  const MotionTag = animated ? motion.div : 'div';
  const apexStars = Number(stars ?? rank?.apexStars ?? 0);
  const apexBoost = rank?.key === 'apex' ? Math.min(12, apexStars) : 0;
  const power = (rankPower[rank?.key] || 0) + (apexBoost * 0.28);
  const hasGlow = power > 0;
  const isCycloneRank = cycloneRankKeys.has(rank?.key);
  const isMythic = power >= 9;
  const lowScale = size === 'sm' ? 0.78 : size === 'lg' ? 0.86 : 0.82;
  const midScale = size === 'sm' ? 0.9 : size === 'lg' ? 1 : 0.94;
  const maxScale = size === 'sm' ? 1.18 : size === 'lg' ? 1.34 : 1.26;
  const scale = power <= 2
    ? lowScale
    : power <= 4
      ? midScale
      : power <= 6
        ? 1
        : Math.min(maxScale, 1 + ((power - 6) * (size === 'sm' ? 0.025 : 0.035)));
  const glowOpacity = !hasGlow ? 0 : isCycloneRank ? Math.min(0.92, 0.28 + ((power - 10) * 0.08)) : Math.min(0.28, 0.08 + (power * 0.018));
  const sparkCount = isCycloneRank ? Math.min(10, 5 + Math.floor(apexBoost)) : 0;
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
    <MotionTag
      {...(animated ? {
        animate: shouldAnimate
          ? { y: [0, -3, 0], scale: [scale, scale + 0.025, scale] }
          : { scale },
        transition: shouldAnimate
          ? { duration: 3, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.2 }
      } : { style: { transform: `scale(${scale})` } })}
      className={`relative isolate ${sizes.shell} shrink-0 overflow-visible`}
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
          {apexStars > 99 ? '99+' : apexStars}
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
  );
}

export default function GameRankBadge({ stats, compact = false, showProgress = true }) {
  const rank = stats?.rank || fallbackRank;
  const highestRank = stats?.highestRank;
  const nextRank = stats?.nextRank;
  const palette = getGamePalette(rank);
  const apexStars = Number(stats?.apexStars ?? rank?.apexStars ?? 0);
  const isApex = rank?.key === 'apex';
  const cardPower = (rankPower[rank?.key] || 0) + (isApex ? Math.min(12, apexStars) * 0.28 : 0);
  const showCardAura = cardPower >= 7;
  const progressValue = nextRank ? (stats?.progress ?? 0) : isApex ? (stats?.apexStarProgress ?? rank?.apexStarProgress ?? 0) : 100;
  const progressLabel = nextRank
    ? `${stats?.xpToNext || 0} pts to ${nextRank.shortName}`
    : isApex
      ? `${stats?.apexStarXpToNext || rank?.apexStarXpToNext || 0} pts to Apex Star ${apexStars + 1}`
      : 'Max game rank reached';

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ring-1 ${palette.soft} ${palette.ring}`}>
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
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
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
