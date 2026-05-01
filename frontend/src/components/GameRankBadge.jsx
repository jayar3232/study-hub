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
    glow: 'shadow-slate-500/30'
  },
  bronze: {
    gradient: 'from-orange-300 via-amber-700 to-stone-950',
    ring: 'ring-orange-300/70 dark:ring-orange-500/50',
    soft: 'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200',
    glow: 'shadow-orange-500/35'
  },
  silver: {
    gradient: 'from-zinc-100 via-zinc-400 to-zinc-950',
    ring: 'ring-zinc-300/80 dark:ring-zinc-400/50',
    soft: 'bg-zinc-50 text-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-100',
    glow: 'shadow-zinc-400/35'
  },
  gold: {
    gradient: 'from-yellow-200 via-amber-500 to-orange-950',
    ring: 'ring-yellow-300/80 dark:ring-yellow-500/50',
    soft: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-100',
    glow: 'shadow-yellow-500/40'
  },
  platinum: {
    gradient: 'from-cyan-200 via-sky-500 to-blue-950',
    ring: 'ring-cyan-300/80 dark:ring-cyan-500/50',
    soft: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100',
    glow: 'shadow-cyan-500/40'
  },
  epic: {
    gradient: 'from-fuchsia-300 via-violet-600 to-indigo-950',
    ring: 'ring-fuchsia-300/80 dark:ring-fuchsia-500/50',
    soft: 'bg-fuchsia-50 text-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-100',
    glow: 'shadow-fuchsia-500/40'
  },
  mythic: {
    gradient: 'from-rose-300 via-pink-600 to-purple-950',
    ring: 'ring-rose-300/80 dark:ring-rose-500/50',
    soft: 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-100',
    glow: 'shadow-rose-500/40'
  },
  apex: {
    gradient: 'from-lime-200 via-emerald-500 to-cyan-950',
    ring: 'ring-emerald-300/80 dark:ring-emerald-500/50',
    soft: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
    glow: 'shadow-emerald-500/40'
  }
};

const sizeMap = {
  sm: { shell: 'h-11 w-11', target: 17, crown: 9, star: 8 },
  md: { shell: 'h-16 w-16', target: 24, crown: 12, star: 10 },
  lg: { shell: 'h-24 w-24', target: 36, crown: 16, star: 13 }
};

const rankPower = {
  recruit: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  epic: 5,
  mythic: 6,
  apex: 7
};

export const getGamePalette = (rank) => palettes[rank?.key] || palettes.recruit;

export function GameRankEmblem({ rank = fallbackRank, size = 'md', animated = false, stars }) {
  const palette = getGamePalette(rank);
  const sizes = sizeMap[size] || sizeMap.md;
  const MotionTag = animated ? motion.div : 'div';
  const apexStars = Number(stars ?? rank?.apexStars ?? 0);
  const apexBoost = rank?.key === 'apex' ? Math.min(10, apexStars) : 0;
  const power = (rankPower[rank?.key] || 0) + (apexBoost * 0.35);
  const scale = 1 + (power * (size === 'sm' ? 0.023 : 0.038));
  const glowOpacity = Math.min(0.98, 0.25 + (power * 0.075));
  const glowBlur = 18 + (power * 5.5);
  const visibleStars = Math.min(5, apexStars);

  return (
    <MotionTag
      {...(animated ? {
        animate: { y: [0, -5, 0], rotate: [0, 1.5, -1.5, 0], scale: [scale, scale + 0.035, scale] },
        transition: { duration: 3.1, repeat: Infinity, ease: 'easeInOut' }
      } : { style: { transform: `scale(${scale})` } })}
      className={`relative ${sizes.shell} shrink-0`}
      title={rank?.name || fallbackRank.name}
    >
      <div className={`absolute inset-[-18%] rounded-full bg-gradient-to-br ${palette.gradient} blur-2xl`} style={{ opacity: glowOpacity, filter: `blur(${glowBlur}px)` }} />
      {apexStars > 0 && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: Math.max(5, 12 - apexBoost), repeat: Infinity, ease: 'linear' }}
          className="absolute inset-[-32%] rounded-full bg-[conic-gradient(from_90deg,transparent,rgba(250,204,21,0.75),transparent,rgba(34,211,238,0.75),transparent)] opacity-80 blur-sm"
        />
      )}
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${palette.gradient} opacity-35 blur-xl`} />
      <div className={`relative flex h-full w-full items-center justify-center rounded-[1.35rem] bg-gradient-to-br ${palette.gradient} text-white shadow-2xl ${palette.glow} ring-2 ${palette.ring}`}>
        <div className="absolute inset-1 rounded-[1.05rem] border border-white/25" />
        <div className="absolute h-[72%] w-[72%] rounded-full border-2 border-white/20" />
        <div className="absolute h-[42%] w-[42%] rounded-full border-2 border-white/25" />
        {power >= 3 && <Star size={sizes.star} className="absolute left-[22%] top-[22%] text-white/80" fill="currentColor" />}
        {power >= 5 && <Star size={sizes.star + 2} className="absolute right-[18%] top-[18%] text-yellow-100" fill="currentColor" />}
        {apexStars > 0 && Array.from({ length: visibleStars }).map((_, index) => (
          <motion.span
            key={index}
            animate={animated ? { opacity: [0.45, 1, 0.45], scale: [0.9, 1.25, 0.9] } : undefined}
            transition={animated ? { duration: 1.6 + (index * 0.15), repeat: Infinity, ease: 'easeInOut' } : undefined}
            className="absolute rounded-full bg-yellow-200 shadow-[0_0_12px_rgba(250,204,21,0.95)]"
            style={{
              width: sizes.star * 0.45,
              height: sizes.star * 0.45,
              left: `${18 + (index * 15)}%`,
              bottom: `${14 + ((index % 2) * 9)}%`
            }}
          />
        ))}
        <Crown size={sizes.crown} className="absolute top-[18%] text-yellow-200 drop-shadow" fill="currentColor" />
        <Target size={sizes.target} className="relative z-10 drop-shadow" strokeWidth={2.5} />
        <Zap size={sizes.star} className="absolute bottom-[22%] right-[24%] text-yellow-200" fill="currentColor" />
      </div>
      {apexStars > 0 && (
        <span className="absolute -bottom-2 -right-2 z-20 inline-flex min-w-6 items-center justify-center gap-0.5 rounded-full border border-yellow-200 bg-gray-950 px-1.5 py-1 text-[10px] font-black text-yellow-100 shadow-lg shadow-yellow-500/30">
          <Star size={10} fill="currentColor" />
          {apexStars > 99 ? '99+' : apexStars}
        </span>
      )}
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
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-4">
        <GameRankEmblem rank={rank} size="md" animated stars={apexStars} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-normal text-gray-500 dark:text-gray-400">
            <Star size={14} className="text-yellow-500" fill="currentColor" />
            Game Rank
          </p>
          <h3 className="mt-1 truncate text-xl font-black text-gray-950 dark:text-white">
            {rank.name}{isApex && apexStars > 0 ? ` - Star ${apexStars}` : ''}
          </h3>
          <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
            {stats?.season?.label || 'Current Season'} - {stats?.highScore || 0} best score
          </p>
        </div>
      </div>

      <div className={`mt-4 grid gap-2 ${isApex ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
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
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
            <span>{progressLabel}</span>
            <span>{progressValue}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressValue}%` }}
              transition={{ duration: 0.75, ease: 'easeOut' }}
              className={`h-full rounded-full bg-gradient-to-r ${palette.gradient} ${isApex ? 'shadow-[0_0_16px_rgba(250,204,21,0.65)]' : ''}`}
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
