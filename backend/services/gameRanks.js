const GAME_RANKS = [
  { key: 'recruit', name: 'Arena Recruit', shortName: 'Recruit', minXp: 0 },
  { key: 'bronze', name: 'Bronze Tactician', shortName: 'Bronze', minXp: 1200 },
  { key: 'silver', name: 'Silver Shotcaller', shortName: 'Silver', minXp: 1800 },
  { key: 'gold', name: 'Gold Strategist', shortName: 'Gold', minXp: 2400 },
  { key: 'platinum', name: 'Platinum Vanguard', shortName: 'Platinum', minXp: 3000 },
  { key: 'epic', name: 'Epic Commander', shortName: 'Epic', minXp: 3600 },
  { key: 'mythic', name: 'Mythic Architect', shortName: 'Mythic', minXp: 4300 },
  { key: 'apex', name: 'Apex Operator', shortName: 'Apex', minXp: 5200 }
];

const getId = (value) => String(value?._id || value?.id || value || '');

const SEASON_LENGTH_MONTHS = 2;

const GAME_REWARDS = {
  recruit: { title: 'Starter Badge', reward: '100 Arena Coins', accent: 'slate' },
  bronze: { title: 'Bronze Trail', reward: '250 Arena Coins', accent: 'orange' },
  silver: { title: 'Silver Frame', reward: 'Profile frame unlock', accent: 'zinc' },
  gold: { title: 'Gold Banner', reward: 'Gold banner unlock', accent: 'yellow' },
  platinum: { title: 'Platinum Crest', reward: 'Premium crest unlock', accent: 'cyan' },
  epic: { title: 'Epic Recall', reward: 'Animated arena flair', accent: 'fuchsia' },
  mythic: { title: 'Mythic Crown', reward: 'Mythic profile crown', accent: 'rose' },
  apex: { title: 'Apex Legacy', reward: 'Apex legacy title', accent: 'emerald' }
};

const DEMOTION_MAP = {
  recruit: 'recruit',
  bronze: 'recruit',
  silver: 'bronze',
  gold: 'silver',
  platinum: 'gold',
  epic: 'platinum',
  mythic: 'epic',
  apex: 'mythic'
};

const getGameRank = (xp = 0) => {
  let current = GAME_RANKS[0];
  let next = null;

  for (let index = 0; index < GAME_RANKS.length; index += 1) {
    const rank = GAME_RANKS[index];
    if (xp >= rank.minXp) {
      current = rank;
      next = GAME_RANKS[index + 1] || null;
    }
  }

  const progress = next
    ? Math.min(100, Math.round(((xp - current.minXp) / (next.minXp - current.minXp)) * 100))
    : 100;

  return {
    current,
    next,
    progress,
    xpToNext: next ? Math.max(0, next.minXp - xp) : 0
  };
};

const getSeasonForDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getUTCFullYear();
  const seasonNumber = Math.floor(date.getUTCMonth() / SEASON_LENGTH_MONTHS) + 1;
  const startMonth = (seasonNumber - 1) * SEASON_LENGTH_MONTHS;
  const startDate = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, startMonth + SEASON_LENGTH_MONTHS, 1, 0, 0, 0, 0));

  return {
    id: `${year}-S${seasonNumber}`,
    label: `Season ${seasonNumber} ${year}`,
    seasonNumber,
    year,
    startsAt: startDate.toISOString(),
    endsAt: endDate.toISOString()
  };
};

const getPreviousSeason = (season = getSeasonForDate()) => {
  const start = new Date(season.startsAt);
  start.setUTCDate(start.getUTCDate() - 1);
  return getSeasonForDate(start);
};

const isInSeason = (session, season) => {
  const completedAt = new Date(session.completedAt || session.createdAt || session.startedAt || 0);
  return completedAt >= new Date(season.startsAt) && completedAt < new Date(season.endsAt);
};

const getRankByKey = (key) => GAME_RANKS.find(rank => rank.key === key) || GAME_RANKS[0];
const getDemotedRank = (rank) => getRankByKey(DEMOTION_MAP[rank?.key] || 'recruit');
const getRewardForRank = (rank) => GAME_REWARDS[rank?.key] || GAME_REWARDS.recruit;

