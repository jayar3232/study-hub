const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/User');
const GameSession = require('../models/GameSession');
const IssueReport = require('../models/IssueReport');
const { GAME_RANKS, buildGameLeaderboard, buildGameStats } = require('../services/gameRanks');

const router = express.Router();

const VALID_DECISIONS = ['execute', 'schedule', 'delegate', 'unblock', 'review'];
const VALID_ISSUE_TYPES = ['problem', 'suggestion'];
const VALID_ISSUE_CATEGORIES = ['bug', 'feature', 'ui', 'performance', 'account', 'workspace', 'messages', 'other'];
const VALID_ISSUE_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const VALID_ISSUE_STATUSES = ['new', 'reviewing', 'approved', 'rejected', 'resolved', 'closed'];
const ROUND_SIZE = 8;
const DURATION_SECONDS = 75;
const DEVELOPER_PASSWORD = process.env.DEVELOPER_ACCESS_PASSWORD || '123!@#';

const clampNumber = (value, min, max, fallback = 0) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
};

const decisionGuide = [
  { key: 'execute', label: 'Execute Now', detail: 'Urgent, high-impact work that should move immediately.' },
  { key: 'schedule', label: 'Schedule Sprint', detail: 'Important work that needs a planned slot.' },
  { key: 'delegate', label: 'Delegate', detail: 'Work best assigned to another owner or role.' },
  { key: 'unblock', label: 'Unblock First', detail: 'Blocked work that needs dependency removal before execution.' },
  { key: 'review', label: 'Review Gate', detail: 'Work that needs QA, approval, or decision validation.' }
];

const challengePool = [
  {
    title: 'Client demo build is failing',
    brief: 'The presentation is in 2 hours and the deployment check is red.',
    priority: 'critical',
    dueInHours: 2,
    estimateHours: 1,
    impact: 'high',
    signal: 'Deadline pressure + live delivery risk',
    correctAnswer: 'execute',
    basePoints: 190
  },
  {
    title: 'Payment copy needs final approval',
    brief: 'The wording is ready, but the owner has not approved the checkout text.',
    priority: 'high',
    dueInHours: 12,
    estimateHours: 1,
    impact: 'high',
    signal: 'Approval needed before release',
    correctAnswer: 'review',
    basePoints: 170
  },
  {
    title: 'Designer is waiting for brand assets',
    brief: 'The landing page cannot continue until the logo package is attached.',
    priority: 'high',
    dueInHours: 24,
    estimateHours: 2,
    impact: 'medium',
    signal: 'Blocked by missing dependency',
    correctAnswer: 'unblock',
    basePoints: 165
  },
  {
    title: 'Database cleanup for old test data',
    brief: 'Useful maintenance, but no current customer-facing deadline.',
    priority: 'low',
    dueInHours: 168,
    estimateHours: 3,
    impact: 'low',
    signal: 'Low urgency maintenance',
    correctAnswer: 'schedule',
    basePoints: 110
  },
  {
    title: 'Video upload compression task',
    brief: 'Needs media expertise and will take a full afternoon to tune.',
    priority: 'medium',
    dueInHours: 72,
    estimateHours: 6,
    impact: 'medium',
    signal: 'Specialized work + larger estimate',
    correctAnswer: 'delegate',
    basePoints: 145
  },
  {
    title: 'Security report needs verification',
    brief: 'A teammate flagged an auth issue, but impact must be confirmed first.',
    priority: 'critical',
    dueInHours: 8,
    estimateHours: 2,
    impact: 'high',
    signal: 'Risky change requiring review',
    correctAnswer: 'review',
    basePoints: 185
  },
  {
    title: 'Unread team messages about launch',
    brief: 'Three people are waiting for a decision on today’s release plan.',
    priority: 'high',
    dueInHours: 4,
    estimateHours: 1,
    impact: 'high',
    signal: 'Team blocked by your decision',
    correctAnswer: 'execute',
    basePoints: 175
  },
  {
    title: 'Analytics dashboard polish',
    brief: 'Nice improvement for next week, but current sprint scope is full.',
    priority: 'medium',
    dueInHours: 120,
    estimateHours: 4,
    impact: 'medium',
    signal: 'Valuable but not urgent',
    correctAnswer: 'schedule',
    basePoints: 130
  },
  {
    title: 'QA checklist assignment',
    brief: 'The checklist is clear and the QA lead has the right context.',
    priority: 'medium',
    dueInHours: 36,
    estimateHours: 3,
    impact: 'medium',
    signal: 'Clear owner fit',
    correctAnswer: 'delegate',
    basePoints: 135
  },
  {
    title: 'Missing API key blocks staging',
    brief: 'The staging server cannot run until environment access is fixed.',
    priority: 'critical',
    dueInHours: 6,
    estimateHours: 1,
    impact: 'high',
    signal: 'Environment dependency blocker',
    correctAnswer: 'unblock',
    basePoints: 185
  },
  {
    title: 'Profile avatar bug report',
    brief: 'Users cannot update avatars after the latest deployment.',
    priority: 'high',
    dueInHours: 18,
    estimateHours: 2,
    impact: 'high',
    signal: 'Active user-facing defect',
    correctAnswer: 'execute',
    basePoints: 175
  },
  {
    title: 'Rewrite onboarding labels',
    brief: 'The copy can improve clarity, but the feature still works today.',
    priority: 'low',
    dueInHours: 96,
    estimateHours: 2,
    impact: 'medium',
    signal: 'Non-blocking improvement',
    correctAnswer: 'schedule',
    basePoints: 115
  }
];

