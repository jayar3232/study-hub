import React from 'react';
import { motion } from 'framer-motion';
import { Award, Crown, Sparkles, Star } from 'lucide-react';

const rankPalettes = {
  rookie: {
    ring: 'ring-slate-300/70 dark:ring-slate-600/70',
    text: 'text-slate-700 dark:text-slate-200',
    soft: 'bg-slate-50 dark:bg-slate-900/40',
    gradient: 'from-slate-500 via-slate-700 to-slate-950',
    glow: 'shadow-slate-500/25'
  },
  bronze: {
    ring: 'ring-amber-700/30 dark:ring-amber-500/40',
    text: 'text-amber-800 dark:text-amber-200',
    soft: 'bg-amber-50 dark:bg-amber-950/30',
    gradient: 'from-amber-400 via-orange-600 to-stone-900',
    glow: 'shadow-amber-500/30'
  },
  silver: {
    ring: 'ring-zinc-300/80 dark:ring-zinc-500/50',
    text: 'text-zinc-700 dark:text-zinc-100',
    soft: 'bg-zinc-50 dark:bg-zinc-900/50',
    gradient: 'from-zinc-100 via-zinc-400 to-zinc-900',
    glow: 'shadow-zinc-400/30'
  },
  gold: {
    ring: 'ring-yellow-300/80 dark:ring-yellow-500/50',
    text: 'text-yellow-800 dark:text-yellow-100',
    soft: 'bg-yellow-50 dark:bg-yellow-950/30',
    gradient: 'from-yellow-200 via-amber-500 to-orange-900',
    glow: 'shadow-yellow-500/35'
  },
  platinum: {
    ring: 'ring-cyan-300/80 dark:ring-cyan-500/50',
    text: 'text-cyan-800 dark:text-cyan-100',
    soft: 'bg-cyan-50 dark:bg-cyan-950/30',
    gradient: 'from-cyan-100 via-sky-400 to-indigo-900',
    glow: 'shadow-cyan-500/35'
  },
  epic: {
    ring: 'ring-violet-300/80 dark:ring-violet-500/50',
    text: 'text-violet-800 dark:text-violet-100',
    soft: 'bg-violet-50 dark:bg-violet-950/30',
    gradient: 'from-violet-300 via-fuchsia-500 to-indigo-950',
    glow: 'shadow-violet-500/35'
  },
  mythic: {
    ring: 'ring-rose-300/80 dark:ring-rose-500/50',
    text: 'text-rose-800 dark:text-rose-100',
    soft: 'bg-rose-50 dark:bg-rose-950/30',
    gradient: 'from-rose-300 via-pink-600 to-purple-950',
    glow: 'shadow-rose-500/35'
  },
  legend: {
    ring: 'ring-orange-300/80 dark:ring-orange-500/50',
    text: 'text-orange-800 dark:text-orange-100',
    soft: 'bg-orange-50 dark:bg-orange-950/30',
    gradient: 'from-orange-200 via-red-500 to-fuchsia-950',
    glow: 'shadow-orange-500/40'
  }
};

const sizeClasses = {
  sm: {
    wrap: 'h-11 w-11',
    icon: 16,
    star: 'h-3 w-3',
    letter: 'text-[11px]'
  },
  md: {
    wrap: 'h-16 w-16',
    icon: 22,
    star: 'h-4 w-4',
    letter: 'text-sm'
  },
  lg: {
    wrap: 'h-24 w-24',
    icon: 34,
    star: 'h-5 w-5',
    letter: 'text-lg'
  }
};

const fallbackRank = {
  key: 'rookie',
  name: 'Rookie Operator',
  shortName: 'Rookie'
};

export const getRankPalette = (rank) => rankPalettes[rank?.key] || rankPalettes.rookie;

export function RankEmblem({ rank = fallbackRank, size = 'md', animated = false }) {
  const palette = getRankPalette(rank);
  const classes = sizeClasses[size] || sizeClasses.md;
  const rankInitial = (rank?.shortName || rank?.name || 'R').charAt(0).toUpperCase();
  const MotionTag = animated ? motion.div : 'div';

  return (
    <MotionTag
      {...(animated ? {
        animate: { y: [0, -4, 0], rotate: [0, -1, 1, 0] },
        transition: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }
      } : {})}
      className={`relative ${classes.wrap} shrink-0`}
      title={rank?.name || fallbackRank.name}
    >
      <div className={`absolute inset-0 rounded-[1.35rem] bg-gradient-to-br ${palette.gradient} opacity-30 blur-xl`} />
      <div
        className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br ${palette.gradient} text-white shadow-xl ${palette.glow} ring-2 ${palette.ring}`}
        style={{ clipPath: 'polygon(50% 0%, 88% 17%, 100% 58%, 73% 100%, 27% 100%, 0% 58%, 12% 17%)' }}
      >
        <div className="absolute inset-[6px] border border-white/25" style={{ clipPath: 'polygon(50% 0%, 88% 17%, 100% 58%, 73% 100%, 27% 100%, 0% 58%, 12% 17%)' }} />
        <div className="absolute -left-5 top-1/2 h-16 w-28 -translate-y-1/2 rotate-[-25deg] bg-white/18 blur-sm" />
        <Award size={classes.icon} className="relative z-10 drop-shadow" strokeWidth={2.4} />
        <span className={`absolute bottom-[18%] z-10 font-black ${classes.letter}`}>{rankInitial}</span>
      </div>
      <span className={`absolute -right-1 top-1 flex ${classes.star} items-center justify-center rounded-full bg-white text-yellow-500 shadow-md ring-1 ring-yellow-100 dark:bg-gray-950 dark:ring-yellow-700/40`}>
        <Star size={size === 'lg' ? 12 : 9} fill="currentColor" />
      </span>
    </MotionTag>
  );
}

export default function RankBadge({ stats, compact = false, showProgress = true }) {
  const rank = stats?.rank || fallbackRank;
  const nextRank = stats?.nextRank;
  const palette = getRankPalette(rank);

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${palette.soft} ${palette.text} ${palette.ring}`}>
        <Crown size={13} />
        {rank.shortName || rank.name}
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900`}>
      <div className="flex items-center gap-4">
        <RankEmblem rank={rank} size="md" animated />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-normal text-gray-500 dark:text-gray-400">
            <Sparkles size={14} className="text-pink-500" />
            Work Rank
          </p>
          <h3 className="mt-1 truncate text-xl font-black text-gray-950 dark:text-white">{rank.name}</h3>
          <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
            {stats?.xp || 0} XP · {stats?.completedTasks || 0} completed tasks
          </p>
        </div>
      </div>

      {showProgress && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
            <span>{nextRank ? `${stats?.xpToNext || 0} XP to ${nextRank.shortName}` : 'Max rank reached'}</span>
            <span>{stats?.progress ?? 0}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats?.progress ?? 0}%` }}
              transition={{ duration: 0.75, ease: 'easeOut' }}
              className={`h-full rounded-full bg-gradient-to-r ${palette.gradient}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