const summarizeCompletedSessions = (completed = []) => {
  const totalScore = completed.reduce((sum, session) => sum + (session.score || 0), 0);
  const highScore = completed.reduce((best, session) => Math.max(best, session.score || 0), 0);
  const totalCorrect = completed.reduce((sum, session) => sum + (session.correctCount || 0), 0);
  const totalQuestions = completed.reduce((sum, session) => sum + (session.totalCount || 0), 0);
  const maxStreak = completed.reduce((best, session) => Math.max(best, session.maxStreak || 0), 0);
  const bestAccuracy = completed.reduce((best, session) => {
    const sessionAccuracy = typeof session.accuracy === 'number' && session.accuracy > 0
      ? session.accuracy
      : session.totalCount ? Math.round(((session.correctCount || 0) / session.totalCount) * 100) : 0;
    return Math.max(best, sessionAccuracy);
  }, 0);
  const bestWpm = completed.reduce((best, session) => Math.max(best, session.wpm || 0), 0);
  const fastestMs = completed
    .filter(session => session.elapsedMs > 0)
    .reduce((best, session) => Math.min(best, session.elapsedMs), Number.POSITIVE_INFINITY);
  const rank = getGameRank(highScore);

  return {
    xp: highScore,
    lifetimeScore: totalScore,
    highScore,
    totalPlays: completed.length,
    averageScore: completed.length ? Math.round(totalScore / completed.length) : 0,
    accuracy: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    bestAccuracy,
    bestWpm,
    fastestMs: Number.isFinite(fastestMs) ? fastestMs : 0,
    maxStreak,
    rank: rank.current,
    nextRank: rank.next,
    progress: rank.progress,
    xpToNext: rank.xpToNext
  };
};

const buildGameStats = (sessions = [], options = {}) => {
  const completed = sessions.filter(session => session.completedAt);
  const season = getSeasonForDate(options.now || new Date());
  const previousSeason = getPreviousSeason(season);
  const seasonCompleted = completed.filter(session => isInSeason(session, season));
  const previousSeasonCompleted = completed.filter(session => isInSeason(session, previousSeason));

  const seasonStats = summarizeCompletedSessions(seasonCompleted);
  const previousStats = summarizeCompletedSessions(previousSeasonCompleted);
  const lifetimeStats = summarizeCompletedSessions(completed);
  const resetRank = previousStats.totalPlays ? getDemotedRank(previousStats.rank) : GAME_RANKS[0];
  const seasonRankScore = Math.max(seasonStats.highScore, resetRank.minXp);
  const rank = getGameRank(seasonRankScore);

  return {
    ...seasonStats,
    xp: seasonRankScore,
    seasonScore: seasonRankScore,
    rank: rank.current,
    nextRank: rank.next,
    progress: rank.progress,
    xpToNext: rank.xpToNext,
    highestRank: lifetimeStats.rank,
    highestScore: lifetimeStats.highScore,
    lifetimeScore: lifetimeStats.lifetimeScore,
    lifetimePlays: lifetimeStats.totalPlays,
    previousSeasonRank: previousStats.rank,
    previousSeasonHighScore: previousStats.highScore,
    resetRank,
    season,
    previousSeason,
    rewards: {
      current: getRewardForRank(rank.current),
      previous: getRewardForRank(previousStats.rank)
    }
  };
};

const buildGameLeaderboard = (sessions = []) => {
  const grouped = new Map();

  sessions
    .filter(session => session.completedAt && session.userId)
    .forEach(session => {
      const userId = getId(session.userId);
      if (!grouped.has(userId)) {
        grouped.set(userId, {
          user: session.userId,
          sessions: []
        });
      }
      grouped.get(userId).sessions.push(session);
    });

  return Array.from(grouped.values())
    .map(entry => {
      const stats = buildGameStats(entry.sessions);
      const plainUser = typeof entry.user?.toObject === 'function' ? entry.user.toObject() : entry.user;
      return {
        user: {
          _id: plainUser?._id,
          name: plainUser?.name,
          email: plainUser?.email,
          course: plainUser?.course,
          avatar: plainUser?.avatar
        },
        stats
      };
    })
    .filter(entry => entry.stats.totalPlays > 0)
    .sort((a, b) => {
      if (b.stats.highScore !== a.stats.highScore) return b.stats.highScore - a.stats.highScore;
      if (b.stats.bestAccuracy !== a.stats.bestAccuracy) return b.stats.bestAccuracy - a.stats.bestAccuracy;
      if (b.stats.bestWpm !== a.stats.bestWpm) return b.stats.bestWpm - a.stats.bestWpm;
      if (a.stats.fastestMs !== b.stats.fastestMs) return (a.stats.fastestMs || Number.MAX_SAFE_INTEGER) - (b.stats.fastestMs || Number.MAX_SAFE_INTEGER);
      return String(a.user.name || '').localeCompare(String(b.user.name || ''));
    })
    .map((entry, index) => ({
      ...entry,
      position: index + 1
    }));
};

module.exports = {
  GAME_RANKS,
  GAME_REWARDS,
  buildGameLeaderboard,
  buildGameStats,
  getSeasonForDate
};