const typingPrompts = [
  'Prioritize the blocker, confirm the owner, and ship the safest fix before the sprint review.',
  'Clear communication turns a confusing bug report into an action plan the whole team can trust.',
  'A strong workspace keeps decisions visible, tasks assigned, and updates easy to verify.',
  'When users report a problem, reproduce it, collect evidence, and explain the next step clearly.',
  'Fast work is useful only when the solution is accurate, stable, and easy for teammates to follow.',
  'The best developer response is calm, specific, and focused on what the member needs next.'
];

const typingSentenceBank = [
  ...typingPrompts,
  'Review the report, confirm the issue, and send a clear update to the member.',
  'A reliable team space keeps deadlines visible and ownership easy to understand.',
  'Before closing a ticket, test the fix and explain the result in simple terms.',
  'Good project flow depends on fast feedback, clean tasks, and responsible decisions.',
  'When the build is ready, check the risky parts before you announce the release.',
  'Invite the right people, assign the next action, and keep the workspace organized.',
  'Strong developers protect user trust by fixing bugs with calm and careful notes.',
  'The dashboard should guide the team toward urgent work without feeling crowded.',
  'A polished profile helps classmates understand your course, campus, and role.',
  'Smooth collaboration feels quiet, fast, and clear even when the project is busy.'
];

const createTypingSentences = (count = 18) => {
  const pool = [...typingSentenceBank];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, Math.min(count, pool.length));
};

const sanitizeText = (value, maxLength) => String(value || '').trim().slice(0, maxLength);

const getDeveloperStatus = async (userId) => {
  const user = await User.findById(userId).select('name email avatar isDeveloper');
  return {
    user,
    isDeveloper: Boolean(user?.isDeveloper)
  };
};

const requireDeveloper = async (req, res) => {
  const { user, isDeveloper } = await getDeveloperStatus(req.user);
  if (!user) {
    res.status(404).json({ msg: 'User not found' });
    return null;
  }
  if (!isDeveloper) {
    res.status(403).json({ msg: 'Developer access required' });
    return null;
  }
  return user;
};

const populateIssue = (query) => query
  .populate('userId', 'name email avatar course')
  .populate('messages.senderId', 'name email avatar');

const canAccessIssue = (issue, userId, isDeveloper) => {
  if (isDeveloper) return true;
  return String(issue.userId?._id || issue.userId) === String(userId);
};

const levenshtein = (a = '', b = '') => {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
};

const scoreTyping = (expected, typed, elapsedMs) => {
  const normalizedExpected = expected.replace(/\s+/g, ' ').trim();
  const normalizedTyped = typed.replace(/\s+/g, ' ').trim();
  const maxLength = Math.max(normalizedExpected.length, normalizedTyped.length, 1);
  const distance = levenshtein(normalizedExpected.toLowerCase(), normalizedTyped.toLowerCase());
  const accuracy = Math.max(0, Math.round((1 - (distance / maxLength)) * 100));
  const minutes = Math.max(elapsedMs / 60000, 0.02);
  const words = normalizedExpected.split(/\s+/).filter(Boolean).length;
  const wpm = Math.max(0, Math.round((words * (accuracy / 100)) / minutes));
  const elapsedSeconds = elapsedMs / 1000;
  const accuracyScore = accuracy * 20;
  const speedScore = Math.min(wpm, 140) * 16;
  const timeBonus = accuracy >= 90 ? Math.max(0, Math.round((60 - elapsedSeconds) * 9)) : 0;
  const perfectBonus = accuracy === 100 ? 500 : 0;
  const score = Math.max(0, Math.round(accuracyScore + speedScore + timeBonus + perfectBonus));

  return { accuracy, wpm, score };
};

