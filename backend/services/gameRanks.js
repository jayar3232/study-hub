const GAME_RANKS = [
  { key: 'recruit', name: 'Arena Recruit', shortName: 'Recruit', minXp: 0 },
  { key: 'iron', name: 'Iron Runner', shortName: 'Iron', minXp: 350 },
  { key: 'bronze', name: 'Bronze Tactician', shortName: 'Bronze', minXp: 750 },
  { key: 'silver', name: 'Silver Shotcaller', shortName: 'Silver', minXp: 1250 },
  { key: 'gold', name: 'Gold Strategist', shortName: 'Gold', minXp: 1900 },
  { key: 'platinum', name: 'Platinum Vanguard', shortName: 'Platinum', minXp: 2700 },
  { key: 'diamond', name: 'Diamond Sentinel', shortName: 'Diamond', minXp: 3600 },
  { key: 'epic', name: 'Epic Commander', shortName: 'Epic', minXp: 4700 },
  { key: 'legend', name: 'Legend Warden', shortName: 'Legend', minXp: 6100 },
  { key: 'mythic', name: 'Mythic Architect', shortName: 'Mythic', minXp: 7800 },
  { key: 'dragon', name: 'Ascendant Vanguard', shortName: 'Ascendant', minXp: 9800 },
  { key: 'inferno', name: 'Immortal Vanguard', shortName: 'Immortal', minXp: 12200 },
  { key: 'celestial', name: 'Celestial Sovereign', shortName: 'Celestial', minXp: 15000 },
  { key: 'apex', name: 'Apex Sovereign', shortName: 'Apex', minXp: 18500 }
];

const getId = (value) => String(value?._id || value?.id || value || '');

const SEASON_LENGTH_MONTHS = 2;
const APEX_STAR_STEP = 2400;

const GAME_REWARDS = {
  recruit: { title: 'Starter Badge', reward: '100 Arena Coins', accent: 'slate' },
  iron: { title: 'Iron Plate', reward: 'Iron profile plate', accent: 'stone' },
  bronze: { title: 'Bronze Trail', reward: '250 Arena Coins', accent: 'orange' },
  silver: { title: 'Silver Frame', reward: 'Profile frame unlock', accent: 'zinc' },
  gold: { title: 'Gold Banner', reward: 'Gold banner unlock', accent: 'yellow' },
  platinum: { title: 'Platinum Crest', reward: 'Premium crest unlock', accent: 'cyan' },
  diamond: { title: 'Diamond Edge', reward: 'Diamond border unlock', accent: 'sky' },
  epic: { title: 'Epic Recall', reward: 'Animated arena flair', accent: 'fuchsia' },
  legend: { title: 'Legend Aura', reward: 'Legend glow aura', accent: 'violet' },
  mythic: { title: 'Mythic Crown', reward: 'Mythic profile crown', accent: 'rose' },
  dragon: { title: 'Ascendant Crest', reward: 'Ascendant rank emblem', accent: 'orange' },
  inferno: { title: 'Immortal Aura', reward: 'Elite glow trail', accent: 'red' },
  celestial: { title: 'Celestial Spark', reward: 'Spark aura unlock', accent: 'amber' },
  apex: { title: 'Sovereign Legacy', reward: 'Apex sovereign title', accent: 'emerald' }
};

const DEMOTION_MAP = {
  recruit: 'recruit',
  iron: 'recruit',
  bronze: 'iron',
  silver: 'bronze',
  gold: 'silver',
  platinum: 'gold',
  diamond: 'platinum',
  epic: 'diamond',
  legend: 'epic',
  mythic: 'legend',
  dragon: 'mythic',
  inferno: 'dragon',
  celestial: 'inferno',
  apex: 'celestial'
};

const getApexStarStats = (xp = 0, starXp = xp) => {
  const apexRank = GAME_RANKS[GAME_RANKS.length - 1];
  if (xp < apexRank.minXp) {
    return {
      apexStars: 0,
      apexStarProgress: 0,
      apexStarXpToNext: apexRank.minXp - xp,
      glowLevel: 0
    };
  }

  const overflow = Math.max(0, starXp - apexRank.minXp);
  const rawStars = Math.floor(overflow / APEX_STAR_STEP) + 1;
  const apexStars = Math.min(99, rawStars);
  const remainder = overflow % APEX_STAR_STEP;

  return {
    apexStars,
    apexStarProgress: Math.round((remainder / APEX_STAR_STEP) * 100),
    apexStarXpToNext: APEX_STAR_STEP - remainder,
    glowLevel: Math.min(10, apexStars)
  };
};

const getGameRank = (xp = 0, starXp = xp) => {
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

  const apexStarStats = getApexStarStats(xp, starXp);
  const currentWithProgress = current.key === 'apex'
    ? { ...current, ...apexStarStats }
    : current;

  return {
    current: currentWithProgress,
    next,
    progress,
    xpToNext: next ? Math.max(0, next.minXp - xp) : 0,
    ...apexStarStats
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
  const rank = getGameRank(highScore, totalScore);

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
    xpToNext: rank.xpToNext,
    apexStars: rank.apexStars,
    apexStarProgress: rank.apexStarProgress,
    apexStarXpToNext: rank.apexStarXpToNext,
    glowLevel: rank.glowLevel
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
  const seasonRankScore = Math.max(seasonStats.lifetimeScore, resetRank.minXp);
  const seasonTotalScore = seasonStats.lifetimeScore;
  const rank = getGameRank(seasonRankScore, Math.max(seasonTotalScore, seasonRankScore));

  return {
    ...seasonStats,
    xp: seasonRankScore,
    seasonScore: seasonRankScore,
    rank: rank.current,
    nextRank: rank.next,
    progress: rank.progress,
    xpToNext: rank.xpToNext,
    seasonTotalScore,
    apexStars: rank.apexStars,
    apexStarProgress: rank.apexStarProgress,
    apexStarXpToNext: rank.apexStarXpToNext,
    glowLevel: rank.glowLevel,
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
      if (b.stats.seasonScore !== a.stats.seasonScore) return b.stats.seasonScore - a.stats.seasonScore;
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
