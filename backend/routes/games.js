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

router.get('/summary/me', auth, async (req, res) => {
  try {
    const [mySessions, leaderboardSessions, myTypingSessions, typingLeaderboardSessions] = await Promise.all([
      GameSession.find({ userId: req.user, completedAt: { $ne: null } }).lean(),
      GameSession.find({ completedAt: { $ne: null } })
        .populate('userId', 'name email course avatar')
        .sort({ score: -1 })
        .limit(300),
      GameSession.find({ userId: req.user, gameKey: 'typing-sprint', completedAt: { $ne: null } }).lean(),
      GameSession.find({ gameKey: 'typing-sprint', completedAt: { $ne: null } })
        .populate('userId', 'name email course avatar')
        .sort({ score: -1 })
        .limit(300)
    ]);

    const leaderboard = buildGameLeaderboard(leaderboardSessions);
    const typingLeaderboard = buildGameLeaderboard(typingLeaderboardSessions);
    const myRank = leaderboard.find(entry => String(entry.user._id) === String(req.user)) || null;
    const myTypingRank = typingLeaderboard.find(entry => String(entry.user._id) === String(req.user)) || null;

    res.json({
      stats: buildGameStats(mySessions),
      typingStats: buildGameStats(myTypingSessions),
      leaderboard: leaderboard.slice(0, 15),
      typingLeaderboard: typingLeaderboard.slice(0, 15),
      myRank,
      myTypingRank,
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
    const { isDeveloper } = await getDeveloperStatus(req.user);
    if (!isDeveloper) {
      return res.json({ issues: [], isDeveloper, developerOnly: true });
    }

    const issues = await populateIssue(
      IssueReport.find({}).sort({ updatedAt: -1 }).limit(100)
    );
    res.json({ issues, isDeveloper, developerOnly: true });
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

    res.status(201).json({
      msg: 'Report submitted to developers',
      issueId: issue._id,
      status: issue.status
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

    res.json(await populateIssue(IssueReport.findById(issue._id)));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/fix-arena/issues/:issueId/messages', auth, async (req, res) => {
  try {
    const developer = await requireDeveloper(req, res);
    if (!developer) return;
    if (!mongoose.Types.ObjectId.isValid(req.params.issueId)) return res.status(404).json({ msg: 'Report not found' });
    const text = sanitizeText(req.body.text, 1500);
    if (!text) return res.status(400).json({ msg: 'Message is required' });

    const issue = await IssueReport.findById(req.params.issueId);
    if (!issue) return res.status(404).json({ msg: 'Report not found' });

    issue.messages.push({
      senderId: req.user,
      role: 'developer',
      text
    });
    if (issue.status === 'new') issue.status = 'reviewing';
    await issue.save();

    res.json(await populateIssue(IssueReport.findById(issue._id)));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/typing-sprint/start', auth, async (req, res) => {
  try {
    const startedAt = new Date();
    const prompt = typingPrompts[crypto.randomInt(typingPrompts.length)];
    const session = new GameSession({
      userId: req.user,
      gameKey: 'typing-sprint',
      durationSeconds: 60,
      challenges: [{
        challengeId: crypto.randomUUID(),
        title: 'Typing Sprint',
        brief: prompt,
        priority: 'medium',
        dueInHours: 1,
        estimateHours: 1,
        impact: 'medium',
        signal: 'Type the prompt as accurately and quickly as possible.',
        correctAnswer: prompt,
        basePoints: 100
      }],
      totalCount: 1,
      startedAt,
      expiresAt: new Date(startedAt.getTime() + 90000)
    });

    await session.save();
    res.status(201).json({
      sessionId: session._id,
      prompt,
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

    const typedText = sanitizeText(req.body.text, 1000);
    const expected = session.challenges[0].correctAnswer;
    const elapsedMs = Math.max(1000, now.getTime() - session.startedAt.getTime());
    const scored = scoreTyping(expected, typedText, elapsedMs);

    session.answers = [{
      challengeId: session.challenges[0].challengeId,
      answer: typedText || 'blank',
      correct: scored.accuracy === 100,
      points: scored.score
    }];
    session.score = scored.score;
    session.accuracy = scored.accuracy;
    session.wpm = scored.wpm;
    session.correctCount = scored.accuracy === 100 ? 1 : 0;
    session.totalCount = 1;
    session.maxStreak = scored.accuracy === 100 ? 1 : 0;
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
        expected
      },
      stats: buildGameStats(myTypingSessions)
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