const scoreSentenceStream = (expected, typedSentences, elapsedMs) => {
  const expectedSentences = expected.split(/\n+/).map(item => item.trim()).filter(Boolean);
  const cleanTypedSentences = (Array.isArray(typedSentences) ? typedSentences : [])
    .map(sentence => sanitizeText(sentence, 240))
    .filter(Boolean)
    .slice(0, expectedSentences.length);
  let correctCount = 0;
  let currentStreak = 0;
  let maxStreak = 0;

  cleanTypedSentences.forEach((sentence, index) => {
    const cleanSentence = sentence.replace(/\s+/g, ' ').trim().toLowerCase();
    const expectedSentence = expectedSentences[index]?.replace(/\s+/g, ' ').trim().toLowerCase();
    const correct = cleanSentence === expectedSentence;
    if (correct) {
      correctCount += 1;
      currentStreak += 1;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });

  const totalCount = Math.max(cleanTypedSentences.length, 1);
  const accuracy = Math.round((correctCount / totalCount) * 100);
  const minutes = Math.max(elapsedMs / 60000, 0.02);
  const correctWords = cleanTypedSentences.reduce((sum, sentence, index) => {
    const cleanSentence = sentence.replace(/\s+/g, ' ').trim().toLowerCase();
    const expectedSentence = expectedSentences[index]?.replace(/\s+/g, ' ').trim().toLowerCase();
    return cleanSentence === expectedSentence ? sum + sentence.split(/\s+/).filter(Boolean).length : sum;
  }, 0);
  const wpm = Math.max(0, Math.round(correctWords / minutes));
  const score = Math.max(0, Math.round(
    (correctCount * 420)
    + (Math.min(wpm, 140) * 12)
    + (accuracy * 12)
    + (maxStreak * 95)
  ));

  return {
    accuracy,
    wpm,
    score,
    correctCount,
    totalCount,
    maxStreak,
    typedText: cleanTypedSentences.join('\n')
  };
};

const shuffle = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = crypto.randomInt(index + 1);
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
};

const publicChallenge = (challenge) => ({
  challengeId: challenge.challengeId,
  title: challenge.title,
  brief: challenge.brief,
  priority: challenge.priority,
  dueInHours: challenge.dueInHours,
  estimateHours: challenge.estimateHours,
  impact: challenge.impact,
  signal: challenge.signal,
  basePoints: challenge.basePoints
});

const createChallenges = () => shuffle(challengePool)
  .slice(0, ROUND_SIZE)
  .map(challenge => ({
    ...challenge,
    challengeId: crypto.randomUUID()
  }));

const scoreSession = (session, submittedAnswers, now) => {
  const answerMap = new Map(
    (Array.isArray(submittedAnswers) ? submittedAnswers : [])
      .map(item => [String(item.challengeId), VALID_DECISIONS.includes(item.answer) ? item.answer : ''])
  );

  let score = 0;
  let correctCount = 0;
  let currentStreak = 0;
  let maxStreak = 0;

  const answers = session.challenges.map(challenge => {
    const answer = answerMap.get(challenge.challengeId) || 'timeout';
    const correct = answer === challenge.correctAnswer;
    let points = 0;

    if (correct) {
      currentStreak += 1;
      maxStreak = Math.max(maxStreak, currentStreak);
      correctCount += 1;
      points = challenge.basePoints + (currentStreak * 18);
      score += points;
    } else {
      currentStreak = 0;
    }

    return {
      challengeId: challenge.challengeId,
      answer,
      correct,
      points
    };
  });

  const elapsedMs = Math.max(0, now.getTime() - session.startedAt.getTime());
  const elapsedSeconds = elapsedMs / 1000;
  const speedBonus = Math.max(0, Math.round((session.durationSeconds - elapsedSeconds) * 4));

  return {
    answers,
    score: Math.max(0, Math.round(score + speedBonus)),
    correctCount,
    totalCount: session.challenges.length,
    maxStreak,
    elapsedMs
  };
};

const createCompletedGameSession = async ({
  userId,
  gameKey,
  title,
  brief,
  signal,
  score,
  accuracy = 0,
  correctCount = 0,
  totalCount = 1,
  maxStreak = 0,
  elapsedMs = 1000
}) => {
  const now = new Date();
  const challengeId = crypto.randomUUID();
  const safeElapsedMs = clampNumber(elapsedMs, 1000, 60 * 60 * 1000, 1000);

  const session = new GameSession({
    userId,
    gameKey,
    durationSeconds: Math.max(1, Math.ceil(safeElapsedMs / 1000)),
    challenges: [{
      challengeId,
      title,
      brief,
      priority: 'medium',
      dueInHours: 1,
      estimateHours: 1,
      impact: 'medium',
      signal,
      correctAnswer: 'score',
      basePoints: score
    }],
    answers: [{
      challengeId,
      answer: `score:${score}`,
      correct: true,
      points: score
    }],
    score,
    accuracy,
    correctCount,
    totalCount,
    maxStreak,
    elapsedMs: safeElapsedMs,
    startedAt: new Date(now.getTime() - safeElapsedMs),
    expiresAt: now,
    completedAt: now
  });

  await session.save();
  return session;
};

const developerContributionScore = {
  reviewing: 180,
  approved: 520,
  rejected: 360,
  resolved: 650,
  closed: 260,
  reply: 140
};

const recordDeveloperContribution = async ({ userId, issue, action, detail }) => {
  const score = developerContributionScore[action] || 160;
  await createCompletedGameSession({
    userId,
    gameKey: 'developer-review',
    title: action === 'reply' ? 'Developer Response' : 'Developer Review',
    brief: action === 'reply'
      ? 'Responded to a member report with a developer follow-up.'
      : 'Reviewed a member report and updated the developer decision.',
    signal: detail || `Report: ${issue?.title || 'Member report'}. Status: ${issue?.status || action}.`,
    score,
    accuracy: 100,
    correctCount: 1,
    totalCount: 1,
    maxStreak: 1,
    elapsedMs: 2200
  });
};

router.get('/summary/me', auth, async (req, res) => {
  try {
    const [
      mySessions,
      leaderboardSessions,
      myTypingSessions,
      typingLeaderboardSessions,
      myBlockSessions,
      blockLeaderboardSessions,
      myBugHuntSessions,
      bugHuntLeaderboardSessions,
      myFocusFlowSessions,
      focusFlowLeaderboardSessions,
      myFlappySessions,
      flappyLeaderboardSessions
    ] = await Promise.all([
      GameSession.find({ userId: req.user, completedAt: { $ne: null } }).lean(),
      GameSession.find({ completedAt: { $ne: null } })
        .populate('userId', 'name email course avatar')
        .sort({ score: -1 })
        .limit(300),
      GameSession.find({ userId: req.user, gameKey: 'typing-sprint', completedAt: { $ne: null } }).lean(),
      GameSession.find({ gameKey: 'typing-sprint', completedAt: { $ne: null } })
        .populate('userId', 'name email course avatar')
        .sort({ score: -1 })
        .limit(300),
      GameSession.find({ userId: req.user, gameKey: 'block-stack', completedAt: { $ne: null } }).lean(),
      GameSession.find({ gameKey: 'block-stack', completedAt: { $ne: null } })
        .populate('userId', 'name email course avatar')
        .sort({ score: -1 })
        .limit(300),
      GameSession.find({ userId: req.user, gameKey: 'bug-hunt', completedAt: { $ne: null } }).lean(),
      GameSession.find({ gameKey: 'bug-hunt', completedAt: { $ne: null } })
        .populate('userId', 'name email course avatar')
        .sort({ score: -1 })
        .limit(300),
      GameSession.find({ userId: req.user, gameKey: 'focus-flow', completedAt: { $ne: null } }).lean(),
      GameSession.find({ gameKey: 'focus-flow', completedAt: { $ne: null } })
        .populate('userId', 'name email course avatar')
        .sort({ score: -1 })
        .limit(300),
      GameSession.find({ userId: req.user, gameKey: 'flappy-bird', completedAt: { $ne: null } }).lean(),
      GameSession.find({ gameKey: 'flappy-bird', completedAt: { $ne: null } })
        .populate('userId', 'name email course avatar')
        .sort({ score: -1 })
        .limit(300)
    ]);

    const leaderboard = buildGameLeaderboard(leaderboardSessions);
    const typingLeaderboard = buildGameLeaderboard(typingLeaderboardSessions);
    const blockLeaderboard = buildGameLeaderboard(blockLeaderboardSessions);
    const bugHuntLeaderboard = buildGameLeaderboard(bugHuntLeaderboardSessions);
    const focusFlowLeaderboard = buildGameLeaderboard(focusFlowLeaderboardSessions);
    const flappyLeaderboard = buildGameLeaderboard(flappyLeaderboardSessions);
    const myRank = leaderboard.find(entry => String(entry.user._id) === String(req.user)) || null;
    const myTypingRank = typingLeaderboard.find(entry => String(entry.user._id) === String(req.user)) || null;
    const myBlockRank = blockLeaderboard.find(entry => String(entry.user._id) === String(req.user)) || null;
    const myBugHuntRank = bugHuntLeaderboard.find(entry => String(entry.user._id) === String(req.user)) || null;
    const myFocusFlowRank = focusFlowLeaderboard.find(entry => String(entry.user._id) === String(req.user)) || null;
    const myFlappyRank = flappyLeaderboard.find(entry => String(entry.user._id) === String(req.user)) || null;

    res.json({
      stats: buildGameStats(mySessions),
      typingStats: buildGameStats(myTypingSessions),
      blockStats: buildGameStats(myBlockSessions),
      bugHuntStats: buildGameStats(myBugHuntSessions),
      focusFlowStats: buildGameStats(myFocusFlowSessions),
      flappyStats: buildGameStats(myFlappySessions),
      leaderboard: leaderboard.slice(0, 15),
      typingLeaderboard: typingLeaderboard.slice(0, 15),
      blockLeaderboard: blockLeaderboard.slice(0, 15),
      bugHuntLeaderboard: bugHuntLeaderboard.slice(0, 15),
      focusFlowLeaderboard: focusFlowLeaderboard.slice(0, 15),
      flappyLeaderboard: flappyLeaderboard.slice(0, 15),
      myRank,
      myTypingRank,
      myBlockRank,
      myBugHuntRank,
      myFocusFlowRank,
      myFlappyRank,
      ranks: GAME_RANKS,
      decisions: decisionGuide
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/developers/me', auth, async (req, res) => {
  try {
    const { user, isDeveloper } = await getDeveloperStatus(req.user);
    res.json({
      isDeveloper,
      user: user ? {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isDeveloper
      } : null
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/developers/access', auth, async (req, res) => {
  try {
    if (req.body.password !== DEVELOPER_PASSWORD) {
      return res.status(403).json({ msg: 'Invalid developer password' });
    }

    const user = await User.findByIdAndUpdate(req.user, { isDeveloper: true }, { new: true })
      .select('name email avatar isDeveloper');

    res.json({
      msg: 'Developer access granted',
      isDeveloper: true,
      user
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/fix-arena/issues', auth, async (req, res) => {
  try {
    const { user, isDeveloper } = await getDeveloperStatus(req.user);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const issues = await populateIssue(
      IssueReport.find(isDeveloper ? {} : { userId: req.user }).sort({ updatedAt: -1 }).limit(100)
    );
    res.json({ issues, isDeveloper, developerOnly: isDeveloper });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/fix-arena/issues', auth, async (req, res) => {
  try {
    const { user, isDeveloper } = await getDeveloperStatus(req.user);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (isDeveloper) {
      return res.status(403).json({ msg: 'Developers cannot submit member reports' });
    }

    const title = sanitizeText(req.body.title, 140);
    const details = sanitizeText(req.body.details, 2500);
    if (!title || !details) return res.status(400).json({ msg: 'Title and details are required' });

    const type = VALID_ISSUE_TYPES.includes(req.body.type) ? req.body.type : 'problem';
    const category = VALID_ISSUE_CATEGORIES.includes(req.body.category) ? req.body.category : 'other';
    const severity = VALID_ISSUE_SEVERITIES.includes(req.body.severity) ? req.body.severity : 'medium';
    const expected = sanitizeText(req.body.expected, 1200);
    const workspaceName = sanitizeText(req.body.workspaceName, 120);

    const issue = await IssueReport.create({
      userId: req.user,
      type,
      category,
      severity,
      title,
      details,
      expected,
      workspaceName,
      messages: [{
        senderId: req.user,
        role: 'member',
        text: 'Submitted this report for developer review.'
      }]
    });

    const populatedIssue = await populateIssue(IssueReport.findById(issue._id));

    res.status(201).json({
      msg: 'Report submitted to developers',
      issueId: issue._id,
      status: issue.status,
      issue: populatedIssue
    });
  } catch (err) {
    console.error('Issue report submit failed:', err);
    res.status(500).json({ msg: err.message });
  }
});

router.put('/fix-arena/issues/:issueId/status', auth, async (req, res) => {
  try {
    const developer = await requireDeveloper(req, res);
    if (!developer) return;
    if (!mongoose.Types.ObjectId.isValid(req.params.issueId)) return res.status(404).json({ msg: 'Report not found' });
    const status = VALID_ISSUE_STATUSES.includes(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ msg: 'Invalid status' });

    const issue = await IssueReport.findById(req.params.issueId);
    if (!issue) return res.status(404).json({ msg: 'Report not found' });

    issue.status = status;
    issue.messages.push({
      senderId: req.user,
      role: 'developer',
      text: `Status changed to ${status}.`
    });
    await issue.save();
    await recordDeveloperContribution({
      userId: req.user,
      issue,
      action: status,
      detail: `Set "${issue.title}" to ${status}.`
    }).catch(err => console.warn('Developer contribution score failed:', err.message));

    res.json(await populateIssue(IssueReport.findById(issue._id)));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/fix-arena/issues/:issueId/messages', auth, async (req, res) => {
  try {
    const { user, isDeveloper } = await getDeveloperStatus(req.user);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (!mongoose.Types.ObjectId.isValid(req.params.issueId)) return res.status(404).json({ msg: 'Report not found' });
    const text = sanitizeText(req.body.text, 1500);
    if (!text) return res.status(400).json({ msg: 'Message is required' });

    const issue = await IssueReport.findById(req.params.issueId);
    if (!issue) return res.status(404).json({ msg: 'Report not found' });
    if (!canAccessIssue(issue, req.user, isDeveloper)) {
      return res.status(403).json({ msg: 'Not authorized to message this report' });
    }

    issue.messages.push({
      senderId: req.user,
      role: isDeveloper ? 'developer' : 'member',
      text
    });
    if (isDeveloper && issue.status === 'new') issue.status = 'reviewing';
    await issue.save();
    if (isDeveloper) {
      await recordDeveloperContribution({
        userId: req.user,
        issue,
        action: 'reply',
        detail: `Replied to "${issue.title}".`
      }).catch(err => console.warn('Developer reply score failed:', err.message));
    }

    res.json(await populateIssue(IssueReport.findById(issue._id)));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/typing-sprint/start', auth, async (req, res) => {
  try {
    const startedAt = new Date();
    const sentences = createTypingSentences();
    const prompt = sentences.join('\n');
    const session = new GameSession({
      userId: req.user,
      gameKey: 'typing-sprint',
      durationSeconds: 75,
      challenges: [{
        challengeId: crypto.randomUUID(),
        title: 'Typing Sprint',
        brief: prompt,
        priority: 'medium',
        dueInHours: 1,
        estimateHours: 1,
        impact: 'medium',
        signal: 'Type each sentence accurately and quickly before the timer ends.',
        correctAnswer: prompt,
        basePoints: 100
      }],
      totalCount: 1,
      startedAt,
      expiresAt: new Date(startedAt.getTime() + 85000)
    });

    await session.save();
    res.status(201).json({
      sessionId: session._id,
      prompt,
      sentences,
      mode: 'sentence-stream',
      durationSeconds: 75,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/typing-sprint/:sessionId/submit', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
      return res.status(404).json({ msg: 'Typing session not found' });
    }

    const session = await GameSession.findOne({ _id: req.params.sessionId, userId: req.user, gameKey: 'typing-sprint' });
    if (!session) return res.status(404).json({ msg: 'Typing session not found' });
    if (session.completedAt) return res.status(400).json({ msg: 'Typing session already submitted' });

    const now = new Date();
    if (now > session.expiresAt) return res.status(400).json({ msg: 'Typing session expired' });

    const typedText = sanitizeText(req.body.text, 2000);
    const expected = session.challenges[0].correctAnswer;
    const elapsedMs = Math.max(1000, now.getTime() - session.startedAt.getTime());
    const isSentenceStream = req.body.mode === 'sentence-stream' && Array.isArray(req.body.typedSentences);
    const scored = isSentenceStream
      ? scoreSentenceStream(expected, req.body.typedSentences, elapsedMs)
      : scoreTyping(expected, typedText, elapsedMs);
    const answerText = isSentenceStream ? scored.typedText : typedText;

    session.answers = [{
      challengeId: session.challenges[0].challengeId,
      answer: answerText || 'blank',
      correct: isSentenceStream ? scored.correctCount > 0 : scored.accuracy === 100,
      points: scored.score
    }];
    session.score = scored.score;
    session.accuracy = scored.accuracy;
    session.wpm = scored.wpm;
    session.correctCount = isSentenceStream ? scored.correctCount : (scored.accuracy === 100 ? 1 : 0);
    session.totalCount = isSentenceStream ? scored.totalCount : 1;
    session.maxStreak = isSentenceStream ? scored.maxStreak : (scored.accuracy === 100 ? 1 : 0);
    session.elapsedMs = elapsedMs;
    session.completedAt = now;
    await session.save();

    const myTypingSessions = await GameSession.find({ userId: req.user, gameKey: 'typing-sprint', completedAt: { $ne: null } }).lean();

    res.json({
      result: {
        sessionId: session._id,
        score: session.score,
        accuracy: scored.accuracy,
        wpm: scored.wpm,
        elapsedMs,
        expected,
        correctCount: session.correctCount,
        totalCount: session.totalCount,
        maxStreak: session.maxStreak
      },
      stats: buildGameStats(myTypingSessions)
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/block-stack/submit', auth, async (req, res) => {
  try {
    const score = clampNumber(req.body.score, 0, 1000000);
    if (score <= 0) return res.status(400).json({ msg: 'Score must be greater than zero' });

    const moves = clampNumber(req.body.moves, 1, 1000, 1);
    const linesCleared = clampNumber(req.body.linesCleared, 0, 500);
    const maxCombo = clampNumber(req.body.maxCombo, 0, 100);
    const boardFill = clampNumber(req.body.boardFill, 0, 100);
    const elapsedMs = clampNumber(req.body.durationMs, 1000, 60 * 60 * 1000, 1000);
    const now = new Date();
    const challengeId = crypto.randomUUID();

    const session = new GameSession({
      userId: req.user,
      gameKey: 'block-stack',
      durationSeconds: Math.max(1, Math.ceil(elapsedMs / 1000)),
      challenges: [{
        challengeId,
        title: 'WorkGrid Blocks',
        brief: 'Place work cards, clear sprint lanes, and keep the project board open.',
        priority: 'medium',
        dueInHours: 1,
        estimateHours: 1,
        impact: 'medium',
        signal: `Moves: ${moves}. Lines cleared: ${linesCleared}. Board fill: ${boardFill}%.`,
        correctAnswer: 'score',
        basePoints: score
      }],
      answers: [{
        challengeId,
        answer: `score:${score}`,
        correct: true,
        points: score
      }],
      score,
      accuracy: boardFill,
      correctCount: linesCleared,
      totalCount: moves,
      maxStreak: maxCombo,
      elapsedMs,
      startedAt: new Date(now.getTime() - elapsedMs),
      expiresAt: now,
      completedAt: now
    });

    await session.save();

    const [mySessions, myBlockSessions] = await Promise.all([
      GameSession.find({ userId: req.user, completedAt: { $ne: null } }).lean(),
      GameSession.find({ userId: req.user, gameKey: 'block-stack', completedAt: { $ne: null } }).lean()
    ]);

    res.status(201).json({
      result: {
        sessionId: session._id,
        score,
        moves,
        linesCleared,
        maxCombo,
        boardFill,
        elapsedMs
      },
      stats: buildGameStats(mySessions),
      blockStats: buildGameStats(myBlockSessions)
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/bug-hunt/submit', auth, async (req, res) => {
  try {
    const score = clampNumber(req.body.score, 0, 1000000);
    if (score <= 0) return res.status(400).json({ msg: 'Score must be greater than zero' });

    const foundCount = clampNumber(req.body.foundCount, 0, 50);
    const totalCount = clampNumber(req.body.totalCount, 1, 50, 1);
    const mistakes = clampNumber(req.body.mistakes, 0, 200);
    const accuracy = clampNumber(req.body.accuracy, 0, 100);
    const secondsLeft = clampNumber(req.body.secondsLeft, 0, 300);
    const elapsedMs = clampNumber((45 - secondsLeft) * 1000, 1000, 45 * 1000, 1000);

    const session = await createCompletedGameSession({
      userId: req.user,
      gameKey: 'bug-hunt',
      title: 'Bug Hunt',
      brief: 'Find UI and workflow issues in a simulated workspace screen.',
      signal: `Found ${foundCount}/${totalCount}. Mistakes: ${mistakes}. Seconds left: ${secondsLeft}.`,
      score,
      accuracy,
      correctCount: foundCount,
      totalCount,
      maxStreak: foundCount,
      elapsedMs
    });

    const [mySessions, myBugHuntSessions] = await Promise.all([
      GameSession.find({ userId: req.user, completedAt: { $ne: null } }).lean(),
      GameSession.find({ userId: req.user, gameKey: 'bug-hunt', completedAt: { $ne: null } }).lean()
    ]);

    res.status(201).json({
      result: {
        sessionId: session._id,
        score,
        foundCount,
        totalCount,
        mistakes,
        accuracy,
        elapsedMs
      },
      stats: buildGameStats(mySessions),
      bugHuntStats: buildGameStats(myBugHuntSessions)
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/focus-flow/submit', auth, async (req, res) => {
  try {
    const score = clampNumber(req.body.score, 0, 1000000);
    if (score <= 0) return res.status(400).json({ msg: 'Score must be greater than zero' });

    const hits = clampNumber(req.body.hits, 0, 1000);
    const total = clampNumber(req.body.total, 1, 1000, 1);
    const perfects = clampNumber(req.body.perfects, 0, 1000);
    const bestStreak = clampNumber(req.body.bestStreak, 0, 1000);
    const accuracy = clampNumber(req.body.accuracy, 0, 100);
    const misses = clampNumber(req.body.misses, 0, 1000);
    const elapsedMs = clampNumber(req.body.elapsedMs || (total * 1800), 1000, 20 * 60 * 1000, 1000);

    const session = await createCompletedGameSession({
      userId: req.user,
      gameKey: 'focus-flow',
      title: 'Focus Flow',
      brief: 'Lock the moving signal inside the focus window with accurate timing.',
      signal: `Hits ${hits}/${total}. Perfect hits: ${perfects}. Best streak: ${bestStreak}.`,
      score,
      accuracy,
      correctCount: hits,
      totalCount: total,
      maxStreak: bestStreak,
      elapsedMs
    });

    const [mySessions, myFocusFlowSessions] = await Promise.all([
      GameSession.find({ userId: req.user, completedAt: { $ne: null } }).lean(),
      GameSession.find({ userId: req.user, gameKey: 'focus-flow', completedAt: { $ne: null } }).lean()
    ]);

    res.status(201).json({
      result: {
        sessionId: session._id,
        score,
        hits,
        total,
        perfects,
        bestStreak,
        misses,
        accuracy,
        elapsedMs
      },
      stats: buildGameStats(mySessions),
      focusFlowStats: buildGameStats(myFocusFlowSessions)
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/flappy-bird/submit', auth, async (req, res) => {
  try {
    const score = clampNumber(req.body.score, 0, 1000000);
    if (score <= 0) return res.status(400).json({ msg: 'Score must be greater than zero' });

    const pipesPassed = clampNumber(req.body.pipesPassed, 0, 1000);
    const elapsedMs = clampNumber(req.body.elapsedMs, 1000, 20 * 60 * 1000, 1000);
    const accuracy = clampNumber(70 + Math.min(30, pipesPassed * 2), 0, 100);

    const session = await createCompletedGameSession({
      userId: req.user,
      gameKey: 'flappy-bird',
      title: 'Flappy Scholar',
      brief: 'Tap through study gates and keep the scholar flying.',
      signal: `Passed ${pipesPassed} gates. Flight time: ${(elapsedMs / 1000).toFixed(1)}s.`,
      score,
      accuracy,
      correctCount: pipesPassed,
      totalCount: Math.max(1, pipesPassed),
      maxStreak: pipesPassed,
      elapsedMs
    });

    const [mySessions, myFlappySessions] = await Promise.all([
      GameSession.find({ userId: req.user, completedAt: { $ne: null } }).lean(),
      GameSession.find({ userId: req.user, gameKey: 'flappy-bird', completedAt: { $ne: null } }).lean()
    ]);

    res.status(201).json({
      result: {
        sessionId: session._id,
        score,
        pipesPassed,
        accuracy,
        elapsedMs
      },
      stats: buildGameStats(mySessions),
      flappyStats: buildGameStats(myFlappySessions)
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/ops-arena/start', auth, async (req, res) => {
  try {
    const startedAt = new Date();
    const session = new GameSession({
      userId: req.user,
      durationSeconds: DURATION_SECONDS,
      challenges: createChallenges(),
      totalCount: ROUND_SIZE,
      startedAt,
      expiresAt: new Date(startedAt.getTime() + (DURATION_SECONDS + 15) * 1000)
    });

    await session.save();

    res.status(201).json({
      sessionId: session._id,
      gameKey: session.gameKey,
      durationSeconds: session.durationSeconds,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      decisions: decisionGuide,
      challenges: session.challenges.map(publicChallenge)
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/ops-arena/:sessionId/submit', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
      return res.status(404).json({ msg: 'Game session not found' });
    }

    const session = await GameSession.findOne({ _id: req.params.sessionId, userId: req.user });
    if (!session) return res.status(404).json({ msg: 'Game session not found' });
    if (session.completedAt) return res.status(400).json({ msg: 'Game session already submitted' });

    const now = new Date();
    if (now > session.expiresAt) {
      session.completedAt = now;
      session.elapsedMs = Math.max(0, now.getTime() - session.startedAt.getTime());
      session.answers = [];
      session.score = 0;
      session.correctCount = 0;
      session.maxStreak = 0;
      await session.save();
      return res.status(400).json({
        msg: 'Game session expired',
        result: {
          sessionId: session._id,
          score: 0,
          correctCount: 0,
          totalCount: session.challenges.length,
          maxStreak: 0,
          elapsedMs: session.elapsedMs,
          answers: []
        }
      });
    }

    const result = scoreSession(session, req.body.answers, now);
    session.answers = result.answers;
    session.score = result.score;
    session.correctCount = result.correctCount;
    session.totalCount = result.totalCount;
    session.maxStreak = result.maxStreak;
    session.elapsedMs = result.elapsedMs;
    session.completedAt = now;
    await session.save();

    const mySessions = await GameSession.find({ userId: req.user, completedAt: { $ne: null } }).lean();

    res.json({
      result: {
        sessionId: session._id,
        score: session.score,
        correctCount: session.correctCount,
        totalCount: session.totalCount,
        maxStreak: session.maxStreak,
        elapsedMs: session.elapsedMs,
        answers: session.answers
      },
      stats: buildGameStats(mySessions)
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
